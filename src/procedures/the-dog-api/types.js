const types = require("../../input-types");

const DOG_BREEDS = {
  Affenpinscher: 1,
  AfghanHound: 2,
  AfricanHuntingDog: 3,
  AiredaleTerrier: 4,
  AkbashDog: 5,
  Akita: 6,
  AlapahaBlueBloodBulldog: 7,
  AlaskanHusky: 8,
  AlaskanMalamute: 9,
  AmericanBulldog: 10,
  AmericanBully: 11,
  AmericanEskimoDog: 12,
  AmericanEskimoDogMiniature: 13,
  AmericanFoxhound: 14,
  AmericanPitBullTerrier: 15,
  AmericanStaffordshireTerrier: 16,
  AmericanWaterSpaniel: 17,
  AnatolianShepherdDog: 18,
  AppenzellerSennenhund: 19,
  AustralianCattleDog: 21,
  AustralianKelpie: 22,
  AustralianShepherd: 23,
  AustralianTerrier: 24,
  Azawakh: 25,
  Barbet: 26,
  Basenji: 28,
  BassetBleudeGascogne: 29,
  BassetHound: 30,
  Beagle: 31,
  BeardedCollie: 32,
  Beauceron: 33,
  BedlingtonTerrier: 34,
  BelgianMalinois: 36,
  BelgianTervuren: 38,
  BerneseMountainDog: 41,
  BichonFrise: 42,
  BlackandTanCoonhound: 43,
  Bloodhound: 45,
  BluetickCoonhound: 47,
  Boerboel: 48,
  BorderCollie: 50,
  BorderTerrier: 51,
  BostonTerrier: 53,
  BouvierdesFlandres: 54,
  Boxer: 55,
  BoykinSpaniel: 56,
  BraccoItaliano: 57,
  Briard: 58,
  Brittany: 59,
  BullTerrier: 61,
  BullTerrierMiniature: 62,
  Bullmastiff: 64,
  CairnTerrier: 65,
  CaneCorso: 67,
  CardiganWelshCorgi: 68,
  CatahoulaLeopardDog: 69,
  CaucasianShepherdOvcharka: 70,
  CavalierKingCharlesSpaniel: 71,
  ChesapeakeBayRetriever: 76,
  ChineseCrested: 78,
  ChineseSharPei: 79,
  Chinook: 80,
  ChowChow: 81,
  ClumberSpaniel: 84,
  CockerSpaniel: 86,
  CockerSpanielAmerican: 87,
  CotondeTulear: 89,
  Dalmatian: 92,
  DobermanPinscher: 94,
  DogoArgentino: 95,
  DutchShepherd: 98,
  EnglishSetter: 101,
  EnglishShepherd: 102,
  EnglishSpringerSpaniel: 103,
  EnglishToySpaniel: 104,
  EnglishToyTerrier: 105,
  Eurasier: 107,
  FieldSpaniel: 108,
  FinnishLapphund: 110,
  FinnishSpitz: 111,
  FrenchBulldog: 113,
  GermanPinscher: 114,
  GermanShepherdDog: 115,
  GermanShorthairedPointer: 116,
  GiantSchnauzer: 119,
  GlenofImaalTerrier: 120,
  GoldenRetriever: 121,
  GordonSetter: 123,
  GreatDane: 124,
  GreatPyrenees: 125,
  Greyhound: 127,
  GriffonBruxellois: 128,
  Harrier: 129,
  Havanese: 130,
  IrishSetter: 134,
  IrishTerrier: 135,
  IrishWolfhound: 137,
  ItalianGreyhound: 138,
  JapaneseChin: 140,
  JapaneseSpitz: 141,
  Keeshond: 142,
  Komondor: 144,
  Kooikerhondje: 145,
  Kuvasz: 147,
  LabradorRetriever: 149,
  LagottoRomagnolo: 151,
  LancashireHeeler: 153,
  Leonberger: 155,
  LhasaApso: 156,
  Maltese: 161,
  MiniatureAmericanShepherd: 165,
  MiniaturePinscher: 167,
  MiniatureSchnauzer: 168,
  Newfoundland: 171,
  NorfolkTerrier: 172,
  NorwichTerrier: 176,
  NovaScotiaDuckTollingRetriever: 177,
  OldEnglishSheepdog: 178,
  OldeEnglishBulldogge: 179,
  Papillon: 181,
  Pekingese: 183,
  PembrokeWelshCorgi: 184,
  PerrodePresaCanario: 185,
  PharaohHound: 188,
  Plott: 189,
  Pomeranian: 193,
  PoodleMiniature: 196,
  PoodleToy: 197,
  Pug: 201,
  Puli: 204,
  Pumi: 205,
  RatTerrier: 207,
  RedboneCoonhound: 208,
  RhodesianRidgeback: 209,
  Rottweiler: 210,
  RussianToy: 211,
  SaintBernard: 212,
  Saluki: 213,
  Samoyed: 214,
  Schipperke: 216,
  ScottishDeerhound: 218,
  ScottishTerrier: 219,
  ShetlandSheepdog: 221,
  ShibaInu: 222,
  ShihTzu: 223,
  ShilohShepherd: 225,
  SiberianHusky: 226,
  SilkyTerrier: 228,
  SmoothFoxTerrier: 232,
  SoftCoatedWheatenTerrier: 233,
  SpanishWaterDog: 235,
  SpinoneItaliano: 236,
  StaffordshireBullTerrier: 238,
  StandardSchnauzer: 239,
  SwedishVallhund: 242,
  ThaiRidgeback: 243,
  TibetanMastiff: 244,
  TibetanSpaniel: 245,
  TibetanTerrier: 246,
  ToyFoxTerrier: 248,
  TreeingWalkerCoonhound: 250,
  Vizsla: 251,
  Weimaraner: 253,
  WelshSpringerSpaniel: 254,
  WestHighlandWhiteTerrier: 256,
  Whippet: 257,
  WhiteShepherd: 258,
  WireFoxTerrier: 259,
  WirehairedPointingGriffon: 260,
  WirehairedVizsla: 261,
  Xoloitzcuintli: 262,
  YorkshireTerrier: 264,
};

function dogTypes() {
  types.defineType({
    name: "BreedsOfDogs",
    description: "List of available Dog Breeds",
    baseType: "Enum",
    baseParams: DOG_BREEDS,
  });
}

module.exports = { dogTypes };
