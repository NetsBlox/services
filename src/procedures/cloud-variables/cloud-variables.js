/**
 * The CloudVariables Service provides support for storing variables on the cloud.
 * Variables can be optionally password-protected or stored only for the current user.
 *
 * Cloud variables that are inactive (no reads or writes) for 30 days are subject to deletion.
 *
 * @service
 * @category GLOBAL
 * @category Utilities
 */
const logger = require('../utils/logger')('cloud-variables');
const Storage = require('../../storage');
const utils = require('../utils');

const globalListeners = {}; // map<var name, map<client id, [socket, msg name, expiry timestamp]>>
const userListeners = {}; // map<user name, map<var name, map<client id, [socket, msg name, expiry timestamp]>>>

let _collections = null;

function getCollections() {
    if (!_collections) {
        _collections = {};
        _collections.sharedVars = Storage.create('cloud-variables:shared').collection;
        _collections.userVars = Storage.create('cloud-variables:user').collection;
    }
    return _collections;
};

// Throws an error if the given variable does not exist
function ensureVariableExists(variable) {
    if (!variable) {
        throw new Error('Variable not found');
    }
};

// Maximum duration of a locked public variable
let MAX_LOCK_AGE = 5 * 1000;

// Get the owner of a variable's lock, if it exists and has a currently valid one
function getLockOwnerId(variable) {
    if (variable && variable.lock) {
        if (!isLockStale(variable)) {
            return variable.lock.clientId;
        }
    }
};

// Determine if a variable has a stale lock
function isLockStale(variable) {
    if (variable && variable.lock) {
        return (new Date() - variable.lock.creationTime) > MAX_LOCK_AGE;
    }
    return false;
};

// Determine if a variable is locked
function isLocked(variable) {
    return !!getLockOwnerId(variable);
};

// Throw an error if the variable is locked by another client
function ensureOwnsMutex(variable, clientId) {
    const ownerId = getLockOwnerId(variable);
    if (ownerId && ownerId !== clientId) {
        throw new Error('Variable is locked (by someone else)');
    }
};

// Determine if a given password is valid for a variable
function isAuthorized(variable, password) {
    return !variable.password ||
        variable.password === password;
}

// Throw an error if the given password does not match
function ensureAuthorized(variable, password) {
    if (variable) {
        if (!isAuthorized(variable, password)) {
            throw new Error('Unauthorized: incorrect password');
        }
    }
};

// Throw an error if the given username is not the owner of the variable 
function ensureOwnsVariable(variable, username) {
    if (variable && variable.creator) {
        if(variable.creator !== username){
            throw new Error('You do not own this variable');
        }
    }

    if (variable && !variable.creator) {
        throw new Error('You do not own this variable');
    }
}

// Throw an error if the user is not logged in
function ensureLoggedIn(caller) {
    if (!caller.username) {
        throw new Error('Login required.');
    }
};

// Throw an error if given variable name is not valid
function validateVariableName(name) {
    if (!/^[\w _()-]+$/.test(name)) {
        throw new Error('Invalid variable name.');
    }
};

// Mapping of access levels and their full names
const accessLevelNames = {
    'r': 'read',
    'w': 'write',
    'a': 'append',
    'd': 'delete',
    'l': 'lock'
};

// Default access level (when correct password is provided), giving full access
const DEFAULT_WITH_PASSWORD_ACCESS = Object.keys(accessLevelNames).join('');

// Default access level (when correct password is provided), giving no access
const DEFAULT_WITHOUT_PASSWORD_ACCESS = '';

// Get the available actions for a variable with the provided authentication. 
// If the variable does not exist, all actions are allowed and proper restriction is expected to be implemented by the caller method.
function getAccessLevel(variable, password, username) {
    if(variable){
        // Creator has full access always
        if(variable.creator && variable.creator === username){
            return DEFAULT_WITH_PASSWORD_ACCESS;
        }

        if(isAuthorized(variable, password)){
            return variable.withPasswordAccess || DEFAULT_WITH_PASSWORD_ACCESS;
        } else {
            return variable.withoutPasswordAccess || DEFAULT_WITHOUT_PASSWORD_ACCESS;
        }
    }

    return DEFAULT_WITH_PASSWORD_ACCESS;
};

