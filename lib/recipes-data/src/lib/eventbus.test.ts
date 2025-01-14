import {
	EventBridgeClient,
	PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { mockClient } from 'aws-sdk-client-mock';
import { registerMetric } from '@recipes-api/cwmetrics';
import { announceNewRecipe } from './eventbus';
import type { RecipeIndexEntry, RecipeReference } from './models';
import Mock = jest.Mock;

const mockEbClient = mockClient(EventBridgeClient);

jest.mock('./config', () => ({
	OutgoingEventBus: 'test-event-bus',
}));

jest.mock('@recipes-api/cwmetrics', () => ({
	registerMetric: jest.fn(),
}));

const outgoingEventBus = 'outgoing-event-bus';

describe('announce_new_recipe', () => {
	beforeEach(() => {
		mockEbClient.reset();
		jest.resetAllMocks();
	});

	it('should send a combined stack of messages for updates and takedowns, not double-announcing updates', async () => {
		const updates: RecipeReference[] = [
			{
				checksum: 'recep-1-cs',
				recipeUID: 'recep-1-uid',
				jsonBlob: 'recep-1-content',
				sponsorshipCount: 0,
			},
			{
				checksum: 'recep-2-cs-updated',
				recipeUID: 'recep-2-uid',
				jsonBlob: 'recep-2-content',
				sponsorshipCount: 0,
			},
		];
		const removals: RecipeIndexEntry[] = [
			{
				checksum: 'recep-2-cs-old', //"recep-2" is updated, so been taken down and replaced with a new checksum
				recipeUID: 'recep-2-uid',
				capiArticleId: 'xxxxxxxxxx',
				sponsorshipCount: 0,
			},
			{
				checksum: 'recep-3-cs',
				recipeUID: 'recep-3-uid',
				capiArticleId: 'yyyyyyyyy',
				sponsorshipCount: 0,
			},
		];

		mockEbClient.on(PutEventsCommand).resolves({
			FailedEntryCount: 0,
			Entries: [
				{
					EventId: 'event-1',
				},
				{
					EventId: 'event-2',
				},
				{
					EventId: 'event-3',
				},
			],
		});
		const result = await announceNewRecipe(updates, removals, outgoingEventBus);
		expect(result).toEqual(3);

		expect(mockEbClient.commandCalls(PutEventsCommand).length).toEqual(1);
		const putCmd = mockEbClient.commandCalls(PutEventsCommand)[0]
			.firstArg as PutEventsCommand;

		expect(putCmd.input.Entries?.length).toEqual(3);

		const firstEntry = putCmd.input.Entries ? putCmd.input.Entries[0] : {};
		expect(firstEntry.DetailType).toEqual('recipe-update');
		expect(firstEntry.Detail).toEqual(
			`{"blob":"recep-1-content","uid":"recep-1-uid","checksum":"recep-1-cs"}`,
		);

		const secondEntry = putCmd.input.Entries ? putCmd.input.Entries[1] : {};
		expect(secondEntry.DetailType).toEqual('recipe-update');
		expect(secondEntry.Detail).toEqual(
			`{"blob":"recep-2-content","uid":"recep-2-uid","checksum":"recep-2-cs-updated"}`,
		);

		const thirdEntry = putCmd.input.Entries ? putCmd.input.Entries[2] : {};
		expect(thirdEntry.DetailType).toEqual('recipe-delete');
		expect(thirdEntry.Detail).toEqual(
			`{"checksum":"recep-3-cs","uid":"recep-3-uid"}`,
		);

		expect((registerMetric as Mock).mock.calls.length).toEqual(1);
		expect((registerMetric as Mock).mock.calls[0][0]).toEqual(
			'FailedAnnouncements',
		);
		expect((registerMetric as Mock).mock.calls[0][1]).toEqual(0);
	});
});
