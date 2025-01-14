import {
	CloudWatchClient,
	PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';

const cwClient = new CloudWatchClient({ region: process.env['AWS_REGION'] });

export type KnownMetric =
	| 'FailedRecipes'
	| 'SuccessfulRecipes'
	| 'UpdatesTotalOfArticle'
	| 'FailedAnnouncements';

export async function registerMetric(metricName: KnownMetric, value: number) {
	const req = new PutMetricDataCommand({
		Namespace: 'RecipeBackend',
		MetricData: [
			{
				MetricName: metricName,
				Dimensions: [
					{
						Name: 'Stack',
						Value: process.env['STACK'],
					},
					{
						Name: 'Stage',
						Value: process.env['STAGE'],
					},
				],
				Timestamp: new Date(),
				Value: value,
			},
		],
	});

	const response = await cwClient.send(req);
	console.debug(
		`Updated ${metricName} metric after ${
			response.$metadata.attempts ?? 1
		} attempts`,
	);
}
