import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import {indexTableName} from "./config";

interface RecipeItem {
	sponsorshipCount?: { N: string };
}

export async function isSponsored(
	recipeUID: string
): Promise<boolean> {
	const client = new DynamoDBClient({ region: process.env.AWS_REGION });
	const req = new QueryCommand({
		TableName: indexTableName,
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
    throw new Error(`ERROR [${recipeUID}] - valid recipe not found in ${indexTableName}`);
	}
}
