const express = require('express');
const Logger = require('./logger');
const assert = require('assert');
const ObjectId = require('mongodb').ObjectId;
const _ = require('lodash');
const APIKey = require('./procedures/utils/api-key');

class APIKeys {
    async init(db, logger) {
        this.logger = logger ? logger.fork('api-keys') : new Logger('netsblox:api-keys');
    }

    async get(apiKey, serviceSettings) {
        const {provider} = apiKey;
        return this.getKeyFrom(provider, serviceSettings.user?.apiKeys) ||
            this.getKeyFrom(provider, serviceSettings.member?.apiKeys) ||
            this.getLeastSharedKey(
                serviceSettings.groups.map(settings => this.getKeyFrom(provider, settings?.apiKeys))
            );
    }

    getKeyFrom(provider, apiKeys) {
        return (apiKeys || {})[provider];
    }

    getLeastSharedKey(keyValues) {
        const counts = keyValues.reduce((counts, key) => {
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});

        const keyPair = Object.entries(counts)
            .sort(
                ([_v1, c1], [_v2, c2]) => c1 < c2 ? -1 : 1
            )
            .unshift();

        return keyPair ? keyPair[0] : null;
    }

    async list(username, groupId) {
        const query = {owner: username};
        if (groupId) {
            query.groups = groupId;
        }
        return this.collection.find(query).toArray();
    }

    /**
     * Create a new API key. Overwrite any existing key with the same owner and
     * scope.
     */
    async create(owner, provider, value, isGroupDefault=false, groups=[]) {
        const doc = {owner, provider, value, isGroupDefault, groups};
        return this.collection.insertOne(doc);
    }

    async setScope(id, isGroupDefault, groups) {
        const filter = {_id: ObjectId(id)};
        const update = {$set: {isGroupDefault, groups}};
        assert(
            typeof isGroupDefault === 'boolean',
            `isGroupDefault must be a boolean! Received ${isGroupDefault}`
        );
        assert(
            groups instanceof Array,
            `groups must be an Array! Received ${groups}`
        );
        return this.collection.updateOne(filter, update);
    }

    async delete(id, username) {
        const query = {_id: ObjectId(id)};
        if (username) {
            query.owner = username;
        }
        return this.collection.deleteOne(query);
    }

    async all() {
        return this.collection.find({}).toArray();
    }

    getAllApiKeys() {
        return Object.values(APIKey)
            .filter(value => value.constructor.name === 'ApiKey');
    }

    getApiProviders() {
        return this.getAllApiKeys()
            .map(key => ({
                provider: key.provider,
                url: key.helpUrl,
            }));
    }

    router() {
        const router = express.Router({mergeParams: true});
        const EDITABLE_DOC_KEYS = ['value', 'isGroupDefault', 'groups'];

        router.route('/').get(async (req, res) => {
            const {username} = req.session;
            const {group} = req.query;
            res.json(await this.list(username, group));
        });

        router.route('/providers').get(async (req, res) => {
            res.json(this.getApiProviders());
        });

        router.route('/:type').post(async (req, res) => {
            const {type} = req.params;
            const {username} = req.session;
            const {value, isGroupDefault, groups} = req.body;

            if (!value) {
                return res.status(400).send('Missing required field: value');
            }
            const result = await this.create(username, type, value, isGroupDefault, groups);
            res.send(result.insertedId);
        });

        router.route('/').patch(async (req, res) => {
            const {username} = req.session;
            const {id} = req.body;
            if (!id) {
                return res.status(400).send('Missing required field: id');
            }
            const query = {
                _id: ObjectId(id),
                owner: username
            };
            const keys = EDITABLE_DOC_KEYS
                .filter(key => Object.prototype.hasOwnProperty.call(req.body, key));
            const update = {$set: _.pick(req.body, keys)};
            const doc = await this.collection.findOneAndUpdate(
                query,
                update,
                {returnNewDocument: true}
            );
            res.json(doc.value);
        });

        router.route('/:provider').post(async (req, res) => {
            const {provider} = req.params;
            const {username} = req.session;
            const {value, isGroupDefault, groups} = req.body;

            if (!value) {
                return res.status(400).send('Missing required field: value');
            }
            // TODO: Validate the provider?
            const result = await this.create(username, provider, value, isGroupDefault, groups);
            res.send(result.insertedId);
        });

        router.route('/:id').options((req, res) => {
            res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, PUT, PATCH, DELETE');
            res.sendStatus(204);
        });
        router.route('/:id').delete(async (req, res) => {
            const {username} = req.session;
            const {id} = req.params;
            const result = await this.delete(id, username);
            res.json(!!result.deletedCount);
        });

        return router;
    }
}

module.exports = new APIKeys();
