// These are utils for server specific tasks
"use strict";

const _ = require("lodash");
var assert = require("assert"),
  Logger = require("./logger"),
  logger = new Logger("netsblox:api:utils"),
  version = require("../package.json").version;

const Filter = require("bad-words");
const profaneChecker = new Filter();

const APP = `NetsBlox ${version}, http://netsblox.org`;
const SERVER_NAME = process.env.SERVER_NAME || "netsblox";

var uuid = function (owner, name) {
  return owner + "/" + name;
};

// Helpers for routes
var serializeArray = function (content) {
  assert(content instanceof Array);
  return content.map(serialize).join(" ");
};

var serialize = function (service) {
  var pairs = _.toPairs(service);
  return encodeURI(pairs.map((list) => list.join("=")).join("&"));
};

var serializeRole = (role, project) => {
  const owner = encodeURIComponent(project.owner);
  const name = encodeURIComponent(project.name);
  const roleId = encodeURIComponent(role.ID);
  const src = role.SourceCode
    ? `<snapdata>+${
      encodeURIComponent(role.SourceCode + role.Media)
    }</snapdata>`
    : "";
  return `ProjectID=${project.getId()}&RoleID=${roleId}&RoomName=${name}&` +
    `Owner=${owner}&${serialize(_.omit(role, ["SourceCode", "Media"]))}` +
    `&SourceCode=${src}`;
};

// Function helpers
var FN_ARGS = /^(function)?\s*[^\(]*\(\s*([^\)]*)\)/m,
  FN_ARG_SPLIT = /,/,
  STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;

var getArgumentsFor = function (fn) {
  var fnText,
    args;

  if (fn.args) {
    return fn.args;
  }

  fnText = fn.toString().replace(STRIP_COMMENTS, "");
  args = fnText.match(FN_ARGS)[2].split(FN_ARG_SPLIT);
  return args
    .map((arg) => arg.replace(/\s+/g, ""))
    .filter((arg) => !!arg);
};

