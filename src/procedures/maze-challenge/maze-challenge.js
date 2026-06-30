/**
 * The MazeChallenge Service provides the gameplay and evaluation of randomized maze puzzles.
 *
 * @service
 * @category Games
 */

"use strict";

const GENERATED_MAZES = Object.create(null);
let NEXT_MAZE_ID = 1;
const LEVEL_SIZES = {
  easy: 9,
  hard: 13,
};
const DELTAS = {
  U: { row: -1, col: 0 },
  D: { row: 1, col: 0 },
  L: { row: 0, col: -1 },
  R: { row: 0, col: 1 },
};

const MazeChallenge = {};

/**
 * Generate and return a fresh maze for the given difficulty level.
 * @param {String=} level Level to load: easy or hard
 * @returns {Array} maze data for drawing
 */
MazeChallenge.getMaze = function (level) {
  const maze = generateMaze(level);

  GENERATED_MAZES[maze.mazeId] = maze;

  return [
    maze.mazeId,
    maze.level,
    maze.rows,
    maze.cols,
    maze.grid,
    maze.startRow,
    maze.startCol,
    maze.goalRow,
    maze.goalCol,
    maze.optimalPath.length,
    "Loaded " + maze.level + " maze.",
  ];
};

/**
 * Evaluate a submitted path for a maze.
 * @param {String} mazeId ID returned by getMaze
 * @param {String} path Path using U, D, L, and R
 * @returns {Array} score and feedback for the submitted path
 */
MazeChallenge.evaluatePath = function (mazeId, path) {
  const maze = GENERATED_MAZES[mazeId];

  if (typeof path !== "string") {
    return [
      0,
      "Path can only contain U, D, L, and R.",
    ];
  }

  path = path.toUpperCase().replace(/[ ,]/g, "");

  if (!maze) {
    return [
      0,
      "Unknown maze ID.",
    ];
  }

  if (/[^UDLR]/.test(path)) {
    return [
      0,
      "Path can only contain U, D, L, and R.",
    ];
  }

  if (path.length === 0) {
    return [
      0,
      "Enter a path using U, D, L, and R.",
    ];
  }

  const result = simulatePath(maze, path);

  if (!result.valid) {
    return [
      Math.min(250, result.validSteps * 15),
      result.message,
    ];
  }

  if (!result.reachedGoal) {
    return [
      Math.min(400, result.validSteps * 20),
      "Your path is valid so far, but it does not reach the goal.",
    ];
  }

  if (path.length === maze.optimalPath.length) {
    return [
      1000,
      "Correct. You reached the goal with an optimal path.",
    ];
  }

  return [
    Math.max(500, 800 - (path.length - maze.optimalPath.length) * 20),
    "You reached the goal, but your path was longer than optimal.",
  ];
};

/**
 * Get a suggested next move for the current path.
 * @param {String} mazeId ID returned by getMaze
 * @param {String=} currentPath Optional current path using U, D, L, and R
 * @returns {String} next move, one of U, D, L, R, or an empty string if no move is available
 */
MazeChallenge.getHint = function (mazeId, currentPath) {
  const maze = GENERATED_MAZES[mazeId];

  if (!maze) {
    return "";
  }

  if (currentPath === undefined || currentPath === null) {
    currentPath = "";
  }

  if (typeof currentPath !== "string") {
    return "";
  }

  currentPath = currentPath.toUpperCase().replace(/[ ,]/g, "");

  if (/[^UDLR]/.test(currentPath)) {
    return "";
  }

  const result = simulatePath(maze, currentPath);

  if (!result.valid) {
    return "";
  }

  if (result.row === maze.goalRow && result.col === maze.goalCol) {
    return "";
  }

  const pathToGoal = shortestPath(
    maze,
    result.row,
    result.col,
    maze.goalRow,
    maze.goalCol,
  );
  const nextMove = pathToGoal[0] || "";

  return nextMove;
};

