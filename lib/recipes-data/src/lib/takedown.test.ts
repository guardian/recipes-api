import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {mockClient} from "aws-sdk-client-mock";
import {recipesforArticle, removeAllRecipeIndexEntriesForArticle, removeRecipe} from './dynamo';
import type { RecipeIndexEntry } from './models';
import {removeRecipeContent} from "./s3";
import {recipesToTakeDown, removeAllRecipesForArticle, removeRecipePermanently, removeRecipeVersion} from './takedown';

mockClient(DynamoDBClient);
const ddbClient = new DynamoDBClient(); //this is a mock object due to `mockClient` above

jest.mock("./s3", ()=>({
  removeRecipeContent: jest.fn(),
}));

jest.mock("./dynamo", ()=>({
  removeAllRecipeIndexEntriesForArticle: jest.fn(),
  removeRecipe: jest.fn(),
  recipesforArticle: jest.fn()
}));

describe("takedown", ()=>{
  beforeEach(()=>{
    jest.resetAllMocks();
    //@ts-ignore -- Typescript doesn't know that this is a mock
    removeRecipeContent.mockReturnValue(Promise.resolve());
    //@ts-ignore -- Typescript doesn't know that this is a mock
    removeRecipe.mockReturnValue(Promise.resolve());
  });

  it("removeRecipePermanently should delete the given recipe from the index and from the content bucket", async ()=>{
    await removeRecipePermanently(ddbClient, "path/to/some/article", {recipeUID: "some-uid", checksum: "xxxyyyzzz"});

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipe.mock.calls.length).toEqual(1);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls.length).toEqual(1);

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipe.mock.calls[0][1]).toEqual("path/to/some/article");
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipe.mock.calls[0][2]).toEqual("some-uid");
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls[0][0]).toEqual("xxxyyyzzz");
  });

  it("removeRecipeVersion should delete the given recipe from the content bucket but not the index", async ()=>{
    await removeRecipeVersion(ddbClient, "path/to/some/article", {recipeUID: "some-uid", checksum: "xxxyyyzzz"});

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipe.mock.calls.length).toEqual(0);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls.length).toEqual(1);

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls[0][0]).toEqual("xxxyyyzzz");
  });

  it("removeAllRecipesForArticle should remove all entries from the database and use the information gleaned to remove from content bucket", async ()=>{
    const knownArticles:RecipeIndexEntry[] = [
      {
        checksum: "abcd",
        recipeUID:"r1"
      },
      {
        checksum: "efg",
        recipeUID:"r2"
      },
      {
        checksum: "hij",
        recipeUID:"r3"
      },
    ];

    //@ts-ignore -- Typescript doesn't know that this is a mock
    removeAllRecipeIndexEntriesForArticle.mockReturnValue(Promise.resolve(knownArticles));

    await removeAllRecipesForArticle(ddbClient, "path/to/some/article");

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeAllRecipeIndexEntriesForArticle.mock.calls.length).toEqual(1);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeAllRecipeIndexEntriesForArticle.mock.calls[0][1]).toEqual("path/to/some/article");
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls.length).toEqual(3);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls[0]).toEqual(["abcd", "soft"]);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls[1]).toEqual(["efg", "soft"]);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(removeRecipeContent.mock.calls[2]).toEqual(["hij", "soft"]);
  });
});

describe("takedown.recipesToTakeDown", ()=>{
  beforeEach(()=>{
    jest.resetAllMocks();
  });

  it("should return a list of recipe references that feature in the DB but not in the incoming update", async ()=>{
    const fakeDbContent:RecipeIndexEntry[] = [
      {
        checksum: "vers938",
        recipeUID: "number1"
      },
      {
        checksum: "vers963",
        recipeUID: "number2"
      },
      {
        checksum: "vers346",
        recipeUID: "number3"
      },
      {
        checksum: "vers432",
        recipeUID: "number4"
      },
      {
        checksum: "vers9789",
        recipeUID: "number5"
      },
    ];

    const fakeUpdateIds:string[] = ["number1","number3","number4"];

    // @ts-ignore -- Typescript doesn't know that this is a mock
    recipesforArticle.mockReturnValue(Promise.resolve(fakeDbContent));

    const result = await recipesToTakeDown(ddbClient, "some-article-id", fakeUpdateIds);
    expect(result).toEqual([
      {checksum: "vers963", recipeUID:"number2"},
      {checksum: "vers9789", recipeUID: "number5"}
    ]);

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls.length).toEqual(1);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls[0][0]).toEqual(ddbClient);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls[0][1]).toEqual("some-article-id");
  });

  it("should return an empty list if there is nothing to take down", async ()=>{
    const fakeDbContent:RecipeIndexEntry[] = [
      {
        checksum: "vers938",
        recipeUID: "number1"
      },
      {
        checksum: "vers346",
        recipeUID: "number3"
      },
      {
        checksum: "vers432",
        recipeUID: "number4"
      },
    ];

    const fakeUpdateIds:string[] = ["number1","number3","number4"];

    // @ts-ignore -- Typescript doesn't know that this is a mock
    recipesforArticle.mockReturnValue(Promise.resolve(fakeDbContent));

    const result = await recipesToTakeDown(ddbClient, "some-article-id", fakeUpdateIds);
    expect(result).toEqual([]);

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls.length).toEqual(1);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls[0][0]).toEqual(ddbClient);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls[0][1]).toEqual("some-article-id");
  });

  it("should return an empty list if both input and current state are empty", async ()=>{
    const fakeDbContent:RecipeIndexEntry[] = [];

    const fakeUpdateIds:string[] = [];

    // @ts-ignore -- Typescript doesn't know that this is a mock
    recipesforArticle.mockReturnValue(Promise.resolve(fakeDbContent));

    const result = await recipesToTakeDown(ddbClient, "some-article-id", fakeUpdateIds);
    expect(result).toEqual([]);

    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls.length).toEqual(1);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls[0][0]).toEqual(ddbClient);
    //@ts-ignore -- Typescript doesn't know that this is a mock
    expect(recipesforArticle.mock.calls[0][1]).toEqual("some-article-id");
  });
})
