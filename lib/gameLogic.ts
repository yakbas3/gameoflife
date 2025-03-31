// GameOfLifeApp/lib/gameLogic.ts

import type { GridState, Coordinates } from '../types/game';

/**
 * Converts row and column numbers into a unique string key.
 * @param row The row number.
 * @param col The column number.
 * @returns A string representation (e.g., "10,25").
 */
export const coordsToString = (row: number, col: number): string => `${row},${col}`;

/**
 * Converts a string key back into row and column numbers.
 * @param str The string key (e.g., "10,25").
 * @returns A Coordinates object or null if the string is invalid.
 */
export const stringToCoords = (str: string): Coordinates | null => {
  const parts = str.split(',');
  if (parts.length !== 2) return null;
  const row = parseInt(parts[0], 10);
  const col = parseInt(parts[1], 10);
  // Check if parsing resulted in valid numbers
  if (isNaN(row) || isNaN(col)) return null;
  return { row, col };
};

/**
 * Creates an empty grid representation (an empty Set).
 * @returns An empty Set<string>.
 */
export const createEmptyGrid = (): GridState => {
  return new Set<string>();
};

/**
 * Counts the number of live neighbors for a given cell coordinate.
 * It checks the 8 cells surrounding the specified (row, col).
 * @param liveCells The current Set of live cell coordinate strings.
 * @param row The row of the cell to check around.
 * @param col The column of the cell to check around.
 * @returns The number of live neighbors (0-8).
 */
const countLiveNeighbors = (liveCells: GridState, row: number, col: number): number => {
  let count = 0;
  // Loop through the 3x3 neighborhood centered at (row, col)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      // Skip the center cell itself
      if (dr === 0 && dc === 0) continue;
      // Check if the neighbor coordinates are in the liveCells Set
      if (liveCells.has(coordsToString(row + dr, col + dc))) {
        count++;
      }
    }
  }
  return count;
};

/**
 * Calculates the next generation of the Game of Life based on the current
 * set of live cells. Uses Conway's rules:
 * - Survival: A live cell with 2 or 3 live neighbors survives.
 * - Death: A live cell with < 2 (underpopulation) or > 3 (overpopulation) live neighbors dies.
 * - Birth: A dead cell with exactly 3 live neighbors becomes a live cell.
 * @param liveCells The current Set of live cell coordinate strings.
 * @returns A new Set<string> representing the live cells in the next generation.
 */
export const calculateNextGeneration = (liveCells: GridState): GridState => {
  const nextLiveCells = new Set<string>();
  // Map to store potential candidates for birth (dead cells) and their neighbor counts
  const candidates = new Map<string, number>();

  // 1. Check neighbors of currently live cells to determine survival and identify birth candidates
  for (const cellStr of liveCells) {
    const coords = stringToCoords(cellStr);
    if (!coords) continue; // Should not happen if Set is managed correctly
    const { row, col } = coords;

    let currentLiveNeighbors = 0;
    // Check the 3x3 neighborhood
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = row + dr;
        const nc = col + dc;
        const neighborStr = coordsToString(nr, nc);

        // If it's a neighbor (not the cell itself)
        if (dr !== 0 || dc !== 0) {
          if (liveCells.has(neighborStr)) {
            currentLiveNeighbors++; // Count live neighbors for the current live cell
          } else {
            // If the neighbor is dead, increment its count in the candidates map
            // It might become alive in the next generation
            candidates.set(neighborStr, (candidates.get(neighborStr) || 0) + 1);
          }
        }
      }
    }

    // Apply survival rule for the current live cell
    if (currentLiveNeighbors === 2 || currentLiveNeighbors === 3) {
      nextLiveCells.add(cellStr); // Cell survives
    }
    // If not 2 or 3 neighbors, the live cell dies (implicitly, by not being added)
  }

  // 2. Check candidates (dead cells with live neighbors) for birth
  for (const [candidateStr, neighborCount] of candidates.entries()) {
    // Apply birth rule
    if (neighborCount === 3) {
      nextLiveCells.add(candidateStr); // Cell is born
    }
  }

  return nextLiveCells;
};