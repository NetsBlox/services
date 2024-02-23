/**
 * The ConnectN AI service allows you to create games like Connect-4 or Tic-Tac-Toe and play against an AI that improves over time.
 *
 * @service
 * @category ArtificialIntelligence
 */
"use strict";

const logger = require("../utils/logger")("connect-n-ai");
const NBService = require("../utils/service");

const MAX_NODES = 500000;

class Game {
  constructor(rows, cols, n, gravity) {
    if (rows < 1 || cols < 1) throw Error(`invalid board size ${rows}x${cols}`);
    if (n < 1) throw Error(`invalid connect size ${n}`);

    this.rows = rows;
    this.cols = cols;
    this.n = n;
    this.gravity = gravity;

    this.clear();
  }

  clear() {
    this.tiles = [];
    for (let i = this.rows * this.cols; i > 0; --i) {
      this.tiles.push(0);
    }
    this.occupied = 0;
    this.running = true;
  }

  isValidMove(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return false;
    }
    if (this.tiles[row * this.cols + col] !== 0) return false;
    if (
      this.gravity && row > 0 && this.tiles[(row - 1) * this.cols + col] === 0
    ) return false;
    return true;
  }

  get(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return undefined;
    }
    return this.tiles[row * this.cols + col];
  }
  set(row, col, player) {
    if (player !== 1 && player !== 2) {
      throw Error(`invalid player ${player}`);
    }
    if (!this.running) {
      throw Error("the game is already over");
    }
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      throw Error(`position is out of bounds`);
    }
    if (this.tiles[row * this.cols + col] !== 0) {
      throw Error(`position was already taken`);
    }
    if (
      this.gravity && row > 0 && this.tiles[(row - 1) * this.cols + col] === 0
    ) {
      throw Error(`position is an invalid move`);
    }

    this.tiles[row * this.cols + col] = player;
    this.occupied++;

    const rayLength = (dr, dc) => {
      let i = 1;
      while (this.get(row + dr * i, col + dc * i) === player) ++i;
      return i - 1;
    };
    for (const [dr, dc] of [[1, 0], [1, 1], [0, 1], [-1, 1]]) {
      if (1 + rayLength(dr, dc) + rayLength(-dr, -dc) >= this.n) {
        this.running = false;
        return "win";
      }
    }
    if (this.occupied >= this.rows * this.cols) {
      this.running = false;
      return "tie";
    }
    return "ok";
  }

  getMoves(aiSettings, player) {
    if (!this.running) {
      throw Error("the game is already over");
    }
    if (player !== 1 && player !== 2) {
      throw Error(`invalid player ${player}`);
    }

    const depth = aiSettings.getDepth(
      this.rows,
      this.cols,
      this.gravity,
      this.occupied,
    );
    const alpha = aiSettings.getAlpha(
      this.rows,
      this.cols,
      this.gravity,
      this.occupied,
    );
    logger.log(
      `getting ai moves: ai-iter=${aiSettings.iter} depth=${depth} alpha=${alpha}`,
    );

    const minimax = (currentDepth, currentPlayer) => {
      if (currentDepth > depth) throw Error("usage error");

      const possibleMoves = [];
      for (let row = 0; row < this.rows; ++row) {
        for (let col = 0; col < this.cols; ++col) {
          if (!this.isValidMove(row, col)) continue;

          switch (this.set(row, col, currentPlayer)) {
            case "win":
              possibleMoves.push([1, row, col]);
              break;
            case "tie":
              possibleMoves.push([0, row, col]);
              break;
            case "ok":
              if (currentDepth + 1 > depth) {
                possibleMoves.push([0, row, col]);
              } else {
                const [theirMoves, theirChoice] = minimax(
                  currentDepth + 1,
                  currentPlayer % 2 + 1,
                );
                possibleMoves.push([theirMoves[theirChoice][0] / -2, row, col]);
              }
              break;
            default:
              throw Error("unreachable");
          }
          this.tiles[row * this.cols + col] = 0;
          this.occupied--;
          this.running = true;
        }
      }
      if (possibleMoves.length === 0) throw Error("usage error");
      possibleMoves.sort((a, b) => Math.random() - 0.5);
      possibleMoves.sort((a, b) => b[0] - a[0]);

      const i = Math.min(
        possibleMoves.length - 1,
        Math.max(0, Math.floor(Math.random() * possibleMoves.length * alpha)),
      );
      return [possibleMoves, i];
    };
    const [moves, _] = minimax(0, player);
    logger.log("got ai moves", moves);
    return moves;
  }
}

