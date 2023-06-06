/**
 * Uses an API to get Chuck Norris jokes.
 * @alpha
 * @service
 * @category Media
 */

const { ChuckNorrisApiKey } = require("../utils/api-key");
const ApiConsumer = require("../utils/api-consumer");

// API url
const ChuckNorrisApiUrl = "https://musicbrainz.org/ws/2/";

const ChuckNorrisApi = new ApiConsumer("ChuckNorrisApi",ChuckNorrisApiUrl, {
    cache: { ttl: 1},
});


/**
 * Gets a random Chuck Norris joke.
 * @return {Text} a string.
 */
ChuckNorrisApi.getRandomJoke = async function () {
    // Requesting JSON from api
    const json = await this._requestData({
        baseUrl: "https://api.chucknorris.io/jokes/random",
    });

    return json["value"];
};

module.exports = ChuckNorrisApi;