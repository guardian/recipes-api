import fs from "node:fs";
import path from "path";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";
import {mockClient} from "aws-sdk-client-mock";
import {MiseEnPlaceData} from "@recipes-api/lib/facia";
import {filterS3Front} from "./sponsorship_filter";

//List of the recipe IDs in the second container
const recipesToDrop:string[] = [
  "767f97b8275340e2b56f223eb8e97dbb",
  "6b69c1c1bde8472e9e0dd930a6a54b05",
  "b73aad6cc5384589af6cc1b62d74b04e",
  "db723e4b1c64456fad8b120beebfdfdb",
  "cff096147abb4bfca8480fc21cc3a9e3",
  "273c0ef6a4f546488b58853686d59c1c",
  "d74b6d3a910a4a6f8f1708cc5539d8dd",
  "e2f13be00bbc441d8f73aae68bc2e238"
];

const s3mock = mockClient(S3Client);
jest.mock('./is-sponsored', ()=>({
  isSponsored: (recipeId:string)=>{
    return Promise.resolve(recipesToDrop.includes(recipeId));
  }
}));

function loadFixture(name:string) {
  const filepath = path.join(__dirname, name);

  const buffer = fs.readFileSync(filepath);
  return JSON.parse(buffer.toString("utf-8")) as unknown;
}

const originalData = loadFixture("real-curation-data.json");

describe('filterS3Front', () => {
  beforeEach(()=>{
    jest.resetAllMocks();
    s3mock.reset();
    s3mock.on(GetObjectCommand).resolves({
      //@ts-ignore
      Body: {
        transformToString: jest.fn().mockResolvedValue(JSON.stringify(originalData))
      }
    });
  });

  it("should download and filter", async ()=>{
    const original = MiseEnPlaceData.parse(originalData);
    const updated = await filterS3Front("fake-front");

    expect(original.length).toEqual(updated.length);
    for(let i=0;i<original.length; i++) {
      if(i==1) {
        expect(updated[i].items.length).toEqual(0);
        expect(original[i].items.length).toEqual(8);
      } else {
        expect(updated[i].items.length).toEqual(original[i].items.length);
      }
    }
  });

});