class AISettings {
  constructor() {
    this.iter = 1;
  }
  getDepth(rows, cols, gravity, occupied) {
    let maxDepth;
    if (gravity) {
      maxDepth = Math.floor(Math.log2(MAX_NODES) / Math.log2(cols));
    } else {
      maxDepth = 0;
      let temp = 1;
      const k = rows * cols - occupied;
      if (k < 1) throw Error("usage error");
      while (maxDepth < k && temp < MAX_NODES) temp *= k - maxDepth++;
      if (temp > MAX_NODES) --maxDepth;
    }

    return Math.max(0, Math.min(maxDepth, Math.floor(Math.log2(this.iter))));
  }
  getAlpha(rows, cols, gravity, occupied) {
    const k = Math.max(1, gravity ? this.iter / rows : this.iter);
    return 1 / (1 + 1.5 * Math.log2(k));
  }
}

class Session {
  constructor() {
    this.game = null;
    this.aiSettings = new AISettings();
    this.touch();
  }

  touch() {
    this.expiry = +new Date() + 60 * 60 * 1000; // expire in one hour
  }
  isExpired() {
    return +new Date() > this.expiry;
  }
}

const sessions = {};
function getSession(id) {
  if (!id) throw Error("invalid session id");

  let session = sessions[id];
  if (!session) {
    session = sessions[id] = new Session();
  }
  session.touch();
  return session;
}

const ConnectNAI = new NBService("ConnectNAI");

/**
 * Creates a new AI session.
 * This has the effect of resetting the AI to the point of knowing nothing about the game.
 */
ConnectNAI.newSession = function () {
  delete sessions[this.caller.clientId];
};

/**
 * Starts a new game with the existing AI session.
 * @param {BoundedInteger<3, 10>} rows The number of rows in the game
 * @param {BoundedInteger<3, 10>} cols The number of columns in the game
 * @param {BoundedInteger<3>} n The number of consecutive pieces needed to win
 * @param {Boolean} gravity Whether or not to use gravity when placing pieces, which makes them fall down to the lowest unoccupied row in the column
 */
ConnectNAI.newGame = function (rows, cols, n, gravity) {
  if (n > rows && n > cols) throw Error("n is too high - impossible to win");

  const session = getSession(this.caller.clientId);
  session.game = new Game(rows, cols, n, gravity);
};

/**
 * Makes a move for the specified player.
 * @param {Integer} row The row to play at.
 * @param {Integer} col The column to play at.
 * @param {Enum<Player1,Player2>} player The player to make the move for.
 * @returns {Tuple<Integer, Integer, Enum<ok,win,tie>>} Location (row/column) and result of the move. The location may not be the same as the input if gravity is enabled (see newGame).
 */
ConnectNAI.makeMove = function (row, col, player) {
  player = { "Player1": 1, "Player2": 2 }[player];
  row -= 1;
  col -= 1;

  const session = getSession(this.caller.clientId);
  const { game, aiSettings } = session;
  if (!game || !game.running) {
    throw Error("no ongoing game - use newGame to start one");
  }
  if (game.gravity && game.get(row, col) === 0) {
    while (row > 0 && game.get(row - 1, col) === 0) --row;
  }
  const res = game.set(row, col, player);
  if (!game.running) {
    aiSettings.iter++;
  }
  return [row + 1, col + 1, res];
};

/**
 * Gets the AI to suggest the next best move for the specified player.
 * @param {Enum<Player1,Player2>} player The player to make the recommendation for.
 * @returns {Array<Tuple<Number, Integer, Integer>>} A list of recommended moves, each being ``[value, row, column]``. These are already sorted in descending value, so the recommended move is the first one.
 */
ConnectNAI.getAIMoves = function (player) {
  player = { "Player1": 1, "Player2": 2 }[player];

  const session = getSession(this.caller.clientId);
  const { game, aiSettings } = session;
  if (!game || !game.running) {
    throw Error("no ongoing game - use newGame to start one");
  }
  return game.getMoves(aiSettings, player).map((
    m,
  ) => [m[0], m[1] + 1, m[2] + 1]);
};

/**
 * Sets the current session's AI to the maximum difficulty.
 */
ConnectNAI.useMaxDifficulty = function () {
  const session = getSession(this.caller.clientId);
  session.aiSettings.iter = Infinity;
};

module.exports = ConnectNAI;
