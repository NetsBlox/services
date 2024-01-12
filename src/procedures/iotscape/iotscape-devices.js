const logger = require("../utils/logger")("iotscape-devices");
const ciphers = require("../roboscape/ciphers");

/**
 * Stores information about registered devices, with a list of IDs and their respective hosts
 */
const IoTScapeDevices = {};
IoTScapeDevices._services = {};
IoTScapeDevices._encryptionStates = {};

/**
 * Encrypt a string with a device's encryption settings
 * @param {String} service Service device is contained in
 * @param {String} id ID of device to use encryption settings for
 * @param {String} plaintext Plaintext to encrypt
 * @returns Plaintext encrypted with device's encryption settings
 */
IoTScapeDevices.deviceEncrypt = function (service, id, plaintext) {
  let encryptionState = IoTScapeDevices.getEncryptionState(service, id);
  return ciphers[encryptionState.cipher].encrypt(
    plaintext,
    encryptionState.key,
  );
};

/**
 * Encrypt a string with a device's encryption settings
 * @param {String} service Service device is contained in
 * @param {String} id ID of device to use encryption settings for
 * @param {String} ciphertext Ciphertext to decrypt
 * @returns Ciphertext decrypted with device's encryption settings
 */
IoTScapeDevices.deviceDecrypt = function (service, id, ciphertext) {
  let encryptionState = IoTScapeDevices.getEncryptionState(service, id);
  return ciphers[encryptionState.cipher].decrypt(
    ciphertext,
    encryptionState.key,
  );
};

/**
 * Get the remote host of a IoTScape device
 * @param {String} service Name of service
 * @param {String} id ID of device
 */
IoTScapeDevices.getInfo = function (service, id) {
  return IoTScapeDevices._services[service][id];
};

/**
 * Get a device's encryption settings (or defaults if not set)
 * @param {String} service Service device is contained in
 * @param {String} id ID of device to get encryption settings for
 */
IoTScapeDevices.getEncryptionState = function (service, id) {
  if (!IoTScapeDevices.deviceExists(service, id)) {
    throw new Error("Device not found");
  }

  if (!Object.keys(IoTScapeDevices._encryptionStates).includes(service)) {
    IoTScapeDevices._encryptionStates[service] = {};
  }

  if (!Object.keys(IoTScapeDevices._encryptionStates[service]).includes(id)) {
    // Create entry with default
    IoTScapeDevices._encryptionStates[service][id] = {
      key: [0],
      cipher: "plain",
      lastSeqNum: -1,
      totalRate: 0, // in messages per second
      clientRate: 0, // in messages per second
      clientPenalty: 0, // in seconds
      totalCount: 0,
      clientCounts: {},
    };
  }

  const state = IoTScapeDevices._encryptionStates[service][id];

  if (state.cipher == "linked") {
    return IoTScapeDevices.getEncryptionState(state.key.service, state.key.id);
  }

  return state;
};

/**
 * Determine if a message should be accepted from a device
 * @param {String} service Service device is contained in
 * @param {String} id ID of device to use encryption settings for
 * @param {String} clientId ID of client
 * @param {Number} seqNum Sequence number of message
 * @returns {Boolean} If message should be accepted
 */
IoTScapeDevices.accepts = function (service, id, clientId, seqNum = -1) {
  const state = IoTScapeDevices.getEncryptionState(service, id);

  // Check sequence number
  if (
    state.lastSeqNum >= 0 &&
    (seqNum <= state.lastSeqNum || seqNum > state.lastSeqNum + 100)
  ) {
    return false;
  } else if (seqNum > -1) {
    state.lastSeqNum = seqNum;
  }

  let client = state.clientCounts[clientId];
  if (!client) {
    client = {
      count: 0,
      penalty: 0,
    };
    state.clientCounts[clientId] = client;
  }

  if (client.penalty > 0) {
    return false;
  }

  // Check rate limits
  if (this.clientRate > 0 && client.count + 1 > this.clientRate) {
    client.penalty = 1 + state.clientPenalty;
    return false;
  }

  if (this.totalRate > 0 && state.totalCount + 1 > state.totalRate) {
    return false;
  }

  state.totalCount += 1;
  client.count += 1;
  state.clientCounts[clientId] = client;
  IoTScapeDevices._encryptionStates[service][id] = state;

  logger.log(JSON.stringify(IoTScapeDevices._encryptionStates[service][id]));
  return true;
};

/**
 * Updates encryption settings for a device
 * @param {String} service Service device is contained in
 * @param {String} id ID of device to update encryption settings for
 * @param {String=} key Key to set
 * @param {String=} cipher Cipher to set
 */
