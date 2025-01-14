import {
	recipesforArticle,
	removeAllRecipeIndexEntriesForArticle,
	removeRecipe,
} from './dynamo';
import { announceNewRecipe } from './eventbus';
import type { RecipeIndexEntry } from './models';
import { removeRecipeContent } from './s3';
import { sendTelemetryEvent } from './telemetry';

enum TakedownMode {
	AllVersions,
	SpecificVersion,
}

/**
 * Internal function that does the business of taking a recipe down
 * @param canonicalArticleId article to which the recipe belongs
 * @param recipe index entry identifying the recipe
 * @param mode Takedown mode. If `TakedownMode.AllVersions`, then any occurence of the content's uid is removed.
 * If `TakedownMode.SpecificVersion`, then the recipe is only removed if its checksum matches the one given in `recipe`
 */
async function takeRecipeDown({
	canonicalArticleId,
	recipe,
	mode,
	staticBucketName,
	fastlyApiKey,
	contentPrefix,
}: {
	canonicalArticleId: string;
	recipe: RecipeIndexEntry;
	mode: TakedownMode;
	staticBucketName: string;
	fastlyApiKey: string;
	contentPrefix: string;
}): Promise<void> {
	console.log(
		`takeRecipeDown: removing recipe ${recipe.recipeUID} for ${canonicalArticleId} from the index`,
	);
	await removeRecipe(
		canonicalArticleId,
		recipe.recipeUID,
		mode == TakedownMode.AllVersions ? undefined : recipe.checksum,
	);

	console.log(
		`takeRecipeDown: removing content version ${recipe.checksum} for ${recipe.recipeUID} on ${canonicalArticleId} from the store`,
	);
	await removeRecipeContent({
		recipeSHA: recipe.checksum,
		staticBucketName: staticBucketName,
		fastlyApiKey: fastlyApiKey,
		contentPrefix,
	});
	console.log(
		`takeRecipeDown: complete for ${recipe.checksum} for ${recipe.recipeUID} on ${canonicalArticleId}`,
	);
}

/**
 * Call this function if you have a recipe which has been deleted, not updated, and must therefore be wiped from the index
 *
 * @param client
 * @param canonicalArticleId
 * @param recipe
 */
export async function removeRecipePermanently({
	canonicalArticleId,
	recipe,
	staticBucketName,
	fastlyApiKey,
	contentPrefix,
}: {
	canonicalArticleId: string;
	recipe: RecipeIndexEntry;
	staticBucketName: string;
	fastlyApiKey: string;
	contentPrefix: string;
}) {
	await takeRecipeDown({
		canonicalArticleId,
		recipe,
		mode: TakedownMode.AllVersions,
		staticBucketName,
		fastlyApiKey,
		contentPrefix,
	});

	try {
		await sendTelemetryEvent('TakenDown', recipe.recipeUID, '');
	} catch (err) {
		console.error(
			`ERROR [${canonicalArticleId}] - unable to send telemetry: `,
			err,
		);
	}
}

/**
 * Call this function if you have a recipe which has been updated but not deleted
 *
 * @param client
 * @param canonicalArticleId
 * @param recipe
 */
export async function removeRecipeVersion({
	canonicalArticleId,
	recipe,
	staticBucketName,
	fastlyApiKey,
	contentPrefix,
}: {
	canonicalArticleId: string;
	recipe: RecipeIndexEntry;
	staticBucketName: string;
	fastlyApiKey: string;
	contentPrefix: string;
}) {
	return takeRecipeDown({
		canonicalArticleId,
		recipe,
		mode: TakedownMode.SpecificVersion,
		staticBucketName,
		fastlyApiKey,
		contentPrefix,
	});
}

export async function removeAllRecipesForArticle({
	canonicalArticleId,
	staticBucketName,
	fastlyApiKey,
	contentPrefix,
	outgoingEventBus,
}: {
	canonicalArticleId: string;
	staticBucketName: string;
	fastlyApiKey: string;
	contentPrefix: string;
	outgoingEventBus: string;
}): Promise<number> {
	const removedEntries =
		await removeAllRecipeIndexEntriesForArticle(canonicalArticleId);
	console.log(
		`Taken down article ${canonicalArticleId} had ${removedEntries.length} recipes in it which will also be removed`,
	);
	await Promise.all(
		removedEntries.map((recep) =>
			removeRecipeContent({
				recipeSHA: recep.checksum,
				staticBucketName: staticBucketName,
				fastlyApiKey,
				contentPrefix,
				purgeType: 'hard',
			}),
		),
	);

	try {
		await announceNewRecipe([], removedEntries, outgoingEventBus);
	} catch (e) {
		const err = e as Error;
		console.error(`Unable to announce takedowns: ${err.toString()}`);
	}

	try {
		await Promise.all(
			removedEntries.map((recep) =>
				sendTelemetryEvent('TakenDown', recep.recipeUID, ''),
			),
		);
	} catch (err) {
		console.error(
			`ERROR [${canonicalArticleId}] - unable to send telemetry: `,
			err,
		);
	}
	return removedEntries.length;
}

/**
 * This function checks an incoming list of recipes (from an article update) against the list of recipes
 * currently present.  If we are missing any of the "current" recipes then these should be taken down.
 * @param dynamoClient DynamoDB client so we can query the index database
 * @param canonicalArticleId ID of the article that's being updated
 * @param recipeChecksumsToKeep list of the "new" recipes that are in the update (and should therefore be kept)
 * @return list of the recipes that were present in the current version but not in the update. These should be taken down.
 */
export async function recipesToTakeDown(
	canonicalArticleId: string,
	recipeChecksumsToKeep: string[],
): Promise<RecipeIndexEntry[]> {
	const toKeepSet = new Set(recipeChecksumsToKeep);
	const currentSet = await recipesforArticle(canonicalArticleId);

	//ES6 does not give us a Set.difference method, unfortunately. So we have to do it here.
	return currentSet.filter((rec) => !toKeepSet.has(rec.checksum));
}
