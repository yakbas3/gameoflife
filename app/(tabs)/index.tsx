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
import {
    StyleSheet,
    View,
    Text,
    SafeAreaView,
    Dimensions,
    LayoutChangeEvent,
    ScaledSize,
    Platform, // For potential platform-specific adjustments if needed later
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Import constants, types, and logic functions
import type { GridState, Coordinates } from '../../types/game';
import {
    createEmptyGrid,
    calculateNextGeneration,
    coordsToString,
} from '../../lib/gameLogic';

// Import Components
import MainGridView from '../../components/MainGridView';
import ControlPanel from '../../components/ControlPanel';

// --- Constants ---
const SIMULATION_INTERVAL_MS = 100;
const DEBUG = true; // Enable/disable verbose logging

// Define Cell Size in DPs (Density-Independent Pixels)
// This controls the visual size on screen regardless of density
const CELL_SIZE_DP = 25;

// Define Panning Sensitivity
const PAN_SENSITIVITY = 1.5;

// Define Throttle interval for drawing (milliseconds)
const DRAW_THROTTLE_MS = 50; // Adjust as needed for performance vs responsiveness

// Define bounds for logical coordinates
const MAX_COORD_VALUE = 1000000;
const MIN_COORD_VALUE = -1000000;

type DimensionsChangeEvent = {
    window: ScaledSize;
    screen: ScaledSize;
};

// --- Component ---
export default function GameScreen() {
    // --- State Variables ---
    const [liveCells, setLiveCells] = useState<GridState>(() => {
        // Initial Glider pattern for testing
        const initial = createEmptyGrid();
        initial.add(coordsToString(0, 1));
        initial.add(coordsToString(1, 2));
        initial.add(coordsToString(2, 0));
        initial.add(coordsToString(2, 1));
        initial.add(coordsToString(2, 2));
        return initial;
    });
    const [isRunning, setIsRunning] = useState<boolean>(false);
    const [generation, setGeneration] = useState<number>(0);
    const [debugMode, setDebugMode] = useState<boolean>(DEBUG);

    // --- Container Measurements (Layout in DPs) ---
    const [gridContainerMeasurements, setGridContainerMeasurements] = useState({
        x: 0, y: 0, width: 0, height: 0, measured: false
    });

    // --- Reanimated SharedValues (Logical Coordinates) ---
    const viewCenterCoords = useSharedValue<Coordinates>({ row: 0, col: 0 });

    // --- State for displaying info (Derived from state/shared values) ---
    const [displayCenter, setDisplayCenter] = useState(viewCenterCoords.value);
    const [displayLiveCellCount, setDisplayLiveCellCount] = useState(liveCells.size);

    // --- Refs ---
    const gridContainerRef = useRef<View>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivatedCellCoords = useRef<Coordinates | null>(null);
    const lastDrawExecutionTimeRef = useRef<number>(0);

    // Update display count when liveCells Set changes
    useEffect(() => {
        setDisplayLiveCellCount(liveCells.size);
    }, [liveCells]);

    // Reaction to update display state for view center when SharedValue changes
    useAnimatedReaction(
        () => viewCenterCoords.value, // Track the shared value
        (currentCenter, previousCenter) => {
            // Update JS state only if value actually changed
            if (currentCenter.row !== previousCenter?.row || currentCenter.col !== previousCenter?.col) {
                // Run state update on JS thread
                runOnJS(setDisplayCenter)(currentCenter);
            }
        },
        [viewCenterCoords] // Dependency array
    );

    // Measure grid container (gets absolute position X/Y and size W/H in DPs)
    const measureGridContainer = useCallback(() => {
        if (gridContainerRef.current) {
            gridContainerRef.current.measure((x, y, width, height, pageX, pageY) => {
                // Check for valid measurements (sometimes might be 0 initially)
                if (width > 0 && height > 0 && pageX !== undefined && pageY !== undefined) {
                    if (DEBUG) console.log(`Container Measured: Abs(X=${pageX.toFixed(1)}, Y=${pageY.toFixed(1)}), Size(W=${width.toFixed(1)}, H=${height.toFixed(1)}) [DPs]`);
                    setGridContainerMeasurements({ x: pageX, y: pageY, width: width, height: height, measured: true });
                } else {
                    if (DEBUG) console.warn(`Container measured with invalid dimensions: W=${width}, H=${height}, pageX=${pageX}, pageY=${pageY}. Retrying likely needed.`);
                    // Keep measured as false or reset if previously true
                    setGridContainerMeasurements(m => ({ ...m, width, height, x: pageX ?? m.x, y: pageY ?? m.y, measured: false }));
                }
            });
        } else if (DEBUG) {
            console.warn("measureGridContainer called but gridContainerRef is null.");
        }
    }, [DEBUG]); // Dependency on DEBUG for logging

    // Use onLayout for reliable measurement trigger after layout changes
    const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (DEBUG) console.log(`Container onLayout: W=${width.toFixed(1)}, H=${height.toFixed(1)} [DPs]`);
        // Always re-measure on layout changes
        measureGridContainer();
    }, [measureGridContainer, DEBUG]); // Dependency on measureGridContainer and DEBUG

    // Effect for Screen Dimension Changes (e.g., rotation)
    useEffect(() => {
        const handleDimensionChange = ({ window }: DimensionsChangeEvent) => {
            if (DEBUG) console.log(`Screen dimensions changed: W=${window.width}, H=${window.height} [DPs]. Re-measuring container via onLayout.`);
            // Reset measured state, onLayout will trigger re-measurement
            setGridContainerMeasurements(m => ({ ...m, measured: false }));
        };
        const subscription = Dimensions.addEventListener('change', handleDimensionChange);
        return () => {
            if (DEBUG) console.log("Removing dimension change listener.");
            subscription.remove();
        };
    }, [DEBUG]); // Dependency on DEBUG for logging

    // --- Simulation Logic Callbacks ---
    const runSimulationStep = useCallback(() => {
        try {
            setLiveCells(cells => calculateNextGeneration(cells));
            setGeneration(p => p + 1);
        } catch (error) {
            console.error("Error during simulation step:", error);
            // Optionally stop simulation on error
            setIsRunning(false);
        }
    }, []); // No external dependencies

    const handleToggleRun = useCallback(() => setIsRunning(prev => !prev), []);
    const handleStep = useCallback(() => { if (!isRunning) runSimulationStep(); }, [isRunning, runSimulationStep]);
    const handleClear = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsRunning(false);
        setLiveCells(createEmptyGrid());
        setGeneration(0);
        // Optionally reset view center
        // viewCenterCoords.value = { row: 0, col: 0 };
    }, [viewCenterCoords]); // Added viewCenterCoords if resetting view

    const handleRandomize = useCallback(() => {
        if (isRunning) return; // Prevent randomization while running
        try {
            const center = viewCenterCoords.value;
            const newCells = createEmptyGrid();
            const range = 30; // How far from center to randomize (logical units)
            const density = 0.2; // Probability of a cell being alive

            // Calculate bounds carefully, clamping to overall limits
            const startRow = Math.max(MIN_COORD_VALUE, Math.floor(center.row - range));
            const endRow = Math.min(MAX_COORD_VALUE, Math.ceil(center.row + range));
            const startCol = Math.max(MIN_COORD_VALUE, Math.floor(center.col - range));
            const endCol = Math.min(MAX_COORD_VALUE, Math.ceil(center.col + range));

             // Basic check to prevent excessively large loops if bounds are extreme
             if (endRow - startRow > 1000 || endCol - startCol > 1000) {
                  console.warn("Randomization range seems very large, limiting loop iterations.");
                  // Adjust bounds or skip if range is unreasonable
                  return;
             }

            for (let r = startRow; r < endRow; ++r) {
                for (let c = startCol; c < endCol; ++c) {
                    if (Math.random() < density) {
                        newCells.add(coordsToString(r, c));
                    }
                }
            }
            setLiveCells(newCells);
            setGeneration(0);
            if (DEBUG) console.log(`Randomized ${newCells.size} cells around [${center.row.toFixed(0)}, ${center.col.toFixed(0)}] within range ${range}`);
        } catch (error) {
            console.error("Error during randomization:", error);
        }
    }, [isRunning, viewCenterCoords, DEBUG]); // Dependencies

    const handleToggleDebug = useCallback(() => setDebugMode(prev => !prev), []);

    // --- Simulation Loop Effect ---
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (isRunning) {
            if (DEBUG) console.log(`Starting simulation interval (${SIMULATION_INTERVAL_MS}ms)`);
            intervalRef.current = setInterval(runSimulationStep, SIMULATION_INTERVAL_MS);
        } else {
            if (DEBUG) console.log("Simulation paused/stopped.");
        }
        // Cleanup function
        return () => {
            if (intervalRef.current) {
                if (DEBUG) console.log("Clearing simulation interval.");
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isRunning, runSimulationStep, DEBUG]); // Dependencies

    // --- Grid Update Logic (Draw Handler - Receives *Logical* Coords) ---
    const handleDraw = useCallback((targetRowInt: number, targetColInt: number) => {
        // This function runs on the JS thread
        try {
            // Double-check inputs received from UI thread (already checked there, but belt-and-suspenders)
            if (isNaN(targetRowInt) || isNaN(targetColInt) || !isFinite(targetRowInt) || !isFinite(targetColInt)) {
                if (DEBUG) console.error(`handleDraw (JS Thread) received invalid coords: [${targetRowInt}, ${targetColInt}]. Skipping.`);
                return;
            }
            // Re-clamping might be redundant if done correctly on UI thread, but safer
             const clampedRow = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, targetRowInt));
             const clampedCol = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, targetColInt));

             if (clampedRow !== targetRowInt || clampedCol !== targetColInt) {
                  if (DEBUG) console.warn(`handleDraw (JS Thread) clamped coords from [${targetRowInt}, ${targetColInt}] to [${clampedRow}, ${clampedCol}]`);
             }


            const coordsStr = coordsToString(clampedRow, clampedCol);

            // Update state immutably if the cell isn't already alive
            setLiveCells(currentCells => {
                if (currentCells.has(coordsStr)) {
                    return currentCells; // No change needed, return same Set instance
                }
                const newCells = new Set(currentCells); // Create a new Set
                newCells.add(coordsStr); // Add the new cell
                if (DEBUG) console.log(`handleDraw (JS Thread) adding cell: ${coordsStr}`);
                return newCells; // Return the new Set
            });
        } catch (error) {
            console.error("Error in handleDraw:", error);
        }
    }, [DEBUG]); // Dependency on DEBUG for logging

    // --- Gesture Definitions ---

    // --- Two-Finger Pan Gesture (for Navigation) ---
    const panGestureContext = useSharedValue({ startRow: 0, startCol: 0 });
    const viewPanGesture = Gesture.Pan()
        .minPointers(2)
        .maxPointers(2)
        .averageTouches(true) // Use average position of touches
        .onBegin(() => {
            // Store the starting center coordinates when pan begins
            panGestureContext.value = { startRow: viewCenterCoords.value.row, startCol: viewCenterCoords.value.col };
            if (DEBUG) console.log(`(2-Finger) Pan Begin: Start@ R=${panGestureContext.value.startRow.toFixed(2)}, C=${panGestureContext.value.startCol.toFixed(2)}`);
        })
        .onUpdate((event) => {
            // This runs on the UI thread
            try {
                // Calculate change in logical coords based on translation (DPs) and cell size (DPs)
                // Division by CELL_SIZE_DP converts pixel distance to logical distance
                const deltaCol = (event.translationX / CELL_SIZE_DP) * PAN_SENSITIVITY;
                const deltaRow = (event.translationY / CELL_SIZE_DP) * PAN_SENSITIVITY;

                // Calculate new center (subtract delta because panning moves the view opposite to finger motion)
                const newCol = panGestureContext.value.startCol - deltaCol;
                const newRow = panGestureContext.value.startRow - deltaRow;

                // Clamp coordinates to prevent extreme values
                const clampedCol = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, newCol));
                const clampedRow = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, newRow));

                // Basic check for NaN/Infinity before updating shared value
                if (!isFinite(clampedRow) || !isFinite(clampedCol)) {
                    if (DEBUG) console.error(`(2-Finger) Pan calculation resulted in invalid coords: Row=${clampedRow}, Col=${clampedCol}. Inputs: dX=${event.translationX}, dY=${event.translationY}`);
                    return; // Prevent updating shared value with invalid numbers
                }

                // Update shared value directly (efficient on UI thread)
                viewCenterCoords.value = { row: clampedRow, col: clampedCol };

            } catch (error) {
                // Log error but don't necessarily crash the app
                console.error("(2-Finger) Pan Update Error:", error);
                // Potentially reset context or take other recovery action if needed
            }
        })
        .onEnd(() => {
            if (DEBUG) console.log(`(2-Finger) Pan End: Final Center R=${viewCenterCoords.value.row.toFixed(2)}, C=${viewCenterCoords.value.col.toFixed(2)}`);
            // Reset context if necessary, though not strictly required here
            // panGestureContext.value = { startRow: 0, startCol: 0 };
        });

    // --- One-Finger Drag Gesture (for Drawing - Center Relative Calc) ---
    const drawPanGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onBegin(() => {
            // Reset tracking refs for the start of a new draw stroke
            lastActivatedCellCoords.current = null;
            lastDrawExecutionTimeRef.current = 0; // Allow immediate first draw
            if (DEBUG) console.log("(1-Finger) Draw Begin");
        })
        .onUpdate((event) => {
            // This runs on the UI thread
            try {
                // --- Measurement Check ---
                if (!gridContainerMeasurements.measured || gridContainerMeasurements.width <= 0 || gridContainerMeasurements.height <= 0) {
                    if (DEBUG) console.warn("Draw Update ignored: Container not measured or has zero size.");
                    return;
                }

                // --- Throttling ---
                const now = Date.now();
                if (now - lastDrawExecutionTimeRef.current < DRAW_THROTTLE_MS) {
                    return; // Skip if called too recently
                }
                // Update time *before* potential errors/returns
                lastDrawExecutionTimeRef.current = now;

                // --- Coordinate Calculation (Mapping Touch DPs to Logical Coords) ---
                // Get measurements (DPs) and current center (Logical)
                const { x: containerX, y: containerY, width: containerWidthDP, height: containerHeightDP } = gridContainerMeasurements;
                const center_row = viewCenterCoords.value.row;
                const center_col = viewCenterCoords.value.col;

                // Touch position (Absolute DPs)
                const screenX_DP = event.absoluteX;
                const screenY_DP = event.absoluteY;

                // 1. Calculate tap position relative to container center (in DPs)
                const containerCenterX_DP = containerX + containerWidthDP / 2;
                const containerCenterY_DP = containerY + containerHeightDP / 2;
                const tapRelCenterX_DP = screenX_DP - containerCenterX_DP;
                const tapRelCenterY_DP = screenY_DP - containerCenterY_DP;

                // 2. Convert DP offset from center to Logical offset using CELL_SIZE_DP
                // Check CELL_SIZE_DP to prevent division by zero
                if (CELL_SIZE_DP <= 0) {
                     if (DEBUG) console.error("CELL_SIZE_DP is zero or negative, cannot calculate draw coordinates.");
                     return;
                }
                const colOffset = tapRelCenterX_DP / CELL_SIZE_DP;
                const rowOffset = tapRelCenterY_DP / CELL_SIZE_DP;

                // 3. Add logical offset to logical center coordinate
                const targetCol = center_col + colOffset;
                const targetRow = center_row + rowOffset;

                // 4. Floor to get integer logical cell coordinates
                const targetColInt = Math.floor(targetCol);
                const targetRowInt = Math.floor(targetRow);

                // --- Sanity Check & Clamping (Crucial before runOnJS) ---
                if (isNaN(targetRowInt) || isNaN(targetColInt) || !isFinite(targetRowInt) || !isFinite(targetColInt)) {
                    if (DEBUG) console.error(`Draw calc invalid number: [${targetRowInt}, ${targetColInt}]. Inputs: screenDP(${screenX_DP},${screenY_DP}), center(${center_row},${center_col}), container(${containerX},${containerY},${containerWidthDP},${containerHeightDP})`);
                    return; // Do not proceed with invalid coordinates
                }

                // Clamp to defined logical bounds
                const clampedRowInt = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, targetRowInt));
                const clampedColInt = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, targetColInt));

                if ((clampedRowInt !== targetRowInt || clampedColInt !== targetColInt) && DEBUG) {
                     console.warn(`Draw coordinate clamped from [${targetRowInt}, ${targetColInt}] to [${clampedRowInt}, ${clampedColInt}]`);
                }

                // Current target cell coordinates object (using clamped values)
                const currentCellCoords: Coordinates = { row: clampedRowInt, col: clampedColInt };

                if (DEBUG) {
                    // Log throttled update details
                    // console.log(`Draw Throttled Update: TgtInt(${clampedRowInt},${clampedColInt}), TgtFloat(${targetRow.toFixed(2)},${targetCol.toFixed(2)})`);
                }

                // --- Activate cell only if it's different from the last one ---
                if (currentCellCoords.row !== lastActivatedCellCoords.current?.row ||
                    currentCellCoords.col !== lastActivatedCellCoords.current?.col)
                {
                    lastActivatedCellCoords.current = currentCellCoords; // Store the *clamped* coords

                    // *** Pass the validated and clamped *integer logical coordinates* to the JS thread ***
                    runOnJS(handleDraw)(clampedRowInt, clampedColInt);
                }

            } catch (error) {
                console.error("(1-Finger) Draw Update Error:", error);
                // Log context if possible
                if (DEBUG) {
                    console.log("Error occurred with inputs:", {
                        absoluteX: event.absoluteX,
                        absoluteY: event.absoluteY,
                        container: gridContainerMeasurements,
                        center: viewCenterCoords.value,
                    });
                }
                // Reset last activated to prevent potential stuck state?
                lastActivatedCellCoords.current = null;
            }
        })
        .onEnd(() => {
            // Reset ref on gesture end
            lastActivatedCellCoords.current = null;
            if (DEBUG) console.log("(1-Finger) Draw End");
        });

    // Combine Gestures: Pan to draw (1 finger) XOR Pan to navigate (2 fingers)
    const composedGesture = Gesture.Exclusive(drawPanGesture, viewPanGesture);

    // --- Render ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Status Display Area */}
                <View style={styles.statusContainer}>
                    <Text style={styles.statusText}>Gen: {generation}</Text>
                    <Text style={styles.statusText}>{isRunning ? 'Running' : 'Paused'}</Text>
                    <Text style={styles.statusText}>Live: {displayLiveCellCount}</Text>
                    <Text style={styles.statusText}>
                        Center: R:{displayCenter.row.toFixed(1)} C:{displayCenter.col.toFixed(1)}
                    </Text>
                    {/* Show container size in DPs when measured */}
                    {debugMode && gridContainerMeasurements.measured && (
                        <Text style={styles.statusText}>
                            ContDP: W:{gridContainerMeasurements.width.toFixed(0)} H:{gridContainerMeasurements.height.toFixed(0)}
                        </Text>
                    )}
                </View>

                {/* Main Grid Rendering Area */}
                <View
                    ref={gridContainerRef}
                    style={styles.gridContainer}
                    onLayout={handleContainerLayout} // Attach layout handler to trigger measurement
                >
                    <GestureDetector gesture={composedGesture}>
                        {/* Wrapper View needed for GestureDetector to work correctly with GLView */}
                        <View style={styles.gestureDetectorWrapper}>
                            {gridContainerMeasurements.measured ? (
                                <MainGridView
                                    liveCells={liveCells}
                                    viewCenterCoords={viewCenterCoords} // Pass the SharedValue object
                                    cellSizeDP={CELL_SIZE_DP} // Pass cell size in DPs
                                />
                            ) : (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.loadingText}>Measuring Viewport...</Text>
                                </View>
                            )}
                        </View>
                    </GestureDetector>
                </View>

                {/* Control Panel */}
                <ControlPanel
                    isRunning={isRunning}
                    onToggleRun={handleToggleRun}
                    onStep={handleStep}
                    onClear={handleClear}
                    onRandomize={handleRandomize}
                    onToggleDebug={handleToggleDebug}
                    debugMode={debugMode}
                />

                <StatusBar style="auto" />
            </View>
        </SafeAreaView>
    );
}

// --- Styles --- (Mostly unchanged, ensure SpaceMono font is available)
const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f0f0f0' },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 10,
        gap: 10,
        backgroundColor: '#f8f8f8',
    },
    statusContainer: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 5,
        backgroundColor: '#e9e9e9',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#dcdcdc'
    },
    statusText: {
        fontSize: 11,
        marginHorizontal: 4,
        color: '#333',
        // Ensure you have this font linked or change it
        fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', // More common fallback
    },
    gridContainer: {
        flex: 1,
        width: '100%',
        backgroundColor: 'rgb(13, 13, 13)', // Dark background for GLView
        overflow: 'hidden', // Important for GLView
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#555'
    },
    gestureDetectorWrapper: {
        flex: 1, // Make the wrapper fill the grid container
        backgroundColor: 'transparent', // Ensure it doesn't obscure the GLView
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#aaa',
        fontSize: 16,
         fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    },
});