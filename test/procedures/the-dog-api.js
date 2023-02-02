const utils = require("../assets/utils");

<<<<<<< HEAD
describe(utils.suiteName(__filename), function() {
    utils.verifyRPCInterfaces('TheDogApi', [
        ['getRandomDogImage', ['dogBreed']],
        ['getDogBreeds', []],
        ['getBreedInfo', ['dogBreed']],
    ]);
=======
describe(utils.suiteName(__filename), function () {
  utils.verifyRPCInterfaces("TheDogApi", [
    ["getRandomDogImage", ["dogBreeds"]],
  ]);
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f
});
