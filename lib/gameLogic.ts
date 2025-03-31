// GameOfLifeApp/lib/gameLogic.ts

import { GRID_COLS, GRID_ROWS } from '../constants/game';
import type { GridState } from '../types/game';

/**
 * Creates a new grid initialized with all cells set to dead (0).
 * @param rows - Number of rows for the grid.
 * @param cols - Number of columns for the grid.
 * @returns A new GridState object.
 */
export const createEmptyGrid = (rows: number = GRID_ROWS, cols: number = GRID_COLS): GridState => {
  const grid: GridState = [];
  for (let i = 0; i < rows; i++) {
    // Create a row filled with dead cells (0)
    grid.push(Array(cols).fill(0));
  }
  return grid;
};

/**
 * Calculates the next state of the grid based on Conway's Game of Life rules.
 * This is a pure function and does not modify the input grid.
 * @param grid - The current state of the grid.
 * @returns A new GridState object representing the next generation.
 */
export const calculateNextGeneration = (grid: GridState): GridState => {
  const rows = grid.length;
  // Assuming a non-empty grid, get cols from the first row
  const cols = grid[0]?.length || 0;

  if (rows === 0 || cols === 0) {
    console.warn("Calculating next generation on an empty grid.");
    return []; // Handle empty grid case
  }

  // Create a new grid structure for the next state.
  // IMPORTANT: Create a deep enough copy to avoid modifying the original.
  // Using map and spread operator creates new row arrays.
  const nextGrid: GridState = grid.map(row => [...row]);

  // Define the 8 neighbour offsets relative to a cell (row, col)
  // [dRow, dCol]
  const neighbors = [
    [-1, -1], [-1, 0], [-1, 1], // Top row neighbours
    [0, -1],           [0, 1],  // Middle row neighbours (sides)
    [1, -1], [1, 0], [1, 1]   // Bottom row neighbours
  ];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // 1. Count live neighbours for the current cell (row, col) in the *original* grid
      let liveNeighbors = 0;
      neighbors.forEach(([dRow, dCol]) => {
        const nRow = row + dRow;
        const nCol = col + dCol;

        // Check boundaries: Only count neighbours within the grid.
        // Treat cells outside the grid implicitly as dead (by not counting them).
        if (nRow >= 0 && nRow < rows && nCol >= 0 && nCol < cols) {
          // Add the neighbour's state (0 or 1) from the original grid to the count
          liveNeighbors += grid[nRow][nCol];
        }
      });

      // 2. Apply Conway's rules based on the ORIGINAL grid state to determine the cell's fate in the NEW grid
      const currentCellState = grid[row][col];

      // Rule 1: Underpopulation (live cell with < 2 neighbours dies)
      if (currentCellState === 1 && liveNeighbors < 2) {
        nextGrid[row][col] = 0; // Dies
      }
      // Rule 2: Survival (live cell with 2 or 3 neighbours lives)
      // No change needed as we copied the state initially. nextGrid[row][col] is already 1.
      // Rule 3: Overpopulation (live cell with > 3 neighbours dies)
      else if (currentCellState === 1 && liveNeighbors > 3) {
        nextGrid[row][col] = 0; // Dies
      }
      // Rule 4: Reproduction (dead cell with exactly 3 neighbours becomes alive)
      else if (currentCellState === 0 && liveNeighbors === 3) {
        nextGrid[row][col] = 1; // Becomes alive
      }
      // Otherwise, the cell state remains unchanged (already handled by the initial copy)
    }
  }

  return nextGrid; // Return the newly computed grid state
};