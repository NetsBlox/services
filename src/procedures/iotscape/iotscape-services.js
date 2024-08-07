const logger = require("../utils/logger")("iotscape-services");
const { setTimeout, setInterval } = require("../../timers");
const IoTScapeDevices = require("./iotscape-devices");

/**
 * Stores information about registered services, with a list of IDs and their respective hosts
 */
const IoTScapeServices = {};

IoTScapeServices._serviceDefinitions = {};

/**
 * Creates or updates the connection information for a remote service
 * @param {String} name
 * @param {String} id
 * @param {RemoteInfo} rinfo
 */
IoTScapeServices.updateOrCreateServiceInfo = function (
  name,
  definition,
  id,
  rinfo,
) {
  let service = IoTScapeDevices._services[name];
  IoTScapeServices._serviceDefinitions[name] = definition;

  if (!service) {
    // Service not added yet
    service = IoTScapeDevices._services[name] = {};
  }

  if (!rinfo) {
    logger.log("Service " + name + " created without connection info");
    return;
  }

  logger.log(
    "Discovering " + name + ":" + id + " at " + rinfo.address + ":" +
      rinfo.port,
  );

  service[id] = rinfo;
};

/**
 * List services
 */
IoTScapeServices.getServices = function () {
  return Object.keys(IoTScapeDevices._services);
};

/**
 * List events associated with a service
 * @param {string} service Name of service
 */
IoTScapeServices.getMessageTypes = function (service) {
  if (!IoTScapeServices.serviceExists(service)) {
    return {};
  }

  // Parse events into NetsBlox-friendlier format
  let eventsInfo = IoTScapeServices._serviceDefinitions[service].events || {};
  eventsInfo = Object.keys(eventsInfo).map(
    (event) => [event, ["id", ...eventsInfo[event].params]],
  );
  return eventsInfo;
};

/**
 * Determine if a service exists
 * @param {String} service Name of service
 * @returns {Boolean} If service exists
 */
IoTScapeServices.serviceExists = function (service) {
  return IoTScapeServices.getServices().includes(service);
};

IoTScapeServices._specialMethods = {
  "heartbeat": {
    returns: {
      type: ["boolean"],
    },
  },
  "setKey": {
    params: [{
      "name": "key",
      "documentation": "Key to set",
      "type": "number",
      "optional": false,
    }],
    returns: {
      type: ["void"],
    },
  },
  "setCipher": {
    params: [{
      "name": "cipher",
      "documentation": "Cipher to use",
      "type": "string",
      "optional": false,
    }],
    returns: {
      type: ["void"],
    },
  },
  "setClientRate": {
    params: [{
      "name": "rate",
      "documentation": "Maximum number of messages per second per client",
      "type": "number",
      "optional": false,
    }, {
      "name": "penalty",
      "documentation": "Penalty for exceeding rate limit in seconds",
      "type": "number",
      "optional": false,
    }],
    returns: {
      type: ["void"],
    },
  },
  "setTotalRate": {
    params: [{
      "name": "rate",
      "documentation": "Maximum number of messages per second for all clients",
      "type": "number",
      "optional": false,
    }],
    returns: {
      type: ["void"],
    },
  },
  "resetRate": {
    params: [],
    returns: {
      type: ["void"],
    },
  },
  "_requestedKey": {
    returns: {
      type: ["void"],
    },
  },
};

/**
 * List methods associated with a service
 * @param {string} service Name of service
 */
IoTScapeServices.getMethods = function (service) {
  if (!IoTScapeServices.serviceExists(service)) {
    return {};
  }

  // Parse methods into NetsBlox-friendlier format
  let methodsInfo = IoTScapeServices._serviceDefinitions[service].methods;
  methodsInfo = Object.keys(methodsInfo).map(
    (method) => [method, methodsInfo[method].params.map((param) => param.name)],
  );
  return methodsInfo;
};

/**
 * Determine if a service has a given function
 * @param {String} service Name of service
 * @param {String} func Name of function
 * @returns {Boolean} If function exists
 */
