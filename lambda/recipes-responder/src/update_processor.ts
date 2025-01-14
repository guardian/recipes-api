import type { Content } from '@guardian/content-api-models/v1/content';
import { ContentType } from '@guardian/content-api-models/v1/contentType';
import type { RecipeReference } from '@recipes-api/lib/recipes-data';
import {
	announceNewRecipe,
	calculateChecksum,
	extractAllRecipesFromArticle,
	insertNewRecipe,
	publishRecipeContent,
	recipesToTakeDown,
	removeRecipeVersion,
	sendTelemetryEvent,
} from '@recipes-api/lib/recipes-data';

/**
 * Pushes new content into the service
 */
async function publishRecipe({
	canonicalArticleId,
	recipe,
	staticBucketName,
	fastlyApiKey,
	contentPrefix,
}: {
	canonicalArticleId: string;
	recipe: RecipeReference;
	staticBucketName: string;
	fastlyApiKey: string;
	contentPrefix: string;
}): Promise<void> {
	try {
		await sendTelemetryEvent(
			'PublishedData',
			recipe.recipeUID,
			recipe.jsonBlob,
		);
	} catch (err) {
		console.error(`[${canonicalArticleId}] - unable to send telemetry: `, err);
	}
	console.log(
		`INFO [${canonicalArticleId}] - pushing ${recipe.recipeUID} @ ${recipe.checksum} to S3...`,
	);
	await publishRecipeContent({
		recipe,
		staticBucketName: staticBucketName,
		fastlyApiKey,
		contentPrefix,
	});
	console.log(`INFO [${canonicalArticleId}] - updating index table...`);
	await insertNewRecipe(canonicalArticleId, {
		recipeUID: recipe.recipeUID,
		checksum: recipe.checksum,
		capiArticleId: canonicalArticleId,
		sponsorshipCount: recipe.sponsorshipCount,
	});
}

/**
 * Takes an updated article and updates any recipes from inside it
 * @param content - Content of an incoming article
 * @returns a number, representing the number of recipes that were added plus the number that were deleted (i.e., an
 * update counts as 1 add and 1 delete)
 */
export async function handleContentUpdate({
	content,
	staticBucketName,
	fastlyApiKey,
	contentPrefix,
	outgoingEventBus,
}: {
	content: Content;
	staticBucketName: string;
	fastlyApiKey: string;
	contentPrefix: string;
	outgoingEventBus: string;
}): Promise<number> {
	try {
		if (content.type != ContentType.ARTICLE) return 0; //no point processing live-blogs etc.

		const recipesFound = await extractAllRecipesFromArticle(content);
		const allRecipes: RecipeReference[] = recipesFound.map(calculateChecksum);
		console.log(`INFO [${content.id}] - has ${allRecipes.length} recipes`);

		const entriesToRemove = await recipesToTakeDown(
			content.id,
			allRecipes.map((recep) => recep.recipeUID),
		);
		console.log(
			`INFO [${content.id}] - ${entriesToRemove.length} recipes have been removed/superceded in the incoming article`,
		);
		if (allRecipes.length == 0 && entriesToRemove.length == 0) return 0; //no point hanging around and noising up the logs
		await Promise.all(
			entriesToRemove.map((recep) =>
				removeRecipeVersion({
					canonicalArticleId: content.id,
					recipe: recep,
					staticBucketName,
					fastlyApiKey,
					contentPrefix,
				}),
			),
		);
		console.log(
			`INFO [${content.id}] - ${entriesToRemove.length} removed/superceded recipes have been removed from the store`,
		);

		console.log(
			`INFO [${content.id}] - publishing ${allRecipes.length} new/updated recipes to the service`,
		);
		await Promise.all(
			allRecipes.map((recipe) =>
				publishRecipe({
					canonicalArticleId: content.id,
					recipe,
					staticBucketName,
					fastlyApiKey,
					contentPrefix,
				}),
			),
		);

		console.log(
			`INFO [${content.id}] - sending notification of new/updated recipes`,
		);

		try {
			await announceNewRecipe(allRecipes, entriesToRemove, outgoingEventBus);
		} catch (e) {
			const err = e as Error;
			console.error(`Unable to announce updates: ${err.toString()}`);
		}
		console.log(`INFO [${content.id}] - Done`);
		return allRecipes.length + entriesToRemove.length;
	} catch (err) {
		//log out what actually caused the breakage
		console.error('Failed article was: ', JSON.stringify(content));
		console.error('------------');
		console.error(err);
		throw err;
	}
}
