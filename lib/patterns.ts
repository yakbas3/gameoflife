// GameOfLifeApp/lib/patterns.ts

import type { Coordinates } from '../types/game';
import { coordsToString } from './gameLogic';

/**
 * Pattern category types
 */
export type PatternCategory = 'still-life' | 'oscillator' | 'spaceship' | 'gun';

/**
 * Interface for pattern information
 */
export interface Pattern {
  name: string;
  description: string;
  category: PatternCategory;
  emoji: string;
  relativeCoords: number[][];  // [row, col] pairs relative to center
}

/**
 * Convert a pattern's relative coordinates to absolute coordinates
 * @param pattern The pattern to place
 * @param centerRow Center row position
 * @param centerCol Center column position
 * @returns Array of coordinate strings
 */
export const patternToCoords = (
  pattern: Pattern,
  centerRow: number,
  centerCol: number
): string[] => {
  return pattern.relativeCoords.map(([relRow, relCol]) => 
    coordsToString(centerRow + relRow, centerCol + relCol)
  );
};

// Still Life Patterns
const stillLifePatterns: Pattern[] = [
  {
    name: 'Block',
    description: 'A simple 2x2 square of cells.',
    category: 'still-life',
    emoji: '▫️',
    relativeCoords: [
      [0, 0], [0, 1],
      [1, 0], [1, 1]
    ]
  },
  {
    name: 'Beehive',
    description: 'A six-cell shape that stays static.',
    category: 'still-life',
    emoji: '🍯',
    relativeCoords: [
      [0, 1], [0, 2],
      [1, 0], [1, 3],
      [2, 1], [2, 2]
    ]
  },
  {
    name: 'Loaf',
    description: 'Similar to a beehive but with a small bump.',
    category: 'still-life',
    emoji: '🍞',
    relativeCoords: [
      [0, 1], [0, 2],
      [1, 0], [1, 3],
      [2, 1], [2, 3],
      [3, 2]
    ]
  },
  {
    name: 'Boat',
    description: 'Small, five-cell structure that stays static.',
    category: 'still-life',
    emoji: '⛵',
    relativeCoords: [
      [0, 0], [0, 1],
      [1, 0], [1, 2],
      [2, 1]
    ]
  },
  {
    name: 'Tub',
    description: 'Looks like a tiny circle.',
    category: 'still-life',
    emoji: '🛁',
    relativeCoords: [
      [0, 1],
      [1, 0], [1, 2],
      [2, 1]
    ]
  }
];

// Oscillator Patterns
const oscillatorPatterns: Pattern[] = [
  {
    name: 'Blinker',
    description: 'The simplest oscillator; a line of 3 cells toggling vertically/horizontally.',
    category: 'oscillator',
    emoji: '💡',
    relativeCoords: [
      [-1, 0], [0, 0], [1, 0]
    ]
  },
  {
    name: 'Toad',
    description: 'Period 2 oscillator; 6 cells form a shifting pattern.',
    category: 'oscillator',
    emoji: '🐸',
    relativeCoords: [
      [0, 0], [0, 1], [0, 2],
      [1, -1], [1, 0], [1, 1]
    ]
  },
  {
    name: 'Beacon',
    description: 'Two 2x2 blocks that flash alternately.',
    category: 'oscillator',
    emoji: '🚨',
    relativeCoords: [
      [-1, -1], [-1, 0],
      [0, -1], [0, 0],
      [1, 1], [1, 2],
      [2, 1], [2, 2]
    ]
  },
  {
    name: 'Pulsar',
    description: 'Large, complex period 3 oscillator with 48 cells.',
    category: 'oscillator',
    emoji: '⭐',
    relativeCoords: [
      [-6, -4], [-6, -3], [-6, -2], [-6, 2], [-6, 3], [-6, 4],
      [-4, -6], [-4, -1], [-4, 1], [-4, 6],
      [-3, -6], [-3, -1], [-3, 1], [-3, 6],
      [-2, -6], [-2, -1], [-2, 1], [-2, 6],
      [-1, -4], [-1, -3], [-1, -2], [-1, 2], [-1, 3], [-1, 4],
      [1, -4], [1, -3], [1, -2], [1, 2], [1, 3], [1, 4],
      [2, -6], [2, -1], [2, 1], [2, 6],
      [3, -6], [3, -1], [3, 1], [3, 6],
      [4, -6], [4, -1], [4, 1], [4, 6],
      [6, -4], [6, -3], [6, -2], [6, 2], [6, 3], [6, 4]
    ]
  },
  {
    name: 'Pentadecathlon',
    description: 'Period 15 oscillator, looks like a chain.',
    category: 'oscillator',
    emoji: '🧬',
    relativeCoords: [
      [-4, 0], [-3, 0], [-2, -1], [-2, 1], [-1, 0], [0, 0], 
      [1, 0], [2, 0], [3, -1], [3, 1], [4, 0], [5, 0]
    ]
  }
];

// Spaceship Patterns
const spaceshipPatterns: Pattern[] = [
  {
    name: 'Glider',
    description: 'The most iconic; a 5-cell pattern that moves diagonally.',
    category: 'spaceship',
    emoji: '🛸',
    relativeCoords: [
      [-1, 0],
      [0, 1],
      [1, -1], [1, 0], [1, 1]
    ]
  },
  {
    name: 'Lightweight Spaceship',
    description: 'Moves horizontally, small spaceship (LWSS).',
    category: 'spaceship',
    emoji: '✈️',
    relativeCoords: [
      [-1, -1], [-1, 2],
      [0, -2], [0, 2],
      [1, -2], [1, -1], [1, 0], [1, 1], [1, 2],
      [2, -1], [2, 0], [2, 1], [2, 2]
    ]
  },
  {
    name: 'Middleweight Spaceship',
    description: 'Similar to LWSS but larger (MWSS).',
    category: 'spaceship',
    emoji: '🚀',
    relativeCoords: [
      [-1, -2], [-1, 3],
      [0, -3], [0, 3],
      [1, -3], [1, -2], [1, -1], [1, 0], [1, 1], [1, 2], [1, 3],
      [2, -2], [2, -1], [2, 0], [2, 1], [2, 2], [2, 3],
      [3, 0], [3, 1]
    ]
  },
  {
    name: 'Heavyweight Spaceship',
    description: 'The largest common spaceship (HWSS).',
    category: 'spaceship',
    emoji: '🚢',
    relativeCoords: [
      [-1, -2], [-1, -1], [-1, 4],
      [0, -3], [0, 4],
      [1, -3], [1, 4],
      [2, -3], [2, -2], [2, -1], [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
      [3, -2], [3, -1], [3, 0], [3, 1], [3, 2], [3, 3],
      [4, 0], [4, 1]
    ]
  }
];

// Export all patterns
export const allPatterns: Pattern[] = [
  ...stillLifePatterns,
  ...oscillatorPatterns,
  ...spaceshipPatterns
];

// Debug count
console.log("Pattern counts:", {
  stillLife: stillLifePatterns.length,
  oscillators: oscillatorPatterns.length,
  spaceships: spaceshipPatterns.length,
  total: allPatterns.length
});

// Export by category
export const getPatternsByCategory = (category: PatternCategory): Pattern[] => {
  return allPatterns.filter(pattern => pattern.category === category);
}; 