IoTScapeServices.functionExists = function (service, func) {
  if (!IoTScapeServices.serviceExists(service)) {
    return false;
  }

  return Object.keys(IoTScapeServices._specialMethods).includes(func) ||
    IoTScapeServices.getFunctionInfo(service, func) !== undefined;
};

/**
 * Get definition information for a given function
 * @param {String} service Name of service
 * @param {String} func Name of function
 */
IoTScapeServices.getFunctionInfo = function (service, func) {
  if (Object.keys(IoTScapeServices._specialMethods).includes(func)) {
    return IoTScapeServices._specialMethods[func];
  }

  let method =
    (IoTScapeServices._serviceDefinitions[service] ?? { methods: [] }).methods
      .filter((m) => m.name === func);
  return method.length > 0 ? method[0] : undefined;
};

IoTScapeServices._lastRequestID = 0;

/**
 * Get ID for a new request
 */
IoTScapeServices._generateRequestID = function () {
  return (IoTScapeServices._lastRequestID++).toString() + Date.now();
};

IoTScapeServices._awaitingRequests = {};
IoTScapeServices._listeningClients = {};

/**
 * Add a client to get event updates from a device
 * @param {String} service Name of service
 * @param {String} id ID of device
 * @param {*} client Client to add to listeners
 */
IoTScapeServices.listen = function (service, client, id) {
  id = id.toString();

  // Validate name and ID
  if (!IoTScapeDevices.deviceExists(service, id)) {
    return false;
  }

  if (!Object.keys(IoTScapeServices._listeningClients).includes(service)) {
    IoTScapeServices._listeningClients[service] = {};
  }

  if (!Object.keys(IoTScapeServices._listeningClients[service]).includes(id)) {
    IoTScapeServices._listeningClients[service][id] = [];
  }

  // Prevent listen if this client/role/project combination is already listening
  if (
    !IoTScapeServices._listeningClients[service][id].some((existingClient) =>
      existingClient.clientId === client.clientId &&
      existingClient.roleId == client.roleId &&
      existingClient.projectId == client.projectId
    )
  ) {
    IoTScapeServices._listeningClients[service][id].push(client);
  }
};

/**
 * Make a call to a IoTScape function
 * @param {String} service Name of service
 * @param {String} func RPC on device to call
 * @param {String} id ID of device
 * @param {Object} clientId Client making the call
 * @param  {...any} args
 */
