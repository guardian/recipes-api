import type {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {recipesforArticle, removeAllRecipeIndexEntriesForArticle, removeRecipe} from './dynamo';
import type { RecipeIndexEntry } from './models';
import {removeRecipeContent} from "./s3";

enum TakedownMode {
  AllVersions,
  SpecificVersion
}

/**
 * Internal function that does the business of taking a recipe down
 * @param client DynamoDB client object
 * @param canonicalArticleId article to which the recipe belongs
 * @param recipe index entry identifying the recipe
 * @param mode Takedown mode. If `TakedownMode.AllVersions`, then any occurence of the content's uid is removed.
 * If `TakedownMode.SpecificVersion`, then the recipe is only removed if its checksum matches the one given in `recipe`
 */
async function takeRecipeDown(client: DynamoDBClient, canonicalArticleId: string, recipe: RecipeIndexEntry, mode:TakedownMode):Promise<void>
{
  console.log(`takeRecipeDown: removing recipe ${recipe.recipeUID} for ${canonicalArticleId} from the index`);
  await removeRecipe(client, canonicalArticleId, recipe.recipeUID, mode==TakedownMode.AllVersions ? undefined : recipe.checksum);

  console.log(`takeRecipeDown: removing content version ${recipe.checksum} for ${recipe.recipeUID} on ${canonicalArticleId} from the store`);
  await removeRecipeContent(recipe.checksum);
  console.log(`takeRecipeDown: complete for ${recipe.checksum} for ${recipe.recipeUID} on ${canonicalArticleId}`);
}

/**
 * Call this function if you have a recipe which has been deleted, not updated, and must therefore be wiped from the index
 *
 * @param client
 * @param canonicalArticleId
 * @param recipe
 */
export async function removeRecipePermanently(client: DynamoDBClient, canonicalArticleId: string, recipe: RecipeIndexEntry)
{
  return takeRecipeDown(client, canonicalArticleId, recipe, TakedownMode.AllVersions);
}

/**
 * Call this function if you have a recipe which has been updated but not deleted
 *
 * @param client
 * @param canonicalArticleId
 * @param recipe
 */
export async function removeRecipeVersion(client: DynamoDBClient, canonicalArticleId: string, recipe: RecipeIndexEntry)
{
  return takeRecipeDown(client, canonicalArticleId, recipe, TakedownMode.SpecificVersion);
}

export async function removeAllRecipesForArticle(client: DynamoDBClient, canonicalArticleId: string): Promise<number>
{
  const removedEntries = await removeAllRecipeIndexEntriesForArticle(client, canonicalArticleId);
  console.log(`Taken down article ${canonicalArticleId} had ${removedEntries.length} recipes in it which will also be removed`);
  await Promise.all(removedEntries.map(recep=>removeRecipeContent(recep.checksum, "hard")));
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
export async function recipesToTakeDown(dynamoClient:DynamoDBClient, canonicalArticleId:string, recipeChecksumsToKeep: string[]):Promise<RecipeIndexEntry[]>
{
  const toKeepSet = new Set(recipeChecksumsToKeep);
  const currentSet = await recipesforArticle(dynamoClient, canonicalArticleId);

  //ES6 does not give us a Set.difference method, unfortunately. So we have to do it here.
  return currentSet.filter(rec=>!toKeepSet.has(rec.checksum));
}
