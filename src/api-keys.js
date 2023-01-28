const express = require("express");
const Logger = require("./logger");
const assert = require("assert");
const _ = require("lodash");
const APIKey = require("./procedures/utils/api-key");
const { NotAllowedError } = require("./error");

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
    const value = (apiKeys || {})[provider];
    if (value) {
      return new UserApiKey(provider, value);
    }
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
    return Object.entries(keyDict).map(([provider, value]) =>
      new UserApiKey(provider, value)
    );
  }

  /**
   * Create a new API key. Overwrite any existing key with the same owner and
   * scope.
   */
  async create(username, provider, value, groupIds) {
    // Technically, this isn't free from race conditions but shouldn't be a big deal since
    // only the owner can set these anyway
    if (groupIds) {
      await Promise.all(
        groupIds.map((id) =>
          this._createGroupKey(username, id, provider, value)
        ),
      );
    } else {
      await this._createUserKey(username, provider, value);
    }
  }

  async _createUserKey(username, provider, value) {
    const settings = await this.cloud.getUserServiceSettings(username);
    settings.apiKeys ||= {};
    settings.apiKeys[provider] = value;
    await this.cloud.setUserServiceSettings(username, settings);
  }

  async _createGroupKey(username, groupId, provider, value) {
    await this._ensureCanEditGroup(username, groupId);
    const settings = await this.cloud.getGroupServiceSettings(groupId);
    settings.apiKeys ||= {};
    settings.apiKeys[provider] = value;
    await this.cloud.setGroupServiceSettings(groupId, settings);
  }

  async delete(owner, provider, groupIds) {
    // Technically, this isn't free from race conditions but shouldn't be a big deal since
    // only the owner can set these anyway
    if (groupIds) {
      await Promise.all(
        groupIds.map((id) => this._deleteGroupKey(owner, id, provider)),
      );
    } else {
      await this._deleteUserKey(owner, provider);
    }
  }

  async _deleteUserKey(username, provider) {
    const settings = await this.cloud.getUserServiceSettings(username);
    delete settings.apiKeys[provider];
    await this.cloud.setUserServiceSettings(username, settings);
  }

  async _deleteGroupKey(owner, groupId, provider) {
    await this._ensureCanEditGroup(owner, groupId);
    const settings = await this.cloud.getGroupServiceSettings(groupId);
    delete settings.apiKeys[provider];
    await this.cloud.setGroupServiceSettings(groupId, settings);
  }

  async _ensureCanEditGroup(username, groupId) {
    const group = await this.cloud.viewGroup(groupId);
    if (group.owner !== username) {
      throw new NotAllowedError();
    }
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

    router.route("/").get(async (req, res) => {
      const { username } = req.session;
      const { group } = req.query;
      // FIXME: update this
      res.json(await this.list(username, group));
    });

    router.route("/providers").get(async (req, res) => {
      res.json(this.getApiProviders());
    });

    router.route("/:provider").post(handleUserErrors(async (req, res) => {
      const { provider } = req.params;
      const { username } = req.session;
      const { value, groups } = req.body;

      const providers = this.getApiProviders().map(({ provider }) => provider);
      if (!providers.includes(provider)) {
        throw new InvalidKeyProviderError(provider);
      }

      if (!value) {
        throw new MissingFieldError("value");
      }

      const result = await this.create(
        username,
        provider,
        value,
        groups,
      );
      res.sendStatus(200);
    }));

    router.route("/:id").options((req, res) => {
      res.header(
        "Access-Control-Allow-Methods",
        "POST, GET, OPTIONS, PUT, PATCH, DELETE",
      );
      res.sendStatus(204);
    });

    router.route("/:provider").delete(handleUserErrors(async (req, res) => {
      const { username } = req.session;
      const { provider } = req.params;
      const { groupIds } = req.query; // TODO: check this works
      const deleted = await this.delete(username, provider, groupIds);
      res.json(deleted);
    }));

    return router;
  }
}

class UserApiKey {
  constructor(provider, value) {
    this.provider = provider;
    this.value = value;
  }
}

module.exports = APIKeys;
