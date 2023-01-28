const utils = require("./assets/utils");

describe(utils.suiteName(__filename), function () {
  const APIKeys = utils.reqSrc("api-keys");
  const APIKey = utils.reqSrc("procedures/utils/api-key");
  const CloudClientBuilder = require("./assets/mock-cloud-client");
  const assert = require("assert");
  const groupIds = ["g1", "g2"];
  const username = `user_api_key_test`;
  const groups = groupIds.map((id) => ({ id, owner: username }));

  beforeEach(() =>
    cloudClient = CloudClientBuilder.builder()
      .withGroups(groups)
      .build()
  );

  it("should create user keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value);
    const keys = await apiKeys.list(username);
    const key = keys.find((key) => key.provider === type);
    assert(key, `new key (${type}) not found`);
  });

  it("should create group keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value, groupIds);
    const groupKeys = await Promise.all(
      groupIds.map((groupId) => apiKeys.list(username, groupId)),
    );
    const key = groupKeys.every((keys) =>
      keys.find((key) => key.provider === type)
    );
    assert(key, `new key (${type}) not found`);
  });

  it("should get API keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value);
    const apiKey = APIKey.GoogleMapsKey;
    const key = await apiKeys.get(username, apiKey);
    assert.notEqual(key.value, apiKey.value);
  });

  it("should delete user keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    await apiKeys.create(username, type, value);
    await apiKeys.delete(username, type);
    const keys = await apiKeys.list(username);
    const key = keys.find((key) => key.provider === type);
    assert(!key, `new key (${type}) not deleted`);
  });

  it("should delete group keys", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    const groupIds = ["g1", "g2"];
    await apiKeys.create(username, type, value, groupIds);
    await apiKeys.delete(username, type, groupIds);
    const allKeys = await Promise.all(
      groupIds.map((id) => apiKeys.list(username, id)),
    );
    const groupWithKeys = allKeys.find((keys) =>
      keys.find((key) => key.provider === type)
    );
    assert(!groupWithKeys, `key not removed from each group`);
  });

  it.only("should throw error if not-group owner", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    const otherUser = "someUser";
    await assert.rejects(apiKeys.create(otherUser, type, value, groupIds));
  });

  let id = 1;
  function newKey() {
    return {
      username,
      type: "Google Maps",
      value: `value_${id++}`,
    };
  }
});
