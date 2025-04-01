import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import PatternPreview from './PatternPreview';
import { Pattern, PatternCategory } from '../lib/patterns';

// Hardcoded patterns organized by category
const stillLifePatterns: Pattern[] = [
  {
    name: 'Block',
    description: 'A simple 2x2 square of cells.',
    category: 'still-life' as PatternCategory,
    emoji: '▫️',
    relativeCoords: [
      [0, 0], [0, 1],
      [1, 0], [1, 1]
    ]
  },
  {
    name: 'Beehive',
    description: 'A six-cell shape that stays static.',
    category: 'still-life' as PatternCategory,
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
    category: 'still-life' as PatternCategory,
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
    category: 'still-life' as PatternCategory,
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
    category: 'still-life' as PatternCategory,
    emoji: '🛁',
    relativeCoords: [
      [0, 1],
      [1, 0], [1, 2],
      [2, 1]
    ]
  }
];

const oscillatorPatterns: Pattern[] = [
  {
    name: 'Blinker',
    description: 'The simplest oscillator; a line of 3 cells toggling vertically/horizontally.',
    category: 'oscillator' as PatternCategory,
    emoji: '💡',
    relativeCoords: [
      [-1, 0], [0, 0], [1, 0]
    ]
  },
  {
    name: 'Toad',
    description: 'Period 2 oscillator; 6 cells form a shifting pattern.',
    category: 'oscillator' as PatternCategory,
    emoji: '🐸',
    relativeCoords: [
      [0, 0], [0, 1], [0, 2],
      [1, -1], [1, 0], [1, 1]
    ]
  },
  {
    name: 'Beacon',
    description: 'Two 2x2 blocks that flash alternately.',
    category: 'oscillator' as PatternCategory,
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
    category: 'oscillator' as PatternCategory,
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
    category: 'oscillator' as PatternCategory,
    emoji: '🧬',
    relativeCoords: [
      [-4, 0], [-3, 0], [-2, -1], [-2, 1], [-1, 0], [0, 0], 
      [1, 0], [2, 0], [3, -1], [3, 1], [4, 0], [5, 0]
    ]
  }
];

const spaceshipPatterns: Pattern[] = [
  {
    name: 'Glider',
    description: 'The most iconic; a 5-cell pattern that moves diagonally.',
    category: 'spaceship' as PatternCategory,
    emoji: '🛸',
    relativeCoords: [
      /* Layout:
      .O.
      ..O
      OOO
      */
      [0, 1],           // top row
      [1, 2],           // middle row
      [2, 0], [2, 1], [2, 2]  // bottom row
    ]
  },
  {
    name: 'Lightweight Spaceship',
    description: 'Moves horizontally, small spaceship (LWSS).',
    category: 'spaceship' as PatternCategory,
    emoji: '✈️',
    relativeCoords: [
      /* Layout:
      O...O
      .....
      O....O
      .OOOO.
      */
      [0, 0], [0, 4],         // top row
      // empty second row
      [2, 0], [2, 5],         // third row
      [3, 1], [3, 2], [3, 3], [3, 4]  // bottom row
    ]
  },
  {
    name: 'Middleweight Spaceship',
    description: 'Similar to LWSS but larger (MWSS). Moves at c/2 speed.',
    category: 'spaceship' as PatternCategory,
    emoji: '🚀',
    relativeCoords: [
      /* Layout:
      ...OO.
      .O....
      O.....
      O....O
      OOOOO.
      */
      [3, 0], [4, 0],         // top row
      [1, 1],                 // second row
      [0, 2],                 // third row
      [0, 3], [5, 3],         // fourth row
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4]  // bottom row
    ]
  },
  {
    name: 'Heavyweight Spaceship',
    description: 'The largest common spaceship (HWSS). Moves at c/2 speed.',
    category: 'spaceship' as PatternCategory,
    emoji: '🚢',
    relativeCoords: [
      /* Layout:
      ...OOOO.
      .O.....O
      O.......
      O......O
      OOOOOO..
      */
      [3, 0], [4, 0], [5, 0], [6, 0],        // top row
      [1, 1], [7, 1],                        // second row
      [0, 2],                                // third row
      [0, 3], [7, 3],                        // fourth row
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4]  // bottom row
    ]
  }
];

