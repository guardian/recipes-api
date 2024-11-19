# Recipes API / Recipes Backend

## What is this?

This is a backend service that translates data from the Content API into a format that apps like
https://github.com/guardian/ios-feast can use.

# Operations

## Set up for local operations

You need to have a large number of environment variables set for the tools to work. Fortunately there is a script to make setting them up easier.

1. Get CAPI credentials from Janus. You'll need the AWS commandline, and `jq` utility, installed; but you should have these already.
2. Run `STAGE=CODE ./get-local-config.sh` to generate the file `environ-CODE`. Substitute PROD for CODE to get setup for the Production environment (but be careful!)

- I'd recommend deleting the file once you're done with it.

3. It goes without saying that these environ files should NEVER be committed to the repo. They are gitignored, but still... don't do it.
4. Once you have the file, run `source environ-CODE` to set up the environment variables you need to target the CODE environment.
5. You can now run the tools outlined below.

## Testing

Run tests in every project with `npm run test`.

For a tighter feedback loop, run individual projects or files, and watch, with `npm run test -- [project-name] [--test-file file-name] [--watch]`, for example `npm run test -- recipes-data --test-file transform.test.ts --watch`.

## How do I re-index content from CAPI out to Feast?

1. Set up for local operations, as above
2. Run `npm run commandline-reindex -- [--composerId 1234567] [--capiUri path/to/article/in/capi] [--recipeUid 0551534c8d93e8da7bb70553b10fa0d0f62534a3]`

Note that Content API publishes _articles_, wheras we publish _recipes_. There may well be more than one recipe in an article. This command will therefore
re-publish _every_ recipe from the given article; it may well change the SHA value (mutable ID) of some of the recipes. The index will be updated to respect this;
it's necessary so that the client app knows that the content has changed.

You must specify exactly one of the three optional arguments above.

- `--composerId` is the composer ID of an article to re-index. This can be found in the `internalComposerCode` field in CAPI or at the end of a Composer URL (when
  editing a piece of content, the address your browser shows is `/content/{composer-id}`).
- `--capiUri` is the path under which the content can be found in CAPI. It's OK to use either the full URI or the path. Normally this is the same as the URL
  path under which the content can be found on the website.
- `--recipeUid` is an immutable recipe id (UUID) from the Feast app. This can be found in the index.json or at the bottom of a recipe in the feast app when you
  have Developer Mode turned on.

When this command is run, the normal publication process will be performed on your local machine. New content will be published, the index updated and the
caches flushed.

You will need to force an update on the app to actually see the changes.

You _can_ run with `--all` to republish _every single article in the system_. But be careful;

- **one** the index is only regenerated at the end, so it must complete or the index may point to recipe versions that don't exist any more
- **two** if material content updates are made to all recipes that could be a large update for the clients to handle.

## How do I republish only the index JSON?

If you suspect that the index JSON has got out of sync somehow (of _course_, that could never happen!) then you can re-generate it by running:
`npm run commandline-reindex -- --index-only`

## How do I manually force a takedown?

1. Set up for local operations, as above
2. Find the CAPI path for the article you want to take down. Normally this is the same as the URL path on the Guardian website.
3. Run `ARTICLE_ID={capi-path} npm run manual-takedown`.

When this command is run, the normal removal process will be performed on your local machine. All recipes from the article will be removed, the index updated and the
caches flushed.

**Note** The Feast app does _not_ show content "live"; it downloads and caches it. Therefore, even when a recipe is "taken down" it can still be
seen by end-users until their app refreshes its content.

# Development and Deployment

## Running CDK

The CDK stack is integrated with `nx`, so the regular "npm run synth" in the cdk directory won't work.

Instead, you can do:

```bash
npm run build
```

To build _everything_, including the CDK.

```bash
npm test
```

Will run the tests on everything, including CDK (therefore it will fail if the CDK snapshot is out of sync)

```bash
npm run update-cdk
```

Will update the CDK snapshot and allow the tests to pass again

## Running projects

Build, test and lint with `npm run build`, `npm run test`, and `npm run lint`. This will run the relevant command for every project.

To run commands against individual projects, use NX. It's installed as a project dependency, and there's a handy alias to run it via NPM: `npm run nx`.

For example, to run the tests in the `lib-recipes-data` project in watch mode, use `npm run nx -- run lib-recipes-data:test --watch`.

