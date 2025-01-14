import type { DeletedContent } from '@guardian/content-api-models/crier/event/v1/deletedContent';
import type { Event } from '@guardian/content-api-models/crier/event/v1/event';
import { ItemType } from '@guardian/content-api-models/crier/event/v1/itemType';
import { removeAllRecipesForArticle } from '@recipes-api/lib/recipes-data';

export async function handleTakedown({
	event,
	staticBucketName,
	fastlyApiKey,
	contentPrefix,
	outgoingEventBus,
}: {
	event: Event;
	staticBucketName: string;
	fastlyApiKey: string;
	contentPrefix: string;
	outgoingEventBus: string;
}): Promise<number> {
	console.log('takedown payload: ', JSON.stringify(event));

	if (event.itemType == ItemType.CONTENT) {
		//there's no payload in the takedown message!
		return removeAllRecipesForArticle({
			canonicalArticleId: event.payloadId,
			staticBucketName,
			fastlyApiKey,
			contentPrefix,
			outgoingEventBus,
		}); //event.payloadId is the canonical article ref that was taken down
	} else {
		return 0;
	}
}

// I don't think that these are relevant to us here. So, I'm logging it out to verify that suspicion
export async function handleDeletedContent(
	evt: DeletedContent,
): Promise<number> {
	console.log(
		`DEBUG received deleted-content-update for ${
			evt.aliasPaths?.join('/') ?? '(no paths)'
		}`,
	);
	return Promise.resolve(0);
}
