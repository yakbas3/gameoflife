// GameOfLifeApp/app/(tabs)/index.tsx

// Import Gesture Handler and Reanimated first
import 'react-native-gesture-handler';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Import constants, types, and logic functions
import { GRID_ROWS, GRID_COLS } from '../../constants/game';
import type { GridState, Offset } from '../../types/game';
import { createEmptyGrid, calculateNextGeneration } from '../../lib/gameLogic';

// Import Components
import MainGridView from '../../components/MainGridView';
import ControlPanel from '../../components/ControlPanel';

const SIMULATION_INTERVAL_MS = 200;

// --- Constants for Gestures ---
const MIN_ZOOM = 0.2; // Min zoom factor
const MAX_ZOOM = 5.0;  // Max zoom factor

export default function GameScreen() {
  // --- State Variables ---
  const [grid, setGrid] = useState<GridState>(() => {
    // Initialize with a pattern (Blinker + Block)
    const initialGrid = createEmptyGrid(GRID_ROWS, GRID_COLS);
    initialGrid[5][5] = 1; initialGrid[5][6] = 1; initialGrid[5][7] = 1; // Blinker
    initialGrid[10][10] = 1; initialGrid[10][11] = 1; initialGrid[11][10] = 1; initialGrid[11][11] = 1; // Block
    return initialGrid;
  });
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [generation, setGeneration] = useState<number>(0);

  // --- Reanimated SharedValues for smooth gesture updates ---
  const zoom = useSharedValue(1.0);
  const offset = useSharedValue({ x: 0, y: 0 }); // Pixel offset of grid origin

  // --- State for displaying shared values in React UI ---
  const [displayZoom, setDisplayZoom] = useState(zoom.value);
  const [displayOffset, setDisplayOffset] = useState(offset.value);

  // Use an animated reaction to update the display state without blocking UI thread
  useAnimatedReaction(
    () => ({ z: zoom.value, ox: offset.value.x, oy: offset.value.y }), // Object of values to track
    (result, previousResult) => {
      // This callback runs on the UI thread when tracked values change
      // Use runOnJS to safely update React state from the UI thread
      if (result.z !== previousResult?.z) {
        runOnJS(setDisplayZoom)(result.z);
      }
      if (result.ox !== previousResult?.ox || result.oy !== previousResult?.oy) {
        runOnJS(setDisplayOffset)({ x: result.ox, y: result.oy });
      }
    },
    [zoom, offset] // Dependencies for setting up the reaction
  );


  // Ref for simulation interval timer
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Simulation Logic Callbacks ---
  const runSimulationStep = useCallback(() => {
      setGrid((prevGrid) => {
          const nextGrid = calculateNextGeneration(prevGrid);
          setGeneration((prevGen) => prevGen + 1);
          return nextGrid;
      });
  }, []);

  const handleToggleRun = useCallback(() => { setIsRunning(prev => !prev); }, []);

  const handleStep = useCallback(() => { if (!isRunning) runSimulationStep(); }, [isRunning, runSimulationStep]);

  const handleClear = useCallback(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null; // Clear ref too
      setIsRunning(false);
      setGrid(createEmptyGrid(GRID_ROWS, GRID_COLS));
      setGeneration(0);
      // Optional: Reset view on clear
      // offset.value = { x: 0, y: 0 };
      // zoom.value = 1.0;
   }, []);

  const handleRandomize = useCallback(() => {
      if (isRunning) return;
      const newGrid = createEmptyGrid(GRID_ROWS, GRID_COLS);
      for(let r=0; r<GRID_ROWS; ++r) for(let c=0; c<GRID_COLS; ++c) newGrid[r][c] = Math.random() < 0.3 ? 1 : 0;
      setGrid(newGrid);
      setGeneration(0);
  }, [isRunning]);

  // --- Simulation Loop Effect ---
  useEffect(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      if (isRunning) {
          intervalRef.current = setInterval(runSimulationStep, SIMULATION_INTERVAL_MS);
      }
      return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, runSimulationStep]);


  // --- Gesture Definitions ---
  // Context object to store starting values during gestures
  const gestureContext = useSharedValue({ startX: 0, startY: 0, startZoom: 1 });

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      // Store the offset at the moment panning starts
      gestureContext.value = { ...gestureContext.value, startX: offset.value.x, startY: offset.value.y };
    })
    .onUpdate((event) => {
      // Update the current offset based on starting offset + translation
      offset.value = {
        x: gestureContext.value.startX + event.translationX,
        y: gestureContext.value.startY + event.translationY,
      };
    });

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      // Store the zoom level at the moment pinching starts
      gestureContext.value = { ...gestureContext.value, startZoom: zoom.value };
    })
    .onUpdate((event) => {
      // Calculate new zoom, clamping between MIN/MAX values
      zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, gestureContext.value.startZoom * event.scale));
      // Advanced: Adjust offset based on event.focalX/Y to zoom around pinch center
    });

  // Combine pan and pinch to run simultaneously
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);


  // --- Render ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Status Display Area */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Generation: {generation}</Text>
          <Text style={styles.statusText}>Status: {isRunning ? 'Running' : 'Paused'}</Text>
          {/* Display values from React state updated via reaction */}
          <Text style={styles.statusText}>Zoom: {displayZoom.toFixed(2)}</Text>
          <Text style={styles.statusText}>Offset: X:{displayOffset.x.toFixed(0)} Y:{displayOffset.y.toFixed(0)}</Text>
        </View>

        {/* Main Grid Rendering Area - Wrapped with GestureDetector */}
        <View style={styles.gridContainer}>
          <GestureDetector gesture={composedGesture}>
             {/* Pass grid state and SharedValues for offset/zoom to the GL component */}
             <MainGridView grid={grid} offset={offset} zoom={zoom} />
          </GestureDetector>
        </View>

        {/* Placeholder for Minimap */}
         <View style={styles.minimapPlaceholder}>
            <Text>Minimap Area</Text>
        </View>

         {/* Control Panel */}
         <ControlPanel
            isRunning={isRunning}
            onToggleRun={handleToggleRun}
            onStep={handleStep}
            onClear={handleClear}
            onRandomize={handleRandomize}
         />

        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f0f0' },
    container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', padding: 10, gap: 10 },
    statusContainer: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingVertical: 8, paddingHorizontal: 5, backgroundColor: '#e0e0e0', borderRadius: 5, borderWidth: 1, borderColor: '#ccc' },
    statusText: { fontSize: 12, marginHorizontal: 5, color: '#333' },
    gridContainer: { flex: 1, width: '100%', borderWidth: 1, borderColor: '#cccccc', backgroundColor: '#1a1a1a', overflow: 'hidden' },
    minimapPlaceholder: { position: 'absolute', bottom: 95, right: 15, width: 80, height: 80, backgroundColor: 'rgba(200, 200, 200, 0.8)', borderWidth: 1, borderColor: '#999999', borderRadius: 4, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
});