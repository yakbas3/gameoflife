import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Pressable, Modal, View, Text, StyleSheet, ScrollView, Image, Linking } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import type { ComponentProps } from 'react';

// Import for the rule examples with grid visualization
import { Pattern, PatternCategory } from '@/lib/patterns';
import PatternPreview from '@/components/PatternPreview';

// Default values for settings
const DEFAULT_SPEED = 100; // milliseconds per generation
const DEFAULT_LIVE_CELL_COLOR = '#00ff00'; // bright green

// Define type for FontAwesome icon names
type FontAwesomeIconName = ComponentProps<typeof FontAwesome>['name'];

// Define type for rule examples
interface RuleExampleType {
  name: string;
  description: string;
  emoji: string;
  relativeCoords: number[][];
  nextGeneration: number[][];
}

// Define type for control examples
interface ControlExampleType {
  name: string;
  description: string;
  icon: FontAwesomeIconName;
  color?: string; // Optional color for the icon
}

// Define rule example patterns
const ruleExamples: Record<string, RuleExampleType> = {
  underpopulation: {
    name: 'Underpopulation',
    description: 'Cells with fewer than 2 neighbors die',
    emoji: '💀',
    relativeCoords: [
      [0, 0], // Center cell will die
      [1, 0]  // Only one neighbor
    ],
    nextGeneration: [] // All cells die
  },
  survival: {
    name: 'Survival',
    description: 'Cells with 2-3 neighbors survive',
    emoji: '✅',
    relativeCoords: [
      [0, 0], // Center cell survives
      [-1, 0], [1, 0], // 2 neighbors
    ],
    nextGeneration: [
      [0, 0], [-1, 0], [1, 0] // All cells survive
    ]
  },
  overpopulation: {
    name: 'Overpopulation',
    description: 'Cells with more than 3 neighbors die',
    emoji: '🧟',
    relativeCoords: [
      [0, 0], // Center cell will die
      [-1, -1], [-1, 0], [-1, 1], 
      [0, -1], [0, 1] // 5 neighbors (too many)
    ],
    nextGeneration: [
      [-1, -1], [-1, 0], [-1, 1], 
      [0, -1], [0, 1] // Center cell dies
    ]
  },
  reproduction: {
    name: 'Reproduction',
    description: 'Dead cells with exactly 3 neighbors become alive',
    emoji: '🌱',
    relativeCoords: [
      [-1, 0], [0, -1], [0, 1] // 3 neighbors around empty center
    ],
    nextGeneration: [
      [-1, 0], [0, -1], [0, 1],
      [0, 0] // Center cell becomes alive
    ]
  }
};

// Conway's Wikipedia URL
const CONWAY_WIKI_URL = 'https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life';
// Conway's image URL (from Princeton University)
const CONWAY_IMAGE_URL = 'https://www.princeton.edu/sites/default/files/styles/scale_1440/public/images/2020/04/20090310_ConwayKochen_DJA_066-copy.jpg?itok=BbmXyoCQ';

