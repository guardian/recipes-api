import type { Tag } from '@guardian/content-api-models/v1/tag';
import {
	TagsResponse,
	TagsResponseSerde,
} from '@guardian/content-api-models/v1/tagsResponse';
import { deserialzeTagsResponse } from './deserialize';

export const URL_MAX = 2048;

/**
 * We need to have <2048 chars in the URI or one of the backends objects.
 * So, we try to bundle all of the tag IDs into one lookup; if that fails, we split in half and try two; etc.
 * @param tagIdList the list of tag IDs to resolve
 * @param capiBaseUrl base URL for CAPI
 * @param capiKey API key for CAPI
 * @param tagIdListTail remaining tag IDs to process next iteration. Internal use only.
 * @param prevUrlList URLs already determined. Internal use only.
 */
export function buildUriList(
	tagIdList: string[],
	capiBaseUrl: string,
	capiKey: string,
	tagIdListTail: string[] = [],
	prevUrlList: string[] = [],
): string[] {
	if (tagIdList.length == 0) {
		//We reached the end!
		return prevUrlList;
	}

	const joinedIdList = encodeURIComponent(tagIdList.join(','));
	const testUri = `${capiBaseUrl}/tags?ids=${joinedIdList}&api-key=${capiKey}`;
	if (testUri.length > URL_MAX) {
		//uri is not usable, try again
		const midpoint = tagIdList.length / 2;
		const newTail = tagIdListTail.concat(tagIdList.slice(midpoint));

		return buildUriList(
			tagIdList.slice(0, midpoint),
			capiBaseUrl,
			capiKey,
			newTail,
			prevUrlList,
		);
	} else {
		//we found a length that works.
		return buildUriList(
			tagIdListTail,
			capiBaseUrl,
			capiKey,
			[],
			prevUrlList.concat(testUri),
		);
	}
}

/**
 * Given a list of tag IDs (of any length), retrieve the metadata efficiently from CAPI.
 * Note that success does NOT guarantee that _every_ tag was found, or indeed that _any_ tag was found.
 * Returns a list of CAPI tag data
 * @param tagIdList list of tag IDs to look up.
 * @param capiBaseUrl base URL of CAPI to use
 * @param capiKey API key valid for the CAPI instance you're targeting. Developer-tier does have access to this data.
 */
export async function fetchTagsById(
	tagIdList: string[],
	capiBaseUrl: string,
	capiKey: string,
): Promise<Tag[]> {
	const urlList = buildUriList(tagIdList, capiBaseUrl, capiKey);
	let results: Tag[] = [];

	for (const url of urlList) {
		const response = await fetch(url + '&format=thrift');
		if (response.status != 200) {
			const errorText = await response.text();
			console.error(
				`CAPI returned with an error ${response.status}: ${errorText}`,
			);
			throw new Error('CAPI returned an error');
		} else {
			const rawBytes = await response.arrayBuffer();
			const contentBody = deserialzeTagsResponse(Buffer.from(rawBytes));

			results = results.concat(...contentBody.results);
		}
	}
	return results;
}
