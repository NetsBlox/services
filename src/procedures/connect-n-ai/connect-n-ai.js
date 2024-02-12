/**
 * The ConnectN AI service allows you to create games like Connect-4 or Tic-Tac-Toe and play against an AI that improves over time.
 * 
 * @service
 * @category ArtificialIntelligence
 */
"use strict";

const logger = require("../utils/logger")("connect-n-ai");
const NBService = require("../utils/service");

const MAX_NODES = 1000000;

class Game {
    constructor(rows, cols, n) {
        if (rows < 1 || cols < 1) throw Error(`invalid board size ${rows}x${cols}`);
        if (n < 1) throw Error(`invalid connect size ${n}`);

        this.rows = rows;
        this.cols = cols;
        this.n = n;

        this.clear();
    }

    clear() {
        this.tiles = [];
        for (let i = this.rows * this.cols; i > 0; --i) {
            this.tiles.push(0);
        }
        this.moves = 0;
        this.running = true;
    }

    get(row, col) {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return undefined;
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
            throw Error(`position (${row},${col}) is out of bounds (${this.rows},${this.cols})`);
        }
        if (this.tiles[row * this.cols + col] !== 0) {
            throw Error(`position (${row},${col}) was already taken`);
        }

        this.tiles[row * this.cols + col] = player;
        this.moves++;

        const rayLength = (dr, dc) => {
            let i = 1;
            while (this.get(row + dr * i, col + dc * i) === player) ++i;
            return i - 1;
        };
        for (const [dr, dc] of [[1, 0], [1, 1], [0, 1], [-1, 1]]) {
            if (1 + rayLength(dr, dc) + rayLength(-dr, -dc) >= this.n) {
                this.running = false;
                return 'win';
            }
        }
        if (this.moves >= this.rows * this.cols) {
            this.running = false;
            return 'tie';
        }
        return 'ok';
    }

    getMove(aiSettings, player) {
        if (!this.running) {
            throw Error("the game is already over");
        }
        if (player !== 1 && player !== 2) {
            throw Error(`invalid player ${player}`);
        }

        const depth = aiSettings.getDepth(this.rows, this.cols);
        const alpha = aiSettings.getAlpha();
        logger.log(`getting ai move: depth=${depth} alpha=${alpha}`);

        const minimax = (currentDepth, currentPlayer) => {
            if (currentDepth > depth) throw Error("usage error");

            const possibleMoves = [];
            for (let row = 0; row < this.rows; ++row) {
                for (let col = 0; col < this.cols; ++col) {
                    if (this.tiles[row * this.cols + col] !== 0) continue;
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
                                const theirValue = minimax(currentDepth + 1, currentPlayer % 2 + 1)[0];
                                possibleMoves.push([-theirValue, row, col]);
                            }
                            break;
                        default:
                            throw Error('unreachable');
                    }
                    this.tiles[row * this.cols + col] = 0;
                    this.moves--;
                    this.running = true;
                }
            }
            if (possibleMoves.length === 0) throw Error("usage error");
            possibleMoves.sort((a, b) => b[0] - a[0]);
            if (currentDepth === 0) {
                console.log('available moves', possibleMoves, this);
            }

            const i = Math.min(possibleMoves.length - 1, Math.max(0, Math.floor(Math.random() * possibleMoves.length * alpha)));
            return possibleMoves[i];
        };
        const res = minimax(0, player);
        return [res[1], res[2]];
    }
}

class AISettings {
    constructor(rows, cols) {
        this.iter = 1;
    }
    advance() {
        this.iter++;
    }
    getDepth(rows, cols) {
        const max_depth = Math.floor(Math.log2(MAX_NODES) / Math.log2(rows * cols));
        return Math.max(0, Math.min(max_depth, Math.floor(Math.log2(this.iter))));
    }
    getAlpha() {
        return 1 / this.iter;
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
 */
ConnectNAI.newGame = function (rows, cols, n) {
    if (n > rows && n > cols) throw Error("n is too high - impossible to win");

    const session = getSession(this.caller.clientId);
    session.game = new Game(rows, cols, n);
};

/**
 * Makes a move for the specified player.
 * @param {Integer} row The row to play at.
 * @param {Integer} col The column to play at.
 * @param {Enum<Player1,Player2>} player The player to make the move for.
 * @returns {Enum<ok,win,tie>} result of the move.
 */
ConnectNAI.makeMove = function (row, col, player) {
    player = { 'Player1': 1, 'Player2': 2 }[player];

    const session = getSession(this.caller.clientId);
    const { game, aiSettings } = session;
    if (!game || !game.running) throw Error("no ongoing game - use newGame to start one");
    const res = game.set(row, col, player);
    if (!game.running) {
        aiSettings.advance();
    }
    return res;
};

/**
 * Gets the AI to suggest the next best move for the specified player.
 * @param {Enum<Player1,Player2>} player The player to make the recommendation for.
 * @returns {Tuple<Integer, Integer>} location (row/column) of the recommended move.
 */
ConnectNAI.getAIMove = function (player) {
    player = { 'Player1': 1, 'Player2': 2 }[player];

    const session = getSession(this.caller.clientId);
    const { game, aiSettings } = session;
    if (!game || !game.running) throw Error("no ongoing game - use newGame to start one");
    return game.getMove(aiSettings, player);
};

module.exports = ConnectNAI;
