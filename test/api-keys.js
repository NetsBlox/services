const utils = require("./assets/utils");

describe(utils.suiteName(__filename), function () {
  const APIKeys = utils.reqSrc("api-keys");
  const APIKey = utils.reqSrc("procedures/utils/api-key");
  const CloudClient = require("./assets/mock-cloud-client");
  const assert = require("assert");
  const groupId = "g1";
  const username = `user_api_key_test`;
  const groups = [{ id: groupId, owner: username }];

  it("should get API keys", async function () {
    const cloudClient = CloudClient.builder().withGroups(groups).build();
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value);
    const apiKey = APIKey.GoogleMapsKey;
    const key = await apiKeys.get(username, apiKey);
    assert.notEqual(key.value, apiKey.value);
  });
});
