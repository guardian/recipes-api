import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Callback, Context } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import * as indexJSON from './fixtures/index.json';
import { writeBatchToReindexQueueHandler } from './index';

const RecipeIndexSnapshotBucket = 'example-reindex-bucket';
const ReindexBatchSize = 10;

jest.mock('./config', () => ({
	getConfig: () => ({
		RecipeIndexSnapshotBucket,
		ReindexBatchSize,
	}),
}));

jest.mock('../sharedConfig', () => ({
	getConfig: () => ({
		RecipeIndexSnapshotBucket,
		ReindexBatchSize: 10,
	}),
}));

const s3Mock = mockClient(S3Client);

describe('writeBatchToReindexQueue', () => {
	const mockContext = {} as unknown as Context;
	const mockCallback = {} as unknown as Callback;
	s3Mock.on(GetObjectCommand).resolves({
		/* @ts-ignore */
		Body: {
			transformToString: () => Promise.resolve(JSON.stringify(indexJSON)),
		},
	});

	it('should move the current index on by the batch size', async () => {
		const output = await writeBatchToReindexQueueHandler(
			{
				nextIndex: 0,
				indexObjectKey: 'path/to/key',
				executionId: 'example-execution-id',
				dryRun: true,
			},
			mockContext,
			mockCallback,
		);

		expect(output?.nextIndex).toBe(10);
		expect(output?.lastIndex).toBe(indexJSON.recipes.length - 1);
	});

	it('should move the index one beyond the last recipe on completion', async () => {
		const output = await writeBatchToReindexQueueHandler(
			{
				nextIndex: 170,
				indexObjectKey: 'path/to/key',
				executionId: 'example-execution-id',
				dryRun: true,
			},
			mockContext,
			mockCallback,
		);

		expect(output?.nextIndex).toBe(indexJSON.recipes.length);
		expect(output?.lastIndex).toBe(indexJSON.recipes.length - 1);
	});
});