// Throws an error if the requested access type is not allowed
function ensureHasAccessLevel(variable, password, username, type) {
    if(!getAccessLevel(variable, password, username).includes(type)){
        if(type in accessLevelNames){
            throw new Error(`You are not authorized to ${accessLevelNames[type]} this variable, please check your password`);
        } else {
            throw new Error(`You are not authorized to perform that action on this variable, please check your password`);
        }
    }
};

// Size, in bytes, of maximum variable content
const MAX_CONTENT_SIZE = 4 * 1024 * 1024;

// Throws an error if content is too large to store in a cloud variable
function validateContentSize(content) {
    const sizeInBytes = content.length*2;  // assuming utf8. Figure ~2 bytes per char
    if (sizeInBytes > MAX_CONTENT_SIZE) {
        throw new Error('Variable value is too large.');
    }
};

const CloudVariables = {};
CloudVariables._queuedLocks = {};
CloudVariables._setMaxLockAge = function(age) {  // for testing
    MAX_LOCK_AGE = age;
};

/**
 * Get the value of a cloud variable
 * @param {String} name Variable name
 * @param {String=} password Password (if password-protected)
 * @returns {Any} the stored value
 */
CloudVariables.getVariable = async function(name, password) {
    const {sharedVars} = getCollections();
    const username = this.caller.username;
    const variable = await sharedVars.findOne({name: name});

    ensureVariableExists(variable);
    ensureHasAccessLevel(variable, password, this.caller.username, 'r');

    const query = {
        $set: {
            lastReader: username,
            lastReadTime: new Date(),
        }
    };
    await sharedVars.updateOne({_id: variable._id}, query);
    return variable.value;
};

CloudVariables._sendUpdate = function(name, value, targets) {
    const expired = [];
    const now = +new Date();
    for (const clientId in targets) {
        const [socket, msgType, expiry] = targets[clientId];
        if (now < expiry) socket.sendMessage(msgType, { name, value });
        else expired.push(clientId);
    }
    for (const clientId of expired) {
        delete targets[clientId];
    }
};

/**
 * Set a cloud variable.
 * If a password is provided on creation, the variable will be password-protected.
 * @param {String} name Variable name
 * @param {Any} value Value to store in variable
 * @param {String=} password Password (if password-protected)
 */
 CloudVariables.setVariable = async function(name, value, password) {
    validateVariableName(name);
    validateContentSize(value);

    const {sharedVars} = getCollections();
    const username = this.caller.username;
    const variable = await sharedVars.findOne({name: name});

    ensureHasAccessLevel(variable, password, this.caller.username, 'w');
    ensureOwnsMutex(variable, this.caller.clientId);

    let query;
    
    // Set both the password and value in case it gets deleted
    // during this async fn...
    if(variable || !this.caller.username){
        query = {
            $set: {
                value,
                password,
                lastWriter: username,
                lastWriteTime: new Date(),
            }
        };
    } else {
        // The variable did not exist, set creator data
        query = {
            $set: {
                value,
                password,
                creator: username,
                createdOn: new Date(),
                lastWriter: username,
                lastWriteTime: new Date(),
            }
        };
    }

    await sharedVars.updateOne({name: name}, query, {upsert: true});
    this._sendUpdate(name, value, globalListeners[name] || {});
};

/**
 * Append to a list cloud variable.
 * @param {String} name Variable name
 * @param {Any} value Value to append to variable
 * @param {String=} password Password (if password-protected)
 */
 CloudVariables.appendToVariable = async function(name, value, password) {
    validateVariableName(name);
    validateContentSize(value);

    const {sharedVars} = getCollections();
    const username = this.caller.username;
    const variable = await sharedVars.findOne({name: name});

    ensureVariableExists(variable);
    ensureHasAccessLevel(variable, password, this.caller.username, 'a');
    ensureOwnsMutex(variable, this.caller.clientId);

    const query = {
        $push: {
            value,
        },
        $set: {
            lastWriter: username,
            lastWriteTime: new Date(),
        }
    };

    try {
        const updatedVar = await sharedVars.findOneAndUpdate({name: name}, query, {upsert: true, returnDocument: "after"});
        this._sendUpdate(name, updatedVar.value.value, globalListeners[name] || {});
    } catch (error) {
        throw new Error('Variable must be of list type to use appendToVariable');
    }
};

