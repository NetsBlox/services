/*
 * socket here refers to a Netsblox socket (instance of a client object)
 */
'use strict';

const utils = require('../server-utils');
const Projects = require('../storage/projects');
const ProjectActions = require('../storage/project-actions');
const ClientRegistry = require('./client-registry');

var NetworkTopology = function() {
    this.initialized = false;
    this._clients = new ClientRegistry();
};

let Client = null;
NetworkTopology.prototype.init = function(logger, _Client) {
    this.initialized = true;
    this._logger = logger.fork('network-topology');

    Client = _Client;
    this.startClientCheckInterval();
    const self = this;
    Client.prototype.onClose = function(err) {
        return self.onDisconnect(this, err);
    };
};

// socket: new client object (netsblox websocket)
NetworkTopology.prototype.onConnect = function(socket, uuid) {
    let client = this._clients.withUuid(uuid);
    if (client) {
        client.reconnect(socket);
    } else {
        client = new Client(this._logger, socket, uuid);
        this._clients.add(client);
    }
    this._logger.trace(`client (re)connected ${client.toString()} total: ${this._clients.count()}`);
    return client;
};

// input: client object (netsblox websocket)
NetworkTopology.prototype.onDisconnect = function(client) {
    this._logger.trace(`client disconnected ${client.toString()} total: ${this._clients.count()}`);
    let isClientActive = this._clients.contains(client);
    if (isClientActive) {
        this._clients.remove(client);
        const {projectId, roleId} = client;
        if (projectId && roleId) {
            this.onClientLeave(projectId, roleId);
        }
    } else {
        this._logger.error(`Could not find client to disconnect: ${client.toString()}`);
    }
    return isClientActive;
};

NetworkTopology.prototype.getClient = function(uuid) {
    return this._clients.withUuid(uuid);
};

NetworkTopology.prototype.getClientsAt = function(projectId, roleId) {
    projectId = projectId && projectId.toString();
    return this._clients.at(projectId, roleId);
};

NetworkTopology.prototype.getClientsAtProject = function(projectId) {
    projectId = projectId && projectId.toString();
    return this._clients.atProject(projectId);
};

NetworkTopology.prototype.isProjectActive = function(projectId, skipId) {
    const sockets = this.getClientsAtProject(projectId)
        .filter(socket => socket.uuid !== skipId);
    return sockets.length > 0;
};

NetworkTopology.prototype.setClientState = async function(clientId, projectId, roleId, username) {
    const client = this.getClient(clientId);

    if (!client) {
        this._logger.warn(`Could not set client state for ${clientId}`);
        return this.getRoomState(projectId);
    }

    // Update the changed rooms
    const {projectId: oldProjectId, roleId: oldRoleId} = client;
    client.setState(projectId, roleId, username);

    if (oldProjectId && oldRoleId) {
        await this.onClientLeave(oldProjectId, oldRoleId);
    }

    if (oldProjectId !== projectId) {  // moved to a new project
        return this.onRoomUpdate(projectId, true);
    }
};

NetworkTopology.prototype.getRoomState = function(projectId, refresh=false) {
    return Projects.getProjectMetadataById(projectId, {unmarkForDeletion: refresh})
        .then(metadata => {
            if (!metadata) throw new Error('could not find project', projectId);
            const ids = Object.keys(metadata.roles).sort();
            const rolesInfo = {};
            const roles = ids.map(id => [metadata.roles[id].ProjectName, id]);

            roles.forEach(pair => {
                // Change this to use the socket id
                const [name, id] = pair;
                const occupants = this.getClientsAt(projectId, id)
                    .map(socket => {
                        return {
                            uuid: socket.uuid,
                            username: utils.isSocketUuid(socket.username) ?
                                null : socket.username
                        };
                    });
                rolesInfo[id] = {name, occupants};
            });

            return {
                saved: !metadata.transient,
                version: Date.now(),
                owner: metadata.owner,
                id: metadata._id.toString(),
                collaborators: metadata.collaborators,
                name: metadata.name,
                roles: rolesInfo
            };
        });
};

NetworkTopology.prototype.onRoomUpdate = function(projectId, refresh=false) {
    // push room update msg to the clients in the project
    return this.getRoomState(projectId, refresh)
        .then(state => {
            const clients = this.getClientsAtProject(projectId);

            const msg = state;
            msg.type = 'room-roles';

            const count = clients.length;
            if (count > 0) {
                this._logger.info(`About to send room update for ${projectId} to ${count} clients`);
                clients.forEach(client => client.send(msg));
            } // if not close the room?
            return msg;
        });
};

NetworkTopology.prototype.onClientLeave = function(projectId, roleId) {
    return this.onRoomUpdate(projectId, true)
        .then(state => {  // Check if previous role is now empty
            const isRoleEmpty = state.roles[roleId].occupants.length === 0;
            const isProjectEmpty = !Object.values(state.roles)
                .find(role => role.occupants.length > 0);

            // Check if project is empty. If empty and the project is unsaved, remove it
            if (isProjectEmpty && !state.saved) {
                return Projects.markForDeletion(state.id);
            } else if (isRoleEmpty) {
                return this.onRoleEmpty(projectId, roleId);
            }
        });
};

NetworkTopology.prototype.onRoleEmpty = async function(projectId, roleId) {
    // Get the current (saved) action ID for the role
    const endTime = new Date();
    const project = await Projects.getById(projectId);
    const actionId = await project.getRoleActionIdById(roleId);
    // Update the latest action ID for the role
    await ProjectActions.setLatestActionId(projectId, roleId, actionId);

    // Clear the actions after that ID
    return await ProjectActions.clearActionsAfter(projectId, roleId, actionId, endTime);
};

NetworkTopology.prototype.clients = function() {
    return this._clients.toArray();
};

NetworkTopology.prototype.getClientsWithUsername = function(username) {
    return this._clients.withUsername(username);
};

NetworkTopology.prototype.startClientCheckInterval = async function(duration=Client.HEARTBEAT_INTERVAL) {
    while (true) {
        this.checkClients(this.clients());
        await utils.sleep(duration);
    }
};

NetworkTopology.prototype.checkClients = function(clients) {
    clients.forEach(client => {
        if (!client.isWaitingForReconnect) {
            client.checkAlive();
        }
    });
};

module.exports = new NetworkTopology();
