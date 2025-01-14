import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Handler } from 'aws-lambda';
import {
	getOutgoingEventBus,
	putReindexIds,
} from '@recipes-api/lib/recipes-data';
import { getRecipeIndexSnapshotBucket, getReindexBatchSize } from '../config';
import type {
	RecipeArticlesSnapshot,
	WriteBatchToReindexQueueInput,
	WriteBatchToReindexQueueOutput,
} from '../types';

const s3Client = new S3Client({ region: process.env['AWS_REGION'] });

export const writeBatchToReindexQueueHandler: Handler<
	WriteBatchToReindexQueueInput,
	WriteBatchToReindexQueueOutput
> = async (state) => {
	const reindexSnapshotBucket = getRecipeIndexSnapshotBucket();
	const reindexBatchSize = getReindexBatchSize();
	const outgoingEventBus = getOutgoingEventBus();

	const {
		input: { executionId, nextIndex: currentIndex, indexObjectKey },
		dryRun: _dryRun,
	} = state;
	const dryRun = _dryRun ?? true;

	const req = new GetObjectCommand({
		Bucket: reindexSnapshotBucket,
		Key: indexObjectKey,
	});

	const pathToRecipeIndex = `${reindexSnapshotBucket}/${indexObjectKey}`;

	console.log(
		`Reading articles to reindex for execution with ID ${executionId} from S3 at path ${pathToRecipeIndex}`,
	);

	const response = await s3Client.send(req);

	if (!response.Body) {
		throw new Error(
			`Read articles to reindex at ${pathToRecipeIndex}, but the response body was empty`,
		);
	}

	const recipeIndexSnapshotJson =
		await response.Body.transformToString('utf-8');

	const recipeIndexSnapshot = JSON.parse(
		recipeIndexSnapshotJson,
	) as RecipeArticlesSnapshot;

	console.log(
		`Received articles to reindex for execution with ID ${executionId} from S3 at path ${pathToRecipeIndex}, containing ${recipeIndexSnapshot.length} articles to reindex`,
	);

	const nextIndex = Math.min(
		currentIndex + reindexBatchSize,
		recipeIndexSnapshot.length,
	);

	const articleIdsToReindex = recipeIndexSnapshot.slice(
		currentIndex,
		nextIndex,
	);

	const dryRunMsg = '[DRY RUN]: ';
	const writeMsg = `${
		articleIdsToReindex.length
	} article ids to the reindex queue, from index ${currentIndex} to index ${
		nextIndex - 1
	} (batch size ${reindexBatchSize})`;

	console.log(`${dryRun ? dryRunMsg : ''} about to write ${writeMsg}`);

	if (!dryRun) {
		await putReindexIds(articleIdsToReindex, outgoingEventBus);
	}

	console.log(`${dryRun ? dryRunMsg : ''} completed writing ${writeMsg}`);

	return {
		executionId,
		indexObjectKey,
		nextIndex: nextIndex,
		lastIndex: recipeIndexSnapshot.length - 1,
	};
};
