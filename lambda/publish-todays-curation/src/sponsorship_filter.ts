import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import type {ContainerItem, MiseEnPlaceDataFormat} from "@recipes-api/lib/facia";
import { MiseEnPlaceData, Recipe} from "@recipes-api/lib/facia";
import {Bucket} from "./config";
import {isSponsored} from "./is-sponsored";

const s3client = new S3Client({region: process.env["AWS_REGION"]});

async function downloadCurationFile(Key: string) {
  const req = new GetObjectCommand({
    Bucket,
    Key
  });

  const response = await s3client.send(req);
  const content = response.Body ? await response.Body.transformToString("utf-8") : undefined;
  return content ? MiseEnPlaceData.parse(JSON.parse(content)) : undefined;
}

function maybeRecipe(theThing:unknown):Recipe | undefined {
  try {
    //Is the given entry a recipe entry?
    return Recipe.parse(theThing);
  } catch(err) {
    return undefined;  //if not, then return undefined.
  }
}

function filterItemList(itemList: ContainerItem[], isSponsoredMap:Record<string, boolean>): ContainerItem[] {
  return itemList.filter(entry=>{
    const recipePtr = maybeRecipe(entry);
    if(recipePtr) {
      const sponsorFlag = isSponsoredMap[recipePtr.recipe.id]; //if it IS sponsored, we do NOT want to keep it.
      switch (sponsorFlag) {
        case true:
          return false;
        case false:
          return true;
        case undefined:
          return false;
      }
    } else {
      return true;  //keep it if it's not a recipe
    }
  })
}

function getAllRecipeIdsFromCuration(front:MiseEnPlaceDataFormat) {
  return front.flatMap((container)=>
    container.items.filter(item=>maybeRecipe(item)) as Recipe[]
  )
}

async function checkSponsorshipStatus(recipeIds:Recipe[]):Promise<Record<string, boolean>> {
  const result:Record<string, boolean> = {};

  for (const recep of recipeIds) {
    try {
      result[recep.recipe.id] = await isSponsored(recep.recipe.id)
    } catch(err) {
      console.error(`Could not check recipe ID ${recep.recipe.id} as it no longer exists!`, err);
      //Don't put it in the map. This will cause the filter function to drop it out.
    }
  }
  return result;
}

export async function filterS3Front(Key: string) {
  const content = await downloadCurationFile(Key);

  if(content) {
    console.log(`Curation front ${Key} has ${content.length} containers`);
    const allRecipeIds = getAllRecipeIdsFromCuration(content);
    const isSponsoredMap = await checkSponsorshipStatus(allRecipeIds);

    return content.map((container)=>({
      ...container,
      items: filterItemList(container.items, isSponsoredMap),
    })) as MiseEnPlaceDataFormat
  } else {
    throw new Error(`There was no content for the front ${Key}`);
  }
}
