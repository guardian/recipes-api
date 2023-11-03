import { AttributeValue, BatchWriteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { RecipeIndexEntry, RecipeIndexEntryToDynamo } from "./models";
import {v4 as uuid} from "uuid";
import formatISO from "date-fns/formatISO";

const tableName = process.env["TABLE_NAME"];
const client = new DynamoDBClient();
const limit = 30000;

function createRecord(count:number):RecipeIndexEntry[] {
  const now = new Date();

  let out:RecipeIndexEntry[] = [];

  for(let i=0;i<count;i++) {
    out.push({
      capiArticleId: `path/to/fake/recipe/${now.valueOf()}`,
      recipeUID: uuid(),
      lastUpdated: now,
      recipeVersion: Math.random().toString(36).slice(-10)
    });
  }

  return out;
}

async function batchWrite(records:Record<string, AttributeValue>[]) {
  const RequestItems = {};
  RequestItems[tableName] = records.map(Item=>({
    PutRequest: {
      Item,
    }
  }));

  const req = new BatchWriteItemCommand({
    RequestItems,
  });

  await client.send(req);
}

//START MAIN
if(!tableName || tableName=="") {
  console.log(`ERROR You need to set the TABLE_NAME variable to the table to write.  This table will be filled with approximately ${limit} dummy records.`);
  process.exit(1);
}

let recipes = 0;
while(recipes < limit) {
  const countForArticle = Math.ceil(Math.random() * 5);
  const dataToPush = createRecord(countForArticle).map(RecipeIndexEntryToDynamo);

  await batchWrite(dataToPush);
  recipes += countForArticle;
}