// Gun Patterns
const gunPatterns: Pattern[] = [
  {
    name: 'Gosper Glider Gun',
    description: 'Period 30 pattern that emits gliders. The first gun ever discovered.',
    category: 'gun' as PatternCategory,
    emoji: '💣',
    relativeCoords: [
      /* Layout:
      ........................O...........
      ......................O.O...........
      ............OO......OO............OO
      ...........O...O....OO............OO
      OO........O.....O...OO..............
      OO........O...O.OO....O.O...........
      ..........O.....O.......O...........
      ...........O...O....................
      ............OO......................
      */
      // Left blocks
      [4, 0], [4, 1], [5, 0], [5, 1],
      
      // Right blocks
      [2, 34], [2, 35], [3, 34], [3, 35],
      
      // Left structure (queen bee)
      [2, 12], [2, 13],
      [3, 11], [3, 15],
      [4, 10], [4, 16],
      [5, 10], [5, 14], [5, 16],
      [6, 10], [6, 16],
      [7, 11], [7, 15],
      [8, 12], [8, 13],
      
      // Right structure (catalyst)
      [0, 24],
      [1, 22], [1, 24],
      [2, 20], [2, 21],
      [3, 20], [3, 21],
      
      // Center structures
      [2, 22], [2, 23],
      [3, 22], [3, 23],
      [4, 20], [4, 21], [4, 22],
      [5, 20], [5, 21], [5, 24],
      [6, 22], [6, 24]
    ]
  },
  {
    name: 'Simkin Glider Gun',
    description: 'Period 36 glider gun discovered in 2015.',
    category: 'gun' as PatternCategory,
    emoji: '🔧',
    relativeCoords: [
      /* Layout:
      OO.....OO.....................
      OO.....OO.....................
      .................................
      .......OO........................
      .......OO........................
      .................................
      .................................
      .................................
      .................................
      .................................
      .................OO.OO...........
      ................O.....O..........
      ................O......O.OO......
      ................OOO...O...O......
      ....................O...O.OO.....
      ...................OO.OO..........
      */
      // Upper left blocks
      [0, 0], [0, 1], [1, 0], [1, 1],
      
      // Upper right blocks
      [0, 7], [0, 8], [1, 7], [1, 8],
      
      // Middle blocks
      [3, 7], [3, 8], [4, 7], [4, 8],
      
      // Lower pattern - catalyst components
      [10, 17], [10, 18], [10, 19], [10, 20],
      [11, 16], [11, 22],
      [12, 16], [12, 23], [12, 24], [12, 25],
      [13, 16], [13, 17], [13, 18], [13, 23], [13, 25],
      [14, 22], [14, 23], [14, 24], [14, 26],
      [15, 21], [15, 22], [15, 23], [15, 24]
    ]
  },
  {
    name: 'P10 Glider Gun',
    description: 'Period 10 gun - more compact than the Gosper Gun.',
    category: 'gun' as PatternCategory,
    emoji: '🌀',
    relativeCoords: [
      /* Layout:
      .....OO.........
      .....OO.........
      .................
      .................
      .................
      .................
      .................
      .................
      .................
      .OO..............
      O..O.............
      O................
      .OOO.............
      ....O............
      .................
      .................
      .................
      .................
      .................
      .................
      .....OO.........
      .....OO.........
      */
      // Top pair of blocks
      [0, 5], [0, 6], [1, 5], [1, 6],
      
      // Middle catalyst
      [9, 1], [9, 2],
      [10, 0], [10, 3],
      [11, 0],
      [12, 1], [12, 2], [12, 3],
      [13, 4],
      
      // Bottom pair of blocks
      [20, 5], [20, 6], [21, 5], [21, 6]
    ]
  }
];

interface PatternsModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectPattern: (pattern: Pattern) => void;
  liveCellColor: string;
}

