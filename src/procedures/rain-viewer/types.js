const types = require("../../input-types");

const TIME_OFFSETS = {
  "-120min": 0,
  "-110min": 1,
  "-100min": 2,
  "-90min": 3,
  "-80min": 4,
  "-70min": 5,
  "-60min": 6,
  "-50min": 7,
  "-40min": 8,
  "-30min": 9,
  "-20min": 10,
  "-10min": 11,
  "now": 12,
};

const COLOR_SCHEMES = {
  "Universal Blue": 8,
};

function defineTypes() {
  types.defineType({
    name: "TimeOffset",
    description:
      "A time offset for a weather radar forecast from the :doc:`/services/RainViewer/index` service.",
    baseType: "Enum",
    baseParams: TIME_OFFSETS,
  });

  types.defineType({
    name: "ColorScheme",
    description:
      "A color scheme for an overlay provided by the :doc:`/services/RainViewer/index` service. For more information, check out the `Rain Viewer documentation <https://www.rainviewer.com/api/color-schemes.html>`__.",
    baseType: "Enum",
    baseParams: COLOR_SCHEMES,
  });
}

module.exports = {
  TIME_OFFSETS,
  COLOR_SCHEMES,
  defineTypes,
};
