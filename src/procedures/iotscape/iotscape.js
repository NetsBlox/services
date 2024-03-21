/**
 * The IoTScape Service enables remote devices to provide custom services. Custom
 * Services can be found under the "Community/Devices" section using the `call <RPC>`
 * block.
 *
 * @service
 * @category Devices
 */
const _ = require("lodash");
const fs = require("fs");
const path = require("path");
const { isValidIdent } = require("../../utils");
const dgram = require("dgram"),
  server = dgram.createSocket("udp4");

const logger = require("../utils/logger")("iotscape");
const Storage = require("../../storage");
const ServiceEvents = require("../utils/service-events");
const IoTScapeServices = require("./iotscape-services");
const IoTScapeDevices = require("./iotscape-devices");
const Filter = require("bad-words"),
  filter = new Filter();

const normalizeServiceName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, "");
const RESERVED_RPC_NAMES = ["serviceName", "COMPATIBILITY"];
const RESERVED_SERVICE_NAMES = fs.readdirSync(path.join(__dirname, ".."))
  .map(normalizeServiceName);
const MONGODB_DOC_TOO_LARGE = "Attempt to write outside buffer bounds";

const isValidServiceName = (name) =>
  isValidIdent(name) &&
  !RESERVED_SERVICE_NAMES.includes(normalizeServiceName(name));
const isValidRPCName = (name) =>
  isValidIdent(name) && !RESERVED_RPC_NAMES.includes(name);
const isValidArgName = (name) => isValidIdent(name);

const IoTScape = {};
IoTScape.serviceName = "IoTScape";

IoTScape._mongoCollection = null;
IoTScape._getDatabase = function () {
  if (!IoTScape._mongoCollection) {
    IoTScape._mongoCollection = Storage.createCollection(
      "netsblox:services:community",
    );
  }
  return IoTScape._mongoCollection;
};

/**
 * List IDs of devices associated for a service
 * @param {String} service Name of service to get device IDs for
 */
IoTScape.getDevices = function (service) {
  if (!IoTScapeServices.serviceExists(service)) {
    throw new Error("Service not found");
  }

  return IoTScapeDevices.getDevices(service);
};

/**
 * List all IoTScape services registered with the server
 */
IoTScape.getServices = IoTScapeServices.getServices;

/**
 * List the message types associated with a service
 * @param {String} service Name of service to get events for
 */
IoTScape.getMessageTypes = function (service) {
  if (!IoTScapeServices.serviceExists(service)) {
    throw new Error("Service not found");
  }

  return IoTScapeServices.getMessageTypes(service);
};

/**
 * List the methods associated with a service
 * @param {String} service Name of service to get methods for
 */
IoTScape.getMethods = function (service) {
  if (!IoTScapeServices.serviceExists(service)) {
    throw new Error("Service not found");
  }

  return IoTScapeServices.getMethods(service);
};

/**
 * Make a call to a device as a text command
 * @param {String} service Name of service to make call to
 * @param {String} id ID of device to make call to
 * @param {String} command Input to RPC
 */
IoTScape.send = function (service, id, command) {
  return IoTScape._send(service, id, command, this.caller);
};

/**
 * Internal method for sending a command to a device
 * @param {String} service Name of service to make call to
 * @param {String} id ID of device to make call to
 * @param {String} command Input to RPC
 * @param {Object} caller The caller object from the RPC
 * @returns
 */
IoTScape._send = function (service, id, command, caller) {
  const clientId = caller.clientId;

  if (!IoTScapeServices.serviceExists(service)) {
    throw new Error("Service not found");
  }

  if (!IoTScapeDevices.deviceExists(service, id)) {
    throw new Error("Device not found");
  }

  let parts = IoTScapeDevices.deviceDecrypt(service, id, command).split(/\s+/g);

  // Require at least a function name
  if (parts.length < 1) {
    throw new Error("Command too short or invalid");
  }

  // Check for sequence number
  let seqNum = -1;
  if (parts[0].match(/^[0-9]+$/)) {
    seqNum = parseInt(parts[0]);
    parts = parts.slice(1);
  }

  // Allow for RoboScape-esque "set"/"get" commands to be implemented simpler (e.g. "set speed" becomes "setSpeed" instead of a "set" method)
  if (parts.length >= 2) {
    // Combine first word "set", "get", and "reset" with the next words if it's a valid method in the service
    if (["set", "get", "reset"].includes(parts[0])) {
      let methodName = parts[0] + parts[1][0].toUpperCase() + parts[1].slice(1);
      if (IoTScapeServices.functionExists(service, methodName)) {
        parts = [methodName, ...parts.slice(2)];
      } else {
        // Attempt with three words (e.g. "set client rate" becomes "setClientRate" instead of a "set" method)
        if (parts.length >= 3) {
          methodName = parts[0] + parts[1][0].toUpperCase() +
            parts[1].slice(1) +
            parts[2][0].toUpperCase() + parts[2].slice(1);
          if (IoTScapeServices.functionExists(service, methodName)) {
            parts = [methodName, ...parts.slice(3)];
          }
        }
      }
    }
  }

  // Check that call will be accepted
  if (!IoTScapeDevices.accepts(service, id, clientId, seqNum)) {
    return false;
  }

  return IoTScapeServices.call(
    service,
    parts[0],
    id,
    clientId,
    ...parts.slice(1),
  );
};

