/**
 * An object representing the caller of an RPC. Provides access to information about the caller
 * such as project ID, role ID, username, etc.
 */

class RpcCaller {
  constructor(clientId) {
    this.clientId = clientId;
  }

    // TODO: refactor this so it lazily fetches the context
    // await caller.getClientState()
    // await caller.getUsername()
    // caller.clientId
  static from(req) {
    const { clientId } = req.query;
    if (!req.clientState) {
      // TODO: lazily request these
      const { username, state } = await cloud.getClientInfo(clientId);
      req.clientState = state;
      req.username = username;
    }
    {
      username,
      projectId,
      roleId,
      clientId,
    };
  }
}
module.exports = RpcCaller;
