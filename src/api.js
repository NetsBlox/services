const express = require('express');
const {defer} = require('./utils');
const RemoteClient = require('./remote-client');
const Services = require('./services-worker');
const Logger = require('./logger');
const ApiKeys = require('./api-keys');
const fs = require('fs');
const path = require('path');
const routeUtils = require('./procedures/utils/router-utils');
const NetsBloxCloud = require('./cloud-client');

class ServicesAPI {
    constructor() {
        this.loading = defer();

        this.logger = new Logger('netsblox:services');
        this.services = new Services(this.logger);
    }

    async initialize() {
        await this.services.load();
        await this.services.initialize();
    }

    isServiceLoaded(name) {
        return this.services.isServiceLoaded(name);
    }

    getServices() {
        return Object.values(this.services.metadata);
    }

    getServiceNameFromDeprecated(name) {
        const deprecatedService = Object.entries(this.services.compatibility)
            .find(pair => {
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
            .find(serviceName => serviceName.toLowerCase() === name);

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
        const router = express.Router({mergeParams: true});

        router.use(...routeUtils.allDefaults());

        this.addServiceRoutes(router);

        router.route('/').get((req, res) => {
            const metadata = Object.entries(this.services.metadata)
                .filter(nameAndMetadata => this.isServiceLoaded(nameAndMetadata[0]))
                .map(pair => {
                    const [name, metadata] = pair;
                    return {
                        name: name,
                        categories: metadata.categories
                    };
                });
            return res.send(metadata);
        });

        router.route('/:serviceName').get((req, res) => {
            const serviceName = this.getValidServiceName(req.params.serviceName);

            if (!this.isServiceLoaded(serviceName)) {
                return res.status(404).send(`Service "${serviceName}" is not available.`);
            }

            return res.json(this.services.metadata[serviceName]);
        });

        router.route('/:serviceName/:rpcName')
            .post((req, res) => {
                const serviceName = this.getValidServiceName(req.params.serviceName);
                if (this.validateRPCRequest(serviceName, req, res)) {
                    const {rpcName} = req.params;
                    return this.invokeRPC(serviceName, rpcName, req, res);
                }
            });

        return router;
    }

    addServiceRoutes(router) {
        const servicesWithRoutes = fs.readdirSync(path.join(__dirname, 'procedures'))
            .filter(name => fs.existsSync(path.join(__dirname, 'procedures', name, 'routes.js')));

        servicesWithRoutes.forEach(name => {
            const routesPath = `./procedures/${name}/routes`;
            const subrouter = require(routesPath);
            if (Array.isArray(subrouter)) {
                this.logger.warn(`Routes defined as a list of objects is deprecated. Please update ${name} routes to return an express router.`);
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
        return service.rpcs[rpcName].args.map(arg => arg.name);
    }

    validateRPCRequest(serviceName, req, res) {
        const {rpcName} = req.params;
        const {clientId} = req.query;

        if(!clientId) {
            res.status(400).send('Client ID is required.');
        } else if (!this.isServiceLoaded(serviceName)) {
            res.status(404).send(`Service "${serviceName}" is not available.`);
        } else if (!this.exists(serviceName, rpcName)) {
            res.status(404).send(`RPC "${rpcName}" is not available.`);
        } else {
            return true;
        }

        return false;
    }

    async invokeRPC(serviceName, rpcName, req, res) {
        const {clientId} = req.query;
        this.logger.info(`Received request to ${serviceName} for ${rpcName} (from ${clientId})`);

        const ctx = {};
        ctx.response = res;
        ctx.request = req;
        const {username, state} = await NetsBloxCloud.getClientInfo(clientId)
        // TODO: add support for external states, too?
        const projectId = state.browser?.projectId;
        const roleId = state.browser?.roleId;

        ctx.caller = {
            username,
            projectId,
            roleId,
            clientId,
        };
        const apiKey = this.services.getApiKey(serviceName);
        console.log({apiKey});
        if (apiKey) {
            // TODO: handle invalid settings (parse error)
            const settings = await NetsBloxCloud.getServiceSettings(username);
            const apiKeyValue = await ApiKeys.get(apiKey, settings);
            if (apiKeyValue) {
                ctx.apiKey = apiKeyValue;
            }
            console.log('key', ctx.apiKey);
        }
        ctx.socket = new RemoteClient(projectId, roleId, clientId);

        const args = this.getArguments(serviceName, rpcName, req);

        return this.services.invoke(ctx, serviceName, rpcName, args);
    }

    getArguments(serviceName, rpcName, req) {
        const expectedArgs = this.getArgumentNames(serviceName, rpcName);
        const oldFieldNameFor = this.getDeprecatedArgName(serviceName, rpcName) || {};
        return expectedArgs.map(argName => {
            const oldName = oldFieldNameFor[argName];
            return req.body.hasOwnProperty(argName) ? req.body[argName] : req.body[oldName];
        });
    }
}

module.exports = new ServicesAPI();
