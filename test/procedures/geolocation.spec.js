const utils = require("../assets/utils");

describe(utils.suiteName(__filename), function () {
  const assert = require("assert").strict;
  var Geocoding = utils.reqSrc("procedures/geolocation/geolocation"),
    RPCMock = require("../assets/mock-service"),
    geocoding;

  before(async () => {
    testSuite = await utils.TestSuiteBuilder().setup();
  });
  after(() => {
    testSuite.takedown();
  });
  beforeEach(() => geocoding = new RPCMock(Geocoding));
  afterEach(() => geocoding.destroy());
  utils.verifyRPCInterfaces("Geolocation", [
    ["nearbySearch", ["latitude", "longitude", "keyword", "radius"]],
    ["city", ["latitude", "longitude"]],
    ["country", ["latitude", "longitude"]],
    ["countryCode", ["latitude", "longitude"]],
    ["state*", ["latitude", "longitude"]],
    ["stateCode*", ["latitude", "longitude"]],
    ["county*", ["latitude", "longitude"]],
    ["info", ["latitude", "longitude"]],
    ["geolocate", ["address"]],
    ["timezone", ["address"]],
    ["streetAddress", ["address"]],
  ]);

  describe("geolocate", function () {
    it("should use proper key for caching", async () => {
      geocoding._service._rawGeolocate = () => 123;
      await geocoding.geolocate("Moscow, Russia");
      let called = false;
      geocoding._service._rawGeolocate = () => called = true;

      await geocoding.geolocate(
        "1025 16th Ave S, Nashville, TN 37212",
      );
      assert(called);
    });
  });

  describe("nearbySearch", function () {
    let defaultApiKey;
    before(() => defaultApiKey = geocoding.unwrap().apiKey);
    after(() => geocoding.unwrap().apiKey = defaultApiKey);

    it("should throw error if API key is invalid", async function () {
      geocoding.apiKey = geocoding.unwrap().apiKey.withValue("invalidKey");
      await assert.rejects(
        () => geocoding.nearbySearch(36, -87, "pizza"),
        /The provided API key is invalid/,
      );
    });
  });
});
