const utils = require("./assets/utils");

describe(utils.suiteName(__filename), function () {
  const APIKeys = utils.reqSrc("api-keys");
  const APIKey = utils.reqSrc("procedures/utils/api-key");
  const CloudClientBuilder = require("./assets/mock-cloud-client");
  const assert = require("assert");
  const groupId = "g1";
  const username = `user_api_key_test`;
  const groups = [{ id: groupId, owner: username }];

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
    await apiKeys.create(username, type, value, groupId);
    const groupKeys = await apiKeys.list(username, groupId);
    const key = groupKeys.find((key) => key.provider === type);
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
    await apiKeys.create(username, type, value, groupId);
    await apiKeys.delete(username, type, groupId);
    const keys = await apiKeys.list(username, id);
    const key = keys.find((key) => key.provider === type);
    assert(!key, `key not removed from each group`);
  });

  it("should throw error if not-group owner", async function () {
    const { username, type, value } = newKey();
    const apiKeys = new APIKeys(cloudClient);
    const otherUser = "someUser";
    await assert.rejects(apiKeys.create(otherUser, type, value, groupId));
  });

  let id = 1;
  function newKey() {
    return {
      username,
      type: "Google Maps",
      value: `value_${id++}`,
    };
  }

  describe("router", function () {
    const axios = require("axios");
    const routerUtils = require("../src/procedures/utils/router-utils");
    const port = process.env.PORT || 8934;
    let app;

    beforeEach(() => {
      const userData = {};
      userData[username] = { apiKeys: { "Google Maps": "abc" } };
      const groupData = {};
      groupData[groupId] = { apiKeys: { "Pixabay": "def" } };

      cloudClient = CloudClientBuilder.builder()
        .withGroups(groups)
        .withUserSettings(userData)
        .withGroupSettings(groupData)
        .build();
      apiKeys = new APIKeys(cloudClient);
      const router = apiKeys.router();
      const server = require("express")();
      server.use(routerUtils.json());
      // Add a middleware for setting the username in the tests
      server.use((req, _res, next) => {
        req.session = {
          username: req.query.username,
        };
        next();
      });
      server.use(router);
      app = server.listen(port);
    });

    afterEach(() => app.close());

    function url(path) {
      return `http://localhost:${port}` + path;
    }

    it("should list API providers", async function () {
      const resp = await axios.get(url("/providers"));
      assert.equal(resp.status, 200);
      assert(Array.isArray(resp.data));
      assert(resp.data.every((k) => k.provider && k.url));
    });

    it("should create user key", async function () {
      const prov = "Data.gov";
      const value = "abcdef";
      const resp = await axios.post(
        url(
          `/${encodeURIComponent(prov)}?username=${username}`,
        ),
        { value },
      );
      assert.equal(resp.status, 200);
      const keys = await apiKeys.list(username);
      assert.equal(keys.length, 2);
    });

    it("should create group key", async function () {
      const prov = "Data.gov";
      const value = "abcdef123";
      const resp = await axios.post(
        url(
          `/${encodeURIComponent(prov)}?username=${username}&group=${groupId}`,
        ),
        { value },
      );
      assert.equal(resp.status, 200);
      const keys = await apiKeys.list(username, groupId);
      assert.equal(keys.length, 2);
    });

    it("should return error if non-owner sets group key", async function () {
      try {
        const prov = "Data.gov";
        const value = "abcdef123";
        const resp = await axios.post(
          url(
            `/${encodeURIComponent(prov)}?username=otherUser&group=${groupId}`,
          ),
          { value },
        );
      } catch (err) {
        assert.equal(err.response.status, 403);
      }
    });

    it("should list user keys", async function () {
      const resp = await axios.get(url(`/?username=${username}`));
      assert(Array.isArray(resp.data));
      assert.equal(resp.data.length, 1);
      assert.equal(resp.data[0].provider, "Google Maps");
    });

    it("should list group keys", async function () {
      const resp = await axios.get(
        url(`/?username=${username}&group=${groupId}`),
      );
      assert(Array.isArray(resp.data));
      assert.equal(resp.data.length, 1);
      assert.equal(resp.data[0].provider, "Pixabay");
    });

    it("should delete user keys", async function () {
      const prov = "Google Maps";
      const resp = await axios.delete(
        url(`/${encodeURIComponent(prov)}?username=${username}`),
      );
      assert.equal(resp.status, 200);
      const keys = await apiKeys.list(username);
      assert.equal(keys.length, 0);
    });

    it("should delete group keys", async function () {
      const prov = "Pixabay";
      const resp = await axios.delete(
        url(
          `/${encodeURIComponent(prov)}?username=${username}&group=${groupId}`,
        ),
      );
      assert.equal(resp.status, 200);
      const keys = await apiKeys.list(username, groupId);
      assert.equal(keys.length, 0);
    });

    it("should return error if non-owner deletes group key", async function () {
      const prov = "Pixabay";
      try {
        await axios.delete(
          url(
            `/${encodeURIComponent(prov)}?username=otherUser&group=${groupId}`,
          ),
        );
        assert(false, "Request returned successful status code");
      } catch (err) {
        assert.equal(err.response.status, 403);
      }
    });
  });
});
