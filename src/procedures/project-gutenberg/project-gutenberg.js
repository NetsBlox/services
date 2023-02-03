/**
 * The Project Gutenberg service provides access to public domain books. For more information, check out https://project-gutenberg.org/.
 *
 * @service
 * @category Language
 */

const logger = require('../utils/logger')('project-gutenberg');
const metadata = require('./metadata');
const Storage = require('../../storage');
const _ = require('lodash');
const ProjectGutenbergStorage = Storage.createCollection('netsblox:services:project-gutenberg');
const {BookNotFound} = require('./errors');
const axios = require('axios');
const ProjectGutenberg = {};

ProjectGutenberg.initialize = function() {
    ProjectGutenbergStorage.findOne({}).then(async result => {
        if (!result) {
            logger.info('No data found in database, importing metadata.');
            const docs = await metadata.getMetadataDocs();
            await ProjectGutenbergStorage.insertMany(docs);
        }
    });
};

/**
 * Get the URL for the full text of a given book.
 *
 * @param {String} ID Book ID
 * @returns {String}
 */
ProjectGutenberg.getText = async function(id) {
    const {url} = await this.getInfo(id);
    const response = await axios({url, method: 'GET'});
    return response.data;
};

/**
 * Get information about a given book including title and author.
 *
 * @param {String} ID Book ID
 * @returns {Array}
 */
ProjectGutenberg.getInfo = async function(id) {
    const info = await ProjectGutenbergStorage.findOne({id},  {_id: 0});
    if (!info) {
        throw new BookNotFound(id);
    }
    return _.pick(info, ['id', 'title', 'short title', 'author', 'contributor', 'language', 'url']);
};

/**
 * Search for a book given title text and optional advanced options. Returns a list of up to 100 book IDs.
 *
 * @param {Enum<publisher,title,author,language,subject>} field
 * @param {String} text
 * @returns {Array<string>}
 */
ProjectGutenberg.search = async function(field, text) {
    let query = {};
    query[field] = {$regex: text, $options: 'i'};
    if (field === 'author') {
        const nameChunks = text.split(' ');
        nameChunks.unshift(nameChunks.pop() + ',');
        query = {
            $or: [
                query,
                {author: {$regex: nameChunks.join(' '), $options: 'i'}},
            ]
        };
    }

    const info = await ProjectGutenbergStorage.find(query,  {_id: 0}).limit(100).toArray();
    const ids = info.map(info => info.id);
    return ids;
};

module.exports = ProjectGutenberg;
