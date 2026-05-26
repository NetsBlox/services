const Logger = require("./logger");

class APIKeys {
  constructor(cloud, logger) {
    this.cloud = cloud;
    this.logger = logger
      ? logger.fork("api-keys")
      : new Logger("netsblox:api-keys");
  }

  async get(username, apiKey) {
    const { provider } = apiKey;
    const { user, member } = await this.cloud.getServiceSettings(username);
    if (user?.[provider]?.apiKey?.value) {
      this.logger.info("Using user key for", provider);
      const keyValue = user[provider].apiKey.value;
      return new UserApiKey(provider, keyValue);
    } else if (member?.[provider]?.apiKey?.value) {
      this.logger.info("Using group key for", provider);
      const keyValue = user[provider].apiKey.value;
      return new UserApiKey(provider, keyValue);
    } else {
      return undefined;
    }
  }
}

class UserApiKey {
  constructor(provider, value) {
    this.provider = provider;
    this.value = value;
  }
}

module.exports = APIKeys;
