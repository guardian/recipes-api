import { ContributorsReport } from './search-backend-schema';

/**
 * Calls the search backend to discover all of the profile tags. Ignores 'byline' type contributors
 * @param baseUri base URI of the recipe search
 */
export async function discover_profile_tags(
	baseUri: string,
): Promise<string[]> {
	const url = baseUri + '/keywords/contributors?limit=1000';
	const content = await fetch(url);
	if (content.status != 200) {
		const contentBody = await content.text();
		console.error(
			`Recipe search backend returned ${content.status}: ${contentBody}`,
		);
		throw new Error('Unable to retrieve contributors from search backend');
	}

	const contributorsInfo = ContributorsReport.parse(await content.json());
	return contributorsInfo.results
		.filter((c) => c.contributorType === 'Profile')
		.map((c) => c.nameOrId);
}