/**
 * Create a service using a given definition.
 *
 * @param {String} definition Service definition
 * @param {RemoteInfo} remote Remote host information
 */
IoTScape._createService = async function (definition, remote) {
  let parsed = null;

  try {
    parsed = JSON.parse(definition);
  } catch (err) {
    logger.log("Error parsing IoTScape service: " + err);
    return;
  }

  // Ignore empty and request messages sent to this method
  if (parsed == null || parsed.request) {
    return;
  }

  const name = Object.keys(parsed)[0];
  parsed = parsed[name];

  // Verify service definition is in message
  if (typeof (parsed.service) == "undefined") {
    return;
  }

  // Validate service name
  if (!isValidServiceName(name) || name.replace(/[^a-zA-Z0-9]/g, "") !== name) {
    logger.log(`Service ${name} rejected due to invalid name`);
    return;
  }

  const serviceInfo = parsed.service;
  const methodsInfo = parsed.methods || {};
  let methods = _generateMethods(methodsInfo);

  // Validate method names
  if (
    !Object.keys(methodsInfo).every((method) =>
      isValidRPCName(method) &&
      methodsInfo[method].params.every((param) => isValidArgName(param.name))
    )
  ) {
    logger.log(`Service ${name} rejected due to invalid method`);
    return;
  }

  const version = serviceInfo.version;
  const id = parsed.id.trim();

  logger.log(
    `Received definition for service ${name} v${version} from ID ${id}`,
  );

  if (!IoTScape._validateServiceStrings(name, id, serviceInfo, methods)) {
    logger.log(`Service ${name} rejected due to invalid string`);
    return;
  }

  let service = {
    name: name,
    type: "DeviceService",
    description: serviceInfo.description,
    author: "IoTScape",
    createdAt: new Date(),
    methods,
    version: serviceInfo.version,
  };

  // Handle merge for existing service
  [service, methodsChanged] = await _mergeWithExistingService(
    name,
    service,
    methods,
  );

  // Send to database
  if (methodsChanged) {
    const query = { $set: service };
    try {
      await IoTScape._getDatabase().updateOne({ name }, query, {
        upsert: true,
      });
      ServiceEvents.emit(ServiceEvents.UPDATE, name);
    } catch (err) {
      if (err.message === MONGODB_DOC_TOO_LARGE) {
        logger.log(
          "Uploaded service is too large. Please decrease service size and try again.",
        );
      }
      throw err;
    }
  } else {
    logger.log(`Service ${name} already exists and is up to date`);
  }
  IoTScapeServices.updateOrCreateServiceInfo(name, parsed, id, remote);
};

/**
 * Check that strings provided in a service definition are valid and free of profanity
 * @returns {boolean} Were the strings for this service considered valid
 */
IoTScape._validateServiceStrings = function (name, id, serviceInfo, methods) {
  // Validate service name
  if (
    !isValidServiceName(name) || name.replace(/[^a-zA-Z0-9]/g, "") !== name ||
    filter.isProfane(name.replace(/[A-Z]/g, " $&"))
  ) {
    logger.log(`Service name ${name} rejected`);
    return false;
  }

  if (id == "" || filter.isProfane(id.replace(/[A-Z]/g, " $&"))) {
    logger.log("ID invalid");
    return false;
  }

  // Additional profanity checks
  if (
    filter.isProfane(serviceInfo.description) ||
    methods.map((method) => method.name).some((name) =>
      !isValidRPCName(name) || filter.isProfane(name)
    ) ||
    methods.map((method) => method.documentation).some((doc) =>
      filter.isProfane(doc)
    )
  ) {
    logger.log(`Definition for service ${name} rejected`);
    return false;
  }

  return true;
};

