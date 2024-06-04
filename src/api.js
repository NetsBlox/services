const express = require("express");
const { defer, filterAsync } = require("./utils");
const RemoteClient = require("./remote-client");
const Services = require("./services-worker");
const Logger = require("./logger");
const ApiKeys = require("./api-keys");
const fs = require("fs");
const path = require("path");
const routeUtils = require("./procedures/utils/router-utils");
const NetsBloxCloud = require("./cloud-client");
const { UserError } = require("./error");

class ServicesAPI {
  constructor() {
    this.loading = defer();

    this.logger = new Logger("netsblox:services");
    this.services = new Services(this.logger);
    this.keys = new ApiKeys(NetsBloxCloud, this.logger);
  }

  async initialize() {
    await this.services.load();
    await this.services.initialize();
  }

  async isServiceLoaded(name) {
    return await this.services.isServiceLoaded(name);
  }

  getServices() {
    return Object.values(this.services.metadata);
  }

  getServiceNameFromDeprecated(name) {
    const deprecatedService = Object.entries(this.services.compatibility)
      .find((pair) => {
        const [validName, info] = pair;
        if (info.path && info.path.toLowerCase() === name) {
          return validName;
        }
      });

    return deprecatedService ? deprecatedService[0] : null;
  }

  getValidServiceName(name) {
    if (this.services.metadata[name]) {
      return name;
    }

    name = name.toLowerCase();
    const validNames = Object.keys(this.services.metadata);
    let validName = validNames
      .find((serviceName) => serviceName.toLowerCase() === name);

    if (validName) {
      return validName;
    }

    return this.getServiceNameFromDeprecated(name);
  }

  getServiceMetadata(name) {
    const validName = this.getValidServiceName(name);
    if (validName) {
      return this.services.metadata[validName];
    }
  }

  getDeprecatedArgName(serviceName, rpcName) {
    const compat = this.services.compatibility[serviceName];

    if (compat) {
      return compat.arguments[rpcName];
    }

    return null;
  }

  router() {
    const router = express.Router({ mergeParams: true });

    router.use(...routeUtils.allDefaults());

    this.addServiceRoutes(router);

    router.route("/").get(async (req, res) => {
      const namedPairs = await filterAsync(
        Object.entries(this.services.metadata),
        (nameAndMetadata) => this.isServiceLoaded(nameAndMetadata[0]),
      );
      const metadata = namedPairs
        .map((pair) => {
          const [name, metadata] = pair;
          return {
            name: name,
            categories: metadata.categories,
          };
        });

      return res.send(metadata);
    });

    router.route("/:serviceName").get(async (req, res) => {
      const serviceName = this.getValidServiceName(req.params.serviceName);

      if (!await this.isServiceLoaded(serviceName)) {
        return res.status(404).send(
          `Service "${serviceName}" is not available.`,
        );
      }

      return res.json(this.services.metadata[serviceName]);
    });

    router.route("/:serviceName/:rpcName")
      .post(async (req, res) => {
        const serviceName = this.getValidServiceName(req.params.serviceName);
        if (await this.validateRPCRequest(serviceName, req, res)) {
          const { rpcName } = req.params;
          return this.invokeRPC(serviceName, rpcName, req, res);
        }
      });

    return router;
  }

  addServiceRoutes(router) {
    const servicesWithRoutes = fs.readdirSync(
      path.join(__dirname, "procedures"),
    )
      .filter((name) =>
        fs.existsSync(path.join(__dirname, "procedures", name, "routes.js"))
      );

    servicesWithRoutes.forEach((name) => {
      const routesPath = `./procedures/${name}/routes`;
      const subrouter = require(routesPath);
      if (Array.isArray(subrouter)) {
        this.logger.warn(
          `Routes defined as a list of objects is deprecated. Please update ${name} routes to return an express router.`,
        );
        return;
      }
      router.use(`/routes/${name}`, subrouter);
    });
  }

  exists(serviceName, rpcName) {
    const service = this.services.metadata[serviceName];
    return service && !!service.rpcs[rpcName];
  }

  getArgumentNames(serviceName, rpcName) {
    const service = this.services.metadata[serviceName];
    return service?.rpcs[rpcName].args.map((arg) => arg.name) ?? [];
  }

  async validateRPCRequest(serviceName, req, res) {
    const { rpcName } = req.params;
    const { clientId } = req.query;

    if (!clientId) {
      res.status(400).send("Client ID is required.");
    } else if (!await this.isServiceLoaded(serviceName)) {
      res.status(404).send(`Service "${serviceName}" is not available.`);
    } else if (!this.exists(serviceName, rpcName)) {
      res.status(404).send(`RPC "${rpcName}" is not available.`);
    } else {
      return true;
    }
    return false;
  }

  async invokeRPC(serviceName, rpcName, req, res) {
    const { clientId } = req.query;
    this.logger.info(
      `Received request to ${serviceName} for ${rpcName} (from ${clientId})`,
    );

    const ctx = {};
    ctx.response = res;
    ctx.request = req;

    let username = undefined;
    let state = undefined;
    try {
      const clientInfo = await NetsBloxCloud.getClientInfo(clientId);
      username = clientInfo.username;
      state = clientInfo.state;
    } catch (e) {
      this.logger.error(
        `invokeRPC: failed to get client info - clientId=${clientId} cloud error: ${e}`,
      );
    }

    // TODO: add support for external states, too?
    const projectId = state?.browser?.projectId;
    const roleId = state?.browser?.roleId;

    ctx.caller = {
      username,
      projectId,
      roleId,
      clientId,
    };
    const apiKey = this.services.getApiKey(serviceName);
    const isLoggedIn = !!username;
    if (apiKey && isLoggedIn) {
      // TODO: handle invalid settings (parse error)
      const apiKeyValue = await this.keys.get(username, apiKey); // TODO: double check this
      if (apiKeyValue) {
        ctx.apiKey = apiKeyValue;
      }
    }
    ctx.socket = new RemoteClient(projectId, roleId, clientId);

    const args = this.getArguments(serviceName, rpcName, req);

    return this.services.invoke(ctx, serviceName, rpcName, args);
  }

  getArguments(serviceName, rpcName, req) {
    const expectedArgs = this.getArgumentNames(serviceName, rpcName);
    const oldFieldNameFor = this.getDeprecatedArgName(serviceName, rpcName) ||
      {};
    return expectedArgs.map((argName) => {
      const oldName = oldFieldNameFor[argName];
      return req.body.hasOwnProperty(argName)
        ? req.body[argName]
        : req.body[oldName];
    });
  }
}

module.exports = new ServicesAPI();
