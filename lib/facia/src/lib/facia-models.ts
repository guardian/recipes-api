import { z } from "zod";

//This should mirror FeastAppModel in Facia backend
export const RecipeIdentifier = z.object({
  id: z.string()
})

export type RecipeIdentifier = z.infer<typeof RecipeIdentifier>;

export const Recipe = z.object({
  recipe: RecipeIdentifier
});

export type Recipe = z.infer<typeof Recipe>;

export const Chef = z.object({
  backgroundHex: z.string().optional(),
  id: z.string(),
  image: z.string().optional(),
  bio: z.string().optional(),                //FIXME - should this be Optional? Check with Basecamp team
  foregroundHex: z.string().optional()
});

export type Chef = z.infer<typeof Chef>;

export const Palette = z.object({
  backgroundHex: z.string().optional(),
  foregroundHex: z.string().optional(),
});

export type Palette = z.infer<typeof Chef>;

export const SubCollection = z.object({
  byline: z.string().optional(),
  darkPalette: Palette.optional(),
  image: z.string().optional(),
  title: z.string(),
  lightPalette: Palette.optional(),
  recipes: z.array(z.string())
});

export type SubCollection = z.infer<typeof SubCollection>;

export type ContainerItem = SubCollection | Chef | Recipe;

export const FeastAppContainer = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().optional(),
  items: z.array(z.union([SubCollection, Chef, Recipe]))
});

export type FeastAppContainer = z.infer<typeof FeastAppContainer>;

const AvailableEditions = [
	'feast-northern-hemisphere',
	'feast-southern-hemisphere',
] as const;
export type Edition = (typeof AvailableEditions)[number];
export const Edition = z.custom<Edition>(
	(val) => AvailableEditions.includes(val),
	{
		message: `Edition name must be one of the following: ${AvailableEditions.join(
			', ',
		)}`,
	},
);

const DateString = z.custom<string>((val)=>{
  try {
    const d = Date.parse(val as string);
    return !isNaN(d)
  } catch {
    return false
  }
});

export const FeastCuration = z.object({
  id: z.string(),
  edition: Edition,
  issueDate: DateString,
  version: z.string(),
  fronts: z.record(z.string(), z.array(FeastAppContainer))
});

export type FeastCuration = z.infer<typeof FeastCuration>;
