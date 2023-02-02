const utils = require("../assets/utils");

<<<<<<< HEAD
describe(utils.suiteName(__filename), function() {
    utils.verifyRPCInterfaces('TheCatApi', [
        ['getRandomCatImage', ['catBreed']],
        ['getCatBreeds', []],
        ['getBreedInfo', ['catBreed']],
    ]);
=======
describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("TheCatApi", [
    ["getRandomCatImage", ["catBreeds"]],
  ]);
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f
});
