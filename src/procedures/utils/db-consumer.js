const NBService = require('./service.js');

/**
 * Converts a phrase into camel case format
 * @param {String} text 
 */
function toCamelCase(text) {
    // create uppercc
    return text.toLowerCase()
        .split(' ')
        .map((s) => s.charAt(0).toUpperCase() + s.substring(1))
        .join('');
}

/**
 * Base for RPC services using the database as a source
 */
class DBConsumer extends NBService {
    /**
    * @param {String} serviceName a valid service name
    * @param {Object} model mongoose model
    */
    constructor(serviceName, model) {
        super(serviceName);
        this._model = model;
    }

    _cleanDbRec(rec) {
        delete rec._doc._id;
        delete rec._doc.__v;
        return rec._doc;
    }

    _fields() {
        let fields = Object.keys(this._model.schema.paths);
        return fields.slice(0,fields.length-2); // exclude id and v
    }

    async _advancedSearch(field, query, skip = 0, limit = -1) {
        // prepare and check the input

        if(!Array.isArray(field)){
            field = [field];
            query = [query];
        }

        let dbQuery = {};
        for(let i in field){
            if (!this._fields().find(attr => attr === field[i])){
                throw new Error('bad field name');
            }
        
            // Build the database query
            if(typeof(query[i]) === 'string'){
                dbQuery[field[i]] = new RegExp(`.*${query[i]}.*`, 'i');
            } else {
                // Allow for query objects to be passed in
                dbQuery[field[i]] = query[i];
            }
        }

        let res;

        if(limit === -1){
            res = await this._model.find(dbQuery).skip(skip);
        } else {
            res = await this._model.find(dbQuery).skip(skip).limit(limit);
        }
        
        return res.map(this._cleanDbRec);
    }

    /**
     * Generates RPC functions from a list of fields
     * @param {Array<String>} featuredFields Names of fields to generate functions for
     */
    _genRPCs(featuredFields) {
        featuredFields.forEach(field => {
            // make sure the field exists
            if (!this._fields().includes(field)) throw new Error('non existing featured field');

            this['searchBy' + toCamelCase(field)] = async function(query) {
                // build the database query
                let dbQuery = {};
                dbQuery[field] = new RegExp(`.*${query}.*`, 'i');

                let res = await this._model.find(dbQuery).limit(20);
                return res.map(this._cleanDbRec);
            };
        });
    }
}

module.exports = DBConsumer;