// given a project source code returns an array of used services as tags.
var extractRpcs = function (projectXml) {
  let services = [];
  let foundRpcs = projectXml.match(
    /getJSFromRPCStruct"><l>([a-zA-Z\-_0-9]+)<\/l>/g,
  );
  if (foundRpcs) {
    foundRpcs.forEach((txt) => {
      let match = txt.match(/getJSFromRPCStruct"><l>([a-zA-Z\-_0-9]+)<\/l>/);
      services.push(match[1]);
    });
  }
  return services;
};

var computeAspectRatioPadding = function (width, height, ratio) {
  var diff,
    left = 0,
    top = 0,
    right = 0,
    bottom = 0,
    expectedHeight = width / ratio;

  if (expectedHeight > height) { // Add padding to the height
    diff = expectedHeight - height;
    top = bottom = diff / 2;
    logger.trace(`new dims should be ${width}x${height + diff}`);
  } else { // add padding to the width
    diff = ratio * height - width;
    left = right = diff / 2;
    logger.trace(`new dims should be ${width + diff}x${height}`);
  }
  return { left, right, top, bottom };
};

var isSocketUuid = function (name) {
  return name && name[0] === "_";
};

var getEmptyRole = function (name) {
  return {
    ProjectName: name,
    SourceCode: "",
    SourceSize: 0,
    Media: "",
    MediaSize: 0,
  };
};

var parseActionId = function (src) {
  const startString = 'collabStartIndex="';
  const startIndex = src.indexOf(startString);
  const offset = startIndex + startString.length + 1;
  const endIndex = src.substring(offset).indexOf('"') + offset;
  return +src.substring(offset - 1, endIndex) || 0;
};

var parseField = function (src, field) {
  const startIndex = src.indexOf(`<${field}>`);
  const endIndex = src.indexOf(`</${field}>`);
  return src.substring(startIndex + field.length + 2, endIndex);
};

// Snap serialization functions
const SnapXml = {};
function isNil(thing) {
  return thing === undefined || thing === null;
}

SnapXml.escape = function (string, ignoreQuotes) {
  var src = isNil(string) ? "" : string.toString(),
    result = "",
    i,
    ch;
  for (i = 0; i < src.length; i += 1) {
    ch = src[i];
    switch (ch) {
      case "'":
        result += "&apos;";
        break;
      case '"':
        result += ignoreQuotes ? ch : "&quot;";
        break;
      case "<":
        result += "&lt;";
        break;
      case ">":
        result += "&gt;";
        break;
      case "&":
        result += "&amp;";
        break;
      case "\n": // escape CR b/c of export to URL feature
        result += "&#xD;";
        break;
      case "~": // escape tilde b/c it's overloaded in serializer.store()
        result += "&#126;";
        break;
      default:
        result += ch;
    }
  }
  return result;
};

SnapXml.format = function (string) {
  // private
  var i = -1,
    values = arguments,
    value;

  return string.replace(/[@$%]([\d]+)?/g, function (spec, index) {
    index = parseInt(index, 10);

    if (isNaN(index)) {
      i += 1;
      value = values[i + 1];
    } else {
      value = values[index + 1];
    }
    // original line of code - now frowned upon by JSLint:
    // value = values[(isNaN(index) ? (i += 1) : index) + 1];

    return spec === "@"
      ? SnapXml.escape(value)
      : spec === "$"
      ? SnapXml.escape(value, true)
      : value;
  });
};

const sortByDateField = function (list, field, dir) {
  dir = dir || 1;
  return list.sort((r1, r2) => {
    let [aTime, bTime] = [r1[field], r2[field]];
    let [aDate, bDate] = [new Date(aTime), new Date(bTime)];
    return aDate < bDate ? -dir : dir;
  });
};

let lastId = "";
const getNewClientId = function () {
  let suffix = Date.now();

  if (lastId.includes(suffix)) {
    let count = +lastId.split("_")[2] || 1;
    suffix += "_" + (count + 1);
  }

  const clientId = "_" + SERVER_NAME + suffix;
  lastId = clientId;
  return clientId;
};

function defer() {
  const deferred = {};
  deferred.promise = new Promise((res, rej) => {
    deferred.resolve = res;
    deferred.reject = rej;
  });
  return deferred;
}

function assertValidIdent(ident) {
  if (!ident.match(/^[a-zA-Z](?:[a-zA-Z0-9\-_ ]*[a-zA-Z0-9])?$/)) {
    let cause;
    if (!ident.length) cause = "Must not be empty string";
    else if (!ident[0].match(/[a-zA-Z]/)) cause = "Must start with a letter";
    else if (!ident[ident.length - 1].match(/[a-zA-Z0-9]/)) {
      cause = "Must end with a letter or number";
    } else cause = "Contained an invalid character";

    throw Error(`'${ident}' is not a valid identifier: ${cause}`);
  }
}
function isValidIdent(ident) {
  try {
    assertValidIdent(ident);
    return true;
  } catch {
    return false;
  }
}

function isProfane(text) {
  const normalized = text.toLowerCase();
  return profaneChecker.isProfane(normalized) ||
    profaneChecker.list.find((badWord) =>
      normalized.includes(badWord.toLowerCase())
    );
}

async function ninvoke(obj, method, ...args) {
  return new Promise((resolve, reject) => {
    const callback = (err, result) => {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    };
    args.push(callback);
    obj[method](...args);
  });
}

function filterMap(list, fn) {
  return list.reduce((keep, item) => {
    const mapped = fn(item);
    if (mapped !== undefined) {
      keep.push(mapped);
    }
    return keep;
  }, []);
}

async function filterAsync(list, fn) {
  const indices = await Promise.all(list.map(async (item, index) => {
    if (await fn(item)) {
      return index;
    } else {
      return -1;
    }
  }));
  return filterMap(indices, (idx) => list[idx]);
}

module.exports = {
  serialize,
  serializeArray,
  serializeRole,
  uuid,
  extractRpcs,
  computeAspectRatioPadding,
  isSocketUuid,
  xml: {
    thumbnail: (src) => parseField(src, "thumbnail"),
    notes: (src) => parseField(src, "notes"),
    actionId: parseActionId,
    format: SnapXml.format,
  },
  getEmptyRole,
  getArgumentsFor,
  APP,
  version,
  sortByDateField,
  getNewClientId,
  defer,
  assertValidIdent,
  isValidIdent,
  profaneChecker,
  isProfane,
  ninvoke,

  filterAsync,
  filterMap,
};
