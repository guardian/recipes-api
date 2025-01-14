import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import {
	recipesforArticle,
	removeAllRecipeIndexEntriesForArticle,
	removeRecipe,
} from './dynamo';
import type { RecipeIndexEntry } from './models';
import { removeRecipeContent } from './s3';
import {
	recipesToTakeDown,
	removeAllRecipesForArticle,
	removeRecipePermanently,
	removeRecipeVersion,
} from './takedown';
import { sendTelemetryEvent } from './telemetry';

mockClient(DynamoDBClient);

jest.mock('./config', () => ({
	FeaturedImageWidth: 700,
	PreviewImageWidth: 300,
	ImageDpr: 1,
}));

jest.mock('./s3', () => ({
	removeRecipeContent: jest.fn(),
}));

jest.mock('./dynamo', () => ({
	removeAllRecipeIndexEntriesForArticle: jest.fn(),
	removeRecipe: jest.fn(),
	recipesforArticle: jest.fn(),
}));

jest.mock('./config', () => ({}));

jest.mock('./telemetry', () => ({
	__esmodule: true,
	sendTelemetryEvent: jest.fn(),
}));

const fastlyApiKey = 'fastly-api-key';
const staticBucketName = 'static-bucket';
const contentPrefix = 'content-prefix';
const outgoingEventBus = 'outgoing-event-bus';

describe('takedown', () => {
	beforeEach(() => {
		jest.resetAllMocks();
		//@ts-ignore -- Typescript doesn't know that this is a mock
		removeRecipeContent.mockReturnValue(Promise.resolve());
		//@ts-ignore -- Typescript doesn't know that this is a mock
		removeRecipe.mockReturnValue(Promise.resolve());
	});

	it('removeRecipePermanently should delete the given recipe from the index and from the content bucket', async () => {
		await removeRecipePermanently({
			canonicalArticleId: 'path/to/some/article',
			recipe: {
				recipeUID: 'some-uid',
				checksum: 'xxxyyyzzz',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			staticBucketName,
			fastlyApiKey,
			contentPrefix,
		});

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls.length).toEqual(1);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][0]).toEqual('path/to/some/article');
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][1]).toEqual('some-uid');
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][2]).toBeUndefined();
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls.length).toEqual(1);

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][0]).toEqual('path/to/some/article');
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][1]).toEqual('some-uid');
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls[0][0].recipeSHA).toEqual('xxxyyyzzz');

		expect((sendTelemetryEvent as jest.Mock).mock.calls.length).toEqual(1);
		expect((sendTelemetryEvent as jest.Mock).mock.calls[0][0]).toEqual(
			'TakenDown',
		);
		expect((sendTelemetryEvent as jest.Mock).mock.calls[0][1]).toEqual(
			'some-uid',
		);
	});

	it('removeRecipeVersion should delete the given recipe from the content bucket but not the index', async () => {
		await removeRecipeVersion({
			canonicalArticleId: 'path/to/some/article',
			recipe: {
				recipeUID: 'some-uid',
				checksum: 'xxxyyyzzz',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			staticBucketName,
			fastlyApiKey,
			contentPrefix,
		});

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls.length).toEqual(1);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][0]).toEqual('path/to/some/article');
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][1]).toEqual('some-uid');
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipe.mock.calls[0][2]).toEqual('xxxyyyzzz');

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls.length).toEqual(1);

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls[0][0].recipeSHA).toEqual('xxxyyyzzz');

		expect((sendTelemetryEvent as jest.Mock).mock.calls.length).toEqual(0); //this is not a take-down
	});

	it('removeAllRecipesForArticle should remove all entries from the database and use the information gleaned to remove from content bucket', async () => {
		const knownArticles: RecipeIndexEntry[] = [
			{
				checksum: 'abcd',
				recipeUID: 'r1',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'efg',
				recipeUID: 'r2',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'hij',
				recipeUID: 'r3',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
		];

		//@ts-ignore -- Typescript doesn't know that this is a mock
		removeAllRecipeIndexEntriesForArticle.mockReturnValue(
			Promise.resolve(knownArticles),
		);

		await removeAllRecipesForArticle({
			canonicalArticleId: 'path/to/some/article',
			staticBucketName,
			fastlyApiKey,
			contentPrefix,
			outgoingEventBus,
		});

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeAllRecipeIndexEntriesForArticle.mock.calls.length).toEqual(1);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeAllRecipeIndexEntriesForArticle.mock.calls[0][0]).toEqual(
			'path/to/some/article',
		);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls.length).toEqual(3);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls[0]).toEqual([
			{
				recipeSHA: 'abcd',
				staticBucketName: 'static-bucket',
				fastlyApiKey: 'fastly-api-key',
				purgeType: 'hard',
				contentPrefix: 'content-prefix',
			},
		]);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls[1]).toEqual([
			{
				recipeSHA: 'efg',
				staticBucketName: 'static-bucket',
				fastlyApiKey: 'fastly-api-key',
				purgeType: 'hard',
				contentPrefix: 'content-prefix',
			},
		]);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeRecipeContent.mock.calls[2]).toEqual([
			{
				recipeSHA: 'hij',
				staticBucketName: 'static-bucket',
				fastlyApiKey: 'fastly-api-key',
				purgeType: 'hard',
				contentPrefix: 'content-prefix',
			},
		]);

		expect((sendTelemetryEvent as jest.Mock).mock.calls.length).toEqual(3);
	});
});

