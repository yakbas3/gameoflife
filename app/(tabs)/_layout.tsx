import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Pressable, Modal, View, Text, StyleSheet, ScrollView } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

// Default values for settings
const DEFAULT_SPEED = 100; // milliseconds per generation
const DEFAULT_LIVE_CELL_COLOR = '#00ff00'; // bright green

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
              <Text style={[styles.modalText, { color: colorScheme === 'dark' ? '#e0e0e0' : '#333333' }]}>
                Conway's Game of Life is a cellular automaton devised by mathematician John Conway in 1970.
                It is a zero-player game, meaning its evolution is determined by its initial state, with no further input needed.
              </Text>
              
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Rules
              </Text>
              <Text style={[styles.modalText, { color: colorScheme === 'dark' ? '#e0e0e0' : '#333333' }]}>
                1. Any live cell with fewer than two live neighbors dies (underpopulation).
                {'\n'}2. Any live cell with two or three live neighbors lives on.
                {'\n'}3. Any live cell with more than three live neighbors dies (overpopulation).
                {'\n'}4. Any dead cell with exactly three live neighbors becomes a live cell (reproduction).
              </Text>
              
              <Text style={[styles.sectionTitle, { color: colorScheme === 'dark' ? '#ffffff' : '#000000' }]}>
                Controls
              </Text>
              <Text style={[styles.modalText, { color: colorScheme === 'dark' ? '#e0e0e0' : '#333333' }]}>
                • <Text style={styles.boldText}>Play/Pause:</Text> Start or pause the simulation.
                {'\n'}• <Text style={styles.boldText}>Step:</Text> Advance one generation (only when paused).
                {'\n'}• <Text style={styles.boldText}>Random:</Text> Create a random pattern (only when paused).
                {'\n'}• <Text style={styles.boldText}>Clear:</Text> Remove all cells from the grid.
                {'\n'}• <Text style={styles.boldText}>Tap:</Text> Toggle cell state.
                {'\n'}• <Text style={styles.boldText}>Pan (two fingers):</Text> Move around the grid.
                {'\n'}• <Text style={styles.boldText}>Pinch:</Text> Zoom in and out.
              </Text>
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
    width: '85%',
    maxHeight: '80%',
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
    marginTop: 10,
    marginBottom: 5,
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
}); 