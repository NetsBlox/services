/*
 * An in-memory cloud client for testing
 */
const _ = require("lodash");
class CloudClient {
  constructor(userData = {}, groupData = {}) {
    this.userData = _.cloneDeep(userData);
    this.groupData = _.cloneDeep(groupData);
  }

  async getServiceSettings(username) {
    return {
      user: this.userData[username] || {},
      group: this.groupData,
    };
  }

  async setUserServiceSettings(username, settings) {
    this.userData[username] = _.cloneDeep(settings);
  }

  async getUserServiceSettings(username) {
    return _.cloneDeep(this.userData[username] || {});
  }
}

module.exports = CloudClient;
