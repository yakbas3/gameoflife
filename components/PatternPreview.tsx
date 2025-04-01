import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import type { Pattern } from '../lib/patterns';

interface PatternPreviewProps {
  pattern: Pattern;
  cellSize?: number;
  cellColor?: string;
  gridColor?: string;
  maxSize?: number;
}

const PatternPreview: React.FC<PatternPreviewProps> = ({
  pattern,
  cellSize = 8,
  cellColor = '#00ff00',
  gridColor = '#111111',
  maxSize = 120
}) => {
  // Calculate bounds of the pattern
  const { bounds, cellSize: computedCellSize } = useMemo(() => {
    let minRow = Infinity;
    let maxRow = -Infinity;
    let minCol = Infinity;
    let maxCol = -Infinity;

    // Find min and max coordinates
    for (const [row, col] of pattern.relativeCoords) {
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }

    // Add padding
    minRow -= 1;
    maxRow += 1;
    minCol -= 1;
    maxCol += 1;

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;

    // Calculate the actual cell size
    const maxDim = Math.max(width, height);
    
    // For larger patterns, use smaller cells
    let computedSize;
    // Special handling for guns and large patterns
    if (maxDim > 30) {
      // Very large pattern like P60 Gun
      computedSize = Math.max(Math.floor(maxSize / (maxDim * 1.5)), 1);
    } else if (maxDim > 20) {
      // Large pattern like Gosper Gun
      computedSize = Math.max(Math.floor(maxSize / (maxDim * 1.2)), 1.5);
    } else if (maxDim > 10) {
      // Medium-large pattern
      computedSize = Math.max(Math.floor(maxSize / (maxDim * 1.1)), 2);
    } else {
      // Normal pattern (spaceships, oscillators, still life)
      computedSize = Math.max(Math.min(cellSize, Math.floor(maxSize / maxDim)), 3);
    }

    return {
      bounds: { minRow, maxRow, minCol, maxCol, width, height },
      cellSize: computedSize
    };
  }, [pattern.relativeCoords, cellSize, maxSize]);

  // Calculate container dimensions
  const gridWidth = Math.max(50, bounds.width * computedCellSize);
  const gridHeight = Math.max(50, bounds.height * computedCellSize);

  // Render cells directly from pattern coordinates
  const cellViews = pattern.relativeCoords.map(([row, col], index) => {
    const top = (row - bounds.minRow) * computedCellSize;
    const left = (col - bounds.minCol) * computedCellSize;
    
    return (
      <View
        key={`${index}-${row}-${col}`}
        style={{
          position: 'absolute',
          top,
          left,
          width: computedCellSize < 2 ? computedCellSize : computedCellSize - 0.5,
          height: computedCellSize < 2 ? computedCellSize : computedCellSize - 0.5,
          backgroundColor: cellColor,
          borderWidth: computedCellSize < 2 ? 0 : 0.5,
          borderColor: 'rgba(255, 255, 255, 0.7)',
          borderRadius: computedCellSize < 2 ? 0 : 1,
        }}
      />
    );
  });

  return (
    <View style={[
      styles.container, 
      { 
        width: gridWidth, 
        height: gridHeight, 
        backgroundColor: gridColor,
      }
    ]}>
      {cellViews}
      <Text style={styles.nameOverlay}>{pattern.name}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    minWidth: 50,
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#666',
    borderRadius: 4,
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 2,
    left: 0,
    right: 0,
    fontSize: 7,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    textAlign: 'center',
    paddingVertical: 1,
  }
});

export default PatternPreview; 