IoTScapeDevices.updateEncryptionState = function (
  service,
  id,
  key = null,
  cipher = null,
) {
  logger.log(`Updating encryption state for ${service}:${id}`);
  if (!IoTScapeDevices.deviceExists(service, id)) {
    throw new Error("Device not found");
  }

  if (!Object.keys(IoTScapeDevices._encryptionStates).includes(service)) {
    IoTScapeDevices._encryptionStates[service] = {};
  }

  if (!Object.keys(IoTScapeDevices._encryptionStates[service]).includes(id)) {
    // Create entry with default
    IoTScapeDevices._encryptionStates[service][id] = {
      key: [0],
      cipher: "plain",
    };
  }

  // Update key if requested
  if (key != null) {
    IoTScapeDevices._setKey(service, id, key, cipher);

    if (
      key != [0] &&
      IoTScapeDevices._encryptionStates[service][id].cipher == "plain"
    ) {
      cipher = "caesar";
    }
  }

  // Update cipher if requested
  cipher = (cipher || "").toLowerCase();

  if (["linked", ...Object.keys(ciphers)].includes(cipher)) {
    IoTScapeDevices._encryptionStates[service][id].cipher = cipher;
  } else if (cipher != "") {
    // Prevent attempts to use ciphers with no implementation
    throw new Error("Invalid cipher");
  }
};

IoTScapeDevices._setKey = function (service, id, key, cipher) {
  // Set default cipher
  if (
    IoTScapeDevices._encryptionStates[service][id].cipher === "plain" &&
    cipher == null
  ) {
    cipher = "caesar";
  }

  // Setting linked status does not require key to be parsed
  if (cipher != "linked") {
    key = key.map((c) => parseInt(c));

    if (key.includes(NaN)) {
      throw new Error("Invalid key");
    }
  }

  IoTScapeDevices._encryptionStates[service][id].key = key;
};

/**
 * Remove a device from a service
 * @param {String} service Name of service
 * @param {String} id ID of device to remove
 */
IoTScapeDevices.removeDevice = function (service, id) {
  if (!IoTScapeDevices.deviceExists(service, id)) {
    return;
  }

  delete IoTScapeDevices._services[service][id];

  if (Object.keys(IoTScapeDevices._encryptionStates).includes(service)) {
    delete IoTScapeDevices._encryptionStates[service][id];
  }

  if (
    IoTScapeDevices._listeningClients[service] !== undefined &&
    IoTScapeDevices._listeningClients[service][id] !== undefined
  ) {
    delete IoTScapeDevices._listeningClients[service][id];
  }

  logger.log(`Removed ${service}:${id}`);
};

/**
 * List IDs of devices associated for a service
 * @param {String} service Name of service to get device IDs for
 */
IoTScapeDevices.getDevices = function (service) {
  const serviceDict = IoTScapeDevices._services[service];
  return Object.keys(serviceDict || []);
};

/**
 * Determine if a device with a given ID exists
 * @param {String} service Name of service
 * @param {String} id ID of device
 * @returns {Boolean} If device exists
 */
IoTScapeDevices.deviceExists = function (service, id) {
  return IoTScapeDevices.getDevices(service).includes(id);
};

/**
 * Clear the encryption settings for a device
 * @param {String} service Name of service
 * @param {String} id ID of device
 */
IoTScapeDevices.clearEncryption = function (service, id) {
  if (Object.keys(IoTScapeDevices._encryptionStates).includes(service)) {
    delete IoTScapeDevices._encryptionStates[service][id];
  }
};

/**
 * Set targetService's device with targetId as its ID to use the encryption settings of a different device
 * @param {String} service Name of service
 * @param {String} id ID of device
 * @param {String} targetService
 * @param {String} targetId
 */
IoTScapeDevices.link = function (service, id, targetService, targetId) {
  // Validate input
  if (service == targetService && id == targetId) {
    throw new Error("Device cannot be linked to self");
  }

  // Prevent cycles and long chains by enforcing only one layer of linking
  if (IoTScapeDevices.getEncryptionState(service, id).cipher == "linked") {
    throw new Error("Cannot link to other linked device");
  }

  IoTScapeDevices.updateEncryptionState(targetService, targetId, {
    service,
    id,
  }, "linked");
};

// Clear rates every second
setInterval(() => {
  for (let service in IoTScapeDevices._encryptionStates) {
    for (let id in IoTScapeDevices._encryptionStates[service]) {
      let state = IoTScapeDevices._encryptionStates[service][id];

      state.totalCount = 0;

      for (let clientId in state.clientCounts) {
        let client = state.clientCounts[clientId];
        client.count = 0;
        client.penalty = Math.max(0, client.penalty - 1);
        state.clientCounts[clientId] = client;
      }

      IoTScapeDevices._encryptionStates[service][id] = state;
    }
  }
}, 1000);

module.exports = IoTScapeDevices;
