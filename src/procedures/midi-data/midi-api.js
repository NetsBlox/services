const MIDI_NOTE_ON = 0x9;
const MIDI_NOTE_OFF = 0x8;
const TRACK_NAME_EVENT = 0x03;
const INT_TO_HEX = {
  0: "0",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "A",
  11: "B",
  12: "C",
  13: "D",
  14: "E",
  15: "F",
};
const HEX_TO_INT = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "A": 10,
  "B": 11,
  "C": 12,
  "D": 13,
  "E": 14,
  "F": 15,
};
const NOTE_DURATION_LENGTHS = [
  0.125,
  0.1875,
  0.21875,
  0.25,
  0.375,
  0.4375,
  0.5,
  0.75,
  0.875,
  1,
  1.5,
  1.75,
  2,
  3,
  3.5,
  4,
  6,
  7,
];
const NOTE_DURATION_NAMES = [
  "ThirtySecond",
  "DottedThirtySecond",
  "DoubleDottedThirtySecond",
  "Sixteenth",
  "DottedSixteenth",
  "DoubleDottedSixteenth",
  "Eighth",
  "DottedEighth",
  "DoubleDottedEighth",
  "Quarter",
  "DottedQuarter",
  "DoubleDottedQuarter",
  "Half",
  "DottedHalf",
  "DoubleDottedHalf",
  "Whole",
  "DottedWhole",
  "DoubleDottedWhole",
];

function Note(value, duration) {
  this.value = value;
  this.duration = duration;
}

class MidiReader {
  #syntaxtree;

  constructor(arraybuffer) {
    if (!(arraybuffer instanceof ArrayBuffer)) {
      throw (new Error("MidiReader must read array buffer"));
    }
    this.#syntaxtree = new SyntaxTree(arraybuffer);
  }

  getNotes() {
    const notes = this.#syntaxtree.getNotes();
    let container = [];
    for (let i = 0; i < notes.length; i++) {
      let track = [notes[i].name];
      let _notes = [];
      for (let j = 0; j < notes[i].notes.length; j++) {
        _notes.push([notes[i].notes[j].value, notes[i].notes[j].duration]);
      }
      track.push(_notes);
      container.push(track);
    }
    return container;
  }
}

class SyntaxTree {
  #root;

  /**
   * @description creates a syntax tree representation of the given midi file.
   * @param {ArrayBuffer} arraybuffer - the given midi file
   */
  constructor(arraybuffer) {
    this.#root = TreeNodeFactory.SmfNodeFactory(arraybuffer);
  }

  /**
   * @description returns all the notes in a midi file
   * @returns {[Object{name: String, notes: [Note]}]}
   */
  getNotes() {
    const headerChunk = this.#root.lookup(HeaderChunkNode)[0];
    const division = headerChunk.division.toInt();
    if (division < 0) {
      throw (new Error("division type not yet supported"));
    }
    const trackChunks = this.#root.lookup(TrackChunkNode);
    let notes = [];
    for (let i = 0; i < trackChunks.length; i++) {
      notes.push({
        name: trackChunks[i].getName(),
        notes: trackChunks[i].getNotes(division),
      });
    }
    return notes;
  }
}

class TreeNode {
  nodes;

  /**
   * @constructor
   * @param {[Object]} nodes - the child nodes of this node.
   */
  constructor(nodes) {
    if (nodes.length == 0) {
      this.nodes = null;
    } else {
      this.nodes = [];
      for (let i = 0; i < nodes.length; i++) {
        this.add(nodes[i]);
      }
    }
  }

  /**
   * @description adds a child node to the current node.
   * @param {Object} node - the node being added.
   */
  add(node) {
    if (node instanceof Array) {
      this.nodes = this.nodes.concat(node);
    } else {
      this.nodes.push(node);
    }
  }

  /**
   * @description finds all instances in the tree of a specific subclass.
   * @param {Object} targetInstance
   * @returns {[Object]}
   */
  lookup(targetInstance) {
    let tmp = [];
    if (this instanceof targetInstance) {
      tmp.push(this);
    }
    for (let i = 0; i < this.nodes.length; i++) {
      tmp = tmp.concat(this.nodes[i].lookup(targetInstance));
    }
    return tmp;
  }
}

