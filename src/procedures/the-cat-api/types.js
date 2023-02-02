const types = require("../../input-types");

const CAT_BREEDS = {
  Abyssinian: "abys",
  Aegean: "aege",
  AmericanBobtail: "abob",
  AmericanCurl: "acur",
  AmericanShorthair: "asho",
  AmericanWirehair: "awir",
  ArabianMau: "amau",
  AustralianMist: "amis",
  Balinese: "bali",
  Bambino: "bamb",
  Bengal: "beng",
  Birman: "birm",
  Bombay: "bomb",
  BritishLonghair: "bslo",
  BritishShorthair: "bsho",
  Burmese: "bure",
  Burmilla: "buri",
  CaliforniaSpangled: "cspa",
  ChantillyTiffany: "ctif",
  Chartreux: "char",
  Chausie: "chau",
  Cheetoh: "chee",
  ColorpointShorthair: "csho",
  CornishRex: "crex",
  Cymric: "cymr",
  Cyprus: "cypr",
  DevonRex: "drex",
  Donskoy: "dons",
  DragonLi: "lihu",
  EgyptianMau: "emau",
  EuropeanBurmese: "ebur",
  ExoticShorthair: "esho",
  HavanaBrown: "hbro",
  Himalayan: "hima",
  JapaneseBobtail: "jbob",
  Javanese: "java",
  KhaoManee: "khao",
  Korat: "kora",
  Kurilian: "kuri",
  LaPerm: "lape",
  MaineCoon: "mcoo",
  Malayan: "mala",
  Manx: "manx",
  Munchkin: "munc",
  Nebelung: "nebe",
  NorwegianForestCat: "norw",
  Ocicat: "ocic",
  Oriental: "orie",
  Persian: "pers",
  Pixiebob: "pixi",
  Ragamuffin: "raga",
  Ragdoll: "ragd",
  RussianBlue: "rblu",
  Savannah: "sava",
  ScottishFold: "sfol",
  SelkirkRex: "srex",
  Siamese: "siam",
  Siberian: "sibe",
  Singapura: "sing",
  Snowshoe: "snow",
  Somali: "soma",
  Sphynx: "sphy",
  Tonkinese: "tonk",
  Toyger: "toyg",
  TurkishAngora: "tang",
  TurkishVan: "tvan",
  YorkChocolate: "ycho",
};

<<<<<<< HEAD

function registerTypes() {
    types.defineType({
        name: 'CatBreeds',
        description: 'List of cat breeds supported by the API',
        baseType: 'Enum',
        baseParams: CAT_BREEDS,
    });
}

module.exports = { registerTypes, CAT_BREEDS };
=======
function catTypes() {
  types.defineType({
    name: "BreedsOfCats",
    description: "List of available Cat Breeds",
    baseType: "Enum",
    baseParams: CAT_BREEDS,
  });
}

module.exports = { catTypes };
>>>>>>> 765e96475f26c1bf2e25c8e22c160a9132a6104f