IoTScapeServices.call = async function (service, func, id, clientId, ...args) {
  id = id.toString();

  // Validate name, ID, and function
  if (
    !IoTScapeDevices.deviceExists(service, id) ||
    !IoTScapeServices.functionExists(service, func)
  ) {
    if (!IoTScapeDevices.deviceExists(service, id)) {
      logger.log("Device does not exist");
    }
    if (!IoTScapeServices.functionExists(service, func)) {
      logger.log("Function does not exist");
    }

    return false;
  }

  logger.log(`Calling ${service}:${id}.${func}(${args.join(", ")})`);

  const reqid = IoTScapeServices._generateRequestID();

  // Don't send out serverside commands
  if (func !== "heartbeat") {
    // Create and send request
    let request = {
      id: reqid,
      service: service,
      device: id,
      function: func,
      params: [...args],
    };

    // Handle special functions
    if (
      func == "setKey" || func == "setCipher" || func == "setClientRate" ||
      func == "setTotalRate" || func == "resetRate"
    ) {
      // Handle setKey/Cipher after relaying message to use old encryption
      if (IoTScapeDevices.getEncryptionState(service, id).cipher != "linked") {
        if (func === "setKey") {
          IoTScapeDevices.updateEncryptionState(service, id, args, null);
        } else if (func === "setCipher") {
          IoTScapeDevices.updateEncryptionState(service, id, null, args[0]);
        } else if (func === "setClientRate") {
          IoTScapeDevices.updateEncryptionState(
            service,
            id,
            null,
            null,
            args[0],
            args[1],
          );
        } else if (func === "setTotalRate") {
          IoTScapeDevices.updateEncryptionState(
            service,
            id,
            null,
            null,
            null,
            null,
            args[0],
          );
        } else if (func === "resetRate") {
          IoTScapeDevices.updateEncryptionState(
            service,
            id,
            null,
            null,
            0,
            0,
            0,
          );
        }
      } else {
        // Not supported on linked device
        return false;
      }

      return true;
    }

    // Determine response type
    const methodInfo = IoTScapeServices.getFunctionInfo(service, func);
    const responseType = methodInfo.returns.type;

    // Add caller info to request
    if (clientId) {
      request.clientId = clientId;
    } else {
      request.clientId = "server";
    }
    // Expects a value response
    let attempt = (resolve) => {
      const rinfo = IoTScapeDevices.getInfo(service, id);
      IoTScapeServices.socket.send(
        JSON.stringify(request),
        rinfo.port,
        rinfo.address,
      );

      IoTScapeServices._awaitingRequests[reqid] = {
        service: service,
        function: func,
        resolve,
      };
    };

    let timeout = (_, reject) => {
      // Time out eventually
      setTimeout(() => {
        delete IoTScapeServices._awaitingRequests[reqid];
        reject();
      }, 3000);
    };

    let promise = Promise.race([
      new Promise(attempt),
      new Promise(timeout),
    ]).then((result) => result).catch(() => {
      // Make second attempt
      logger.log("IoTScape request timed out, trying again");
      return Promise.race([new Promise(attempt), new Promise(timeout)]).then((
        result,
      ) => result).catch(() => {
        logger.log("IoTScape request timed out again, giving up");
        return "Response timed out.";
      });
    });

    // No response required
    if (responseType.length < 1 || responseType[0] == "void") {
      return;
    }

    // Event response type
    if (responseType[0].startsWith("event")) {
      return;
    }

    return promise;
  }
};

/**
 * Map of message types which should be handled on the server to their handlers
 */
IoTScapeServices._specialMessageTypes = {
  "_reset": (parsed) => {
    // Reset encryption on device
    logger.log(`Resetting ${parsed.service}:${parsed.id}`);
    IoTScapeDevices.clearEncryption(parsed.service, parsed.id);
  },
  "_requestKey": (parsed) => {
    if (
      IoTScapeDevices.getEncryptionState(parsed.service, parsed.id).cipher ==
        "linked"
    ) {
      logger.log(
        `Refused to generate HW key for ${parsed.service}:${parsed.id} due to existing link`,
      );
      return;
    }
    // Generate hardware key
    let key = [];

    for (let i = 0; i < 4; i++) {
      key.push(Math.floor(Math.random() * 16));
    }

    IoTScapeDevices.updateEncryptionState(
      parsed.service,
      parsed.id,
      key,
      "caesar",
    );

    // Tell device what the new key is, so it can display it
    IoTScapeServices.call(
      parsed.service,
      "_requestedKey",
      parsed.id,
      null,
      ...key,
    );
  },
  "_link": (parsed) => {
    const targetService = parsed.event.args.service;
    const targetID = parsed.event.args.id;

    if (!IoTScapeDevices.deviceExists(targetService, targetID)) {
      logger.log(
        `Requested invalid link of ${parsed.service}:${parsed.id} to ${targetService}:${targetID}`,
      );
      return;
    }

    logger.log(
      `Linking ${parsed.service}:${parsed.id} to ${targetService}:${targetID}`,
    );

    IoTScapeDevices.link(parsed.service, parsed.id, targetService, targetID);
  },
};

const _handleMessage = function (message, remote) {
  let parsed = null;

  try {
    parsed = JSON.parse(message);
  } catch (err) {
    logger.log("Error parsing IoTScape message: " + err);
    return;
  }

  if (parsed == null) {
    logger.log("Invalid IoTScape message");
    return;
  }

  // Ignore other messages
  if (parsed.request) {
    _handleResponse(parsed);
  }

  if (parsed.event && IoTScapeDevices.deviceExists(parsed.service, parsed.id)) {
    _handleEvent(parsed, remote);
  }
};

