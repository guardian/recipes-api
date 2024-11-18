import type { Tag } from '@guardian/content-api-models/v1/tag';
import { fetchTagsById } from '@recipes-api/lib/capi';
import type { ChefInfoFile } from '@recipes-api/lib/recipes-data';
import { writeChefData } from '@recipes-api/lib/recipes-data';
import { capi_base_url, capi_key, recipes_base_url } from './config';
import { discover_profile_tags } from './recipe-search';

export function buildChefInfo(from: Tag[]): ChefInfoFile {
	return from.reduce<ChefInfoFile>((prev: ChefInfoFile, current: Tag) => {
		const id = current.id;
		prev[id] = {
			webTitle: current.webTitle,
			webUrl: current.webUrl,
			apiUrl: current.apiUrl,
			bio: current.bio,
			bylineImageUrl: current.bylineImageUrl,
			bylineLargeImageUrl: current.bylineLargeImageUrl,
		};
		return prev;
	}, {});
}

export async function handler() {
	const profile_tag_ids = await discover_profile_tags(
		recipes_base_url as string,
	);

	console.log(`Found ${profile_tag_ids.length} profile tags for chefs`);

	const capi_tag_data = await fetchTagsById(
		profile_tag_ids,
		capi_base_url as string,
		capi_key as string,
	);

	console.log(`CAPI returned information about ${capi_tag_data.length} tags`);
	const chef_info = buildChefInfo(capi_tag_data);
	console.log(`Chef info file has ${Object.keys(chef_info).length} entries`);

	await writeChefData(chef_info, 'v2/contributors.json');
}
