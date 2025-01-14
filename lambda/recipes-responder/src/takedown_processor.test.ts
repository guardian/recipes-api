import type { Event } from '@guardian/content-api-models/crier/event/v1/event';
import { EventType } from '@guardian/content-api-models/crier/event/v1/eventType';
import { ItemType } from '@guardian/content-api-models/crier/event/v1/itemType';
import Int64 from 'node-int64';
import {
	awaitableDelay,
	removeAllRecipesForArticle,
} from '@recipes-api/lib/recipes-data';
import { handleTakedown } from './takedown_processor';

jest.mock('@recipes-api/lib/recipes-data', () => ({
	awaitableDelay: jest.fn(),
	removeAllRecipesForArticle: jest.fn(),
}));

jest.mock('../../../lib/recipes-data/src/lib/eventbus', () => ({
	announce_new_recipe: jest.fn(),
}));

const staticBucketName = 'static-bucket-name';
const fastlyApiKey = 'fastly-api-key';
const contentPrefix = 'cdn.content.location';
const outgoingEventBus = 'outgoing-event-bus';

describe('takedown_processor.handleTakedown', () => {
	beforeEach(() => {
		jest.resetAllMocks();
	});

	it('should remove all recipes associated with the given article', async () => {
		// @ts-ignore -- Typescript doesn't know that this is a mock
		removeAllRecipesForArticle.mockReturnValue(Promise.resolve(1));
		const testEvt: Event = {
			//DELETE events don't have a payload
			payloadId: 'path/to/article/id',
			eventType: EventType.DELETE,
			itemType: ItemType.CONTENT,
			dateTime: new Int64(Date.now()),
		};

		const count = await handleTakedown({
			event: testEvt,
			staticBucketName,
			fastlyApiKey,
			contentPrefix,
			outgoingEventBus,
		});
		// @ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeAllRecipesForArticle.mock.calls.length).toEqual(1);
		// @ts-ignore -- Typescript doesn't know that this is a mock
		expect(awaitableDelay.mock.calls.length).toEqual(0);
		expect(
			// @ts-ignore -- Typescript doesn't know that this is a mock
			removeAllRecipesForArticle.mock.calls[0][0].canonicalArticleId,
		).toEqual('path/to/article/id');
		expect(count).toEqual(1);
	});

	it("should ignore anything that is not a 'content' payload", async () => {
		const testEvt: Event = {
			payloadId: 'fake-id',
			eventType: EventType.DELETE,
			itemType: ItemType.ATOM,
			dateTime: new Int64(Date.now()),
		};

		const count = await handleTakedown({
			event: testEvt,
			staticBucketName,
			fastlyApiKey,
			contentPrefix,
			outgoingEventBus,
		});
		// @ts-ignore -- Typescript doesn't know that this is a mock
		expect(removeAllRecipesForArticle.mock.calls.length).toEqual(0);
		// @ts-ignore -- Typescript doesn't know that this is a mock
		expect(awaitableDelay.mock.calls.length).toEqual(0);
		expect(count).toEqual(0);
	});
});