function generateMaze(level) {
  level = typeof level === "string" ? level.toLowerCase() : "easy";
  level = LEVEL_SIZES[level] ? level : "easy";

  const size = LEVEL_SIZES[level];
  const grid = Array.from({ length: size }, function () {
    return Array(size).fill("#");
  });
  const stack = [{ row: 0, col: 0 }];
  const visited = { "0,0": true };

  grid[0][0] = ".";

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = [
      { row: current.row - 2, col: current.col },
      { row: current.row + 2, col: current.col },
      { row: current.row, col: current.col - 2 },
      { row: current.row, col: current.col + 2 },
    ].filter(function (next) {
      return next.row >= 0 &&
        next.row < size &&
        next.col >= 0 &&
        next.col < size &&
        !visited[next.row + "," + next.col];
    });

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    const middleRow = current.row + (next.row - current.row) / 2;
    const middleCol = current.col + (next.col - current.col) / 2;

    grid[middleRow][middleCol] = ".";
    grid[next.row][next.col] = ".";
    visited[next.row + "," + next.col] = true;
    stack.push(next);
  }

  addLoopsToGrid(grid, size, level);

  const goal = size - 1;

  grid[0][0] = "S";
  grid[goal][goal] = "G";

  const maze = {
    mazeId: "maze-" + NEXT_MAZE_ID++,
    level: level,
    rows: size,
    cols: size,
    grid: grid.map(function (row) {
      return row.join("");
    }),
    startRow: 0,
    startCol: 0,
    goalRow: goal,
    goalCol: goal,
    optimalPath: "",
  };

  maze.optimalPath = shortestPath(
    maze,
    maze.startRow,
    maze.startCol,
    maze.goalRow,
    maze.goalCol,
  );

  return maze;
}

function addLoopsToGrid(grid, size, level) {
  const loopCounts = { easy: 3, hard: 8 };
  const target = loopCounts[level] || loopCounts.easy;
  const maxAttempts = target * 50;
  let opened = 0;
  let attempts = 0;

  while (opened < target && attempts < maxAttempts) {
    attempts++;

    const row = 1 + Math.floor(Math.random() * (size - 2));
    const col = 1 + Math.floor(Math.random() * (size - 2));
    let openNeighbors = 0;

    if (grid[row][col] !== "#") {
      continue;
    }

    [
      grid[row - 1][col],
      grid[row + 1][col],
      grid[row][col - 1],
      grid[row][col + 1],
    ].forEach(function (value) {
      if (value === ".") {
        openNeighbors++;
      }
    });

    if (openNeighbors >= 2) {
      grid[row][col] = ".";
      opened++;
    }
  }
}

function simulatePath(maze, path) {
  let row = maze.startRow;
  let col = maze.startCol;

  for (let i = 0; i < path.length; i++) {
    const delta = DELTAS[path[i]];
    const nextRow = row + delta.row;
    const nextCol = col + delta.col;
    const step = i + 1;

    if (
      nextRow < 0 ||
      nextRow >= maze.rows ||
      nextCol < 0 ||
      nextCol >= maze.cols
    ) {
      return {
        valid: false,
        row: row,
        col: col,
        validSteps: i,
        message: "Your path leaves the maze at step " + step + ".",
      };
    }

    if (maze.grid[nextRow][nextCol] === "#") {
      return {
        valid: false,
        row: row,
        col: col,
        validSteps: i,
        message: "Your path hits a wall at step " + step + ".",
      };
    }

    row = nextRow;
    col = nextCol;
  }

  return {
    valid: true,
    reachedGoal: row === maze.goalRow && col === maze.goalCol,
    row: row,
    col: col,
    validSteps: path.length,
  };
}

function shortestPath(maze, startRow, startCol, goalRow, goalCol) {
  const queue = [{ row: startRow, col: startCol, path: "" }];
  const visited = {};

  visited[startRow + "," + startCol] = true;

  while (queue.length > 0) {
    const current = queue.shift();

    if (current.row === goalRow && current.col === goalCol) {
      return current.path;
    }

    for (const move in DELTAS) {
      const delta = DELTAS[move];
      const row = current.row + delta.row;
      const col = current.col + delta.col;
      const key = row + "," + col;

      if (
        !visited[key] &&
        row >= 0 &&
        row < maze.rows &&
        col >= 0 &&
        col < maze.cols &&
        maze.grid[row][col] !== "#"
      ) {
        visited[key] = true;
        queue.push({
          row: row,
          col: col,
          path: current.path + move,
        });
      }
    }
  }

  return "";
}

module.exports = MazeChallenge;
