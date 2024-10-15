import { deployCurationData } from '@recipes-api/lib/recipes-data';
import { notifyFaciaTool } from './facia-notifications';
import {
	messageWithBrokenIssueDate,
	messageWithMissingFrontsTitle,
	validMessage,
	validMessageContent,
} from './fixtures/sns';
import { handler } from './main';

jest.mock('@recipes-api/lib/recipes-data', () => ({
	deployCurationData: jest.fn(),
}));

jest.mock('./config', () => ({
	faciaPublicationStatusTopicArn: 'config-param',
	faciaPublicationStatusRoleArn: 'config-param',
}));

jest.mock('./facia-notifications', () => ({
	notifyFaciaTool: jest.fn(),
}));

const importCurationDataMock = deployCurationData as jest.Mock;
const notifyFaciaToolMock = notifyFaciaTool as jest.Mock;

describe('main', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should publish the content it was given', async () => {
		const rec = {
			Records: [
				{
					eventSource: 'sqs',
					awsRegion: 'xx-north-n',
					messageId: 'BDB66A64-F095-4F4D-9B6A-135173E262A5',
					body: JSON.stringify(validMessage),
				},
			],
		};

		// @ts-ignore
		await handler(rec, null, null);

		expect(importCurationDataMock.mock.calls.length).toEqual(2);
		expect(importCurationDataMock.mock.calls[0][0]).toEqual(
			JSON.stringify(validMessageContent.fronts['all-recipes']),
		);
		expect(importCurationDataMock.mock.calls[0][1]).toEqual(
			validMessageContent.edition,
		);
		expect(importCurationDataMock.mock.calls[0][2]).toEqual('all-recipes');
		expect(importCurationDataMock.mock.calls[0][3]).toEqual(
			new Date(2024, 0, 2),
		);

		expect(importCurationDataMock.mock.calls[1][0]).toEqual(
			JSON.stringify(validMessageContent.fronts['meat-free']),
		);
		expect(importCurationDataMock.mock.calls[1][1]).toEqual(
			validMessageContent.edition,
		);
		expect(importCurationDataMock.mock.calls[1][2]).toEqual('meat-free');
		expect(importCurationDataMock.mock.calls[1][3]).toEqual(
			new Date(2024, 0, 2),
		);

		const notifyFaciaToolMock = notifyFaciaTool as jest.Mock;
		expect(notifyFaciaToolMock.mock.calls[0][0]).toMatchObject({
			edition: 'feast-northern-hemisphere',
			issueDate: '2024-01-02',
			message:
				'This issue has been published but its date is in the past so it can only be seen in the Fronts Preview tool',
			status: 'Published',
			version: 'v1',
		});
	});

	it('should not accept valid envelope json, failing with an error', async () => {
		const rec = {
			Records: [
				{
					eventSource: 'sqs',
					awsRegion: 'xx-north-n',
					messageId: 'BDB66A64-F095-4F4D-9B6A-135173E262A5',
					body: JSON.stringify(messageWithBrokenIssueDate),
				},
			],
		};

		const expectedError = new Error(
			`Error parsing message envelope: ${JSON.stringify({
				issues: [
					{
						code: 'custom',
						fatal: true,
						path: ['issueDate'],
						message: 'Invalid input',
					},
				],
				name: 'ZodError',
			})}`,
		);

		// @ts-ignore
		await expect(() => handler(rec, null, null)).rejects.toEqual(expectedError);
	});

	it('should not accept valid fronts json, failing and reporting the error to the Fronts publication queue', async () => {
		const rec = {
			Records: [
				{
					eventSource: 'sqs',
					awsRegion: 'xx-north-n',
					messageId: 'BDB66A64-F095-4F4D-9B6A-135173E262A5',
					body: JSON.stringify(messageWithMissingFrontsTitle),
				},
			],
		};

		// @ts-ignore
		await handler(rec, null, null);

		expect(importCurationDataMock.mock.calls.length).toEqual(0);

		expect(notifyFaciaToolMock.mock.calls[0][0]).toMatchObject({
			edition: 'feast-northern-hemisphere',
			issueDate: '2024-01-02',
			message: `Failed to publish this issue. Error: ${JSON.stringify({
				issues: [
					{
						code: 'invalid_type',
						expected: 'string',
						received: 'null',
						path: ['fronts', 'all-recipes', 0, 'title'],
						message: 'Expected string, received null',
					},
				],
				name: 'ZodError',
			})}`,
			status: 'Failed',
			version: 'v1',
		});
	});

	it('should not accept invalid json', async () => {
		const rec = {
			Records: [
				{
					eventSource: 'sqs',
					awsRegion: 'xx-north-n',
					messageId: 'BDB66A64-F095-4F4D-9B6A-135173E262A5',
					body: 'blahblahblahthisisnotjson',
				},
			],
		};

		const expectedError = new SyntaxError(
			'Unexpected token b in JSON at position 0',
		);
		// @ts-ignore
		await expect(() => handler(rec, null, null)).rejects.toEqual(expectedError);
	});

	it('should notify when the deploy fails', async () => {
		const rec = {
			Records: [
				{
					eventSource: 'sqs',
					awsRegion: 'xx-north-n',
					messageId: 'BDB66A64-F095-4F4D-9B6A-135173E262A5',
					body: JSON.stringify(validMessage),
				},
			],
		};

		const expectedError = new Error('Error deploying content');
		importCurationDataMock.mockRejectedValueOnce(expectedError);

		// @ts-ignore
		await handler(rec, null, null);

		expect(notifyFaciaToolMock.mock.calls[0][0]).toMatchObject({
			edition: 'feast-northern-hemisphere',
			issueDate: '2024-01-02',
			message: 'Failed to publish this issue. Error: Error deploying content',
			status: 'Failed',
			version: 'v1',
		});
	});
});
