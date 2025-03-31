// GameOfLifeApp/types/game.ts

/** Represents the state of a single cell: 0 for dead, 1 for alive. */
export type CellState = 0 | 1;

/** Represents the entire grid as a 2D array of cell states. */
export type GridState = CellState[][];

/** Represents the pan offset of the grid view. */
export type Offset = {
  x: number;
  y: number;
};