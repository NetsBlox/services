const {
  SendMessageToClient,
  SendMessage,
  SendMessageToRoom,
  SendMessageToRole,
} = require("./messages");
const NetsBloxCloud = require("./cloud-client");

class RemoteClient {
  // FIXME: should I pass the caller here??
  constructor(caller) {
    this.context = caller;
  }

  /**
   * Send a message to the RPC caller.
   */
  async sendMessage(type, contents = {}) {
    // TODO: how can I support external clients here, too?
    const state = await this.context.getClientState();
    return NetsBloxCloud.sendMessage(
      new SendMessageToClient(
        state,
        this.clientId,
        type,
        contents,
      ),
    );
  }

  /**
   * Send a message to a given NetsBlox address.
   */
  async sendMessageTo(address, type, contents = {}) {
    return NetsBloxCloud.sendMessage(
      new SendMessage(address, type, contents),
    );
  }

  /**
   * Send a message to a role (relative to the caller).
   *
   * Rejects if the caller is not a NetsBlox browser.
   */
  async sendMessageToRole(roleId, type, contents = {}) {
    const projectId = await this.context.getProjectId();
    return NetsBloxCloud.sendMessage(
      new SendMessageToRole(this.projectId, roleId, type, contents),
    );
  }

  /**
   * Send a message to all roles in the RPC caller's room.
   *
   * Rejects if the caller is not a NetsBlox browser.
   */
  async sendMessageToRoom(type, contents = {}) {
    const projectId = await this.context.getProjectId();
    return NetsBloxCloud.sendMessage(
      new SendMessageToRoom(this.projectId, type, contents),
    );
  }
}

module.exports = RemoteClient;