describe('takedown.recipesToTakeDown', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	it('should return a list of recipe references that feature in the DB but not in the incoming update', async () => {
		const fakeDbContent: RecipeIndexEntry[] = [
			{
				checksum: 'vers938',
				recipeUID: 'number1',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'vers963',
				recipeUID: 'number2',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'vers346',
				recipeUID: 'number3',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'vers432',
				recipeUID: 'number4',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'vers9789',
				recipeUID: 'number5',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
		];

		const fakeUpdateIds: string[] = ['vers938', 'vers346', 'vers432'];

		// @ts-ignore -- Typescript doesn't know that this is a mock
		recipesforArticle.mockReturnValue(Promise.resolve(fakeDbContent));

		const result = await recipesToTakeDown('some-article-id', fakeUpdateIds);
		expect(result).toEqual([
			{
				checksum: 'vers963',
				recipeUID: 'number2',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'vers9789',
				recipeUID: 'number5',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
		]);

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(recipesforArticle.mock.calls.length).toEqual(1);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(recipesforArticle.mock.calls[0][0]).toEqual('some-article-id');
	});

	it('should return an empty list if there is nothing to take down', async () => {
		const fakeDbContent: RecipeIndexEntry[] = [
			{
				checksum: 'vers938',
				recipeUID: 'number1',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'vers346',
				recipeUID: 'number3',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
			{
				checksum: 'vers432',
				recipeUID: 'number4',
				capiArticleId: 'path/to/some/article',
				sponsorshipCount: 0,
			},
		];

		const fakeUpdateIds: string[] = ['vers938', 'vers346', 'vers432'];

		// @ts-ignore -- Typescript doesn't know that this is a mock
		recipesforArticle.mockReturnValue(Promise.resolve(fakeDbContent));

		const result = await recipesToTakeDown('some-article-id', fakeUpdateIds);
		expect(result).toEqual([]);

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(recipesforArticle.mock.calls.length).toEqual(1);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(recipesforArticle.mock.calls[0][0]).toEqual('some-article-id');
	});

	it('should return an empty list if both input and current state are empty', async () => {
		const fakeDbContent: RecipeIndexEntry[] = [];

		const fakeUpdateIds: string[] = [];

		// @ts-ignore -- Typescript doesn't know that this is a mock
		recipesforArticle.mockReturnValue(Promise.resolve(fakeDbContent));

		const result = await recipesToTakeDown('some-article-id', fakeUpdateIds);
		expect(result).toEqual([]);

		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(recipesforArticle.mock.calls.length).toEqual(1);
		//@ts-ignore -- Typescript doesn't know that this is a mock
		expect(recipesforArticle.mock.calls[0][0]).toEqual('some-article-id');
	});
});
