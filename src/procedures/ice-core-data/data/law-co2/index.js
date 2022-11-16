const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dataFile = path.join(__dirname, 'antarctica2015co2law.txt');
const lines = fs.readFileSync(dataFile, 'utf8').split('\n');

// Remove all the headers and descriptions
const dataRegex = /^-?\d/;
while (!dataRegex.test(lines[0])) {
    lines.shift();
}
while (!dataRegex.test(lines[lines.length-1])) {
    lines.pop();
}

const records = lines
    .map(line => {
        const [yearsBefore1950, value] = line.split('\t');
        const core = 'Law';
        const year = 1950 - yearsBefore1950;
        return {core, year, datatype: 'Carbon Dioxide', value};
    });

const EXPECTED_RECORD_COUNT = 136;
assert.equal(records.length, EXPECTED_RECORD_COUNT);
module.exports = records;