See the [NX documentation](https://nx.dev/nx-api/nx/documents) for other commands.

## How does it work?

```mermaid
flowchart LR
    crier([ crier ]) --> kinesis --> responder[recipes-responder]
    responder --> content["Recipe content
    extraction"] --> s3[(s3)]
    responder --> dynamodb --> responder --> index[Index content] --> s3
    s3 --> Fastly --> app([ Mobile app ])
```

- The recipes-responder lambda function receives updates from the Crier kinesis stream
- Anything which is not an article update/takedown is ignored
- Each article update is scanned to find any recipe elements in the article
- We take a SHA of the recipe content so we can detect changes
- The list of recipes (with SHA identifiers) is compared against the list of recipes we already have for that article ID
  - If a recipe SHA does not exist, then it's been removed or updated => we remove its content from the bucket and its entry from the database
- We then take the list of "new" recipes (updated or newly inserted), output their content to S3 and register them in the database
- Explicit CDN flushes are performed for each S3 put/delete
- As we do this, we keep count of the total number of inserts + deletions
- If we have made any inserts or deletions, we scan the index table and output the results as JSON to an `index.json` file in the S3 bucket. Then cache-flush that too.

## How is it used?

- The static S3 bucket is fronted by a Fastly cache distribution.
- The app client makes a HEAD request to `/index.json`, including the `If-Modified-Since` header with the timestamp of the last successful update
  - If no update has taken place, the client receives `304 Not Modified` and can wait for the next poll. No data body is transferred.
  - If an update has taken place since the last update, the client receives `200 OK` with a `Content-Length` header. It can then decide when/how to obtain the whole content
- If an update has taken place, the client downloads `/index.json` with a GET request.
- It then compares the list of version IDs (SHAs, in reality) of each recipe with the one it has locally
  - If the SHA matches then no action needs to be taken
  - If the index has a SHA not in the local database then the content must be downloaded. This is done via `GET /content/{sha}`.
  - If the load database has a SHA that is not in the index then the local version must be deleted.

The underlying assumption is that under "normal operation" there will only be one or two recipe changes in each update, so we minimise the data transfer
inherent in checking for them. Furthermore, it's important the the app can work without a persistent internet connection so we don't know how big/small the change delta is.

### Why no search API?

The data here is for _retrieval_ only; search is a seperate concern which is implemented at https://github.com/guardian/recipe-search-backend.  This is because the search
uses a different tech stack to do advanced semantic search wheras the code here is only concerned with pushing the recipe data into a place where it can
easily be retrieved.

### Auth

Endpoints which require authentication use [API Gateway API keys](https://eu-west-1.console.aws.amazon.com/apigateway/main/api-keys?api=unselected&region=eu-west-1#): one is created for each client, and included in a [usage plan](https://eu-west-1.console.aws.amazon.com/apigateway/main/usage-plans?api=unselected&region=eu-west-1) to give access to an instance of the recipes backend (e.g. CODE or PROD).

## What's in the box?

### lambda/recipes-responder

This is the lambda function which listens to Kinesis updates from crier. It is responsible for all of the processing and extraction logic, although
most of the actual logic lives in the library code imported into it

### lambda/facia-responder

This lambda function responds to curation updates from the Fronts Tool (aka Facia) and publishes them for the Feast app as well as updating Facia with the
publication status

### lambda/publish-todays-curation

This lambda function runs once a day to take that day's curation from the dated folders where it is stored and copy it to the "current" curation.  It's
also triggered by S3 when a new curation data json is written to dated folders; if the date is todays then it is published immediately

### lambda/profile-cache-rebuild

This lambda function is run hourly to update a mapping cache of {tag-id}->{contributor info} at `v2/contributors.json`

### lambda/test-indexbuild

A lambda function that rebuilds the index on-demand. This is incorporated from initial testing and will probably be removed.

### lib/capi

Library functions to communicate with the Content Application Programmer's Interface. This is imported into the lambda code as `@recipes-api/lib/capi`.

### lib/recipes-data

Library functions that hold the actual logic for processing the content. Parsing of the incoming Thrift content is done by the `@guardian/content-api-models/crier`
library; these functions take in data structures defined by the Thrift models and perform inspection, checksumming, databasing, storage and CDN interfacing.

### tools/manual-takedown

Runnable script that allows you to forcibly remove all recipes from a given article ID. This can be run from an npm script: `npm run manual-takedown`.

### tools/fill-db

Runnable script that fills the index table with junk data. This is from initial testing and will be removed, don't use it.
