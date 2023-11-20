import type {Content} from "@guardian/content-api-models/v1/content";
import {ContentType} from "@guardian/content-api-models/v1/contentType";
import type {RecipeReference} from "@recipes-api/lib/recipes-data";
import {
  calculateChecksum,
  extractAllRecipesFromArticle,
  insertNewRecipe,
  publishRecipeContent,
  recipesToTakeDown,
  removeRecipeVersion
} from "@recipes-api/lib/recipes-data";
import {DynamoClient} from "./dynamo_conn";

/**
 * Pushes new content into the service
 * @param canonicalArticleId
 * @param recep
 */
async function publishRecipe(canonicalArticleId:string, recep:RecipeReference):Promise<void>
{
  console.log(`INFO [${canonicalArticleId}] - pushing ${recep.recipeUID} @ ${recep.checksum} to S3...`);
  await publishRecipeContent(recep);
  console.log(`INFO [${canonicalArticleId}] - updating index table...`);
  await insertNewRecipe(DynamoClient, canonicalArticleId, {recipeUID: recep.recipeUID, checksum: recep.checksum});
}

/**
 * Takes an updated article and updates any recipes from inside it
 * @param content - Content of an incoming article
 * @returns a number, representing the number of recipes that were updated
 */
export async function handleContentUpdate(content:Content):Promise<number>
{
  if(content.type!=ContentType.ARTICLE) return 0;  //no point processing live-blogs etc.

  const allRecipes:RecipeReference[] = (await extractAllRecipesFromArticle(content)).map(calculateChecksum);
  console.log(`INFO [${content.id}] - has ${allRecipes.length} recipes`);
  if(allRecipes.length==0) return 0;  //no point hanging around and noising up the logs

  const entriesToRemove = await recipesToTakeDown(DynamoClient, content.id, allRecipes.map(recep=>recep.recipeUID));
  console.log(`INFO [${content.id}] - ${entriesToRemove.length} recipes have been removed/superceded`);
  entriesToRemove.map(recep=>removeRecipeVersion(DynamoClient, content.id, recep));

  console.log(`INFO [${content.id}] - publishing ${allRecipes.length} recipes to the service`)
  await Promise.all(allRecipes.map(recep=>publishRecipe(content.id, recep)))

  console.log(`INFO [${content.id}] - Done`);
  return allRecipes.length;
}