/**
 * Delete a given cloud variable
 *
 * @param {String} name Variable to delete
 * @param {String=} password Password (if password-protected)
 */
CloudVariables.deleteVariable = async function(name, password) {
    const {sharedVars} = getCollections();
    const variable = await sharedVars.findOne({name: name});

    ensureVariableExists(variable);
    ensureHasAccessLevel(variable, password, this.caller.username, 'd');

    // Clear the queued locks
    const id = variable._id;
    this._clearPendingLocks(id);
    await sharedVars.deleteOne({_id: id});
    delete globalListeners[name];
};

/**
 * Lock a given cloud variable.
 *
 * A locked variable cannot be changed by anyone other than the person
 * who locked it. A variable cannot be locked for more than 5 seconds.
 *
 * @param {String} name Variable to lock
 * @param {String=} password Password (if password-protected)
 */
CloudVariables.lockVariable = async function(name, password) {
    validateVariableName(name);

    const {sharedVars} = getCollections();
    const username = this.caller.username;
    const clientId = this.caller.clientId;
    const variable = await sharedVars.findOne({name: name});

    ensureVariableExists(variable);
    ensureHasAccessLevel(variable, password, this.caller.username, 'l');

    // What if the block is killed before a lock can be acquired?
    // Then should we close the connection on the client?
    //
    // If locked by someone else, then we need to queue the lock
    // If it is already locked, we should block until we can obtain the lock
    const lockOwner = getLockOwnerId(variable);

    if (lockOwner && lockOwner !== clientId) {
        await this._queueLockFor(variable);
    } else {
        await this._applyLock(variable._id, clientId, username);
    }
};

CloudVariables._queueLockFor = async function(variable) {
    // Return a promise which will resolve when the lock is applied
    const deferred = utils.defer();
    const id = variable._id;
    const {password} = variable;

    if (!this._queuedLocks[id]) {
        this._queuedLocks[id] = [];
    }

    const lock = {
        id: id,
        password: password,
        clientId: this.caller.clientId,
        username: this.caller.username,
        promise: deferred
    };

    logger.trace(`queued lock on ${id} for ${this.caller.clientId}`);
    this._queuedLocks[id].push(lock);

    // If the request is terminated, remove the lock from the queue
    this.request.on('close', () => {
        const queue = this._queuedLocks[id] || [];
        const index = queue.indexOf(lock);
        if (index > -1) {
            queue.splice(index, 1);
            if (!this._queuedLocks[id].length) {
                delete this._queuedLocks[id];
            }
        }
        return deferred.reject(new Error('Canceled by user'));
    });

    // We need to ensure that the variable still exists in case it was deleted
    // during the earlier queries
    await this._checkVariableLock(id);
    return deferred.promise;
};

CloudVariables._applyLock = async function(id, clientId, username) {
    const {sharedVars} = getCollections();

    const lock = {
        clientId,
        username,
        creationTime: new Date()
    };
    const query = {
        $set: {
            lock
        }
    };

    setTimeout(() => this._checkVariableLock(id), MAX_LOCK_AGE+1);
    const res = await sharedVars.updateOne({_id: id}, query);

    // Ensure that the variable wasn't deleted during this application
    logger.trace(`${clientId} locked variable ${id}`);
    if (res.matchedCount === 0) {
        throw new Error('Variable deleted');
    }
};

CloudVariables._clearPendingLocks = function(id) {
    const pendingLocks = this._queuedLocks[id] || [];
    pendingLocks.forEach(lock => lock.promise.reject(new Error('Variable deleted')));
    delete this._queuedLocks[id];
};

