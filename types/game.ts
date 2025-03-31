// GameOfLifeApp/types/game.ts

/**
 * Represents a coordinate pair in the logical grid space.
 */
export interface Coordinates {
    row: number;
    col: number;
  }
  
  /**
   * The state of the Game of Life grid, represented as a Set of
   * strings, where each string is a "row,col" coordinate of a live cell.
   */
  export type GridState = Set<string>;
  
  // Note: The Offset type is no longer needed for this approach.
  // export interface Offset { x: number; y: number; }