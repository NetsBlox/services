/* eslint-disable no-console */
"use strict";

const _ = require("lodash");
const fsp = require("fs").promises;
const fse = require("fs-extra");
const path = require("path");
const { exec } = require("child_process");
const Logger = require("../src/logger");
const ServicesWorker = require("../src/services-worker");
const Storage = require("../src/storage/connection");
const ServiceStorage = require("../src/storage");
const axios = require("axios");
const config = require("../src/config");

main().catch((err) => console.error(err));

async function main() {
  const db = await Storage.connect();
  ServiceStorage.init(new Logger("services"), db);
  await build();
}

let INPUT_TYPES = undefined;
async function build() {
  const services = new ServicesWorker(new Logger("netsblox:build-docs"));
  await services.load(); // needed for docs
  INPUT_TYPES = await getLoadedTypes(); // needed for other functions
  await compileDocs(services);
}

async function hasDirectory(dir, subdir) {
  return (await fsp.readdir(dir)).includes(subdir) &&
    (await fsp.lstat(path.join(dir, subdir))).isDirectory();
}

function isObject(type) {
  return type && type.name && type.name.toLowerCase() === "object";
}
function linkType(dispName) {
  return `\`${dispName} </docs/fundamentals/rpc-arg-types.html#${dispName}>\`__`;
}
function getTypeString(type, link = false) {
  if (link === true) {
    const links = [];
    getTypeString(type, links);
    return links.join(" | ");
  }

  if (type.name === undefined) {
    const rawName = type.toString();
    const ty = INPUT_TYPES[rawName];
    if (link && ty) {
      const res = linkType(ty.displayName || rawName);
      if (!link.includes(res)) link.push(res);
    }
    return rawName;
  }

  const params = type.params || [];
  const name = (INPUT_TYPES[type.name] || {}).displayName || type.name;

  if (link) {
    if (INPUT_TYPES[type.name]) {
      const res = linkType(name);
      if (!link.includes(res)) link.push(res);
    }
    for (const sub of params) getTypeString(sub, link);
  } else {
    if (isObject(type)) return "Object";
    return params.length
      ? `${name}<${params.map((x) => getTypeString(x)).join(", ")}>`
      : name;
  }
}
function getParamString(param, link = false) {
  if (link) return param.type ? getTypeString(param.type, true) : "";

  const str = param.type
    ? `${param.name}: ${getTypeString(param.type)}`
    : param.name;
  return param.optional ? `${str}?` : str;
}

async function loadSubservice(path) {
  try {
    const root = config.ServerURL;
    return await axios.get(`${root}${path}`);
  } catch (err) {
    if (err.code === "ECONNREFUSED") {
      const msg = process.env.SERVER_URL
        ? `Unable to connect to ${process.env.SERVER_URL}. Is this the correct address?`
        : "Unable to connect to services server. Please set the SERVER_URL environment variable and retry.";
      throw new Error(msg);
    } else if (config.ServerURL) {
      const msg =
        `${config.ServerURL} is not a valid address for NetsBlox services. ` +
        "It should be set to the services server such as https://services.netsblox.org";

      throw new Error(msg);
    }
    throw err;
  }
}
async function getLoadedTypes() {
  const res = await loadSubservice("/input-types");
  return res.data;
}
async function getLoadedServices() {
  const res = await loadSubservice("/");
  return res.data.map((s) => s.name);
}

const SERVICE_FILTERS = {
  all: () => true,
  nodeprecated: (name, meta) => !meta.tags.includes("deprecated"),
  fsonly: (name, meta) => meta.servicePath,
};
function getServiceFilter(
  loadedServices,
  filterString = "fsonly,nodeprecated",
) {
  const isServiceLoaded = (name) => loadedServices.includes(name);
  const filters = filterString.split(",").map((s) => s.trim()).filter((s) =>
    s.length
  ).map((s) => SERVICE_FILTERS[s]);
  filters.unshift(isServiceLoaded);
  return (name, meta) => filters.every((f) => f(name, meta));
}

const SERVICE_DIR_REGEX = /(.*)\/.*\.js/;
const DOCS_PATH = path.join(__dirname, "..", "docs");
const GENERATED_PATH = path.join(DOCS_PATH, "_generated");
const SERVICES_PATH = path.join(GENERATED_PATH, "services");

function getCategories(obj) {
  const cats = obj.categories;
  if (!cats || !cats.length) return ["index"];
  for (let i = 0; i < cats.length; ++i) {
    if (cats[i].length === 0) cats[i] = "index";
  }
  return cats;
}
function updateCategories(categories, name, obj) {
  for (const category of getCategories(obj)) {
    const cat = categories[category];
    if (cat) cat.items.push(name);
    else categories[category] = { description: undefined, items: [name] };
  }
}
function sortCategories(categories) {
  for (const category in categories) {
    categories[category].items.sort();
  }
}

function trimText(str) {
  str = (str || "").trim();
  return str.length ? str : undefined;
}

