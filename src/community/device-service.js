const createLogger = require("../procedures/utils/logger");
const IoTScapeServices = require("../procedures/iotscape/iotscape-services");
const IoTScapeDevices = require("../procedures/iotscape/iotscape-devices");
const IoTScape = require("../procedures/iotscape/iotscape");

/**
 * Represents a service created for a IoTScape device
 */
class DeviceService {
  constructor(record) {
    this._record = record;
    this.serviceName = record.name;
    this._logger = createLogger(this.serviceName);

    this.COMPATIBILITY = {};

    record.methods.forEach((method) => {
      try {
        this._initializeRPC(method);
      } catch (err) {
        this._logger.error(
          `Unable to load ${record.name}.${method.name}: ${err.message}`,
        );
      }
    });

    this._docs = {
      description: record.description,
      categories: [["Community", "Devices"], ["Devices", "Community"]],
      getDocFor: (method) => {
        let m = record.methods.find((val) => val.name == method);
        return {
          name: m.name,
          description: m.documentation,
          categories: m.categories,
          args: m.arguments.map((argument) => ({
            name: argument.name,
            optional: argument.optional,
            type: argument.type,
          })),
        };
      },
    };
  }

  async _initializeRPC(methodSpec) {
    // Default methods have special implementations
    if (methodSpec.name === "getDevices") {
      this[methodSpec.name] = async function () {
        return IoTScapeDevices.getDevices(this.serviceName);
      };
    } else if (methodSpec.name === "listen") {
      this[methodSpec.name] = async function () {
        return IoTScapeServices.listen(
          this.serviceName,
          this.socket,
          ...arguments,
        );
      };
    } else if (methodSpec.name === "send") {
      this[methodSpec.name] = async function () {
        return IoTScape._send(
          this.serviceName,
          arguments[0],
          arguments[1],
          this.caller,
        );
      };
    } else if (methodSpec.name === "getMessageTypes") {
      this[methodSpec.name] = async function () {
        return IoTScapeServices.getMessageTypes(this.serviceName);
      };
    } else if (methodSpec.name === "getMethods") {
      this[methodSpec.name] = async function () {
        return IoTScapeServices.getMethods(this.serviceName);
      };
    } else {
      this[methodSpec.name] = async function () {
        let args = Object.values(arguments).splice(1).map((arg) => {
          
          // Convert objects to strings
          if (typeof arg === "object") {
            return JSON.stringify(arg);
          }

          // Strings with spaces need to be wrapped in quotes
          if (typeof arg === "string" && arg.includes(" ")) {
            return `"${arg}"`;
          }
          
          return arg;
        });

        return await IoTScape._send(
          this.serviceName,
          arguments[0],
          [methodSpec.name, ...args].join(" "),
          this.caller,
        );
      };
    }
  }

  _getArgs(method) {
    return this._docs.getDocFor(method).args.map((info) => info.name);
  }

  async onDelete() {
  }
}

module.exports = DeviceService;
