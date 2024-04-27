const _ = require("lodash");
const fetch = require("node-fetch");
const CacheManager = require("cache-manager");
const cache = CacheManager.caching({
  store: "memory",
  max: 1000,
  ttl: 3, // secs
});

// Client for NetsBlox Cloud
class NetsBloxCloud {
  constructor(cloudUrl, id, secret) {
    this.cloudUrl = cloudUrl;
    this.id = id;
    this.secret = secret;
  }

  async whoami(cookieJar) {
    const cookieStr = Object.entries(cookieJar)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");

    const opts = {
      headers: {
        cookie: cookieStr,
      },
    };
    console.log("whoami using cookies:", cookieStr);
    const response = await this.fetch("/users/whoami", opts);
    return await response.text();
  }

  async getRoomState(projectId) {
    const url = `/network/id/${projectId}`;
    return await this.get(url);
  }

  async getClientInfo(clientId) {
    const url = `/network/${clientId}/state`;
    return await this.get(url);
  }

  async userExists(username) {
    const user = await this.viewUser(username).catch(nop);
    return !!user;
  }

  async viewUser(username) {
    const url = `/users/${username}`;
    return await this.get(url);
  }

  async sendMessage(message) {
    const url = `/network/messages/`;
    const response = await this.post(url, message);
    return response.status > 199 && response.status < 400;
  }

  async post(urlPath, body) {
    const headers = { "Content-Type": "application/json" };
    body = JSON.stringify(body);
    return await this.fetch(urlPath, { method: "post", body, headers });
  }

  async get(urlPath) {
    return await cache.wrap(urlPath, async () => {
      const response = await this.fetch(urlPath);
      return await response.json();
    });
  }

  async fetch(urlPath, options = {}) {
    const url = `${this.cloudUrl}${urlPath}`;
    const headers = options.headers || {};
    // TODO: make this a Bearer token?
    headers["X-Authorization"] = this.id + ":" + this.secret;

    options.headers = headers;
    return await fetch(url, options);
  }

  async viewGroup(groupId) {
    const url = `/groups/id/${groupId}`;
    return await this.get(url);
  }

  // Service Settings
  async getServiceSettings(username) {
    const url = `/services/settings/user/${username}/${this.id}/all`;
    const settings = await this.get(url);
    // settings fields are strings which we happen to use to store JSON
    // so we need to JSON.parse them, too
    settings.user = JSON.parse(settings.user);
    settings.member = JSON.parse(settings.member);
    settings.groups = _.mapValues(settings.groups, JSON.parse);
    return settings;
  }

  async getUserServiceSettings(username) {
    const url = `/services/settings/user/${username}/${this.id}`;
    const settings = await this.get(url);
    return JSON.parse(settings);
  }

  async setUserServiceSettings(username, settings) {
    const url = `/services/settings/user/${username}/${this.id}`;
    const response = await this.post(url, settings);
    const isOk = response.status > 199 && response.status < 400;
    return isOk; // FIXME: throwing might be better...
  }

  async getGroupServiceSettings(groupId) {
    const url = `/services/settings/group/${groupId}/${this.id}`;
    const settings = await this.get(url);
    return JSON.parse(settings);
  }

  async setGroupServiceSettings(groupId, settings) {
    const url = `/services/settings/group/${groupId}/${this.id}`;
    const response = await this.post(url, settings);
    const isOk = response.status > 199 && response.status < 400;
    return isOk; // FIXME: throwing might be better...
  }

  // OAuth
  async getOAuthClients() {
    const url = `/oauth/clients/`;
    const clients = await this.get(url);
    return clients;
  }

  async getOAuthToken(tokenId) {
    return await this.get(`/oauth/token/${tokenId}`);
  }

  isConfigured() {
    return this.cloudUrl && this.id && this.secret;
  }
}

const config = require("./config");
module.exports = new NetsBloxCloud(
  config.NetsBloxCloud,
  config.NetsBloxCloudID,
  config.NetsBloxCloudSecret,
);
