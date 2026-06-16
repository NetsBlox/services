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
  medium: 13,
  hard: 17,
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
 * @param {String=} level Level to load: easy, medium, or hard
 * @returns {Object} maze data for drawing
 */
MazeChallenge.getMaze = function (level) {
  const maze = generateMaze(level);

  GENERATED_MAZES[maze.mazeId] = maze;

  return {
    mazeId: maze.mazeId,
    level: maze.level,
    rows: maze.rows,
    cols: maze.cols,
    grid: maze.grid,
    startRow: maze.startRow,
    startCol: maze.startCol,
    goalRow: maze.goalRow,
    goalCol: maze.goalCol,
    optimalLength: maze.optimalPath.length,
    message: "Loaded " + maze.level + " maze.",
  };
};

/**
 * Evaluate a submitted path for a maze.
 * @param {String} mazeId ID returned by getMaze
 * @param {String} path Path using U, D, L, and R
 * @returns {Object} score and feedback for the submitted path
 */
MazeChallenge.evaluatePath = function (mazeId, path) {
  const maze = GENERATED_MAZES[mazeId];

  if (typeof path !== "string") {
    return {
      score: 0,
      message: "Path can only contain U, D, L, and R.",
    };
  }

  path = path.toUpperCase().replace(/[ ,]/g, "");

  if (!maze) {
    return {
      score: 0,
      message: "Unknown maze ID.",
    };
  }

  if (/[^UDLR]/.test(path)) {
    return {
      score: 0,
      message: "Path can only contain U, D, L, and R.",
    };
  }

  if (path.length === 0) {
    return {
      score: 0,
      message: "Enter a path using U, D, L, and R.",
    };
  }

  const result = simulatePath(maze, path);

  if (!result.valid) {
    return {
      score: Math.min(250, result.validSteps * 15),
      message: result.message,
    };
  }

  if (!result.reachedGoal) {
    return {
      score: Math.min(400, result.validSteps * 20),
      message: "Your path is valid so far, but it does not reach the goal.",
    };
  }

  if (path.length === maze.optimalPath.length) {
    return {
      score: 1000,
      message: "Correct. You reached the goal with an optimal path.",
    };
  }

  return {
    score: Math.max(500, 800 - (path.length - maze.optimalPath.length) * 20),
    message: "You reached the goal, but your path was longer than optimal.",
  };
};

/**
 * Get a suggested next move for the current path.
 * @param {String} mazeId ID returned by getMaze
 * @param {String} currentPath Current path using U, D, L, and R
 * @returns {Object} simple hint data
 */
MazeChallenge.getHint = function (mazeId, currentPath) {
  const maze = GENERATED_MAZES[mazeId];

  if (!maze) {
    return {
      nextMove: "",
      message: "Unknown maze ID.",
    };
  }

  if (typeof currentPath !== "string") {
    return {
      nextMove: "",
      message: "Path can only contain U, D, L, and R.",
    };
  }

  currentPath = currentPath.toUpperCase().replace(/[ ,]/g, "");

  if (/[^UDLR]/.test(currentPath)) {
    return {
      nextMove: "",
      message: "Path can only contain U, D, L, and R.",
    };
  }

  const result = simulatePath(maze, currentPath);

  if (!result.valid) {
    return {
      nextMove: "",
      message: result.message,
    };
  }

  if (result.row === maze.goalRow && result.col === maze.goalCol) {
    return {
      nextMove: "",
      message: "You are already at the goal.",
    };
  }

  const pathToGoal = shortestPath(
    maze,
    result.row,
    result.col,
    maze.goalRow,
    maze.goalCol,
  );
  const nextMove = pathToGoal[0] || "";
  const names = { U: "up", D: "down", L: "left", R: "right" };

  return {
    nextMove: nextMove,
    message: nextMove
      ? "Try moving " + names[nextMove] + " next."
      : "No hint is available.",
  };
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

  const goal = size % 2 === 0 ? size - 2 : size - 1;

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
