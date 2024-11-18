import { discover_profile_tags } from './recipe-search';

describe('discover_profile_tags', () => {
	it('should call the recipe search backend and interpret the data', async () => {
		const results = await discover_profile_tags(
			'https://recipes.code.dev-guardianapis.com',
		);

		expect(results.length).toBeGreaterThan(10);
		expect(results.includes('profile/yotamottolenghi')).toBeTruthy();
		expect(results.includes('profile/nigelslater')).toBeTruthy();
	});
});
