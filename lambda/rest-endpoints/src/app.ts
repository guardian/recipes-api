import bodyParser from 'body-parser';
import {renderFile as ejs} from "ejs";
import express from 'express';
import type {Request} from 'express';
import {deployCurationData, recipeByUID } from "@recipes-api/lib/recipes-data";
import {getBodyContentAsJson, validateDateParam} from "./helpers";
import {FeastAppContainer} from "@recipes-api/lib/facia";

export const app = express();
app.set('view engine', 'ejs');
app.engine('.ejs', ejs);

const router = express.Router();
router.use(bodyParser.json({
  limit: '1mb'
}));

interface CurationParams {
  edition: string;
  front: string;
}

/**
 * Checks whether the parameters make sense and raises an exception if they don't
 * @param params CurationParams object
 */
function validateCurationParams(params: CurationParams) {
  const checker = /[^\\w]+/;

  if(!params.edition.match(checker) || !params.front.match(checker)) {
    throw new Error("Invalid region parameter");
  }
}

router.post('/api/curation/:edition/:front', (req: Request<CurationParams>, resp)=>{
  if(req.header("Content-Type") != "application/json") {
    resp.status(405).json({status: "error", detail: "wrong content type"});
    return;
  }

  let dateval:Date|null = null;

  try {
    dateval = req.query.date ? validateDateParam(req.query.date as string) : null;
  } catch {
    console.log("Provided querystring ", req.query, " did not validate");
    resp.status(400).json({status: "error", "detail": "invalid querystring parameters. date must be specified in YYYY-MM-DD format"})
    return;
  }

  try {
    validateCurationParams(req.params);
  } catch(err) {
    console.log("Provided params ", req.params, " did not validate");
    resp.status(400).json({status: "error", "detail": "invalid regionalisation parameters. region and variant must be basic strings with no punctuation etc."})
    return;
  }

  try {
    const textContent = getBodyContentAsJson(req.body);
    if(textContent.length==0) {
      resp.status(400).json({status: "error", detail: "no content was sent"});
      return;
    }

    //For the time being, this check is only advisory as we are not 100% confident that the models represent everything that MEP can send
    //When we move to Fronts this will be mandatory
    try {
      FeastAppContainer.parse(JSON.parse(textContent));
    } catch (err) {
      console.warn(`We were sent content that did not validate: `, err);
      console.warn(`Data we got: ${textContent}`);
      resp.status(400).json({status: "error", detail: (err as Error).toString()});
      return;
    }

    deployCurationData(textContent, req.params.edition, req.params.front, dateval)
      .then(() => {
        return resp.status(200).json({status: "ok"})
      })
      .catch((err) => {
        console.error(err);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment -- can't help `err` being untyped
        return resp.status(500).json({status: "error", detail: err.toString()})
      })
  } catch(err) {
    console.error("Could not parse incoming data as json: ", err);
    return resp.status(400).json({status: "error", detail: "invalid content"});
  }
});

interface RecipeIdParams {
  recipeUID: string;
}

function validateComposerParams(params: RecipeIdParams) {
  const checker = /^[\w\d]+$/;

  if(!params.recipeUID.match(checker)) {
    throw new Error("Invalid recipe UID");
  }
}

router.get('/api/content/by-uid/:recipeUID', (req: Request<RecipeIdParams>, resp) => {
  try {
    validateComposerParams(req.params);
  } catch(e) {
    console.log("Provided params ", req.params, " did not validate");
    resp.status(400).json({status: "error", detail: "invalid recipe immutable ID"});
    return;
  }

  recipeByUID(req.params.recipeUID).then(result=>{
    if(result) {
      resp.redirect(`/content/${result.checksum}`);
      return;
    } else {
      resp.status(404).json({status: "not found", detail: "No recipe found with that UID"});
      return;
    }
  }).catch((err)=>{
    console.error(err);
    resp.status(500).json({status: "error", detail: "there was an internal error fetching the recipe. See server-side logs."})
  });
});

app.use('/', router);
