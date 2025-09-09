const {
  SendMessageToClient,
  SendMessage,
  SendMessageToRoom,
  SendMessageToRole,
} = require("./messages");
const NetsBloxCloud = require("./cloud-client");

class RemoteClient {
  constructor(state, clientId, username) {
    this.state = state;
    this.projectId = state?.browser?.projectId;
    this.roleId = state?.browser?.roleId;
    this.roleId = roleId;
    this.username = username;
  }

  async sendMessage(type, contents = {}) {
    return NetsBloxCloud.sendMessage(
      new SendMessageToClient(
        this.state,
        this.clientId,
        type,
        contents,
      ),
    );
  }

  async sendMessageTo(address, type, contents = {}) {
    return NetsBloxCloud.sendMessage(
      new SendMessage(address, type, contents),
    );
  }

  async sendMessageToRole(roleId, type, contents = {}) {
    return NetsBloxCloud.sendMessage(
      new SendMessageToRole(this.projectId, roleId, type, contents),
    );
  }

  async sendMessageToRoom(type, contents = {}) {
    return NetsBloxCloud.sendMessage(
      new SendMessageToRoom(this.projectId, type, contents),
    );
  }
}

module.exports = RemoteClient;
