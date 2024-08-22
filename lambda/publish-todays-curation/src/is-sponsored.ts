import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

interface RecipeItem {
	sponsorshipCount?: { N: string };
}

export async function isSponsored(
	recipeUID: string,
	tableName: string,
): Promise<boolean> {
	const client = new DynamoDBClient({ region: process.env.AWS_REGION });
	const req = new QueryCommand({
		TableName: tableName,
		IndexName: 'idxRecipeUID',
		KeyConditionExpression: 'recipeUID = :uid',
		ExpressionAttributeValues: {
			':uid': { S: recipeUID },
		},
	});

	const response = await client.send(req);
	if (response.Items && response.Items.length > 0) {
		const item = response.Items[0] as RecipeItem;
		return !!item.sponsorshipCount?.N && parseInt(item.sponsorshipCount.N) > 0;
	} else {
    throw new Error(`ERROR [${recipeUID}] - valid recipe not found in ${tableName}`);
	}
}