// Methods used for all device services but not included in definitions
const _defaultMethods = [{
  name: "getDevices",
  documentation: "Get a list of device IDs for this service",
  arguments: [],
  returns: {
    documentation: "",
    type: ["void"],
  },
}, {
  name: "listen",
  documentation: "Register for receiving messages from the given id",
  arguments: [{
    name: "id",
    optional: false,
    documentation: "ID of device to listen to messages from",
  }],
  returns: {
    documentation: "",
    type: ["void"],
  },
}, {
  name: "send",
  documentation: "Send a text-based message to the service",
  arguments: [{
    name: "id",
    optional: false,
    documentation: "ID of device to send request to",
  }, {
    name: "command",
    optional: false,
    documentation: "Request to send to device",
  }],
  returns: {
    documentation: "",
    type: ["any"],
  },
}, {
  name: "getMessageTypes",
  documentation: "Register for receiving messages from the given id",
  arguments: [],
  returns: {
    documentation: "",
    type: ["array"],
  },
}, {
  name: "getMethods",
  documentation: "Get methods associated with this service",
  arguments: [],
  returns: {
    documentation: "",
    type: ["array"],
  },
}];

/**
 * Creates definitions for methods of an incoming service
 * @param {Object} methodsInfo Methods from parsed JSON data
 */
function _generateMethods(methodsInfo) {
  if (!methodsInfo) {
    logger.error("No methods definition for service");
    return [];
  }
  try {
    // Add default methods first
    let methods = [
      ..._defaultMethods,
      ...Object.keys(methodsInfo).map((methodName) => {
        const methodInfo = methodsInfo[methodName];

        if (!methodInfo) {
          throw new Error("Undefined method " + methodName);
        }

        const method = {
          name: methodName,
          documentation: methodInfo.documentation,
          categories: [["Basic"]],
          returns: methodInfo.returns,
        };

        method.arguments = methodInfo.params.map((param) => {
          let type = param.type === "number"
            ? { name: "Number", params: [] }
            : null;
          return {
            name: param.name,
            optional: param.optional,
            documentation: param.documentation,
            type,
          };
        });

        // Add ID argument to all non-getDevices methods
        method.arguments = [{
          name: "id",
          optional: false,
          documentation: "ID of device to send request to",
        }, ...method.arguments];

        return method;
      }),
    ];
    return methods;
  } catch (error) {
    logger.err(error);
    return [];
  }
}

/**
 * Merges an incoming service with an existing version
 * @param {String} name Name of service to look for
 * @param {object} service Incoming service
 */
async function _mergeWithExistingService(name, service) {
  let existing = await IoTScape._getDatabase().findOne({ name });
  let methodsChanged = false;

  if (existing !== null) {
    const methodNames = _.uniq(
      [...service.methods, ...existing.methods]
        .filter((method) =>
          isValidRPCName(method.name) &&
          method.arguments.every((arg) => isValidArgName(arg.name))
        ) // validate methods
        .map((method) => method.name),
    );

    // Check if methods are the same
    methodsChanged = !_.isEqual(
      service.methods.map((method) => method.name),
      existing.methods.map((method) => method.name),
    );

    // Use newer methods if available
    service.methods = methodNames.map((name) => {
      const existingMethod = existing.methods.find((method) =>
        method.name === name
      );
      const incomingMethod = service.methods.find((method) =>
        method.name === name
      );

      if (existing.version >= service.version) {
        return existingMethod || incomingMethod;
      } else {
        return incomingMethod || existingMethod;
      }
    });

    // Use max of both versions
    if (existing.version > service.version) {
      service.version = existing.version;
    }
  } else {
    // No existing service, so update required
    methodsChanged = true;
  }

  return [service, methodsChanged];
}

server.on("listening", function () {
  var local = server.address();
  logger.log("listening on " + local.address + ":" + local.port);
});

server.on("message", function (message, remote) {
  IoTScape._createService(message, remote);
});

IoTScapeServices.start(server);

/* eslint no-console: off */
IoTScape.initialize = function () {
  console.log("IOTSCAPE_PORT is " + process.env.IOTSCAPE_PORT);
  // Clear old devices
  IoTScape._getDatabase().deleteMany({ type: "DeviceService" });

  server.bind(process.env.IOTSCAPE_PORT || 1975);
};

IoTScape.isSupported = function () {
  if (!process.env.IOTSCAPE_PORT) {
    console.log("IOTSCAPE_PORT is not set (to 1975), IoTScape is disabled");
  }
  return !!process.env.IOTSCAPE_PORT;
};

module.exports = IoTScape;
