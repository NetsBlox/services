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

/**
 * Get people from a category.
 *
 * @category People
 * @param {String} category category name
 * @returns {Array} matching person records
 */
AfricanAmericanData.getPeopleByCategory = async function (category) {
  return this._requestData({
    path: `/people/category/${encode(category)}`,
  });
};
 
/**
 * Get all available people categories.
 *
 * @category People
 * @returns {Array} category names
 */
AfricanAmericanData.getPeopleCategories = async function () {
  return this._requestData({
    path: "/people/categories",
  });
};
 
async function lookupPerson(self, name) {
  return self._requestData({
    path: `/people/lookup/${encode(name)}`,
  });
}

/**
 * Get a person's achievement or trivia clue.
 *
 * @category People
 * @param {String} name the person's name
 * @returns {String} the person's achievement
 */
AfricanAmericanData.getPersonAchievement = async function (name) {
  const person = await lookupPerson(this, name);
  return person.achievement || "";
};
 
/**
 * Get a person's occupation.
 *
 * @category People
 * @param {String} name the person's name
 * @returns {String} the person's occupation
 */
AfricanAmericanData.getPersonOccupation = async function (name) {
  const person = await lookupPerson(this, name);
  return person.occupation || "";
};
 
/**
 * Get a person's category.
 *
 * @category People
 * @param {String} name the person's name
 * @returns {String} the person's category
 */
AfricanAmericanData.getPersonCategory = async function (name) {
  const person = await lookupPerson(this, name);
  return person.category || "";
};
 
/**
 * Get a person's image.
 *
 * @category People
 * @param {String} name the person's name
 * @returns {Image} the person's image
 */
AfricanAmericanData.getPersonImage = async function (name) {
  const person = await lookupPerson(this, name);
  return this._sendImage({
    baseUrl: person.image,
  });
};
 
// HISTORY
// title, summary, year, location, category, image
 
/**
 * Get the titles of all historical events.
 *
 * @category History
 * @returns {Array} all event titles
 */
AfricanAmericanData.getAllHistoryEvents = async function () {
  const events = await this._requestData({
    path: "/history",
  });
  return events.map((event) => event.title);
};
 
/**
 * Search historical events by title, summary, location,
 * year, or category.
 *
 * @category History
 * @param {String} titleOrCategory search term
 * @returns {Array} matching event titles
 */
AfricanAmericanData.searchHistory = async function (titleOrCategory) {
  const events = await this._requestData({
    path: `/history/search?q=${encode(titleOrCategory)}`,
  });
  return events.map((event) => event.title);
};
 
/**
 * Get the title of one random historical event.
 *
 * @category History
 * @returns {String} the random event's title
 */
AfricanAmericanData.getRandomHistoryEvent = async function () {
  const event = await this._requestData({
    path: "/history/random",
  });
  return event.title || "";
};
 
/**
 * Get historical event titles from a category.
 *
 * @category History
 * @param {String} category history category
 * @returns {Array} matching event titles
 */
AfricanAmericanData.getHistoryByCategory = async function (category) {
  const events = await this._requestData({
    path: `/history/category/${encode(category)}`,
  });
  return events.map((event) => event.title);
};
 
/**
 * Get all available history categories.
 *
 * @category History
 * @returns {Array} category names
 */
AfricanAmericanData.getHistoryCategories = async function () {
  return this._requestData({
    path: "/history/categories",
  });
};

async function lookupHistoryEvent(self, title) {
  return self._requestData({
    path: `/history/lookup/${encode(title)}`,
  });
}
 
/**
 * Get the summary of a historical event.
 *
 * @category History
 * @param {String} title the event's title
 * @returns {String} the event summary
 */
AfricanAmericanData.getEventSummary = async function (title) {
  const event = await lookupHistoryEvent(this, title);
  return event.summary || "";
};
 
/**
 * Get the year of a historical event.
 *
 * @category History
 * @param {String} title the event's title
 * @returns {Number} the event year
 */
AfricanAmericanData.getEventYear = async function (title) {
  const event = await lookupHistoryEvent(this, title);
  return event.year;
};
 
/**
 * Get the location of a historical event.
 *
 * @category History
 * @param {String} title the event's title
 * @returns {String} the event location
 */
AfricanAmericanData.getEventLocation = async function (title) {
  const event = await lookupHistoryEvent(this, title);
  return event.location || "";
};
 
/**
 * Get the category of a historical event.
 *
 * @category History
 * @param {String} title the event's title
 * @returns {String} the event category
 */
AfricanAmericanData.getEventCategory = async function (title) {
  const event = await lookupHistoryEvent(this, title);
  return event.category || "";
};
 
