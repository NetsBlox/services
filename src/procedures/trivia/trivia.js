/**
 * The Trivia Service provides access to trivia questions from https://j-archive.com/.
 *
 * @service
 * @category Games
 */
'use strict';

const fs = require('fs');
const zlib = require('zlib');
const Trivia = {};

const QUESTIONS_PATH = 'q.json.gz';

const QUESTIONS = (function() {
    const res = JSON.parse(zlib.gunzipSync(fs.readFileSync(QUESTIONS_PATH)));

    return res;
})();

Trivia.search = async function () {
    return QUESTIONS;
};

/**
 * Get a random trivia question.
 * This includes the question, answer, and additional information.
 * @returns {Object} structured data representing the trivia question
 */
Trivia.getRandomQuestion = function() {
    const keepKeys = [
        'id',
        'question',
        'answer',
        'value',
        'category',
        'airdate',
        'invalid_count'
    ];

    return this._requestData({path: '/random'})
        .then(questions => {
            const [question] = questions.map(q => {
                const cleanedQ = {};
                keepKeys.forEach(k => cleanedQ[k] = q[k]);
                return cleanedQ;
            });

            question.category = question.category.title;
            return question;
        });
};

module.exports = Trivia;