CloudVariables._checkVariableLock = async function(id) {
    const {sharedVars} = getCollections();
    const variable = await sharedVars.findOne({_id: id});

    if (!variable) {
        logger.trace(`${id} has been deleted. Clearing locks.`);
        this._clearPendingLocks(id);
    } else if (isLockStale(variable)) {
        logger.trace(`releasing lock on ${id} (timeout).`);
        await this._onUnlockVariable(id);
    }
};

/**
 * Unlock a given cloud variable.
 *
 * A locked variable cannot be changed by anyone other than the person
 * who locked it. A variable cannot be locked for more than 5 minutes.
 *
 * @param {String} name Variable to delete
 * @param {String=} password Password (if password-protected)
 */
CloudVariables.unlockVariable = async function(name, password) {
    validateVariableName(name);

    const {sharedVars} = getCollections();
    const {clientId} = this.caller;
    const variable = await sharedVars.findOne({name: name});

    ensureVariableExists(variable);
    ensureAuthorized(variable, password);
    ensureOwnsMutex(variable, clientId);

    if (!isLocked(variable)) {
        throw new Error('Variable not locked');
    }

    const query = {
        $set: {
            lock: null
        }
    };

    const result = await sharedVars.updateOne({_id: variable._id}, query);

    if(result.modifiedCount === 1) {
        logger.trace(`${clientId} unlocked ${name} (${variable._id})`);
    } else {
        logger.trace(`${clientId} tried to unlock ${name} but variable was deleted`);
    }
    await this._onUnlockVariable(variable._id);
};

CloudVariables._onUnlockVariable = async function(id) {
    // if there is a queued lock, apply it
    if (this._queuedLocks.hasOwnProperty(id)) {
        const nextLock = this._queuedLocks[id].shift();
        const {clientId, username} = nextLock;

        // apply the lock
        await this._applyLock(id, clientId, username);
        nextLock.promise.resolve();
        if (this._queuedLocks[id].length === 0) {
            delete this._queuedLocks[id];
        }
    }
};

/**
 * Get the value of a variable for the current user.
 * @param {String} name Variable name
 * @returns {Any} the stored value
 */
CloudVariables.getUserVariable = async function(name) {
    const {userVars} = getCollections();
    const username = this.caller.username;

    ensureLoggedIn(this.caller);
    const variable = await userVars.findOne({name: name, owner: username});

    if (!variable) {
        throw new Error('Variable not found');
    }

    const query = {
        $set: {
            lastReadTime: new Date(),
        }
    };
    await userVars.updateOne({name, owner: username}, query);
    return variable.value;
};

/**
 * Set the value of the user cloud variable for the current user.
 * @param {String} name Variable name
 * @param {Any} value Value to store in variable
 */
 CloudVariables.appendToUserVariable = async function(name, value) {
    ensureLoggedIn(this.caller);
    validateVariableName(name);
    validateContentSize(value);

    const {userVars} = getCollections();
    const username = this.caller.username;
    const query = {
        $push: {
            value,
        },
        $set: {
            lastWriteTime: new Date(),
        }
    };

    try {
        const updatedVar = await userVars.findOneAndUpdate({name, owner: username}, query, {upsert: true, returnDocument: "after"});
        this._sendUpdate(name, updatedVar.value.value, (userListeners[username] || {})[name] || {});
    } catch (error) {
        throw new Error('Variable must be of list type to use appendToUserVariable');
    }
};


/**
 * Set the value of the user cloud variable for the current user.
 * @param {String} name Variable name
 * @param {Any} value Value to store in variable
 */
CloudVariables.setUserVariable = async function(name, value) {
    ensureLoggedIn(this.caller);
    validateVariableName(name);
    validateContentSize(value);

    const {userVars} = getCollections();
    const username = this.caller.username;
    const query = {
        $set: {
            value,
            lastWriteTime: new Date(),
        }
    };
    await userVars.updateOne({name, owner: username}, query, {upsert: true});
    this._sendUpdate(name, value, (userListeners[username] || {})[name] || {});
};