// Define control examples with visual representation
const controlExamples: ControlExampleType[] = [
  {
    name: 'Tap Cell',
    description: 'Toggle cell state by tapping on a cell',
    icon: 'hand-pointer-o',
    color: '#FF9500'
  },
  {
    name: 'Pan Grid',
    description: 'Move around the grid with two fingers',
    icon: 'arrows',
    color: '#5AC8FA'
  },
  {
    name: 'Pinch Zoom',
    description: 'Zoom in and out of the grid',
    icon: 'search-plus',
    color: '#4CD964'
  },
  {
    name: 'Play/Pause',
    description: 'Start or pause the simulation',
    icon: 'play-circle',
    color: '#007AFF'
  },
  {
    name: 'Step',
    description: 'Advance one generation when paused',
    icon: 'step-forward',
    color: '#5856D6'
  },
  {
    name: 'Random',
    description: 'Create a random pattern of cells',
    icon: 'random',
    color: '#FF2D55'
  },
  {
    name: 'Clear',
    description: 'Remove all cells from the grid',
    icon: 'trash',
    color: '#FF3B30'
  }
];

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  
  // Settings state
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [liveCellColor, setLiveCellColor] = useState(DEFAULT_LIVE_CELL_COLOR);
  
  // Apply settings and update route params
  const applySettings = () => {
    // Update the route with new parameters
    router.setParams({ 
      speed: speed.toString(),
      liveCellColor 
    });
    
    // Close the modal
    setSettingsModalVisible(false);
  };
  
  const InfoButton = () => (
    <Pressable
      onPress={() => setInfoModalVisible(true)}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && { opacity: 0.7 }
      ]}
    >
      <FontAwesome
        name="info-circle"
        size={22}
        color={colorScheme === 'dark' ? '#ffffff' : '#000000'}
      />
    </Pressable>
  );
  
  const SettingsButton = () => (
    <Pressable
      onPress={() => setSettingsModalVisible(true)}
      style={({ pressed }) => [
        styles.headerButton,
        pressed && { opacity: 0.7 }
      ]}
    >
      <FontAwesome
        name="cog"
        size={22}
        color={colorScheme === 'dark' ? '#ffffff' : '#000000'}
      />
    </Pressable>
  );
  
  // Color options
  const colorOptions = [
    { label: 'Green', value: '#00ff00' },
    { label: 'Blue', value: '#0088ff' },
    { label: 'Red', value: '#ff3333' },
    { label: 'Yellow', value: '#ffcc00' },
    { label: 'Purple', value: '#aa44ff' },
    { label: 'Cyan', value: '#00cccc' },
    { label: 'White', value: '#ffffff' },
  ];

  // Component for rule examples
  const RuleExample = ({ example, exampleName }: { example: RuleExampleType; exampleName: string }) => {
    const initialPattern: Pattern = {
      name: example.name,
      description: example.description,
      category: 'still-life' as PatternCategory, // Use a valid category
      emoji: example.emoji,
      relativeCoords: example.relativeCoords
    };

    const nextPattern: Pattern = {
      name: `${example.name} (Next)`,
      description: 'After one generation',
      category: 'still-life' as PatternCategory, // Use a valid category
      emoji: '➡️',
      relativeCoords: example.nextGeneration
    };

    return (
      <View style={styles.ruleExampleContainer}>
        <View style={styles.ruleExampleContent}>
          <View style={styles.ruleExampleGrids}>
            <View style={styles.exampleGrid}>
              <PatternPreview
                pattern={initialPattern}
                cellColor={liveCellColor}
                gridColor={colorScheme === 'dark' ? '#222222' : '#e0e0e0'}
                maxSize={80}
                cellSize={12}
              />
              <Text style={[styles.exampleLabel, { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }]}>
                Initial State
              </Text>
            </View>
            
            <FontAwesome
              name="arrow-right"
              size={20}
              color={colorScheme === 'dark' ? '#ffffff' : '#000000'}
              style={styles.arrowIcon}
            />
            
            <View style={styles.exampleGrid}>
              <PatternPreview
                pattern={nextPattern}
                cellColor={liveCellColor}
                gridColor={colorScheme === 'dark' ? '#222222' : '#e0e0e0'}
                maxSize={80}
                cellSize={12}
              />
              <Text style={[styles.exampleLabel, { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }]}>
                Next Generation
              </Text>
            </View>
          </View>
          
          <View style={styles.ruleExampleInfo}>
            <Text style={[
              styles.ruleExampleTitle,
              { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
            ]}>
              {example.emoji} {example.name}
            </Text>
            <Text style={[
              styles.ruleExampleDescription,
              { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }
            ]}>
              {example.description}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Component for control examples
  const ControlExample = ({ control }: { control: ControlExampleType }) => {
    return (
      <View style={[
        styles.controlExampleContainer,
        { backgroundColor: colorScheme === 'dark' ? '#333333' : '#f0f0f0' }
      ]}>
        <View style={styles.controlIconContainer}>
          <FontAwesome
            name={control.icon}
            size={28}
            color={control.color || (colorScheme === 'dark' ? liveCellColor : '#333333')}
            style={styles.controlIcon}
          />
        </View>
        <View style={styles.controlInfo}>
          <Text style={[
            styles.controlName,
            { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }
          ]}>
            {control.name}
          </Text>
          <Text style={[
            styles.controlDescription,
            { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }
          ]}>
            {control.description}
          </Text>
        </View>
      </View>
    );
  };
  
  return (
    <>
      <Stack>
        <Stack.Screen 
          name="index" 
          options={{
            title: "Conway's Game of Life",
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            // Use different colors based on theme
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#f8f9fa',
            },
            headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
            // Add the info button to the left of the header
            headerLeft: () => <InfoButton />,
            // Add the settings button to the right of the header
            headerRight: () => <SettingsButton />
          }}
          initialParams={{ 
            speed: speed, 
            liveCellColor: liveCellColor 
          }}
        />
      </Stack>
      
      {/* Info Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={infoModalVisible}
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff' }
          ]}>
            <ScrollView style={styles.scrollView}>
              <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Conway's Game of Life
              </Text>
              
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                About
              </Text>
              <View style={styles.aboutSection}>
                <View style={styles.conwayImageContainer}>
                  <Image 
                    source={{ uri: CONWAY_IMAGE_URL }} 
                    style={styles.conwayImage}
                    resizeMode="cover"
                  />
                  <Text style={[styles.imageCaption, { color: colorScheme === 'dark' ? '#bbbbbb' : '#666666' }]}>
                    John Conway (1937-2020)
                  </Text>
                </View>
                <Text style={[styles.modalText, { color: colorScheme === 'dark' ? '#e0e0e0' : '#333333' }]}>
                  Conway's Game of Life is a cellular automaton devised by British mathematician John Horton Conway in 1970.
                  It is a zero-player game, meaning its evolution is determined by its initial state, with no further input needed.
                </Text>
                <Pressable 
                  onPress={() => Linking.openURL(CONWAY_WIKI_URL)}
                  style={styles.wikiLink}
                >
                  <Text style={styles.wikiLinkText}>
                    <FontAwesome name="wikipedia-w" size={14} /> Learn more on Wikipedia
                  </Text>
                </Pressable>
              </View>
              
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Rules
              </Text>
              
              {/* Visual Rule Examples */}
              <RuleExample example={ruleExamples.underpopulation} exampleName="underpopulation" />
              <RuleExample example={ruleExamples.survival} exampleName="survival" />
              <RuleExample example={ruleExamples.overpopulation} exampleName="overpopulation" />
              <RuleExample example={ruleExamples.reproduction} exampleName="reproduction" />
              
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Controls
              </Text>
              
              {/* Visual Control Examples */}
              <View style={styles.controlsContainer}>
                {controlExamples.map((control, index) => (
                  <ControlExample key={index} control={control} />
                ))}
              </View>
            </ScrollView>
            
            <Pressable
              style={[
                styles.closeButton,
                { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0' }
              ]}
              onPress={() => setInfoModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      
      {/* Settings Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={settingsModalVisible}
        onRequestClose={() => setSettingsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalContent,
            { backgroundColor: colorScheme === 'dark' ? '#1c1c1c' : '#ffffff' }
          ]}>
            <ScrollView style={styles.scrollView}>
              <Text style={[styles.modalTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Settings
              </Text>
              
              {/* Speed Setting */}
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Simulation Speed
              </Text>
              <View style={styles.sliderContainer}>
                <Text style={[styles.sliderLabel, { color: colorScheme === 'dark' ? '#e0e0e0' : '#333333' }]}>
                  Slow
                </Text>
                <Slider
                  style={styles.slider}
                  minimumValue={50}
                  maximumValue={500}
                  step={10}
                  value={speed}
                  onValueChange={setSpeed}
                  minimumTrackTintColor={colorScheme === 'dark' ? '#4CAF50' : '#4CAF50'}
                  maximumTrackTintColor={colorScheme === 'dark' ? '#555' : '#ccc'}
                  thumbTintColor={colorScheme === 'dark' ? '#8BC34A' : '#8BC34A'}
                  inverted={true}
                />
                <Text style={[styles.sliderLabel, { color: colorScheme === 'dark' ? '#e0e0e0' : '#333333' }]}>
                  Fast
                </Text>
              </View>
              <Text style={[styles.settingValue, { color: colorScheme === 'dark' ? '#e0e0e0' : '#333333' }]}>
                {speed}ms per generation
              </Text>
              
              {/* Live Cell Color Setting */}
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Live Cell Color
              </Text>
              <View style={styles.colorOptionsContainer}>
                {colorOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.colorOption,
                      { backgroundColor: option.value },
                      liveCellColor === option.value && styles.selectedColorOption
                    ]}
                    onPress={() => setLiveCellColor(option.value)}
                  />
                ))}
              </View>
            </ScrollView>
            
            <Pressable
              style={[
                styles.closeButton,
                { backgroundColor: colorScheme === 'dark' ? '#333' : '#f0f0f0' }
              ]}
              onPress={applySettings}
            >
              <Text style={[styles.closeButtonText, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Apply Settings
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerButton: {
    padding: 8,
    marginHorizontal: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollView: {
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    paddingBottom: 5,
  },
  modalText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  boldText: {
    fontWeight: 'bold',
  },
  closeButton: {
    borderRadius: 8,
    padding: 10,
    elevation: 2,
    marginTop: 5,
  },
  closeButtonText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Rule example styles
  ruleExampleContainer: {
    marginBottom: 12,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 100, 100, 0.2)',
  },
  ruleExampleContent: {
    flexDirection: 'column',
  },
  ruleExampleGrids: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  exampleGrid: {
    alignItems: 'center',
    width: 80,
  },
  arrowIcon: {
    marginHorizontal: 10,
  },
  exampleLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  ruleExampleInfo: {
    marginTop: 4,
  },
  ruleExampleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ruleExampleDescription: {
    fontSize: 14,
  },
  // Control example styles
  controlsContainer: {
    marginTop: 5,
  },
  controlExampleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(100, 100, 100, 0.2)',
  },
  controlIconContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(100, 100, 100, 0.3)',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  controlIcon: {
    // No marginBottom needed now
  },
  controlInfo: {
    flex: 1,
  },
  controlName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  controlDescription: {
    fontSize: 14,
  },
  // Existing settings modal styles
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  slider: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
  },
  sliderLabel: {
    fontSize: 12,
    width: 40,
    textAlign: 'center',
  },
  settingValue: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  colorOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 10,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
    borderColor: '#aaa',
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
    elevation: 5,
  },
  // About section styles
  aboutSection: {
    marginBottom: 15,
  },
  conwayImageContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  conwayImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 5,
    borderWidth: 2,
    borderColor: '#555',
  },
  imageCaption: {
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  wikiLink: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#0366d6',
    borderRadius: 5,
    alignSelf: 'center',
  },
  wikiLinkText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
}); 