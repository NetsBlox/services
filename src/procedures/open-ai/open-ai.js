/**
 * Access OpenAI's ChatGPT services for text and image generation!
 * Note that you must be logged in to use this service, and you must provide this service with a valid OpenAI API key to use (for your account only!).
 * Do not share your OpenAI API key with anyone else!
 *
 * @service
 * @category ArtificialIntelligence
 * @category Media
 * @alpha
 */

const NBService = require("../utils/service");
const types = require("../../input-types");
const Storage = require("../../storage");
const axios = require("axios");

const OpenAI = new NBService("OpenAI");

types.defineType({
    name: "Role",
    description: "A role used by OpenAI's ChatGPT",
    baseType: "Enum",
    baseParams: ["system", "user", "assistant"],
});
types.defineType({
    name: "Resolution",
    description: "An image resolution for use by OpenAI's image generators",
    baseType: "Enum",
    baseParams: ["256x256", "512x512", "1024x1024"],
});

_usersDB = null;
function getUsersDB() {
  if (!_usersDB) {
    _usersDB = Storage.createCollection("open-ai-users");
  }
  return _usersDB;
}

class User {
    constructor(username, key, textModel, imageModel) {
        this.username = username;
        this.key = key;
        this.textModel = textModel;
        this.imageModel = imageModel;
    }
    async save() {
        await getUsersDB().updateOne({ username: this.username }, { $set: this }, { upsert: true });
    }
}

async function getUser(caller) {
    const username = caller?.username;
    if (!username) throw Error("You must be logged in to use this feature");

    const info = await getUsersDB().findOne({ username });
    const key = info?.key || null;
    const textModel = info?.textModel || "gpt-3.5-turbo";
    const imageModel = info?.imageModel || "dall-e-2"
    return new User(username, key, textModel, imageModel);
}

function parsePrompt(prompt) {
    if (typeof(prompt) === "string") {
        return [{ role: "system", content: prompt }];
    }
    if (typeof(prompt[0]) === "string") {
        return prompt.map(content => ({ role: "user", content }));
    }
    return prompt.map(x => ({ role: x[0], content: x[1] }));
}

function prettyError(e) {
    if (e?.response?.statusText === 'Unauthorized') {
        return Error('Unauthorized request. Your API key may be invalid.');
    }
    return e;
}

/**
 * Sets the OpenAI API key for the currently logged in account.
 * 
 * Ideally, you should only run this command once per account
 * from a throw-away project to avoid leaking your API key to other users.
 * 
 * @param {String} key The new OpenAI API key to use for this account
 */
OpenAI.setKey = async function (key) {
    const user = await getUser(this.caller);
    user.key = key;
    await user.save();
};

/**
 * Generate text given a prompt.
 * The prompt can take any of the following forms:
 * 
 * - A single piece of text.
 * - A list of multiple pieces of text representing a back-and-forth dialog.
 * - A list of pairs representing a dialog. The second value of each pair is the dialog spoken,
 *   and the first value is the role of the speaker ("system", "user", or "assistant").
 *   User represents the human using the tool, assistant represents ChatGPT itself,
 *   and System is a special role you can use to give instructions for ChatGPT to follow.
 *
 * Note that this service does not maintain a chat history with ChatGPT.
 * Because of this, if you would like to have a continued dialog rather than one-off completions,
 * you must keep track of the dialog yourself in a list and provide the full dialog list to this service.
 * 
 * @param {Union<String, Array<String>, Array<Tuple<Role, String>>>} prompt The prompt to provide to ChatGPT for completion.
 * @returns {String} The generated text
 */
OpenAI.generateText = async function (prompt) {
    const user = await getUser(this.caller);
    if (!user.key) throw Error("an OpenAI API key has not been set for this account");

    let resp;
    try {
        resp = await axios.post("https://api.openai.com/v1/chat/completions",
            { model: user.textModel, messages: parsePrompt(prompt) },
            { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.key}` } },
        );
    } catch (e) {
        throw prettyError(e);
    }

    return resp.data.choices[0].message.content;
};

/**
 * Generates an image given a prompt.
 * 
 * @param {String} prompt The prompt to provide to ChatGPT for completion.
 * @param {Resolution=} size The resolution of the generated image. Note that larger images are more expensive to generate.
 * @returns {Image} The generated image
 */
OpenAI.generateImage = async function (prompt, size = "256x256") {
    const user = await getUser(this.caller);
    if (!user.key) throw Error("an OpeAI API key has not been set for this account");

    let resp;
    try {
        resp = await axios.post("https://api.openai.com/v1/images/generations",
            { model: user.imageModel, prompt, n: 1, size },
            { headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.key}` } },
        );
    } catch (e) {
        throw prettyError(e);
    }

    const img = (await axios.get(resp.data.data[0].url, { responseType: 'arraybuffer' })).data;

    const rsp = this.response;
    rsp.set("content-type", "image/png");
    rsp.set("content-length", img.length);
    rsp.set("connection", "close");
    return rsp.status(200).send(img);
};

module.exports = OpenAI;
