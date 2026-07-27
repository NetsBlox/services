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
 
