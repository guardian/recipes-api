import type {RetrievableContent} from "@guardian/content-api-models/crier/event/v1/retrievableContent";
import type {Content} from "@guardian/content-api-models/v1/content";
import {ContentType} from "@guardian/content-api-models/v1/contentType";
import {callCAPI} from "@recipes-api/lib/capi";
import {handleContentUpdate} from "./update_processor";
import {handleContentUpdateRetrievable} from "./update_retrievable_processor";

jest.mock("@recipes-api/lib/capi", ()=>({
  callCAPI: jest.fn(),
}));

jest.mock("./update_processor", ()=>({
  handleContentUpdate: jest.fn(),
}));

jest.mock("./config", ()=>({
  CapiKey: "fake-api-key",
}));

const fakeUpdate:RetrievableContent = {
  capiUrl: "api:///path/to/article",
  id: "path/to/article",
  contentType: ContentType.ARTICLE,
}

const fakeContent:Content = {
  apiUrl: "api://path/to/content",
  id: "path/to/content",
  isHosted: false,
  references: [],
  tags: [],
  type: ContentType.ARTICLE,
  webTitle: "Test Article",
  webUrl: "web://path/to/content"
}

describe('handleContentUpdateRetrievable',  ()=> {
  beforeEach(()=>{
    jest.resetAllMocks();
  });

  it("should retrieve the content from CAPI, then call out to the regular update-processor", async ()=>{
    // @ts-ignore -- Typescript doesn't know that this is a mock
    callCAPI.mockReturnValue(Promise.resolve({action:0, content: fakeContent}));
    // @ts-ignore -- Typescript doesn't know that this is a mock
    handleContentUpdate.mockReturnValue(Promise.resolve(3));

    const recordCount = await handleContentUpdateRetrievable(fakeUpdate);
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(callCAPI.mock.calls.length).toEqual(1);
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(callCAPI.mock.calls[0][0]).toEqual(fakeUpdate.capiUrl + "?show-fields=internalRevision&show-blocks=all&show-channels=all&api-key=fake-api-key&format=thrift");
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(handleContentUpdate.mock.calls.length).toEqual(1);
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(handleContentUpdate.mock.calls[0][0]).toEqual(fakeContent);
    expect(recordCount).toEqual(3); //it should pass back the value returned by handleContentUpdate
  });

  it("should ignore something that's not an article", async ()=>{
    // @ts-ignore -- Typescript doesn't know that this is a mock
    callCAPI.mockReturnValue(Promise.resolve({action:0, content: fakeContent}));

    const recordCount = await handleContentUpdateRetrievable({...fakeUpdate, contentType: ContentType.GALLERY});
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(callCAPI.mock.calls.length).toEqual(0);
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(handleContentUpdate.mock.calls.length).toEqual(0);
    expect(recordCount).toEqual(0);
  });

  it("should throw if it gets an error response from CAPI", async ()=>{
    // @ts-ignore -- Typescript doesn't know that this is a mock
    callCAPI.mockReturnValue(Promise.resolve({action:4, content: fakeContent}));

    await expect(handleContentUpdateRetrievable(fakeUpdate)).rejects.toEqual(new Error("Could not handle retrievable update from CAPI: PollingAction code was 4. Allowing the lambda runtime to retry or DLQ."));

    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(callCAPI.mock.calls.length).toEqual(1);
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(handleContentUpdate.mock.calls.length).toEqual(0);
  });

  it("should disregard content that is taken down in the meantime", async ()=>{
    // @ts-ignore -- Typescript doesn't know that this is a mock
    callCAPI.mockReturnValue(Promise.resolve({action:1, content: fakeContent}));

    const recordCount = await handleContentUpdateRetrievable(fakeUpdate);
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(callCAPI.mock.calls.length).toEqual(1);
    // @ts-ignore -- Typescript doesn't know that this is a mock
    expect(handleContentUpdate.mock.calls.length).toEqual(0);
    expect(recordCount).toEqual(0);
  });
});