function getRPCsMeta(service) {
  const categories = { index: { description: undefined, items: [] } };
  const rpcs = {};

  for (const rpcName in service.rpcs) {
    const rpc = service.rpcs[rpcName];
    if (rpc.deprecated) continue;

    updateCategories(categories, rpcName, rpc);
    rpcs[rpcName] = {
      description: trimText(rpc.rawDescription),
      args: (rpc.args || []).map((arg) => {
        return {
          decl: getParamString(arg, false),
          declLink: getParamString(arg, true),
          description: trimText(arg.rawDescription),
          fields: !isObject(arg.type) || !(arg.type.params || []).length
            ? undefined
            : arg.type.params
              .filter((f) => !f.tags.includes("deprecated")).map((field) => {
                return {
                  decl: getParamString(field, false),
                  declLink: getParamString(field, true),
                  description: trimText(field.rawDescription),
                };
              }),
        };
      }),
      returns: rpc.returns
        ? {
          type: getTypeString(rpc.returns.type, false),
          typeLink: getTypeString(rpc.returns.type, true),
          description: trimText(rpc.returns.rawDescription),
        }
        : undefined,
    };
  }
  sortCategories(categories);

  return { categories, rpcs };
}
function getMeta(services, serviceFilter) {
  const categories = { index: { description: undefined, items: [] } };
  const servicesMeta = {};
  const apiKeys = {};

  for (const serviceName in services.metadata) {
    const service = services.metadata[serviceName];
    if (!serviceFilter(serviceName, service)) continue;

    updateCategories(categories, serviceName, service);
    servicesMeta[serviceName] = {
      path: service.servicePath,
      description: trimText(service.rawDescription),
      rpcs: getRPCsMeta(service),
    };
    apiKeys[serviceName] = service.apiKey;
  }
  sortCategories(categories);

  return {
    description: undefined,
    categories,
    services: servicesMeta,
    apiKeys,
  };
}

async function loadCategoryContent(rootPath, categoryName, isServiceCategory) {
  if ((await fsp.readdir(rootPath)).includes(`${categoryName}.rst`)) {
    return await fsp.readFile(path.join(rootPath, `${categoryName}.rst`), {
      encoding: "utf8",
    });
  }
  const content = `<%= name %><%= description %><%= ${
    isServiceCategory ? "services" : "rpcs"
  } %>`;
  await fsp.writeFile(path.join(rootPath, `${categoryName}.rst`), content);
  return content;
}

async function copyServiceDocs(serviceName, service) {
  const indexContent =
    "<%= name %><%= description %><%= categories %><%= rpcs %>";
  const dest = path.join(SERVICES_PATH, serviceName);

  let needsDir = true;
  if (service.path) {
    const serviceDir = service.path.match(SERVICE_DIR_REGEX)[1];
    if (await hasDirectory(serviceDir, "docs")) {
      const src = path.join(serviceDir, "docs");
      const [files] = await Promise.all([
        fsp.readdir(src),
        fse.copy(src, dest),
      ]);
      needsDir = false;
      if (files.includes("index.rst")) return;
    }
  }

  if (needsDir) await fsp.mkdir(dest);
  await fsp.writeFile(path.join(dest, "index.rst"), indexContent);
}

function buildRPCString(serviceName, rpcName, rpc) {
  let str = `.. function:: ${serviceName}.${rpcName}(${
    rpc.args.map((x) => x.decl).join(", ")
  })\n\n`;

  if (rpc.description) {
    str += `${
      rpc.description.split("\n").map((s) => `    ${s}`).join("\n")
    }\n\n`;
  }

  if (rpc.args.length) {
    str += "    **Arguments:**\n\n";
    for (const arg of rpc.args) {
      const desc = arg.description ? `- ${arg.description}` : "";
      str += `    - \`\`${arg.decl}\`\` (${arg.declLink}) ${desc}\n`;
      if (!arg.fields) continue;

      str += "\n";
      for (const field of arg.fields) {
        const desc = field.description ? `- ${field.description}` : "";
        str += `        - \`\`${field.decl}\`\` (${field.declLink}) ${desc}\n`;
      }
      str += "\n";
    }
    str += "\n";
  }

  if (rpc.returns) {
    const desc = rpc.returns.description ? `- ${rpc.returns.description}` : "";
    str +=
      `    **Returns:** \`\`${rpc.returns.type}\`\` (${rpc.returns.typeLink}) ${desc}\n\n`;
  }

  return str;
}

