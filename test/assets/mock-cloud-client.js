/*
 * An in-memory cloud client for testing
 */
const _ = require("lodash");
class CloudClient {
  constructor(userData = {}, groupData = {}, groups = {}) {
    this.userData = _.cloneDeep(userData);
    this.groupData = _.cloneDeep(groupData);
    this.groups = _.cloneDeep(groups);
  }

  async getServiceSettings(username) {
    const groupIds = this.groups
      .filter((group) => group.owner === username)
      .map((group) => group.id);

    return _.cloneDeep({
      user: this.userData[username] || {},
      groups: this.groupData, // TODO: assume group belongs to everyone for the tests
    });
  }

  async setUserServiceSettings(username, settings) {
    this.userData[username] = _.cloneDeep(settings);
  }

  async getUserServiceSettings(username) {
    return _.cloneDeep(this.userData[username] || {});
  }

  async setGroupServiceSettings(groupId, settings) {
    this.groupData[groupId] = _.cloneDeep(settings);
  }

  async getGroupServiceSettings(groupId) {
    return _.cloneDeep(this.groupData[groupId] || {});
  }

  async viewGroup(groupId) {
    const group = this.groups.find((group) => group.id === groupId);
    return _.cloneDeep(group || {});
  }

  static builder() {
    return new CloudClientBuilder();
  }
}

class CloudClientBuilder {
  constructor() {
    this.userData = {};
    this.groupData = {};
    this.groups = {};
  }

  withGroups(groups) {
    this.groups = groups;
    return this;
  }

  withGroupSettings(groupData) {
    this.groupData = groupData;
    return this;
  }

  withUserSettings(userData) {
    this.userData = userData;
    return this;
  }

  build() {
    return new CloudClient(this.userData, this.groupData, this.groups);
  }
}

module.exports = CloudClient;
