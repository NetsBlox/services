/**
 * African American Data
 *
 * Explore African American people, history, media, culture,
 * and community resources.
 *
 * @service
 * @category History
 */
 
const ApiConsumer = require("../utils/api-consumer");
 
const BASE_URL =
  "http://flask-api-env.eba-er3e5y3h.us-east-2.elasticbeanstalk.com/api";
 
const AfricanAmericanData = new ApiConsumer(
  "AfricanAmericanData",
  BASE_URL,
  {
    cache: { ttl: 5 * 60 },
  }
);
 
function encode(value) {
  return encodeURIComponent(String(value || "").trim());
}
 // PEOPLE
// Fields:
// name, achievement, occupation, category, image
 
/**
 * Get the names of all people.
 *
 * @category People
 * @returns {Array} all person names
 */
AfricanAmericanData.getAllPeople = async function () {
  const people = await this._requestData({
    path: "/people",
  });
  return people.map((person) => person.name);
};
 
/**
 * Search people by name, occupation, achievement, or category.
 *
 * @category People
 * @param {String} nameOrFieldOrCategory search term
 * @returns {Array} matching person names
 */
AfricanAmericanData.searchPeople = async function (nameOrFieldOrCategory) {
  const people = await this._requestData({
    path: `/people/search?q=${encode(nameOrFieldOrCategory)}`,
  });
  return people.map((person) => person.name);
};
 
/**
 * Get the name of one random person.
 *
 * @category People
 * @returns {String} the random person's name
 */
AfricanAmericanData.getRandomPerson = async function () {
  const person = await this._requestData({
    path: "/people/random",
  });
  return person.name || "";
};