class LeafNode extends TreeNode {
  #arraybuffer;

  constructor(arraybuffer) {
    super([]);
    this.#arraybuffer = arraybuffer;
  }

  addNode(node) {
    return;
  }

  lookup(targetInstance) {
    return [];
  }

  getBuffer() {
    return this.#arraybuffer;
  }

  toInt() {
    if (this.#arraybuffer.byteLength == 1) {
      return (new Uint8Array(this.#arraybuffer))[0];
    }
    return bytesToInt(new Uint8Array(this.#arraybuffer));
  }

  toVariableLengthInt() {
    if (this.#arraybuffer.byteLength == 1) {
      return (new Uint8Array(this.#arraybuffer))[0];
    }
    return variableLengthBytesToInt(new Uint8Array(this.#arraybuffer));
  }

  getByteLength() {
    return this.#arraybuffer.byteLength;
  }
}

class SmfNode extends TreeNode {
  /**
   * @constructor
   * @param {HeaderChunkNode} headerChunk
   * @param {[TrackChunkNode]} trackChunk
   */
  constructor(headerChunk, trackChunk) {
    super(arguments);
  }
}

class HeaderChunkNode extends TreeNode {
  division;

  /**
   * @constructor
   * @param {LeafNode} mthd - the literal string MThd
   * @param {LeafNode} length - length of the header chunk
   * @param {LeafNode} format - track format
   * @param {LeafNode} n - number of tracks that follow
   * @param {LeafNode} division - unit of time for delta timing
   */
  constructor(mthd, length, format, n, division) {
    super(arguments);
    this.division = division;
  }
}

class TrackChunkNode extends TreeNode {
  /**
   * @constructor
   * @param {LeafNode} mtrk - the literal string MTrk
   * @param {LeafNode} length - the number of bytes in the track chunk following this number
   * @param {[TrackEventNode]} trackEvent - a sequenced track event
   */
  constructor(mtrk, length, trackEvent) {
    super(arguments);
  }

  /**
   * @description gets the name of this midi track
   * @returns {String} if found
   * @returns {null} if not found
   */
  getName() {
    const metaEvents = this.lookup(MetaEventNode);
    for (let i = 0; i < metaEvents.length; i++) {
      if (metaEvents[i].getType() === TRACK_NAME_EVENT) {
        return metaEvents[i].getDataAsString();
      }
    }
    return null;
  }

  /**
   * @description gets all the notes in the notes they are played in a track.
   * @param {Number} division - the number of ticks per quarter note
   * @returns {[Note]}
   */
  getNotes(division) {
    const commands = this.#getMidiCommands().sort((x, y) => x.time - y.time);
    let notesRecord = {};
    let notes = [];
    for (let i = 0; i < commands.length; i++) {
      if (notesRecord[commands[i].note] === undefined) {
        notesRecord[commands[i].note] = commands[i].time;
      } else {
        const durInt = (commands[i].time - notesRecord[commands[i].note]) /
          division;
        const duration = durationFromInt(durInt);
        notes.push(new Note(commands[i].note, duration));
        notesRecord[commands[i].note] = undefined;
      }
    }
    return notes;
  }

  /**
   * @description A helper function to list all the midi commands in the files.
   * @returns {[Object{note: Number, time: Number, type: Number}]}
   */
  #getMidiCommands() {
    const trackEvents = this.lookup(TrackEventNode);
    let currentTime = 0;
    let midiCommands = [];
    for (let i = 0; i < trackEvents.length; i++) {
      currentTime += trackEvents[i].v_time.toVariableLengthInt();
      const event = trackEvents[i].event;
      const type = event.getType();
      if (
        event instanceof MidiEventNode && type === MIDI_NOTE_ON ||
        type === MIDI_NOTE_OFF
      ) {
        midiCommands.push({
          note: event.getNote(),
          time: currentTime,
          type: type,
        });
      }
    }
    return midiCommands;
  }
}

class TrackEventNode extends TreeNode {
  v_time;
  event;

  /**
   * @constructor
   * @param {LeafNode} v_time - a variable length value specifying the elapsed time (delta time)
   *                            from the previous event to this event.
   * @param {MetaEventNode | LeafNode | SysexEventNode} event
   */
  constructor(v_time, event) {
    super(arguments);
    this.v_time = v_time;
    this.event = event;
  }
}

class MetaEventNode extends TreeNode {
  /**
   * @constructor
   * @param {LeafNode} lead - the byte 0xFF
   * @param {LeafNode} meta_type - the event type
   * @param {LeafNode} v_length - length of meta event data expressed as a variable length value.
   * @param {LeafNode} event_data_bytes - the actual event data.
   */
  constructor(lead, meta_type, v_length, event_data_bytes) {
    super(arguments);
  }

  /**
   * @description gets the type of the meta event
   * @returns {Number}
   */
  getType() {
    return this.nodes[1].toInt();
  }

  /**
   * @description gets the data for the meta event
   * @returns {ArrayBuffer}
   */
  getData() {
    return this.nodes[3].getBuffer();
  }

  /**
   * @description gets the data for the meta event and converts it to a number
   * @returns {Number}
   */
  getDataAsInt() {
    return this.nodes[3].toInt();
  }

  /**
   * @description gets the data for the meta event and converts it to a string
   * @returns {String}
   */
  getDataAsString() {
    const buffer = this.getData();
    const bytes = new Uint8Array(buffer);
    let s = "";
    for (let i = 0; i < bytes.length; i++) {
      s += String.fromCharCode(bytes[i]);
    }
    return s;
  }

  /**
   * @description gets the length of the data chunk in the meta event.
   * @return {Number}
   */
  getDataLength() {
    return this.nodes[2].toInt();
  }
}

class SysexEventNode extends TreeNode {
  /**
   * @constructor
   * @param {LeafNode} lead - the byte 0xF0 or 0xF7
   * * @param {LeafNode} v_length - length of event data expressed as a variable length value.
   * @param {LeafNode} data_bytes - the data
   */
  constructor(lead, v_length, data_bytes) {
    super(arguments);
  }
}

class MidiEventNode extends TreeNode {
  /**
   * @constructor
   * @param {LeafNode} firstByte
   * @param {LeafNode} param1
   * @param {LeafNode} param2
   */
  constructor(firstByte, param1, param2) {
    super(arguments);
  }

  /**
   * @returns {Number} the type of midi event
   */
  getType() {
    const firstByteHex = intToHex(this.nodes[0].toInt());
    if (firstByteHex.length == 1) {
      return 0;
    }
    return HEX_TO_INT[firstByteHex[0]];
  }

  /**
   * @returns {Number} the midi channel
   */
  getMidiChannel() {
    const firstByteHex = intToHex(this.nodes[0].toInt());
    if (firstByteHex.length == 1) {
      return HEX_TO_INT[firstByteHex[0]];
    }
    return HEX_TO_INT[firstByteHex[1]];
  }

  /**
   * @returns {Number} the midi note number
   */
  getNote() {
    return this.nodes[1].toInt();
  }
}

class TreeNodeFactory {
  /**
   * @param {ArrayBuffer} arraybuffer
   * @pre the array buffer is properly formatted.
   * @returns {SmfNode}
   */
  static SmfNodeFactory(arraybuffer) {
    const size = arraybuffer.byteLength;
    const headerChunkNode = TreeNodeFactory.HeaderChunkNodeFactory(
      arraybuffer.slice(0, 14),
    );
    const trackChunks = getTrackChunks(arraybuffer.slice(14, size));
    let trackChunkNodes = [];
    for (let i = 0; i < trackChunks.length; i++) {
      trackChunkNodes.push(
        TreeNodeFactory.TrackChunkNodeFactory(trackChunks[i]),
      );
    }
    return new SmfNode(headerChunkNode, trackChunkNodes);
  }

  /**
   * @param {ArrayBuffer} arraybuffer
   * @pre the array buffer is properly formatted.
   * @returns {HeaderChunkNode}
   * @return {null} on error
   */
  static HeaderChunkNodeFactory(arraybuffer) {
    if (arraybuffer.byteLength != 14) {
      return null;
    }
    const mthd = new LeafNode(arraybuffer.slice(0, 4));
    const length = new LeafNode(arraybuffer.slice(4, 8));
    const format = new LeafNode(arraybuffer.slice(8, 10));
    const n = new LeafNode(arraybuffer.slice(10, 12));
    const division = new LeafNode(arraybuffer.slice(12, 14));
    return new HeaderChunkNode(mthd, length, format, n, division);
  }

  /**
   * @param {ArrayBuffer} arraybuffer
   * @pre the array buffer is properly formatted.
   * @returns {TrackChunkNode}
   */
  static TrackChunkNodeFactory(arraybuffer) {
    const size = arraybuffer.byteLength;
    const mtrk = new LeafNode(arraybuffer.slice(0, 4));
    const length = new LeafNode(arraybuffer.slice(4, 8));
    const events = getTrackEvents(arraybuffer.slice(8, size));
    let eventNodes = [];
    for (let i = 0; i < events.length; i++) {
      eventNodes.push(TreeNodeFactory.TrackEventNodeFactory(events[i]));
    }
    return new TrackChunkNode(mtrk, length, eventNodes);
  }

  /**
   * @param {ArrayBuffer} arraybuffer
   * @pre the array buffer is properly formatted.
   * @returns {TrackEventNode}
   */
  static TrackEventNodeFactory(arraybuffer) {
    const size = arraybuffer.byteLength;
    const vTimeLength = parseVariableLengthValue(new Uint8Array(arraybuffer));
    const vTime = new LeafNode(arraybuffer.slice(0, vTimeLength));
    const eventBuffer = arraybuffer.slice(vTimeLength, size);
    let event;
    if (isMetaEvent(eventBuffer)) {
      event = TreeNodeFactory.MetaEventNodeFactory(eventBuffer);
    } else if (isSysexEvent(eventBuffer)) {
      event = TreeNodeFactory.SysexEventNodeFactory(eventBuffer);
    } else {
      event = TreeNodeFactory.MidiEventNodeFactory(eventBuffer);
    }
    return new TrackEventNode(vTime, event);
  }

  /**
   * @param {ArrayBuffer} arraybuffer
   * @pre the array buffer is properly formatted.
   * @returns {MetaEventNode}
   */
  static MetaEventNodeFactory(arraybuffer) {
    const size = arraybuffer.byteLength;
    const lead = new LeafNode(arraybuffer.slice(0, 1));
    const meta_type = new LeafNode(arraybuffer.slice(1, 2));
    const deltaLength = parseVariableLengthValue(
      new Uint8Array(arraybuffer.slice(2, size)),
    );
    const length = new LeafNode(arraybuffer.slice(2, 2 + deltaLength));
    const data_bytes = new LeafNode(arraybuffer.slice(2 + deltaLength, size));
    return new MetaEventNode(lead, meta_type, length, data_bytes);
  }

  /**
   * @param {ArrayBuffer} arraybuffer
   * @pre the array buffer is properly formatted.
   * @returns {SysexEventNode}
   */
  static SysexEventNodeFactory(arraybuffer) {
    const size = arraybuffer.byteLength;
    const lead = new LeafNode(arraybuffer.slice(0, 1));
    const deltaLength = parseVariableLengthValue(
      new Uint8Array(arraybuffer.slice(1, size)),
    );
    const length = new LeafNode(arraybuffer.slice(1, 1 + deltaLength));
    const data_bytes = new LeafNode(arraybuffer.slice(1 + deltaLength, size));
    return new SysexEventNode(lead, length, data_bytes);
  }

  /**
   * @param {ArrayBuffer} arraybuffer
   * @pre the array buffer is properly formatted.
   * @returns {MidiEventNode}
   */
  static MidiEventNodeFactory(arraybuffer) {
    const firstByte = new LeafNode(arraybuffer.slice(0, 1));
    const param1 = new LeafNode(arraybuffer.slice(1, 2));
    const param2 = new LeafNode(arraybuffer.slice(2, 3));
    return new MidiEventNode(firstByte, param1, param2);
  }
}

/**
 * @description - A helper function to help with comparing a byte array to a string.
 * @param {String} str
 * @param {Int8Array} view
 * @returns {Boolean}
 */
function strcmp(str, view) {
  let tmp = "";
  for (let i = 0; i < view.length; i++) {
    tmp += String.fromCharCode(view[i]);
  }
  return str === tmp;
}

/**
 * @description - Tells you if the first bit in a byte is
 * @param {Number} byte - One byte
 * @returns {Boolean}
 */
function hasLeadingOne(byte) {
  const s = byte.toString(2);
  if (s.length < 8) {
    return false;
  }
  return s[0] === "1";
}

/**
 * @description - Converts a decimal number to hexadecimal.
 * @param {Number} x
 * @returns {[String]}
 */
function intToHex(x) {
  if (x == 0) {
    return ["0"];
  }

  let s = [];
  while (x > 0) {
    const r = x % 16;
    x = Math.floor(x / 16);
    s.push(INT_TO_HEX[r]);
  }
  return s.reverse();
}

/**
 * @description - Converts a series of bytes into an integer.
 * @param {[Number]} bytes
 * @returns {Number}
 */
function bytesToInt(bytes) {
  let hexBytes = [];
  for (let i = 0; i < bytes.length; i++) {
    hexBytes = hexBytes.concat(intToHex(bytes[i]));
  }

  let n = 0;
  for (let i = hexBytes.length - 1, j = 0; i >= 0; i--, j++) {
    const x = HEX_TO_INT[hexBytes[i]];
    n += x * (16 ** j);
  }

  return n;
}

/**
 * @description - Converts a series of variable length bytes into an integer.
 * @param {[Number]} bytes
 * @returns {Number}
 */
function variableLengthBytesToInt(bytes) {
  let str = "";
  const length = parseVariableLengthValue(bytes);
  for (let i = 0; i < length; i++) {
    const s = bytes[i].toString(2);
    if (s.length < 8) {
      str += s;
    } else {
      str += s.substring(1, 8);
    }
  }

  let n = 0;
  for (let i = str.length - 1, j = 0; i >= 0; i--, j++) {
    n += parseInt(str[i]) * (2 ** j);
  }
  return n;
}

/**
 * @description - Takes a series of variable-length bytes and tells you the length (in bytes) of
 *                the first value
 * @param {[Number]} bytes
 * @return {Number}
 */
function parseVariableLengthValue(bytes) {
  let count = 0;
  for (let i = 0; i < bytes.length; i++) {
    count++;
    if (!hasLeadingOne(bytes[i])) {
      break;
    }
  }
  return count > 4 ? 4 : count;
}

/**
 * @description - A helper function to help with identifying the type of track event.
 * @param {ArrayBuffer} arraybuffer
 * @returns {Boolean}
 */
function isMetaEvent(arraybuffer) {
  const tmp = new Uint8Array(arraybuffer);
  return tmp[0] == 0xFF;
}

/**
 * @description - A helper function to get the length of a meta event.
 * @pre - isMetaEvent must return true on the array buffer being passed.
 * @param {ArrayBuffer} arraybuffer
 * @returns {Number}
 */
function getMetaEventLength(arraybuffer) {
  const view = new Uint8Array(arraybuffer.slice(2, arraybuffer.byteLength));
  let bytes = [];
  for (let i = 0; i < view.length; i++) {
    bytes.push(view[i]);
    if (!hasLeadingOne(view[i])) {
      break;
    }
  }
  return variableLengthBytesToInt(bytes);
}

/**
 * @description - A helper function to help with identifying the type of track event.
 * @param {ArrayBuffer} arraybuffer
 * @returns {Boolean}
 */
function isSysexEvent(arraybuffer) {
  const tmp = new Uint8Array(arraybuffer);
  const val = (tmp[0] * 16) + tmp[1];
  return val == 0xF0 || val == 0xF7;
}

/**
 * @description - A helper function to get the length of a sysex event.
 * @pre - isSysexEvent must return true on the array buffer being passed.
 * @param {ArrayBuffer} arraybuffer
 * @returns {Number}
 */
function getSysexEventLength(arraybuffer) {
  const view = new Uint8Array(arraybuffer.slice(1, arraybuffer.byteLength));
  let bytes = [];
  for (let i = 0; i < view.length; i++) {
    bytes.push(view[i]);
    if (!hasLeadingOne(view[i])) {
      break;
    }
  }
  return variableLengthBytesToInt(bytes);
}

/**
 * @description - Separates the track chunks in a midi file and stores them in an array.
 * @param {ArrayBuffer} arraybuffer
 * @returns {[ArrayBuffer]} - an array where each element is an array buffer for a track chunk.
 */
function getTrackChunks(arraybuffer) {
  const view = new Uint8Array(arraybuffer);
  const size = arraybuffer.byteLength;
  let trackChunks = [];
  let i = 0, j = 0;
  for (; j < size - 4; j++) {
    if (strcmp("MTrk", view.slice(j, j + 4)) && j != 0) {
      trackChunks.push(arraybuffer.slice(i, j));
      i = j;
    }
  }
  trackChunks.push(arraybuffer.slice(i, size));
  return trackChunks;
}

/**
 * @description - Separates the track events in a midi file and stores them in an array.
 * @param {ArrayBuffer} arraybuffer
 * @returns {[ArrayBuffer]}
 */
function getTrackEvents(arraybuffer) {
  const size = arraybuffer.byteLength;
  let trackEvents = [];
  for (let i = 0; i < size;) {
    const deltaTimeRaw = new Uint8Array(arraybuffer.slice(i, size));
    const deltaTimeLength = parseVariableLengthValue(deltaTimeRaw);
    const deltaTimeBuffer = arraybuffer.slice(i, i + deltaTimeLength);
    i += deltaTimeLength;

    const slice = arraybuffer.slice(i, size);
    let eventBuffer;
    if (isMetaEvent(slice)) {
      const datalength = getMetaEventLength(slice);
      const variableLength = parseVariableLengthValue(
        new Uint8Array(slice.slice(2, slice.length)),
      );
      eventBuffer = slice.slice(0, 2 + variableLength + datalength);
      i += 2 + variableLength + datalength;
    } else if (isSysexEvent(slice)) {
      // TODO
      throw (new Error("sysex event not recognized"));
    } else {
      eventBuffer = slice.slice(0, 3);
      i += 3;
    }

    const tmp = new Uint8Array(
      deltaTimeBuffer.byteLength + eventBuffer.byteLength,
    );
    tmp.set(new Uint8Array(deltaTimeBuffer), 0);
    tmp.set(new Uint8Array(eventBuffer), deltaTimeBuffer.byteLength);
    trackEvents.push(tmp.buffer);
  }

  return trackEvents;
}

/**
 * @description - converts a beat length into a name for a music duration.
 * @param {Number} beatLength
 * @returns {String}
 */
function durationFromInt(beatLength) {
  let index = NOTE_DURATION_LENGTHS.indexOf(beatLength);
  if (index !== -1) return NOTE_DURATION_NAMES[index];

  let duration = "";
  while (beatLength >= NOTE_DURATION_LENGTHS[0]) {
    for (let i = 0; i < NOTE_DURATION_LENGTHS.length; i++) {
      if (
        i === NOTE_DURATION_LENGTHS.length - 1 &&
        beatLength >= NOTE_DURATION_LENGTHS[i]
      ) {
        index = i;
      } else if (beatLength < NOTE_DURATION_LENGTHS[i]) {
        index = i - 1;
        break;
      }
    }
    duration += duration === ""
      ? `${NOTE_DURATION_NAMES[index]}`
      : `+${NOTE_DURATION_NAMES[index]}`;
    beatLength -= NOTE_DURATION_LENGTHS[index];
  }
  return duration === "" ? NOTE_DURATION_NAMES[0] : duration;
}

module.exports = { MidiReader };
