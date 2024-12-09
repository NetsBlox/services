const types = require("../../input-types");

const COMPOSERS = [
  "J.S. Bach",
  "Beethoven",
  "Mozart",
  "Haydn",
  "Debussy",
  "Traditional",
  "O. Comeau",
  "S. C. Foster",
  "C. J. Brown",
  "F. Abt",
  "E. Grieg",
  "E. Satie",
  "Spagnoletti",
  "Kruetzer",
  "Yaniewicz",
];

const STYLES = [
  "Classical",
  "Baroque",
  "Folk",
  "Gospel",
  "Hymn",
  "Modern",
  "Romantic",
  "Popular / Dance",
];

function registerTypes() {
  types.defineType({
    name: "Composers",
    description: "List of available composers",
    baseType: "Enum",
    baseParams: COMPOSERS,
  });

  types.defineType({
    name: "Styles",
    description: "List of available styles",
    baseType: "Enum",
    baseParams: STYLES,
  });
}

module.exports = { registerTypes };