/**
 * Get an image for a historical event.
 *
 * @category History
 * @param {String} title the event's title
 * @returns {Image} the event image
 */
AfricanAmericanData.getHistoryImage = async function (title) {
  const event = await lookupHistoryEvent(this, title);
  return this._sendImage({
    baseUrl: event.image,
  });
};
 
// MEDIA
// name, summary, role, image
 
/**
 * Get the names of all media people.
 *
 * @category Media
 * @returns {Array} all media person names
 */
AfricanAmericanData.getAllMediaPeople = async function () {
  const people = await this._requestData({
    path: "/media",
  });
  return people.map((person) => person.name);
};
 
/**
 * Search media people by name.
 *
 * @category Media
 * @param {String} personName name to search for
 * @returns {Array} matching media person names
 */
AfricanAmericanData.searchMediaByName = async function (personName) {
  const people = await this._requestData({
    path: `/media/search?q=${encode(personName)}`,
  });
  return people.map((person) => person.name);
};
 
/**
 * Get the name of one random media person.
 *
 * @category Media
 * @returns {String} the random media person's name
 */
AfricanAmericanData.getRandomMediaPerson = async function () {
  const person = await this._requestData({
    path: "/media/random",
  });
  return person.name || "";
};
 
async function lookupMediaPerson(self, name) {
  return self._requestData({
    path: `/media/lookup/${encode(name)}`,
  });
}
 
/**
 * Get a media person's summary.
 *
 * @category Media
 * @param {String} name the media person's name
 * @returns {String} the person's summary
 */
AfricanAmericanData.getMediaSummary = async function (name) {
  const media = await lookupMediaPerson(this, name);
  return media.summary || "";
};
 
/**
 * Get a media person's role.
 *
 * @category Media
 * @param {String} name the media person's name
 * @returns {String} the person's role
 */
AfricanAmericanData.getMediaRole = async function (name) {
  const media = await lookupMediaPerson(this, name);
  return media.role || "";
};
 
/**
 * Get a media person's image.
 *
 * @category Media
 * @param {String} name the media person's name
 * @returns {Image} the person's image
 */
AfricanAmericanData.getMediaImage = async function (name) {
  const media = await lookupMediaPerson(this, name);
  return this._sendImage({
    baseUrl: media.image,
  });
};
 
// CULTURE
// title, category, description, image 
/**
 * Get the titles of all culture items.
 *
 * @category Culture
 * @returns {Array} all culture item titles
 */
AfricanAmericanData.getAllCultureItems = async function () {
  const items = await this._requestData({
    path: "/culture",
  });
  return items.map((item) => item.title);
};
 
/**
 * Search culture items by title, description, or category.
 *
 * @category Culture
 * @param {String} titleOrDescription search term
 * @returns {Array} matching culture item titles
 */
AfricanAmericanData.searchCulture = async function (titleOrDescription) {
  const items = await this._requestData({
    path: `/culture/search?q=${encode(titleOrDescription)}`,
  });
  return items.map((item) => item.title);
};
 
/**
 * Get the title of one random culture item, optionally filtered
 * by category.
 *
 * @category Culture
 * @param {String=} category optional culture category to filter by
 * @returns {String} the random item's title
 */
AfricanAmericanData.getRandomCultureItem = async function (category) {
  const path = category
    ? `/culture/random?category=${encode(category)}`
    : "/culture/random";
  const item = await this._requestData({ path });
  return item.title || "";
};
 
/**
 * Get culture item titles from a category.
 *
 * @category Culture
 * @param {String} category culture category
 * @returns {Array} matching culture item titles
 */
AfricanAmericanData.getCultureByCategory = async function (category) {
  const items = await this._requestData({
    path: `/culture/category/${encode(category)}`,
  });
  return items.map((item) => item.title);
};
 
/**
 * Get all available culture categories.
 *
 * @category Culture
 * @returns {Array} category names
 */
AfricanAmericanData.getCultureCategories = async function () {
  return this._requestData({
    path: "/culture/categories",
  });
};
 
async function lookupCultureItem(self, title) {
  return self._requestData({
    path: `/culture/lookup/${encode(title)}`,
  });
}
 
/**
 * Get the category of a culture item.
 *
 * @category Culture
 * @param {String} title the culture item's title
 * @returns {String} the item category
 */
AfricanAmericanData.getCultureCategory = async function (title) {
  const item = await lookupCultureItem(this, title);
  return item.category || "";
};
 
/**
 * Get the description of a culture item.
 *
 * @category Culture
 * @param {String} title the culture item's title
 * @returns {String} the item description
 */