const PatternsModal: React.FC<PatternsModalProps> = ({
  visible,
  onClose,
  onSelectPattern,
  liveCellColor
}) => {
  const colorScheme = useColorScheme();
  
  // Category titles
  const categoryTitles: Record<PatternCategory, string> = {
    'still-life': '🧱 Still Lifes (Do not change over time)',
    'oscillator': '🔁 Oscillators (Repeat after a fixed number of steps)',
    'spaceship': '🚀 Spaceships (Move across the grid)',
    'gun': '💣 Guns (Emit gliders)'
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={[
          styles.modalContent,
          { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff' }
        ]}>
          <Text style={[
            styles.modalTitle,
            { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
          ]}>
            Game of Life Patterns
          </Text>
          
          <ScrollView 
            style={styles.patternsContainer} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            alwaysBounceVertical={false}
            overScrollMode="never"
          >
            {/* Debug text removed for clean production UI */}
            
            {/* Still Lifes Section */}
            <View style={styles.categorySection}>
              <Text style={[
                styles.categoryTitle,
                { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
              ]}>
                {categoryTitles['still-life']} ({stillLifePatterns.length})
              </Text>
              
              {stillLifePatterns.map((pattern) => (
                <TouchableOpacity
                  key={pattern.name}
                  style={[
                    styles.patternItem,
                    { backgroundColor: colorScheme === 'dark' ? '#333333' : '#f0f0f0' }
                  ]}
                  onPress={() => {
                    onSelectPattern(pattern);
                    onClose();
                  }}
                >
                  <View style={styles.patternContent}>
                    <View style={styles.previewContainer}>
                      <PatternPreview
                        pattern={pattern}
                        cellColor={liveCellColor}
                        gridColor={colorScheme === 'dark' ? '#222222' : '#e0e0e0'}
                        maxSize={80}
                        cellSize={10}
                      />
                    </View>
                    <View style={styles.patternInfo}>
                      <Text style={[
                        styles.patternName,
                        { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
                      ]}>
                        {pattern.emoji} {pattern.name}
                      </Text>
                      <Text style={[
                        styles.patternDescription,
                        { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }
                      ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {pattern.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Oscillators Section */}
            <View style={styles.categorySection}>
              <Text style={[
                styles.categoryTitle,
                { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
              ]}>
                {categoryTitles['oscillator']} ({oscillatorPatterns.length})
              </Text>
              
              {oscillatorPatterns.map((pattern) => (
                <TouchableOpacity
                  key={pattern.name}
                  style={[
                    styles.patternItem,
                    { backgroundColor: colorScheme === 'dark' ? '#333333' : '#f0f0f0' }
                  ]}
                  onPress={() => {
                    onSelectPattern(pattern);
                    onClose();
                  }}
                >
                  <View style={styles.patternContent}>
                    <View style={styles.previewContainer}>
                      <PatternPreview
                        pattern={pattern}
                        cellColor={liveCellColor}
                        gridColor={colorScheme === 'dark' ? '#222222' : '#e0e0e0'}
                        maxSize={80}
                        cellSize={10}
                      />
                    </View>
                    <View style={styles.patternInfo}>
                      <Text style={[
                        styles.patternName,
                        { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
                      ]}>
                        {pattern.emoji} {pattern.name}
                      </Text>
                      <Text style={[
                        styles.patternDescription,
                        { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }
                      ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {pattern.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Spaceships Section */}
            <View style={styles.categorySection}>
              <Text style={[
                styles.categoryTitle,
                { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
              ]}>
                {categoryTitles['spaceship']} ({spaceshipPatterns.length})
              </Text>
              
              {spaceshipPatterns.map((pattern) => (
                <TouchableOpacity
                  key={pattern.name}
                  style={[
                    styles.patternItem,
                    { backgroundColor: colorScheme === 'dark' ? '#333333' : '#f0f0f0' }
                  ]}
                  onPress={() => {
                    onSelectPattern(pattern);
                    onClose();
                  }}
                >
                  <View style={styles.patternContent}>
                    <View style={styles.previewContainer}>
                      <PatternPreview
                        pattern={pattern}
                        cellColor={liveCellColor}
                        gridColor={colorScheme === 'dark' ? '#222222' : '#e0e0e0'}
                        maxSize={80}
                        cellSize={10}
                      />
                    </View>
                    <View style={styles.patternInfo}>
                      <Text style={[
                        styles.patternName,
                        { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
                      ]}>
                        {pattern.emoji} {pattern.name}
                      </Text>
                      <Text style={[
                        styles.patternDescription,
                        { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }
                      ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {pattern.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Gun Patterns Section */}
            <View style={styles.categorySection}>
              <Text style={[
                styles.categoryTitle,
                { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
              ]}>
                {categoryTitles['gun']} ({gunPatterns.length})
              </Text>
              
              {gunPatterns.map((pattern) => (
                <TouchableOpacity
                  key={pattern.name}
                  style={[
                    styles.patternItem,
                    { backgroundColor: colorScheme === 'dark' ? '#333333' : '#f0f0f0' }
                  ]}
                  onPress={() => {
                    onSelectPattern(pattern);
                    onClose();
                  }}
                >
                  <View style={styles.patternContent}>
                    <View style={styles.previewContainer}>
                      <PatternPreview
                        pattern={pattern}
                        cellColor={liveCellColor}
                        gridColor={colorScheme === 'dark' ? '#222222' : '#e0e0e0'}
                        maxSize={80}
                        cellSize={10}
                      />
                    </View>
                    <View style={styles.patternInfo}>
                      <Text style={[
                        styles.patternName,
                        { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
                      ]}>
                        {pattern.emoji} {pattern.name}
                      </Text>
                      <Text style={[
                        styles.patternDescription,
                        { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }
                      ]}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {pattern.description}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          
          <Pressable
            style={[
              styles.closeButton,
              { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0' }
            ]}
            onPress={onClose}
          >
            <Text style={[
              styles.closeButtonText,
              { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
            ]}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    width: '100%',
    height: '100%',
  },
  modalContent: {
    width: '95%',
    height: '85%', 
    maxHeight: 700,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  patternsContainer: {
    flex: 1,
    marginBottom: 10,
  },
  scrollContent: {
    paddingBottom: 15,
  },
  categorySection: {
    marginBottom: 15,
    paddingBottom: 5,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
  },
  patternItem: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 100, 100, 0.2)',
  },
  patternContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  patternInfo: {
    flex: 1,
  },
  patternName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  patternDescription: {
    fontSize: 14,
  },
  closeButton: {
    borderRadius: 8,
    padding: 12,
    elevation: 2,
    marginTop: 5,
  },
  closeButtonText: {
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
  },
  fallbackText: {
    fontSize: 16,
    textAlign: 'center',
    padding: 20,
  },
  noPatternsText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 10,
  },
  debugContainer: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'red',
    borderRadius: 8,
    marginVertical: 10,
  },
  debugText: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  }
});

export default PatternsModal; 