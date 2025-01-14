import * as process from 'process';
import type {
	PutEventsCommandOutput,
	PutEventsRequestEntry,
} from '@aws-sdk/client-eventbridge';
import {
	EventBridgeClient,
	PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { registerMetric } from '@recipes-api/cwmetrics';
import { ReindexEventDetail } from './eventbridge-models';
import type { RecipeIndexEntry, RecipeReference } from './models';

const ebClient = new EventBridgeClient({ region: process.env['AWS_REGION'] });

export async function announceNewRecipe(
	updated: RecipeReference[],
	removedList: RecipeIndexEntry[],
	OutgoingEventBus: string,
) {
	const updates = updated.map((recep) => ({
		Time: new Date(), //Timestamp
		Source: 'recipe-responder', //Identity of sender
		Resources: [], //Affected AWS resources
		DetailType: 'recipe-update', //What happened
		Detail: JSON.stringify({
			blob: recep.jsonBlob,
			uid: recep.recipeUID,
			checksum: recep.checksum,
		}),
		EventBusName: OutgoingEventBus,
	}));

	const updatedUIDs = updated.map((_) => _.recipeUID);

	//OK this would be more efficient with sets or a map, but the numbers are going to be so small
	//it's not worth worrying about here.
	const actualRemovals = removedList.filter(
		(removedEntry) => !updatedUIDs.includes(removedEntry.recipeUID),
	);

	const removals = actualRemovals.map((ent) => ({
		Time: new Date(), //Timestamp
		Source: 'recipe-responder', //Identity of sender
		Resources: [], //Affected AWS resources
		DetailType: 'recipe-delete', //What happened
		Detail: JSON.stringify({
			checksum: ent.checksum,
			uid: ent.recipeUID,
		}),
		EventBusName: OutgoingEventBus,
	}));

	return putEntriesToBus(updates.concat(removals));
}

export async function putReindexIds(
	articleIds: string[],
	outgoingEventBus: string,
) {
	const entry = {
		Time: new Date(),
		Source: 'recipes-reindex',
		Resources: [],
		DetailType: ReindexEventDetail,
		Detail: JSON.stringify({ articleIds } as ReindexEventDetail),
		EventBusName: outgoingEventBus,
	};

	return putEntriesToBus([entry]);
}

/**
 * @returns The number of entries successfully put to the bus, if any.
 */
const putEntriesToBus = async (Entries: PutEventsRequestEntry[]) => {
	const req = new PutEventsCommand({
		Entries,
	});

	const response = await ebClient.send(req);

	await logFailedResponses(response);

	return response.Entries?.length ?? 0;
};

/**
 * Log failed responses in metrics as a side-effect.
 */
const logFailedResponses = async (response: PutEventsCommandOutput) => {
	if (response.FailedEntryCount && response.FailedEntryCount > 0) {
		const failedEntries = response.Entries
			? response.Entries.filter((_) => !_.EventId)
			: [];
		failedEntries.forEach((e, n) => {
			console.warn(
				`${n}: Event failed to send: ${e.ErrorCode ?? '(unknown code)'} ${
					e.ErrorMessage ?? '(message not provided)'
				}`,
			);
		});

		try {
			await registerMetric('FailedAnnouncements', response.FailedEntryCount);
		} catch (e) {
			console.error(`Unable to register FailedAnnouncements metric: `, e);
		}
		throw new Error(
			`${response.FailedEntryCount} messages failed to send, failures are logged out`,
		);
	} else {
		try {
			await registerMetric('FailedAnnouncements', 0);
		} catch (e) {
			console.error(`Unable to register FailedAnnouncements metric: `, e);
		}
	}
};
