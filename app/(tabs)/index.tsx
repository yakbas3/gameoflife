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
    Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// Import constants, types, and logic functions
import type { GridState, Coordinates } from '../../types/game'; // Adjust path if needed
import {
    createEmptyGrid,
    calculateNextGeneration,
    coordsToString,
} from '../../lib/gameLogic'; // Adjust path if needed

// Import Components
import MainGridView from '../../components/MainGridView'; // Adjust path if needed
import ControlPanel from '../../components/ControlPanel'; // Adjust path if needed

// --- Constants ---
const SIMULATION_INTERVAL_MS = 100;
const DEBUG = true; // Ensure this is true for logging

// --- Dynamic View Constants ---
const INITIAL_CELL_SIZE_DP = 25;
const MIN_CELL_SIZE_DP = 5;     // Minimum visual size for cells in DPs
const MAX_CELL_SIZE_DP = 100;   // Maximum visual size for cells in DPs
const PAN_SENSITIVITY = 1.5;    // How fast panning feels
const DRAW_THROTTLE_MS = 30;    // Throttle draw updates (lower = more responsive, higher = less JS load)
const MAX_COORD_VALUE = 1000000;// Logical coordinate limits
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

    // --- Reanimated SharedValues ---
    // Logical center of the view
    const viewCenterCoords = useSharedValue<Coordinates>({ row: 0, col: 0 });
    // Current cell size in DPs (controls zoom)
    const cellSizeDP = useSharedValue<number>(INITIAL_CELL_SIZE_DP);

    // --- State for displaying info ---
    const [displayCenter, setDisplayCenter] = useState(viewCenterCoords.value);
    const [displayCellSize, setDisplayCellSize] = useState(cellSizeDP.value);
    const [displayLiveCellCount, setDisplayLiveCellCount] = useState(liveCells.size);

    // --- Refs ---
    const gridContainerRef = useRef<View>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivatedCellCoords = useRef<Coordinates | null>(null);
    const lastDrawExecutionTimeRef = useRef<number>(0);

    // --- Reactions to update Display State from Shared Values ---
    useEffect(() => {
        setDisplayLiveCellCount(liveCells.size);
    }, [liveCells]);

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

    useAnimatedReaction(
        () => cellSizeDP.value, // Track the shared value
        (currentSize, previousSize) => {
             // Update JS state only if value actually changed
            if (currentSize !== previousSize) {
                 // Run state update on JS thread
                runOnJS(setDisplayCellSize)(currentSize);
            }
        },
        [cellSizeDP] // Dependency array
    );

    // --- Measurement Logic ---
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

    const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
        const { width, height } = event.nativeEvent.layout;
        if (DEBUG) console.log(`Container onLayout: W=${width.toFixed(1)}, H=${height.toFixed(1)} [DPs]`);
        // Always re-measure on layout changes
        measureGridContainer();
    }, [measureGridContainer, DEBUG]); // Dependency on measureGridContainer and DEBUG

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
        if(DEBUG) console.log(">>> runSimulationStep: Called"); // <-- Log 1
        try {
             setLiveCells(cells => {
                  if(DEBUG) console.log(`>>> runSimulationStep: Calculating next gen from ${cells.size} cells`); // <-- Log 2
                  const nextCells = calculateNextGeneration(cells);
                  if(DEBUG) console.log(`>>> runSimulationStep: Next gen has ${nextCells.size} cells`); // <-- Log 3
                   // **Crucial Check:** Did the state actually change?
                   if (nextCells.size === cells.size) {
                       let same = true;
                       if (nextCells.size > 0) { // Avoid iterating empty sets unnecessarily
                            for (const cell of cells) { if (!nextCells.has(cell)) { same = false; break; } }
                            if (same) { for (const cell of nextCells) { if (!cells.has(cell)) { same = false; break; } } }
                       }
                       if (same && DEBUG) console.log(">>> runSimulationStep: Calculated next generation is identical to the current one.");
                   }
                  return nextCells;
             });
             setGeneration(p => {
                  const nextGen = p + 1;
                  if(DEBUG) console.log(`>>> runSimulationStep: Incrementing generation to ${nextGen}`); // <-- Log 4
                  return nextGen;
             });
         } catch (error) {
             console.error(">>> runSimulationStep: Error during simulation step:", error); // <-- Log 5
             // Stop simulation on error to prevent infinite error loops if error is persistent
             setIsRunning(false); // <-- This might be relevant if errors occur
         }
     }, [DEBUG]); // Dependency updated for logging


    const handleToggleRun = useCallback(() => {
        setIsRunning(prev => {
             if(DEBUG) console.log(`>>> handleToggleRun: Toggling isRunning from ${prev} to ${!prev}`); // <-- Log 6
             return !prev;
        });
    }, [DEBUG]); // Dependency updated for logging

    const handleStep = useCallback(() => {
        if (!isRunning) {
             if(DEBUG) console.log(">>> handleStep: Executing single step because !isRunning"); // <-- Log 7
             runSimulationStep();
        } else {
             if(DEBUG) console.log(">>> handleStep: Ignored because isRunning is true"); // <-- Log 8
        }
    }, [isRunning, runSimulationStep, DEBUG]); // Dependencies seem correct

    const handleClear = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsRunning(false);
        setLiveCells(createEmptyGrid());
        setGeneration(0);
        // Optionally reset view center and zoom
        // viewCenterCoords.value = { row: 0, col: 0 };
        // cellSizeDP.value = INITIAL_CELL_SIZE_DP;
    }, [viewCenterCoords, cellSizeDP]); // Add dependencies if resetting view/zoom

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
        // This effect runs when `isRunning` or `runSimulationStep` changes identity
        if(DEBUG) console.log(`>>> useEffect[isRunning]: Effect triggered. isRunning = ${isRunning}`); // <-- Log 9

        if (intervalRef.current) {
             if(DEBUG) console.log(">>> useEffect[isRunning]: Clearing existing interval (Ref was not null)"); // <-- Log 10
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (isRunning) {
            // Only set interval if isRunning is true
            if (DEBUG) console.log(`>>> useEffect[isRunning]: Setting up new interval (${SIMULATION_INTERVAL_MS}ms)`); // <-- Log 11
            intervalRef.current = setInterval(runSimulationStep, SIMULATION_INTERVAL_MS);
        } else {
             // This block runs if isRunning is false
             if (DEBUG) console.log(">>> useEffect[isRunning]: isRunning is false, interval remains cleared."); // <-- Log 12
        }

        // Cleanup function: runs when isRunning changes OR component unmounts
        return () => {
            if (intervalRef.current) {
                if (DEBUG) console.log(">>> useEffect[isRunning] Cleanup: Clearing interval ID", intervalRef.current); // <-- Log 13
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            } else {
                 if (DEBUG) console.log(">>> useEffect[isRunning] Cleanup: No interval ref to clear."); // <-- Log 14
            }
        };
    }, [isRunning, runSimulationStep, DEBUG]); // Dependencies: isRunning, runSimulationStep, DEBUG


    // --- Grid Update Logic (Draw Handler - Receives *Logical* Coords) ---
    const handleDraw = useCallback((targetRowInt: number, targetColInt: number) => {
        // This function runs on the JS thread
        try {
            // Double-check inputs received from UI thread
            if (isNaN(targetRowInt) || isNaN(targetColInt) || !isFinite(targetRowInt) || !isFinite(targetColInt)) {
                if (DEBUG) console.error(`handleDraw (JS Thread) received invalid coords: [${targetRowInt}, ${targetColInt}]. Skipping.`);
                return;
            }
            // Re-clamping is safer
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

    // --- Two-Finger Pan Gesture (Navigation) ---
    const panGestureContext = useSharedValue({ startRow: 0, startCol: 0 });
    const viewPanGesture = Gesture.Pan()
        .minPointers(2)
        .maxPointers(2)
        .averageTouches(true) // Use average position of touches
        .onBegin(() => {
            // Store start logical center for delta calculations
            panGestureContext.value = { startRow: viewCenterCoords.value.row, startCol: viewCenterCoords.value.col };
            // No console log here to avoid spam when running simultaneous with pinch
        })
        .onUpdate((event) => {
            // This runs on the UI thread
            try {
                // Read CURRENT cell size (might be changing due to simultaneous pinch)
                const currentCellSize = cellSizeDP.value;
                if (currentCellSize <= 0 || !isFinite(currentCellSize)) {
                    if (DEBUG) console.error(`(Pan) Invalid cell size: ${currentCellSize}`);
                    return; // Avoid division by zero / NaN
                }
                // Calculate logical delta based on DPs and current cell size
                const deltaCol = (event.translationX / currentCellSize) * PAN_SENSITIVITY;
                const deltaRow = (event.translationY / currentCellSize) * PAN_SENSITIVITY;

                // Calculate new center relative to the start position
                const newCol = panGestureContext.value.startCol - deltaCol;
                const newRow = panGestureContext.value.startRow - deltaRow;

                // Clamp coordinates to prevent extreme values
                const clampedCol = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, newCol));
                const clampedRow = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, newRow));

                // Basic check for NaN/Infinity before updating shared value
                if (!isFinite(clampedRow) || !isFinite(clampedCol)) {
                    if (DEBUG) console.error(`(Pan) Invalid calculated center: R=${clampedRow}, C=${clampedCol}. Inputs: dX=${event.translationX}, dY=${event.translationY}, cellSize=${currentCellSize}`);
                    return; // Prevent updating shared value with invalid numbers
                }

                // Update view center shared value directly (efficient on UI thread)
                viewCenterCoords.value = { row: clampedRow, col: clampedCol };

            } catch (error) {
                // Log error but don't necessarily crash the app
                console.error("(Pan) Update Error:", error);
            }
        })
        .onEnd(() => {
            if (DEBUG) console.log(`(Pan) End: Center R=${viewCenterCoords.value.row.toFixed(2)}, C=${viewCenterCoords.value.col.toFixed(2)}`);
            // Context is automatically reset by gesture handler state machine
        });

    // --- Pinch Gesture (Zooming & Focal Point Adjustment) ---
    const pinchStartContext = useSharedValue({ startCellSize: 0, startViewCenter: { row: 0, col: 0 } });
    const pinchGesture = Gesture.Pinch()
        .onBegin((event) => {
            // Store starting state for pinch calculations
            pinchStartContext.value = {
                startCellSize: cellSizeDP.value,
                startViewCenter: { row: viewCenterCoords.value.row, col: viewCenterCoords.value.col }
            };
            if (DEBUG) console.log(`(Pinch) Begin: Start Size=${pinchStartContext.value.startCellSize.toFixed(2)} Center R=${pinchStartContext.value.startViewCenter.row.toFixed(2)} C=${pinchStartContext.value.startViewCenter.col.toFixed(2)}`);
        })
        .onUpdate((event) => {
            // Runs on UI thread
            try {
                // --- Measurement Check ---
                // Ensure we have container dimensions needed for focal point mapping
                if (!gridContainerMeasurements.measured || gridContainerMeasurements.width <= 0 || gridContainerMeasurements.height <= 0) {
                    if (DEBUG) console.warn("(Pinch) Update ignored: Container not measured or zero size.");
                    return;
                }
                const { x: containerX, y: containerY, width: containerWidthDP, height: containerHeightDP } = gridContainerMeasurements;

                // --- Calculate New Cell Size ---
                const startSize = pinchStartContext.value.startCellSize;
                // Prevent issues if starting size was somehow invalid
                if (startSize <= 0 || !isFinite(startSize)) {
                     if (DEBUG) console.error(`(Pinch) Invalid start cell size in context: ${startSize}`);
                     return;
                }
                const targetSize = startSize * event.scale;
                // Clamp the new size within defined limits
                const newClampedCellSize = Math.max(MIN_CELL_SIZE_DP, Math.min(MAX_CELL_SIZE_DP, targetSize));

                // Validate the calculated new cell size before proceeding
                if (!isFinite(newClampedCellSize) || newClampedCellSize <= 0) {
                     if (DEBUG) console.error(`(Pinch) Invalid new cell size calculation: ${newClampedCellSize}. Scale=${event.scale}, Start=${startSize}`);
                     return; // Prevent division by zero or invalid state later
                }

                // --- Calculate Focal Point Adjustment ---
                const { startViewCenter } = pinchStartContext.value;
                const startCenterRow = startViewCenter.row;
                const startCenterCol = startViewCenter.col;

                // 1. Focal point relative to container center (in DPs)
                const focalX_DP = event.focalX; // Absolute screen coordinates in DPs
                const focalY_DP = event.focalY;
                const containerCenterX_DP = containerX + containerWidthDP / 2;
                const containerCenterY_DP = containerY + containerHeightDP / 2;
                const tapRelCenterX_DP = focalX_DP - containerCenterX_DP;
                const tapRelCenterY_DP = focalY_DP - containerCenterY_DP;

                // 2. Logical coordinate under the focal point *using the START state*
                // (Map the focal point from screen DPs to logical coords based on starting zoom/center)
                const colOffsetStart = tapRelCenterX_DP / startSize;
                const rowOffsetStart = tapRelCenterY_DP / startSize;
                const focalLogicalCol = startCenterCol + colOffsetStart;
                const focalLogicalRow = startCenterRow + rowOffsetStart;

                 // Validate focal logical coordinates
                 if (!isFinite(focalLogicalCol) || !isFinite(focalLogicalRow)) {
                     if (DEBUG) console.error(`(Pinch) Invalid focal logical coord calculation: R=${focalLogicalRow}, C=${focalLogicalCol}. OffsetStart R=${rowOffsetStart}, C=${colOffsetStart}`);
                     return;
                 }


                // 3. Calculate the required NEW center coords to keep the focal logical point under the focal screen point *at the new zoom level*
                // (Solve the mapping equation for the new center)
                const colOffsetNew = tapRelCenterX_DP / newClampedCellSize; // Offset based on *new* cell size
                const rowOffsetNew = tapRelCenterY_DP / newClampedCellSize;
                const newTargetCenterCol = focalLogicalCol - colOffsetNew;
                const newTargetCenterRow = focalLogicalRow - rowOffsetNew;

                // Clamp the new center coordinates to defined bounds
                const clampedNewCenterCol = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, newTargetCenterCol));
                const clampedNewCenterRow = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, newTargetCenterRow));

                 // Validate final calculated center coordinates
                 if (!isFinite(clampedNewCenterRow) || !isFinite(clampedNewCenterCol)) {
                      if (DEBUG) console.error(`(Pinch) Invalid new center calc: R=${clampedNewCenterRow}, C=${clampedNewCenterCol}. OffsetNew R=${rowOffsetNew}, C=${colOffsetNew}`);
                      return;
                 }

                // --- Update Shared Values ---
                // Atomically update both zoom and center on the UI thread
                cellSizeDP.value = newClampedCellSize;
                viewCenterCoords.value = { row: clampedNewCenterRow, col: clampedNewCenterCol };

            } catch (error) {
                 console.error("(Pinch) Update Error:", error);
                 // Log context if possible to aid debugging
                 if(DEBUG) console.log("Pinch Error Context:", { scale: event.scale, focalX: event.focalX, focalY: event.focalY, startContext: pinchStartContext.value, container: gridContainerMeasurements });
            }
        })
        .onEnd(() => {
            if (DEBUG) console.log(`(Pinch) End: Final Size=${cellSizeDP.value.toFixed(2)}, Center R=${viewCenterCoords.value.row.toFixed(2)}, C=${viewCenterCoords.value.col.toFixed(2)}`);
            // Context is reset automatically
        });


    // --- One-Finger Drag Gesture (Drawing) ---
    const drawPanGesture = Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .onBegin(() => {
            // Reset tracking refs for the start of a new draw stroke
            lastActivatedCellCoords.current = null;
            lastDrawExecutionTimeRef.current = 0; // Allow immediate first draw
            if (DEBUG) console.log("(Draw) Begin");
        })
        .onUpdate((event) => {
            // This runs on the UI thread
            try {
                // --- Measurement Check ---
                if (!gridContainerMeasurements.measured || gridContainerMeasurements.width <= 0 || gridContainerMeasurements.height <= 0) {
                    // Conditionally log to avoid spamming if container not ready
                    // if (DEBUG) console.warn("(Draw) Update ignored: Container not measured or zero size.");
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
                // *** Use the CURRENT cell size from shared value ***
                const currentCellSize = cellSizeDP.value;
                // Validate cell size before division
                if (currentCellSize <= 0 || !isFinite(currentCellSize)) {
                    if (DEBUG) console.error(`(Draw) Invalid cell size: ${currentCellSize}`);
                    return;
                }

                // Touch position (Absolute DPs)
                const screenX_DP = event.absoluteX;
                const screenY_DP = event.absoluteY;

                // 1. Calculate tap position relative to container center (in DPs)
                const containerCenterX_DP = containerX + containerWidthDP / 2;
                const containerCenterY_DP = containerY + containerHeightDP / 2;
                const tapRelCenterX_DP = screenX_DP - containerCenterX_DP;
                const tapRelCenterY_DP = screenY_DP - containerCenterY_DP;

                // 2. Convert DP offset from center to Logical offset using currentCellSize
                const colOffset = tapRelCenterX_DP / currentCellSize;
                const rowOffset = tapRelCenterY_DP / currentCellSize;

                // 3. Add logical offset to logical center coordinate
                const targetCol = center_col + colOffset;
                const targetRow = center_row + rowOffset;

                // 4. Floor to get integer logical cell coordinates
                const targetColInt = Math.floor(targetCol);
                const targetRowInt = Math.floor(targetRow);

                // --- Sanity Check & Clamping (Crucial before runOnJS) ---
                if (isNaN(targetRowInt) || isNaN(targetColInt) || !isFinite(targetRowInt) || !isFinite(targetColInt)) {
                    // Conditionally log to avoid spamming
                    // if (DEBUG) console.error(`(Draw) Calc invalid number: [${targetRowInt}, ${targetColInt}]. Inputs: screenDP(${screenX_DP},${screenY_DP}), center(${center_row},${center_col}), cellSize=${currentCellSize}`);
                    return; // Do not proceed with invalid coordinates
                }

                // Clamp to defined logical bounds
                const clampedRowInt = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, targetRowInt));
                const clampedColInt = Math.max(MIN_COORD_VALUE, Math.min(MAX_COORD_VALUE, targetColInt));

                if ((clampedRowInt !== targetRowInt || clampedColInt !== targetColInt) && DEBUG) {
                     // Log clamping only if it happens
                     console.warn(`(Draw) Coordinate clamped from [${targetRowInt}, ${targetColInt}] to [${clampedRowInt}, ${clampedColInt}]`);
                }

                // Current target cell coordinates object (using clamped values)
                const currentCellCoords: Coordinates = { row: clampedRowInt, col: clampedColInt };

                // --- Activate cell only if it's different from the last one ---
                if (currentCellCoords.row !== lastActivatedCellCoords.current?.row ||
                    currentCellCoords.col !== lastActivatedCellCoords.current?.col)
                {
                    lastActivatedCellCoords.current = currentCellCoords; // Store the *clamped* coords

                    // *** Pass the validated and clamped *integer logical coordinates* to the JS thread ***
                    runOnJS(handleDraw)(clampedRowInt, clampedColInt);
                }

            } catch (error) {
                console.error("(Draw) Update Error:", error);
                // Log context if possible to aid debugging
                if (DEBUG) console.log("Draw Error Context:", { absX: event.absoluteX, absY: event.absoluteY, container: gridContainerMeasurements, center: viewCenterCoords.value, cellSize: cellSizeDP.value });
                // Reset last activated to prevent potential stuck state?
                lastActivatedCellCoords.current = null;
            }
        })
        .onEnd(() => {
            // Reset ref on gesture end
            lastActivatedCellCoords.current = null;
            if (DEBUG) console.log("(Draw) End");
        });

    // --- Combine Gestures ---
    // Allow Pan and Pinch to run simultaneously (both use 2 fingers)
    const twoFingerGestures = Gesture.Simultaneous(viewPanGesture, pinchGesture);
    // Make Draw exclusive from the 2-finger gestures (1 finger vs 2 fingers)
    const composedGesture = Gesture.Exclusive(drawPanGesture, twoFingerGestures);

    // --- Render ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Status Display Area */}
                <View style={styles.statusContainer}>
                    <Text style={styles.statusText}>Gen: {generation}</Text> {/* Check if this updates */}
                    <Text style={styles.statusText}>{isRunning ? 'Running' : 'Paused'}</Text> {/* Check if this changes */}
                    <Text style={styles.statusText}>Live: {displayLiveCellCount}</Text>
                    <Text style={styles.statusText}>
                        Center: R:{displayCenter.row.toFixed(1)} C:{displayCenter.col.toFixed(1)}
                    </Text>
                     <Text style={styles.statusText}>
                        Zoom: {displayCellSize.toFixed(1)}dp
                     </Text>
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
                                    liveCells={liveCells} // Pass current liveCells
                                    viewCenterCoords={viewCenterCoords} // Pass SharedValue
                                    cellSizeDP={cellSizeDP} // Pass SharedValue
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
                     isRunning={isRunning} // Pass current isRunning state
                     onToggleRun={handleToggleRun} // Pass the toggle handler
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

// --- Styles ---
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