const _handleResponse = function (parsed) {
  const requestID = parsed.request;

  if (
    Object.keys(IoTScapeServices._awaitingRequests).includes(
      requestID.toString(),
    )
  ) {
    if (parsed.response) {
      // Return multiple results as a list, single result as a value
      const methodInfo = IoTScapeServices.getFunctionInfo(
        IoTScapeServices._awaitingRequests[requestID].service,
        IoTScapeServices._awaitingRequests[requestID].function,
      );
      const responseType = methodInfo.returns.type;

      try {
        if (responseType.length > 1) {
          IoTScapeServices._awaitingRequests[requestID].resolve(
            parsed.response,
          );
        } else {
          IoTScapeServices._awaitingRequests[requestID].resolve(
            ...parsed.response,
          );
        }
      } catch (error) {
        logger.log("IoTScape response invalid: " + error);
      }

      delete IoTScapeServices._awaitingRequests[requestID];
    }
  }
};

const _handleEvent = function (parsed, remote) {
  // Handle special message types, but only if they come from the device
  if (
    Object.keys(IoTScapeServices._specialMessageTypes).includes(
      parsed.event.type,
    ) &&
    IoTScapeDevices._services[parsed.service][parsed.id].address ==
      remote.address &&
    IoTScapeDevices._services[parsed.service][parsed.id].port == remote.port
  ) {
    IoTScapeServices._specialMessageTypes[parsed.event.type](parsed);
  } else {
    IoTScapeServices.sendMessageToListeningClients(
      parsed.service,
      parsed.id.toString(),
      parsed.event.type,
      { ...parsed.event.args },
    );
  }
};

/**
 * Send a NetsBlox message to clients listening to a device
 * @param {String} service Name of service
 * @param {String} id ID of device
 * @param {String} type Message type
 * @param {Object} content Contents of message
 */
IoTScapeServices.sendMessageToListeningClients = function (
  service,
  id,
  type,
  content,
) {
  // Find listening clients
  const clientsByID = IoTScapeServices._listeningClients[service] || {};
  const clients = clientsByID[id] || [];

  logger.log("Sending message to clients: " + JSON.stringify(clients));

  if (type == "device command") {
    // Send command directly
    clients.forEach((client) => {
      client.sendMessage(type, { service, device: id, ...content });
    });
  } else {
    // Currently not used, but could be used to return device responses
    clients.forEach((client) => {
      client.sendMessage("device message", {
        service,
        device: id,
        message: IoTScapeDevices.deviceEncrypt(
          service,
          id,
          [type, ...Object.values(content)].join(" "),
        ),
      });
    });
  }
};

IoTScapeServices.start = function (socket) {
  IoTScapeServices.socket = socket;

  // Handle incoming responses
  IoTScapeServices.socket.on("message", _handleMessage);

  // Request heartbeats on interval
  async function heartbeat(service, device) {
    logger.log(`heartbeat ${service}:${device}`);

    try {
      // Send heartbeat request, will timeout if device does not respond
      await IoTScapeServices.call(service, "heartbeat", device, null);
    } catch (e) {
      // Remove device if it didn't respond
      return false;
    }

    return true;
  }

  setInterval(async () => {
    for (const service of IoTScapeServices.getServices()) {
      IoTScapeDevices.getDevices(service).forEach(async (device) => {
        if (!(await heartbeat(service, device))) {
          // Send second heartbeat request, will timeout if device does not respond
          if (!(await heartbeat(service, device))) {
            logger.log(
              `${service}:${device} did not respond to heartbeat, removing from active devices`,
            );
            IoTScapeDevices.removeDevice(service, device);
          }
        }
      });
    }
  }, 2 * 60 * 1000);
};

module.exports = IoTScapeServices;
