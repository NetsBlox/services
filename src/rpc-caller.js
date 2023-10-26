/**
 * An object representing the caller of an RPC. Provides access to information about the caller
 * such as project ID, role ID, username, etc.
 */

class RpcCaller {
  constructor(clientId, username) {
    this.clientId = clientId;
    this.username = username;
    // TODO: merge with the socket
    // TODO: fetch API key from this?
  }

  isLoggedIn() {
    return !!this.username;
  }

  async getClientInfo() {
    if (!this.clientInfo) {
      this.clientInfo = Object.freeze(await cloud.getClientInfo(this.clientId));
    }

    return this.clientInfo;
  }

  async getRoomState() {
    const { state } = await this.getClientInfo();
    const projectId = state?.browser?.projectId;

    if (!this.roomState && projectId) {
      this.roomState = Object.freeze(await cloud.getRoomState(projectId));
    }

    return this.roomState;
  }
  async getAddress() {
    const { state } = await this.getClientInfo();
    if (!state) {
      throw new Error("Unable to get NetsBlox address");
    }

    if (state.browser) {
      const room = await this.getRoomState();
      const { roleId } = state.browser;
      const roleName = room.roles[roleId]?.name;
      if (!roleName) {
        throw new Error("Could not find role");
      }

      return `${roleName}@${room.name}@${room.owner}`;
    } else {
      return `${state.address} #${state.appId}`;
    }
  }

  // TODO: refactor this so it lazily fetches the context
  // await caller.getClientState()
  // await caller.getUsername()
  // caller.clientId
  static from(req) {
    const { clientId } = req.query;
    if (!req.clientState) {
      // TODO: lazily request these
      //const { username, state } = await cloud.getClientInfo(clientId);
      req.clientState = state;
      req.username = username;
    }
    const projectId = state?.browser?.projectId;
    const roleId = state?.browser?.roleId;
    //{
    // username,
    // projectId,
    // roleId,
    // clientId,
    //};
  }
}

class BrowserState {
  constructor(projectId, roleId) {
    this.projectId = projectId;
    this.roleId = roleId;
  }

  toString() {
    return `${this.address}#${this.appId}`;
  }
}

class ExternalState {
  constructor(address, appId) {
    this.address = address;
    this.appId = appId;
  }

  toString() {
    return `${this.address}#${this.appId}`;
  }
}

module.exports = RpcCaller;
