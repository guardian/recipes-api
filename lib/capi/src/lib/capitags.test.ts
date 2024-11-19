import { buildUriList, URL_MAX } from './capitags';

describe('buildUriList', () => {
	it('should just return a shorter list', () => {
		const list = [
			'profile/person-one',
			'profile/persontwo',
			'profile/personthree-and-a-half',
		];
		const result = buildUriList(
			list,
			'https://content.guardianapis.com',
			'some-key',
			[],
			[],
		);
		expect(result).toEqual([
			'https://content.guardianapis.com/tags?ids=profile%2Fperson-one%2Cprofile%2Fpersontwo%2Cprofile%2Fpersonthree-and-a-half&api-key=some-key',
		]);
	});

	it('should split a longer list into multiple uris', () => {
		const list: string[] = [];
		for (let i = 0; i < 2048; i++) {
			list[i] = i.toString();
		}

		const result = buildUriList(
			list,
			'https://content.guardianapis.com',
			'some-key',
			[],
			[],
		);

		expect(result.length).toBeGreaterThan(1);

		//Now parse the IDs back out and check that we got the same numbers that went in
		let sentList: string[] = [];
		const xtractor = /ids=([^&]+)/;
		for (const uri of result) {
			const parts = xtractor.exec(uri);
			if (parts) {
				const idList = decodeURIComponent(parts[1]).split(',');
				sentList = sentList.concat(...idList);
			}
		}
		for (const incomingId of list) {
			if (!sentList.includes(incomingId)) {
				console.log(
					`Should have sent a request for id ${incomingId} but it was not found`,
				);
			}
		}

		expect(sentList.length).toEqual(list.length);

		for (const url of result) {
			expect(url.length).toBeLessThan(URL_MAX);
		}
	});
});