const RESOLVE_FILE_REGEX = /\.rst$/;
async function recursiveResolveCopy(from, to, vars) {
  const info = await fsp.lstat(from);
  if (info.isDirectory()) {
    await fsp.mkdir(to);
    const files = await fsp.readdir(from);
    return await Promise.all(files.map((file) => {
      return recursiveResolveCopy(
        path.join(from, file),
        path.join(to, file),
        vars,
      );
    }));
  }
  if (!from.match(RESOLVE_FILE_REGEX)) {
    return await fsp.copyFile(from, to);
  }

  const content = _.template(await fsp.readFile(from, { encoding: "utf-8" }))(
    vars,
  );
  await fsp.writeFile(to, content);
}
async function cleanRoot() {
  const docsFiles = new Set(await fsp.readdir(DOCS_PATH));
  if (docsFiles.has("_generated")) {
    await fsp.rm(GENERATED_PATH, { recursive: true });
    docsFiles.delete("_generated");
  }
  await fsp.mkdir(GENERATED_PATH);
  await fsp.mkdir(SERVICES_PATH);

  return docsFiles;
}
async function compileDocs(services) {
  const rootDocs = await cleanRoot();

  const loadedServices = await getLoadedServices();
  const serviceFilter = getServiceFilter(
    loadedServices,
    process.env.DOCS_SERVICE_FILTER,
  );
  const meta = getMeta(services, serviceFilter);
  const servicesString =
    "\n\n.. toctree::\n    :maxdepth: 2\n    :titlesonly:\n    :caption: Services\n\n    " +
    (Object.keys(meta.categories).concat(meta.categories.index.items)).filter(
      (s) => s !== "index",
    ).sort().map((item) => {
      const isCategory = !!meta.categories[item];
      return isCategory ? `services/${item}.rst` : `services/${item}/index.rst`;
    }).join("\n    ") + "\n\n";

  for (const serviceName in meta.services) {
    const service = meta.services[serviceName];
    await copyServiceDocs(serviceName, service);

    const categories = Object.keys(service.rpcs.categories).sort();
    const catsString =
      "\n\n.. toctree::\n    :maxdepth: 2\n    :titlesonly:\n    :caption: RPC Categories\n\n" +
      categories.filter((s) => s !== "index").map((s) => `    ${s}.rst\n`).join(
        "",
      ) + "\n\n";
    for (const categoryName of categories) {
      const category = service.rpcs.categories[categoryName];
      const rpcsPieces = category.items.map((s) =>
        buildRPCString(serviceName, s, service.rpcs.rpcs[s])
      );
      const rpcsString = rpcsPieces.length
        ? "\n\nRPCS\n----\n\n" + rpcsPieces.join("\n") + "\n\n"
        : "\n\n";
      const name = categoryName === "index" ? serviceName : categoryName;

      let content = _.template(
        await loadCategoryContent(
          path.join(SERVICES_PATH, serviceName),
          categoryName,
          false,
        ),
      )({
        name: `\n\n${name}\n${"=".repeat(name.length)}\n\n`,
        description: `\n\n${
          (categoryName === "index" ? service : category).description || ""
        }\n\n`,
        categories: catsString,
        rpcs: rpcsString,
      });
      await fsp.writeFile(
        path.join(SERVICES_PATH, serviceName, `${categoryName}.rst`),
        content,
      );
    }
  }

  for (const categoryName in meta.categories) {
    if (categoryName === "index") continue;

    const category = meta.categories[categoryName];
    const servString =
      "\n\n.. toctree::\n    :maxdepth: 2\n    :titlesonly:\n    :caption: Services\n\n" +
      category.items.map((s) => `    ${s}/index.rst\n`).join("") + "\n\n";

    let content = _.template(
      await loadCategoryContent(SERVICES_PATH, categoryName, true),
    )({
      name: `\n\n${categoryName}\n${"=".repeat(categoryName.length)}\n\n`,
      description: `\n\n${category.description || ""}\n\n`,
      services: servString,
    });
    await fsp.writeFile(
      path.join(SERVICES_PATH, `${categoryName}.rst`),
      content,
    );
  }

  const resolveVars = {
    services: servicesString,
    apiKeys: meta.apiKeys,
    inputTypes: INPUT_TYPES,
  };
  await Promise.all(
    Array.from(rootDocs).map((file) => {
      return recursiveResolveCopy(
        path.join(DOCS_PATH, file),
        path.join(GENERATED_PATH, file),
        resolveVars,
      );
    }),
  );

  // the reason for not using promisify is so that we still get the stderr/stdout on failure so user can see what the issue was
  await new Promise((resolve, reject) => {
    exec(
      "make clean && make html",
      { cwd: GENERATED_PATH },
      async (error, stdout, stderr) => {
        const { ignored, important } = splitErrors(stderr);
        if (error || important.length) {
          reject(
            Error(
              `failed to compile docs:\nerror: ${
                error ? error : ""
              }\n\nimportant:\n${important}\n\nignored:\n${ignored}\n\nstdout:\n${stdout}`,
            ),
          );
        } else if (!await hasDirectory(GENERATED_PATH, "_build")) {
          reject(Error(`failed to find docs build directory`));
        } else if (
          !await hasDirectory(path.join(GENERATED_PATH, "_build"), "html")
        ) {
          reject(Error(`failed to find html in docs build directory`));
        } else {
          console.log(`compiled docs:`, stdout);
          resolve();
        }
      },
    );
  });
}

const IGNORED_WARNINGS = [
  "WARNING: duplicate function description",
];
function splitErrors(str) {
  const isIgnored = (e) => IGNORED_WARNINGS.some((p) => e.includes(p));
  const errors = str.split("\n").map((s) => s.trim()).filter((s) => s.length);
  const [ignored, important] = _.partition(errors, isIgnored);
  return { ignored: ignored.join("\n"), important: important.join("\n") };
}

/* eslint-enable no-console */