/**
 * Delete the user variable for the current user.
 * @param {String} name Variable name
 */
CloudVariables.deleteUserVariable = async function(name) {
    const {userVars} = getCollections();
    const username = this.caller.username;

    ensureLoggedIn(this.caller);
    await userVars.deleteOne({name: name, owner: username});
    delete (userListeners[username] || {})[name];
};

CloudVariables._getListenBucket = function (name) {
    let bucket = globalListeners[name];
    if (!bucket) bucket = globalListeners[name] = {};
    return bucket;
};
CloudVariables._getUserListenBucket = function (name) {
    const user = this.caller.username;
    let userBucket = userListeners[user];
    if (!userBucket) userBucket = userListeners[user] = {};

    let bucket = userBucket[name];
    if (!bucket) bucket = userBucket[name] = {};
    return bucket;
};

/**
 * Registers your client to receive messages each time the variable value is updated.
 * ``name`` and ``password`` denote the variable to listen to.
 * ``msgType`` is the name of the message that will be sent each time it is updated.
 * 
 * The variable must already exist prior to calling this RPC.
 * Update events will cease when the variable is deleted.
 * 
 * **Message Fields**
 * 
 * - ``name`` - the name of the variable that was updated
 * - ``value`` - the new value of the variable
 * 
 * @param {String} name Variable name
 * @param {String} msgType Message type to send each time the variable is updated
 * @param {String=} password Password (if password-protected)
 * @param {Duration=} duration The maximum duration to listen for updates on the variable (default 1hr).
 */
CloudVariables.listenToVariable = async function(name, msgType, password, duration = 60*60*1000) {
    await this.getVariable(name, password); // ensure we can get the value
    const bucket = this._getListenBucket(name);
    bucket[this.socket.clientId] = [this.socket, msgType, +new Date() + duration];
};

/**
 * Identical to :func:`CloudVariables.listenToVariable` except that it listens for updates on a user variable.
 * 
 * @param {String} name Variable name
 * @param {Any} msgType Message type to send each time the variable is updated
 * @param {Duration=} duration The maximum duration to listen for updates on the variable (default 1hr).
 */
CloudVariables.listenToUserVariable = async function(name, msgType, duration = 60*60*1000) {
    await this.getUserVariable(name); // ensure we can get the value
    const bucket = this._getUserListenBucket(name);
    bucket[this.socket.clientId] = [this.socket, msgType, +new Date() + duration];
};

/**
 * Set the access levels for a public variable.
 * 
 * Create a string combining the following letters (in any order) for each category:
 * 'r' - Read through the getVariable method
 * 'w' - Write through the setVariable method
 * 'a' - Append through the appendToVariable method
 * 'd' - Delete through the deleteVariable method
 * 'l' - Lock through the lockVariable method
 *  
 * The default settings give users with the password read, write, append, delete, and lock access ("rwadl"), and users without the password no access. 
 * The variable's creator will always have full access.
 * 
 * @param {String} name Variable name
 * @param {String} withPassword Access level for other users with password
 * @param {String} withoutPassword Access level for other users without password
 */
CloudVariables.setVariableAccess = async function(name, withPassword = DEFAULT_WITH_PASSWORD_ACCESS, withoutPassword = DEFAULT_WITHOUT_PASSWORD_ACCESS){
    const filterAccessString = (string) => [...string.toLowerCase()].filter(c => c in accessLevelNames).join('');
    
    const withPasswordAccess = filterAccessString(withPassword);
    const withoutPasswordAccess = filterAccessString(withoutPassword);

    const {sharedVars} = getCollections();
    const variable = await sharedVars.findOne({name: name});
    ensureVariableExists(variable);
    ensureLoggedIn(this.caller);
    ensureOwnsVariable(variable, this.caller.username);

    const query = {
        $set: {
            withPasswordAccess,
            withoutPasswordAccess,
            lastWriter: this.caller.username,
            lastWriteTime: new Date(),
        }
    };

    await sharedVars.updateOne({name: name}, query, {upsert: true});
};

module.exports = CloudVariables;
