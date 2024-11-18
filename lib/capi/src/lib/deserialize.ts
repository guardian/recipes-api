import type { Event } from '@guardian/content-api-models/crier/event/v1/event';
import { EventSerde } from '@guardian/content-api-models/crier/event/v1/event';
import type { ItemResponse } from '@guardian/content-api-models/v1/itemResponse';
import { ItemResponseSerde } from '@guardian/content-api-models/v1/itemResponse';
import type { TagsResponse } from '@guardian/content-api-models/v1/tagsResponse';
import { TagsResponseSerde } from '@guardian/content-api-models/v1/tagsResponse';
import type { TProtocol } from 'thrift';
import { TCompactProtocol, TFramedTransport } from 'thrift';

function feedToThrift(content: string | Buffer): TProtocol {
	const buffer = Buffer.isBuffer(content)
		? content
		: Buffer.from(content, 'base64');
	const transport = new TFramedTransport(buffer);
	return new TCompactProtocol(transport);
}

export function deserializeEvent(content: string | Buffer): Event {
	return EventSerde.read(feedToThrift(content));
}

export function deserializeItemResponse(
	content: string | Buffer,
): ItemResponse {
	return ItemResponseSerde.read(feedToThrift(content));
}

export function deserialzeTagsResponse(content: string | Buffer): TagsResponse {
	return TagsResponseSerde.read(feedToThrift(content));
}
