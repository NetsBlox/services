const express = require("express");
const Logger = require("./logger");
const assert = require("assert");
const _ = require("lodash");
const APIKey = require("./procedures/utils/api-key");

class APIKeys {
  constructor(cloud, logger) {
    this.logger = logger
      ? logger.fork("api-keys")
      : new Logger("netsblox:api-keys");
    this.cloud = cloud;
  }

  async get(username, apiKey) {
    const { provider } = apiKey;
    const serviceSettings = await this.cloud.getServiceSettings(username);
    const groupSettings = Object.values(
      serviceSettings.groups,
    );
    return this.getKeyFrom(provider, serviceSettings.user?.apiKeys) ||
      this.getKeyFrom(provider, serviceSettings.member?.apiKeys) ||
      this.getLeastSharedKey(
        groupSettings.map((settings) =>
          this.getKeyFrom(provider, settings?.apiKeys)
        ),
      );
  }

  getKeyFrom(provider, apiKeys) {
    return (apiKeys || {})[provider];
  }

  getLeastSharedKey(keyValues) {
    const counts = keyValues.reduce((counts, key) => {
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    const keyPair = Object.entries(counts)
      .sort(
        ([_v1, c1], [_v2, c2]) => c1 < c2 ? -1 : 1,
      )
      .unshift();

    return keyPair ? keyPair[0] : null;
  }

  async list(username, groupId) {
    const settings = await this.cloud.getServiceSettings(username);
    let keyDict;
    if (groupId) {
      keyDict = settings.groups[groupId]?.apiKeys || {};
    } else {
      keyDict = settings.user.apiKeys || {};
    }
    return Object.entries(keyDict).map(([provider, value]) => ({
      provider,
      value,
    }));
  }

  /**
   * Create a new API key. Overwrite any existing key with the same owner and
   * scope.
   */
  async create(username, provider, value, groupIds) {
    // Technically, this isn't free from race conditions but shouldn't be a big deal since
    // only the owner can set these anyway
    // TODO: add support for group IDs
    const settings = await this.cloud.getUserServiceSettings(username);
    settings.apiKeys ||= {};
    settings.apiKeys[provider] = value;
    await this.cloud.setUserServiceSettings(username, settings);
  }

  async delete(id, username) {
    // Technically, this isn't free from race conditions but shouldn't be a big deal since
    // only the owner can set these anyway
    const settings = await this.cloud.getServiceSettings(username);
  }

  getAllApiKeys() {
    return Object.values(APIKey)
      .filter((value) => value.constructor.name === "ApiKey");
  }

  getApiProviders() {
    return this.getAllApiKeys()
      .map((key) => ({
        provider: key.provider,
        url: key.helpUrl,
      }));
  }

  router() {
    const router = express.Router({ mergeParams: true });
    const EDITABLE_DOC_KEYS = ["value", "isGroupDefault", "groups"];

    router.route("/").get(async (req, res) => {
      const { username } = req.session;
      const { group } = req.query;
      // FIXME: update this
      res.json(await this.list(username, group));
    });

    router.route("/providers").get(async (req, res) => {
      res.json(this.getApiProviders());
    });

    router.route("/:provider").post(async (req, res) => {
      const { provider } = req.params;
      const { username } = req.session;
      const { value, groups } = req.body;

      const providers = this.getApiProviders().map(({ provider }) => provider);
      if (!providers.includes(provider)) {
        return res.status(400).send(`Invalid provider: ${provider}`);
      }

      if (!value) {
        return res.status(400).send("Missing required field: value");
      }
      const result = await this.create(
        username,
        provider,
        value,
        groups,
      );
      res.sendStatus(200);
    });

    router.route("/").patch(async (req, res) => {
      const { username } = req.session;
      const { id } = req.body;
      if (!id) {
        return res.status(400).send("Missing required field: id");
      }
      const query = {
        _id: ObjectId(id),
        owner: username,
      };
      // TODO: update this...
      const keys = EDITABLE_DOC_KEYS
        .filter((key) => Object.prototype.hasOwnProperty.call(req.body, key));
      const update = { $set: _.pick(req.body, keys) };
      const doc = await this.collection.findOneAndUpdate(
        query,
        update,
        { returnNewDocument: true },
      );

      // TODO:
      res.json(doc.value);
    });

    router.route("/:id").options((req, res) => {
      res.header(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS, PUT, PATCH, DELETE",
      );
      res.sendStatus(204);
    });
    router.route("/:provider").delete(async (req, res) => {
      // TODO: get the group IDs and use them
      const { username } = req.session;
      const { provider } = req.params;
      const deleted = await this.delete(username, provider, groupIds);
      res.json(deleted);
    });

    return router;
  }
}

// TODO: can we separate out the storage/client?
module.exports = APIKeys;
