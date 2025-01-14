import type { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import type { IEventBus } from 'aws-cdk-lib/aws-events';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import {
	Choice,
	Condition,
	CustomState,
	DefinitionBody,
	Fail,
	StateMachine,
	Succeed,
	TaskInput,
	Wait,
	WaitTime,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import type { DataStore } from './datastore';

type RecipesReindexProps = {
	dataStore: DataStore;
	contentUrlBase: string;
	reindexBatchSize: number;
	reindexWaitTime: number;
	eventBus: IEventBus;
};

export class RecipesReindex extends Construct {
	constructor(
		scope: GuStack,
		id: string,
		{
			dataStore,
			contentUrlBase,
			reindexBatchSize,
			reindexWaitTime,
			eventBus,
		}: RecipesReindexProps,
	) {
		super(scope, id);

		const appBase = 'recipes-reindex';
		const lambdaFileName = `${appBase}.zip`;

		const snapshotBucket = new Bucket(this, 'reindexSnapshotBucket', {
			bucketName: `recipes-backend-reindex-snapshots-${scope.stage.toLowerCase()}`,
			enforceSSL: true,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		const snapshotRecipeIndex = new GuLambdaFunction(
			scope,
			'SnapshotRecipeIndexLambda',
			{
				app: `${appBase}-snapshot-recipe-index`,
				description: 'Store a snapshot of the current recipe index in S3',
				fileName: lambdaFileName,
				handler: 'main.snapshotRecipeIndexHandler',
				functionName: `${appBase}-snapshot-recipe-index-${scope.stage}`,
				runtime: Runtime.NODEJS_20_X,
				initialPolicy: [
					new PolicyStatement({
						effect: Effect.ALLOW,
						actions: ['s3:PutObject'],
						resources: [snapshotBucket.bucketArn + '/*'],
					}),
					new PolicyStatement({
						effect: Effect.ALLOW,
						actions: ['dynamodb:Scan', 'dynamodb:Query'],
						resources: [
							dataStore.table.tableArn,
							dataStore.table.tableArn + '/index/*',
						],
					}),
				],
				environment: {
					CONTENT_URL_BASE: contentUrlBase,
					RECIPE_INDEX_SNAPSHOT_BUCKET: snapshotBucket.bucketName,
					INDEX_TABLE: dataStore.table.tableName,
					LAST_UPDATED_INDEX: dataStore.lastUpdatedIndexName,
				},
				architecture: Architecture.ARM_64,
				timeout: Duration.seconds(30),
				memorySize: 128,
			},
		);

		const writeBatchToReindexQueue = new GuLambdaFunction(
			scope,
			'WriteBatchToReindexQueueLambda',
			{
				app: `${appBase}-write-batch-to-index-queue`,
				description: 'Write a batch of recipe ids to the reindex queue',
				fileName: lambdaFileName,
				handler: 'main.writeBatchToReindexQueueHandler',
				functionName: `${appBase}-write-batch-to-reindex-queue-${scope.stage}`,
				runtime: Runtime.NODEJS_20_X,
				initialPolicy: [
					new PolicyStatement({
						effect: Effect.ALLOW,
						actions: ['s3:GetObject'],
						resources: [snapshotBucket.bucketArn + '/*'],
					}),
					new PolicyStatement({
						effect: Effect.ALLOW,
						actions: ['events:PutEvents'],
						resources: [eventBus.eventBusArn],
					}),
					new PolicyStatement({
						effect: Effect.ALLOW,
						resources: ['*'],
						actions: ['cloudwatch:PutMetricData'],
					}),
				],
				environment: {
					RECIPE_INDEX_SNAPSHOT_BUCKET: snapshotBucket.bucketName,
					REINDEX_BATCH_SIZE: reindexBatchSize.toString(),
					OUTGOING_EVENT_BUS: eventBus.eventBusName,
				},
				architecture: Architecture.ARM_64,
				timeout: Duration.seconds(30),
				memorySize: 128,
			},
		);

		// Necessary to reference `dryRun` later in the step fn.
		const storeDryRun = new CustomState(scope, 'storeDryRun', {
			stateJson: {
				Type: 'Pass',
				Assign: {
					'dryRun.$': '$.dryRun',
				},
			},
		});

		const checkForOtherRunningReindexesTask = new CustomState(
			scope,
			'checkForOtherRunningTasks',
			{
				stateJson: {
					Type: 'Task',
					Parameters: {
						StatusFilter: 'RUNNING',
						// The ARN of the running state machine
						'StateMachineArn.$': '$$.StateMachine.Id',
					},
					Resource: 'arn:aws:states:::aws-sdk:sfn:listExecutions',
				},
			},
		);

		const snapshotOrderedIndexTask = new LambdaInvoke(
			this,
			'SnapshotOrderedIndexTask',
			{
				lambdaFunction: snapshotRecipeIndex,
				payload: TaskInput.fromObject({
					'executionId.$': '$$.Execution.Name',
				}),
			},
		);

		const writeBatchToReindexQueueTask = new LambdaInvoke(
			this,
			'WriteBatchToReindexQueueTask',
			{
				lambdaFunction: writeBatchToReindexQueue,
				inputPath: '$.Payload',
				payload: TaskInput.fromObject({
					'input.$': '$',
					'dryRun.$': '$dryRun',
				}),
			},
		);

		const waitForThroughputAndWriteNextBatch = new Wait(
			scope,
			'WaitForThroughPut',
			{
				time: WaitTime.duration(Duration.seconds(reindexWaitTime)),
			},
		).next(writeBatchToReindexQueueTask);

		const isReindexComplete = new Choice(this, 'IsReindexComplete')
			.when(
				Condition.numberGreaterThanJsonPath(
					'$.Payload.nextIndex',
					'$.Payload.lastIndex',
				),
				new Succeed(this, 'Reindex complete'),
			)
			.otherwise(waitForThroughputAndWriteNextBatch);

		snapshotOrderedIndexTask
			.next(writeBatchToReindexQueueTask)
			.next(isReindexComplete);

		const isOnlyRunningReindex = new Choice(this, 'IsOnlyRunningReindex')
			.when(Condition.isNotPresent('$.Executions[1]'), snapshotOrderedIndexTask)
			.otherwise(
				new Fail(this, 'Fail', {
					error: 'ReindexingError',
					cause: 'Other reindexes running',
				}),
			);

		// Define the state machine
		const definition = storeDryRun
			.next(checkForOtherRunningReindexesTask)
			.next(isOnlyRunningReindex);

		// We define the name manually so we can construct the ARN manually and limit the scope
		// of the ListExecutions permission to the state machine itself - using `stateMachineArn`
		// or `stateMachineName` will introduce circular dependencies.
		const stateMachineName = `${appBase}-${scope.stage}-reindex-recipes`;
		const stateMachine = new StateMachine(this, 'ReindexingStateMachine', {
			definitionBody: DefinitionBody.fromChainable(definition),
			stateMachineName,
			timeout: Duration.minutes(15),
		});

		stateMachine.addToRolePolicy(
			new PolicyStatement({
				effect: Effect.ALLOW,
				resources: [
					`arn:aws:states:eu-west-1:${scope.account}:stateMachine:${stateMachineName}`,
				],
				actions: ['states:ListExecutions'],
			}),
		);
	}
}
