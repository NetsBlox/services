const utils = require("./assets/utils");

describe.only(utils.suiteName(__filename), function () {
  const APIKeys = utils.reqSrc("api-keys");
  const APIKey = utils.reqSrc("procedures/utils/api-key");
  const InMemoryCloudClient = require("./assets/mock-cloud-client");
  const assert = require("assert");

  beforeEach(() => cloudClient = new InMemoryCloudClient());

  it("should create API keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value);
    const keys = await apiKeys.list(username);
    const key = keys.find((key) => key.provider === type);
    assert(key, `new key (${type}) not found`);
  });

  it("should get API keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value);
    const apiKey = APIKey.GoogleMapsKey;
    const key = await apiKeys.get(username, apiKey);
    console.log(
      await apiKeys.list(username),
      apiKey,
      key,
    );
    // TODO: update the key to be returned
    assert.notEqual(key.value, apiKey.value);
  });

  it("should delete keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value);
    await apiKeys.delete(username); // TODO
    const keys = await apiKeys.list(username);
    const key = keys.find((key) => key.provider === type);
    assert(!key, `new key (${type}) not deleted`);
  });

  let id = 1;
  function newKey() {
    const username = `user_${id++}`;
    return {
      username,
      type: "Google Maps",
      value: `value_${id}`,
    };
  }
});