AfricanAmericanData.getCultureDescription = async function (title) {
  const item = await lookupCultureItem(this, title);
  return item.description || "";
};
 
/**
 * Get the image for a culture item.
 *
 * @category Culture
 * @param {String} title the culture item's title
 * @returns {Image} the item image
 */
AfricanAmericanData.getCultureImage = async function (title) {
  const item = await lookupCultureItem(this, title);
  return this._sendImage({
    baseUrl: item.image,
  });
};
 
// COMMUNITY
// Fields:
// name, description, type, city, state, website, image
 
/**
 * Get the names of all community resources.
 *
 * @category Community
 * @returns {Array} all community resource names
 */
AfricanAmericanData.getAllCommunityResources = async function () {
  const resources = await this._requestData({
    path: "/community",
  });
  return resources.map((resource) => resource.name);
};
 
/**
 * Search community resources by name, type, city,
 * state, or description.
 *
 * @category Community
 * @param {String} nameOrDescription search term
 * @returns {Array} matching community resource names
 */
AfricanAmericanData.searchCommunity = async function (nameOrDescription) {
  const resources = await this._requestData({
    path: `/community/search?q=${encode(nameOrDescription)}`,
  });
  return resources.map((resource) => resource.name);
};
 
/**
 * Get the name of one random community resource.
 *
 * @category Community
 * @returns {String} the random resource's name
 */
AfricanAmericanData.getRandomCommunityResource = async function () {
  const resource = await this._requestData({
    path: "/community/random",
  });
  return resource.name || "";
};
 
/**
 * Get community resource names by type.
 *
 * @category Community
 * @param {String} type community resource type
 * @returns {Array} matching community resource names
 */
AfricanAmericanData.getCommunityByType = async function (type) {
  const resources = await this._requestData({
    path: `/community/type/${encode(type)}`,
  });
  return resources.map((resource) => resource.name);
};
 
/**
 * Get community resource names by state.
 *
 * @category Community
 * @param {String} state state name
 * @returns {Array} matching community resource names
 */
AfricanAmericanData.getCommunityByState = async function (state) {
  const resources = await this._requestData({
    path: `/community/state/${encode(state)}`,
  });
  return resources.map((resource) => resource.name);
};
 
/**
 * Get all available community resource types.
 *
 * @category Community
 * @returns {Array} community resource types
 */
AfricanAmericanData.getCommunityTypes = async function () {
  return this._requestData({
    path: "/community/types",
  });
};
 
/**
 * Get all represented states.
 *
 * @category Community
 * @returns {Array} state names
 */
AfricanAmericanData.getCommunityStates = async function () {
  return this._requestData({
    path: "/community/states",
  });
};

async function lookupCommunityResource(self, name) {
  return self._requestData({
    path: `/community/lookup/${encode(name)}`,
  });
}
 
/**
 * Get the description of a community resource.
 *
 * @category Community
 * @param {String} name the resource's name
 * @returns {String} the resource description
 */
AfricanAmericanData.getCommunityDescription = async function (name) {
  const resource = await lookupCommunityResource(this, name);
  return resource.description || "";
};
 
/**
 * Get the type of a community resource.
 *
 * @category Community
 * @param {String} name the resource's name
 * @returns {String} the resource type
 */
AfricanAmericanData.getCommunityType = async function (name) {
  const resource = await lookupCommunityResource(this, name);
  return resource.type || "";
};
 
/**
 * Get the city of a community resource.
 *
 * @category Community
 * @param {String} name the resource's name
 * @returns {String} the resource city
 */
AfricanAmericanData.getCommunityCity = async function (name) {
  const resource = await lookupCommunityResource(this, name);
  return resource.city || "";
};
 
/**
 * Get the state of a community resource.
 *
 * @category Community
 * @param {String} name the resource's name
 * @returns {String} the resource state
 */
AfricanAmericanData.getCommunityState = async function (name) {
  const resource = await lookupCommunityResource(this, name);
  return resource.state || "";
};
 
/**
 * Get the website of a community resource.
 *
 * @category Community
 * @param {String} name the resource's name
 * @returns {String} the resource website
 */
AfricanAmericanData.getCommunityWebsite = async function (name) {
  const resource = await lookupCommunityResource(this, name);
  return resource.website || "";
};
 
/**
 * Get the image for a community resource.
 *
 * @category Community
 * @param {String} name the resource's name
 * @returns {Image} the resource image
 */
AfricanAmericanData.getCommunityImage = async function (name) {
  const resource = await lookupCommunityResource(this, name);
  return this._sendImage({
    baseUrl: resource.image,
  });
};
 
module.exports = AfricanAmericanData;