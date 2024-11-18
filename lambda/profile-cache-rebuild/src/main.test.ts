import type { Tag } from '@guardian/content-api-models/v1/tag';
import { TagType } from '@guardian/content-api-models/v1/tagType';
import type { ChefInfoFile } from '@recipes-api/lib/recipes-data';
import { buildChefInfo } from './main';

jest.mock('./config', () => ({}));

describe('buildChefInfo', () => {
	it('should build up a simplified structure from the data we provide', () => {
		const incoming: Tag[] = [
			{
				id: 'tag/test1',
				type: TagType.CONTRIBUTOR,
				webTitle: 'Test one',
				webUrl: 'webUrl',
				apiUrl: 'apiUrl',
				references: [],
				bio: 'Some bio here',
				bylineImageUrl: 'https://some-url',
			},
			{
				id: 'tag/test2',
				type: TagType.CONTRIBUTOR,
				webTitle: 'Test two',
				webUrl: 'webUrl',
				apiUrl: 'apiUrl',
				references: [],
				bio: 'Some other bio here',
				bylineImageUrl: 'https://some-different-url',
				bylineLargeImageUrl: 'https://some-different-larger-url',
			},
		];

		const expected: ChefInfoFile = {
			'tag/test1': {
				webTitle: 'Test one',
				webUrl: 'webUrl',
				apiUrl: 'apiUrl',
				bio: 'Some bio here',
				bylineImageUrl: 'https://some-url',
			},
			'tag/test2': {
				webTitle: 'Test two',
				webUrl: 'webUrl',
				apiUrl: 'apiUrl',
				bio: 'Some other bio here',
				bylineImageUrl: 'https://some-different-url',
				bylineLargeImageUrl: 'https://some-different-larger-url',
			},
		};
		expect(buildChefInfo(incoming)).toEqual(expected);
	});
});
