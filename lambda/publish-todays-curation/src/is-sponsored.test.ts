import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { isSponsored } from './is-sponsored';

const dynamoClientMock = mockClient(DynamoDBClient);

describe('isSponsored', () => {
	it('should return true when the sponsorshipCount field exists for the recipe and has the value true', async () => {
		dynamoClientMock.on(QueryCommand).resolves({
			Items: [{ recipeUID: { S: 'id-1' }, sponsorshipCount: { N: '1' } }],
		});
		const result = await isSponsored('id-1', 'TEST-TABLE');
		expect(result).toBe(true);
	});

	it('should return false when the sponsorshipCount field exists for the recipe and has the value false', async () => {
		dynamoClientMock.on(QueryCommand).resolves({
			Items: [{ recipeUID: { S: 'id-1' }, sponsorshipCount: { N: '0' } }],
		});
		const result = await isSponsored('id-1', 'TEST-TABLE');
		expect(result).toBe(false);
	});

	it('should return false where the sponsorshipCount field does not exist for the recipe', async () => {
		dynamoClientMock.on(QueryCommand).resolves({
			Items: [{ recipeUID: { S: 'id-1' } }],
		});
		const result = await isSponsored('id-1', 'TEST-TABLE');
		expect(result).toBe(false);
	});

	it('should return false when the recipe cannot be found', async () => {
		dynamoClientMock.on(QueryCommand).resolves({
			Items: [],
		});
		await expect(isSponsored('id-1', 'TEST-TABLE')).rejects.toThrow(
			'ERROR [id-1] - valid recipe not found in TEST-TABLE',
		);
	});

	it('should throw error when an error occurs during the query', async () => {
		dynamoClientMock.on(QueryCommand).rejects(new Error('Query failed'));
		await expect(isSponsored('id-1', 'TEST-TABLE')).rejects.toThrow();
	});
});
