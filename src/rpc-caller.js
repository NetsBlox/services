/**
 * An object representing the caller of an RPC. Provides access to information about the caller
 * such as project ID, role ID, username, etc.
 */

class ExternalCallerNotAllowed extends Error {
  constructor(appId) {
    super(`RPC must be called from NetsBlox (not ${appId})`);
  }
}

class LoginRequired extends Error {
  constructor() {
    super("Login Required.");
  }
}

class Unimplemented extends Error {
  constructor() {
    super("Unimplemented!");
  }
}

class RpcCallerBase {
  constructor(clientId) {
    this.clientId = clientId;
  }

  /**
   * Get the username of the caller.
   *
   * Throws/rejects if unauthenticated and guest usage is not allowed.
   * @param {boolean=} allowGuest
   */
  async getUsername(allowGuest = false) {
    const { username } = await this.getClientInfo();
    if (!username && !allowGuest) {
      throw new LoginRequired();
    }
    return username;
  }

  /**
   * Get the username of the caller. If not logged in, return the client ID.
   */
  async getUsernameOrClientId() {
    const { username } = await this.getClientInfo();
    return username || this.clientId;
  }

  async isLoggedIn() {
    const username = await this.getUsername();
    return !!username;
  }

  async ensureLoggedIn() {
    if (!await this.isLoggedIn()) {
      throw new LoginRequired();
    }
  }

  /**
   * Get the role ID of the caller.
   *
   * Throws/rejects if caller is using an external client such as PyBlox.
   */
  async getRoleId() {
    return (await this._getBrowserState()).roleId;
  }

  /**
   * Get the project ID of the caller.
   *
   * Throws/rejects if caller is using an external client such as PyBlox.
   */
  async getProjectId() {
    return (await this._getBrowserState()).projectId;
  }

  async getClientState() {
    const { state } = await this.getClientInfo();
    return state;
  }

  // private methods
  async _getBrowserState() {
    const state = await this.getClientState();
    const browserState = state?.browser;

    if (!browserState) { // TODO: test this error message
      if (state?.external) {
        throw new ExternalCallerNotAllowed(state.external.appId);
      } else {
        // FIXME: "state not found" type of error
        throw new ExternalCallerNotAllowed(state.external.appId);
      }
    }
    return browserState;
  }

  async getClientInfo() {
    if (!this.clientInfo) {
      this.clientInfo = Object.freeze(await this._getClientInfo());
    }

    return this.clientInfo;
  }

  async getRoomState() {
    const { state } = await this.getClientInfo();
    const projectId = state?.browser?.projectId;

    if (!this.roomState && projectId) {
      this.roomState = Object.freeze(await this._getRoomState(projectId));
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

  async toSnapshot() {
    const clientInfo = await this.getClientInfo();
    const roomState = await this.getRoomState();
    return new SnapshotCaller(this.clientId, clientInfo, roomState);
  }

  // the following are abstract methods
  async _getClientInfo() {
    throw new Unimplemented();
  }

  async _getRoomState(projectId) {
    throw new Unimplemented();
  }
}

class RpcCaller extends RpcCallerBase {
  async _getClientInfo() {
    return await cloud.getClientInfo(this.clientId);
  }

  async _getRoomState(projectId) {
    return await cloud.getRoomState(projectId);
  }

  static from(req) {
    const { clientId } = req.query;
    return new RpcCaller(clientId);
  }
}

/**
 * A snapshot of an RPC caller with all the fields set (but exposes the same interface)
 */
class CallerSnapshot extends RpcCallerBase {
  constructor(clientId, clientInfo, roomState) {
    super(clientId);
    this.clientInfo = clientInfo;
    this.roomState = roomState;
  }

  async _getClientInfo() {
    return this.clientInfo;
  }

  async _getRoomState(projectId) {
    return this.roomState;
  }

  setUsername(username) {
    this.clientInfo.username = username;
  }

  static load(data) {
    return new CallerSnapshot(data.clientId, data.clientInfo, data.roomState);
  }
}

module.exports = RpcCaller;
module.exports.CallerSnapshot = CallerSnapshot;
