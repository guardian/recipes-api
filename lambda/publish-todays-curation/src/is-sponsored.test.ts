import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { isSponsored } from './is-sponsored';

const dynamoClientMock = mockClient(DynamoDBClient);

describe('isSponsored', () => {
	const consoleLogSpy = jest
		.spyOn(console, 'log')
		.mockImplementation(jest.fn());

	afterAll(() => {
		consoleLogSpy.mockRestore();
	});

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
		const result = await isSponsored('id-1', 'TEST-TABLE');
		expect(result).toBe(false);
		expect(consoleLogSpy).toHaveBeenCalledWith(
			'ERROR [id-1] - valid recipe not found in TEST-TABLE',
		);
	});

	it('should return false when an error occurs during the query', async () => {
		dynamoClientMock.on(QueryCommand).rejects(new Error('Query failed'));
		const result = await isSponsored('id-1', 'TEST-TABLE');
		expect(result).toBe(false);
		expect(consoleLogSpy).toHaveBeenCalledWith(
			'ERROR [id-1] - error retrieving recipe from TEST-TABLE',
			new Error('Query failed'),
		);
	});
});
