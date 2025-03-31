// GameOfLifeApp/components/MainGridView.tsx

import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, AppState, AppStateStatus, PixelRatio, Platform } from 'react-native';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import type { SharedValue } from 'react-native-reanimated';
import type { GridState, Coordinates } from '../types/game';
import { stringToCoords } from '../lib/gameLogic';

// --- Constants ---
const ALIVE_COLOR: [number, number, number, number] = [0.3, 1.0, 0.3, 1.0]; // Bright Green
const GRID_BG_COLOR: [number, number, number, number] = [0.05, 0.05, 0.05, 1.0]; // Very Dark Grey
const GRID_LINE_COLOR: [number, number, number, number] = [0.3, 0.3, 0.3, 0.5]; // Semi-transparent Grey
const DEBUG_GL = true; // Enable detailed GL error checks and logging

// --- Props Interface ---
interface MainGridViewProps {
    liveCells: GridState; // Set of live cell coordinate strings
    viewCenterCoords: SharedValue<Coordinates>; // Center of the viewport (logical coords)
    cellSizeDP: number; // Cell size received in DPs
}

// --- WebGL Shaders ---
const vertexShaderSource = `
  attribute vec2 a_position;
  uniform vec2 u_resolution; // Canvas resolution (pixels)
  uniform vec2 u_translation; // Top-left corner of quad (pixels, Y-down from top-left)
  uniform vec2 u_dimensions; // Width/Height of quad (pixels)

  void main() {
    vec2 pixelPosition = (a_position * u_dimensions) + u_translation;
    vec2 zeroToOne = pixelPosition / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0, 1); // Flip Y for clip space
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_color; // Color passed from JS
  void main() {
    gl_FragColor = u_color;
  }
`;

// --- Helper to check GL Errors ---
const checkGLError = (gl: ExpoWebGLRenderingContext | null, label: string): boolean => {
    if (!gl || !DEBUG_GL) return true; // Skip if no context or debug disabled
    let errorFound = false;
    let error = gl.getError();
    while (error !== gl.NO_ERROR) {
        console.error(`WebGL Error (${label}): ${error}`);
        errorFound = true;
        error = gl.getError(); // Check for subsequent errors
    }
    return !errorFound; // Return true if NO errors were found
};

// --- The Component ---
const MainGridView: React.FC<MainGridViewProps> = ({
    liveCells,
    viewCenterCoords,
    cellSizeDP, // Receive cell size in DPs
}) => {
    // --- Refs ---
    const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const positionAttributeLocationRef = useRef<number>(-1);
    const resolutionUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const translationUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const dimensionsUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const colorUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const positionBufferRef = useRef<WebGLBuffer | null>(null); // Quad vertices buffer
    const isInitializedRef = useRef(false);
    const frameRequestHandle = useRef<number | null>(null);
    const appState = useRef(AppState.currentState);
    const canvasSizeRef = useRef({ width: 0, height: 0 }); // Store size in pixels
    const pixelRatioRef = useRef(PixelRatio.get()); // Store device pixel ratio

    // Keep liveCells in a ref to prevent drawGrid callback re-creation on every update
    const liveCellsRef = useRef<GridState>(liveCells);
    useEffect(() => {
        liveCellsRef.current = liveCells;
    }, [liveCells]);

    // --- Function Definitions ---

    // 1. Stop Render Loop
    const stopRenderLoop = useCallback(() => {
        if (frameRequestHandle.current !== null) {
            if (DEBUG_GL) console.log("Stopping render loop.");
            cancelAnimationFrame(frameRequestHandle.current);
            frameRequestHandle.current = null;
        }
    }, [DEBUG_GL]);

    // 2. Draw Grid (Core Drawing Logic - Operates in Pixels)
    const drawGrid = useCallback((gl: ExpoWebGLRenderingContext) => {
        // --- Pre-computation and Validation ---
        const currentLiveCells = liveCellsRef.current;
        const centerRow = viewCenterCoords.value.row; // Logical center
        const centerCol = viewCenterCoords.value.col; // Logical center
        const pRatio = pixelRatioRef.current;

        // Validate essential resources
        if (!programRef.current || !positionBufferRef.current || !isInitializedRef.current) {
            if (DEBUG_GL) console.warn("drawGrid called before GL initialized or with missing resources.");
            stopRenderLoop(); // Stop if fundamental resources missing
            return;
        }

        // Calculate cell size in physical pixels
        const cellSizePixel = cellSizeDP * pRatio;
        if (cellSizePixel <= 0 || !isFinite(cellSizePixel)) {
            if (DEBUG_GL) console.error(`drawGrid: Invalid calculated cellSizePixel (${cellSizePixel}). cellSizeDP=${cellSizeDP}, pixelRatio=${pRatio}. Skipping frame.`);
            stopRenderLoop(); // Stop if cell size is invalid
            return;
        }

        // Get canvas dimensions in physical pixels
        const canvasWidth = gl.drawingBufferWidth;
        const canvasHeight = gl.drawingBufferHeight;

        // Check for valid canvas size
        if (canvasWidth <= 0 || canvasHeight <= 0) {
            if (DEBUG_GL) console.warn(`drawGrid: Canvas size is zero or invalid (${canvasWidth}x${canvasHeight}). Skipping frame.`);
            // Don't stop the loop yet, might recover on next frame/layout
            return;
        }

        // Update viewport and internal size ref if necessary
        if (canvasWidth !== canvasSizeRef.current.width || canvasHeight !== canvasSizeRef.current.height) {
            if (DEBUG_GL) console.log(`Canvas resize detected: ${canvasWidth}x${canvasHeight} [pixels]. Updating viewport.`);
            canvasSizeRef.current = { width: canvasWidth, height: canvasHeight };
            gl.viewport(0, 0, canvasWidth, canvasHeight); // Set GL viewport to match pixel dimensions
            if (!checkGLError(gl, "glViewport")) return; // Check for errors after setting viewport
        }

        // ****** Declare potentially logged variables *outside* the try block ******
        let minVisibleCol: number | undefined;
        let maxVisibleCol: number | undefined;
        let minVisibleRow: number | undefined;
        let maxVisibleRow: number | undefined;
        let cellsWidthVisible: number | undefined;
        let cellsHeightVisible: number | undefined;
        // ***************************************************************************

        // --- Start Drawing ---
        try {
            // Clear Background
            gl.clearColor(...GRID_BG_COLOR);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (!checkGLError(gl, "glClear")) return;

            // Setup Program & Attributes
            gl.useProgram(programRef.current);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
            const posAttrLoc = positionAttributeLocationRef.current;
            if (posAttrLoc === -1) {
                if (DEBUG_GL) console.error("drawGrid: Invalid position attribute location.");
                stopRenderLoop(); return;
            }
            gl.enableVertexAttribArray(posAttrLoc);
            gl.vertexAttribPointer(posAttrLoc, 2, gl.FLOAT, false, 0, 0); // 2 floats per vertex

            // Set Resolution Uniform (essential for vertex shader)
            if (!resolutionUniformLocationRef.current) {
                 if (DEBUG_GL) console.error("drawGrid: Missing resolution uniform location.");
                 stopRenderLoop(); return;
            }
            gl.uniform2f(resolutionUniformLocationRef.current, canvasWidth, canvasHeight); // Pass pixel resolution
            if (!checkGLError(gl, "Program/Attrib/Resolution Setup")) return;

            // --- Calculate Visible Grid Range (Assign to outer scope vars) ---
            cellsWidthVisible = canvasWidth / cellSizePixel;
            cellsHeightVisible = canvasHeight / cellSizePixel;
            // Add sanity check for division results before using them
            if (!isFinite(cellsWidthVisible) || !isFinite(cellsHeightVisible)) {
                throw new Error(`Invalid cellsVisible calculation: W=${cellsWidthVisible}, H=${cellsHeightVisible}. Inputs: canvasW=${canvasWidth}, canvasH=${canvasHeight}, cellSizePixel=${cellSizePixel}`);
            }

            minVisibleCol = Math.floor(centerCol - cellsWidthVisible / 2 - 1);
            maxVisibleCol = Math.ceil(centerCol + cellsWidthVisible / 2 + 1);
            minVisibleRow = Math.floor(centerRow - cellsHeightVisible / 2 - 1);
            maxVisibleRow = Math.ceil(centerRow + cellsHeightVisible / 2 + 1);

             // Check calculated bounds for validity before using them
             if (!isFinite(minVisibleCol) || !isFinite(maxVisibleCol) || !isFinite(minVisibleRow) || !isFinite(maxVisibleRow)) {
                 throw new Error(`Invalid visible range calculation: Row(${minVisibleRow}-${maxVisibleRow}), Col(${minVisibleCol}-${maxVisibleCol})`);
             }

            // --- Draw Grid Lines (Optimized) ---
            const drawGridLines = cellSizeDP > 4; // Only draw lines if cells are visually large enough (in DPs)
            if (drawGridLines) {
                 if (!colorUniformLocationRef.current || !dimensionsUniformLocationRef.current || !translationUniformLocationRef.current) {
                     if (DEBUG_GL) console.error("drawGrid: Missing uniform location for grid lines.");
                 } else {
                    gl.uniform4fv(colorUniformLocationRef.current, GRID_LINE_COLOR);
                    // Ensure lines are at least 1 physical pixel thick
                    const lineThicknessPixel = Math.max(1, Math.floor(1 * pRatio));

                    // Vertical Lines
                    gl.uniform2f(dimensionsUniformLocationRef.current, lineThicknessPixel, canvasHeight); // Use pixel dimensions
                    for (let col = minVisibleCol; col <= maxVisibleCol; col++) {
                        // Calculate screen X position (start of column) in PIXELS
                        const screenX = canvasWidth / 2 + (col - centerCol) * cellSizePixel;
                        // Culling: Skip if line is entirely off-screen
                        if (screenX + lineThicknessPixel < 0 || screenX > canvasWidth) continue;

                         if (!isFinite(screenX)) {
                              if (DEBUG_GL) console.error(`Grid Line V: Invalid screenX (${screenX}) for col ${col}`);
                              continue; // Skip this line
                         }

                        // Set translation (top-left corner) in PIXELS
                        gl.uniform2f(translationUniformLocationRef.current, screenX - lineThicknessPixel / 2, 0);
                        gl.drawArrays(gl.TRIANGLES, 0, 6); // Draw quad (2 triangles)
                    }

                    // Horizontal Lines
                    gl.uniform2f(dimensionsUniformLocationRef.current, canvasWidth, lineThicknessPixel); // Use pixel dimensions
                    for (let row = minVisibleRow; row <= maxVisibleRow; row++) {
                        // Calculate screen Y position (start of row) in PIXELS
                        const screenY = canvasHeight / 2 + (row - centerRow) * cellSizePixel;
                        // Culling
                        if (screenY + lineThicknessPixel < 0 || screenY > canvasHeight) continue;

                         if (!isFinite(screenY)) {
                              if (DEBUG_GL) console.error(`Grid Line H: Invalid screenY (${screenY}) for row ${row}`);
                              continue; // Skip this line
                         }

                        // Set translation in PIXELS
                        gl.uniform2f(translationUniformLocationRef.current, 0, screenY - lineThicknessPixel / 2);
                        gl.drawArrays(gl.TRIANGLES, 0, 6);
                    }
                    if (!checkGLError(gl, "after grid lines")) return;
                 }
            }

            // --- Draw Live Cells ---
             if (!colorUniformLocationRef.current || !dimensionsUniformLocationRef.current || !translationUniformLocationRef.current) {
                 if (DEBUG_GL) console.error("drawGrid: Missing uniform location for live cells.");
             } else {
                gl.uniform4fv(colorUniformLocationRef.current, ALIVE_COLOR);
                // Calculate padding in pixels (e.g., 1 DP padding)
                const cellPaddingDP = cellSizeDP > 3 ? 1 : 0;
                const cellPaddingPixel = Math.round(cellPaddingDP * pRatio);
                // Calculate actual drawing size in pixels, ensuring it's not negative
                const cellDrawSizePixel = Math.max(0, cellSizePixel - cellPaddingPixel);

                if (cellDrawSizePixel <= 0) {
                     // If calculated size is zero/negative, don't try to draw cells
                     if (DEBUG_GL && currentLiveCells.size > 0) console.warn(`Cell draw size is ${cellDrawSizePixel} pixels, skipping cell rendering.`);
                } else {
                    // Set cell dimensions uniform (pixels)
                    gl.uniform2f(dimensionsUniformLocationRef.current, cellDrawSizePixel, cellDrawSizePixel);

                    for (const cellStr of currentLiveCells) {
                        const coords = stringToCoords(cellStr);
                        if (!coords) continue; // Skip if parsing fails
                        const { row, col } = coords;

                        // Culling 1: Check if cell's logical coords are within the calculated visible range (use outer scope vars)
                        if (row >= minVisibleRow && row <= maxVisibleRow && col >= minVisibleCol && col <= maxVisibleCol) {

                            // Calculate cell's top-left screen position in PIXELS
                            const screenX = canvasWidth / 2 + (col - centerCol) * cellSizePixel;
                            const screenY = canvasHeight / 2 + (row - centerRow) * cellSizePixel;

                             // Culling 2: Precise check if the cell box (using cellSizePixel) is completely off-screen
                            if (screenX + cellSizePixel < 0 || screenX > canvasWidth || screenY + cellSizePixel < 0 || screenY > canvasHeight) {
                                continue;
                            }

                             // Sanity check calculated pixel coordinates
                             if (!isFinite(screenX) || !isFinite(screenY)) {
                                 if (DEBUG_GL) console.error(`Live Cell: Invalid screen coords (${screenX}, ${screenY}) for cell [${row}, ${col}]`);
                                 continue; // Skip drawing this cell
                             }

                            // Set translation uniform for this cell's top-left corner (PIXELS), accounting for padding
                            gl.uniform2f(translationUniformLocationRef.current,
                                         screenX + cellPaddingPixel / 2,
                                         screenY + cellPaddingPixel / 2);
                            gl.drawArrays(gl.TRIANGLES, 0, 6); // Draw the quad
                        }
                    }
                     if (!checkGLError(gl, "after live cells")) return;
                }
             }

            // --- Cleanup ---
            gl.disableVertexAttribArray(posAttrLoc); // Good practice
            gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer
            gl.useProgram(null); // Unbind program
            if (!checkGLError(gl, "after cleanup")) return;

        } catch (error) {
            console.error("!!! CRITICAL ERROR during drawGrid execution !!!", error);
            // Log context: These variables are now accessible from the outer scope.
            // They might be 'undefined' if the error occurred before their assignment.
            console.error("Context:", {
                centerRow, centerCol, canvasWidth, canvasHeight, cellSizePixel,
                cellsWidthVisible, // Log calculated visible cells count too
                cellsHeightVisible,
                minVisibleRow, maxVisibleRow, minVisibleCol, maxVisibleCol // Now using vars from outer scope
            });
            stopRenderLoop();
        }

    }, [viewCenterCoords, cellSizeDP, stopRenderLoop, DEBUG_GL]); // Dependencies

    // 3. Render Loop
    const renderLoop = useCallback(() => {
        // Ensure loop stops if component unmounts or GL becomes invalid
        if (!glRef.current || !isInitializedRef.current || !programRef.current) {
             if (DEBUG_GL) console.warn("Render loop called but GL context/program invalid or not initialized. Stopping.");
             stopRenderLoop();
            return;
        }

        const gl = glRef.current;
        try {
            drawGrid(gl); // Execute drawing logic

            gl.flush(); // Ensure commands are sent (may not be strictly necessary depending on driver)
            gl.endFrameEXP(); // Present the frame buffer to the screen

        } catch (e) {
            console.error("!!! CRITICAL ERROR in render loop (drawGrid/flush/endFrame) !!!", e);
            stopRenderLoop(); // Stop loop on error during frame processing
            return; // Exit loop iteration
        }

        // Schedule the next frame *only if* the loop hasn't been stopped
        if (frameRequestHandle.current !== null) {
            frameRequestHandle.current = requestAnimationFrame(renderLoop);
        }
    }, [drawGrid, stopRenderLoop, DEBUG_GL]); // Depends on drawGrid and stopRenderLoop

    // 4. Start Render Loop
    const startRenderLoop = useCallback(() => {
        // Only start if initialized and not already running
        if (!isInitializedRef.current) {
            if (DEBUG_GL) console.warn("Attempted to start render loop before initialized.");
            return;
        }
        if (frameRequestHandle.current === null) {
            if (DEBUG_GL) console.log("Starting render loop...");
            // Clear any potentially stale handle before requesting new frame
            frameRequestHandle.current = 0;
            frameRequestHandle.current = requestAnimationFrame(renderLoop);
        } else {
             if (DEBUG_GL) console.log("Render loop already running.");
        }
    }, [renderLoop, DEBUG_GL]); // Depends on renderLoop

    // --- WebGL Context Creation ---
    const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
        if (DEBUG_GL) console.log("onContextCreate called - Initializing WebGL...");
        stopRenderLoop(); // Ensure any previous loop is stopped
        glRef.current = gl;
        isInitializedRef.current = false; // Mark as not ready during setup
        programRef.current = null; // Clear previous resources
        positionBufferRef.current = null;
        pixelRatioRef.current = PixelRatio.get(); // Get current pixel ratio

        try {
            // Set initial canvas size ref and viewport (using pixels)
            const initialWidth = gl.drawingBufferWidth;
            const initialHeight = gl.drawingBufferHeight;
            if (initialWidth <= 0 || initialHeight <= 0) {
                // This *can* happen briefly during setup. The resize check in drawGrid should handle it.
                console.warn(`Initial canvas size invalid: ${initialWidth}x${initialHeight} [pixels]. Viewport setup deferred.`);
                 canvasSizeRef.current = { width: 0, height: 0 };
            } else {
                 canvasSizeRef.current = { width: initialWidth, height: initialHeight };
                 gl.viewport(0, 0, initialWidth, initialHeight);
                 if (!checkGLError(gl, "Initial glViewport")) throw new Error("Failed initial viewport setup.");
                 if (DEBUG_GL) console.log(`Initial viewport set: ${initialWidth}x${initialHeight} [pixels]`);
            }


            // --- Compile Shaders ---
            const vertShader = gl.createShader(gl.VERTEX_SHADER);
            if (!vertShader) throw new Error("Failed to create vertex shader.");
            gl.shaderSource(vertShader, vertexShaderSource);
            gl.compileShader(vertShader);
            if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
                const log = gl.getShaderInfoLog(vertShader);
                gl.deleteShader(vertShader);
                throw new Error(`Vertex shader compile error: ${log || 'Unknown error'}`);
            }

            const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
            if (!fragShader) { gl.deleteShader(vertShader); throw new Error("Failed to create fragment shader."); }
            gl.shaderSource(fragShader, fragmentShaderSource);
            gl.compileShader(fragShader);
            if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
                const log = gl.getShaderInfoLog(fragShader);
                gl.deleteShader(vertShader);
                gl.deleteShader(fragShader);
                throw new Error(`Fragment shader compile error: ${log || 'Unknown error'}`);
            }

            // --- Link Program ---
            const program = gl.createProgram();
            if (!program) { gl.deleteShader(vertShader); gl.deleteShader(fragShader); throw new Error("Failed to create program."); }
            gl.attachShader(program, vertShader);
            gl.attachShader(program, fragShader);
            gl.linkProgram(program);

            // --- Clean up shaders after linking ---
            gl.deleteShader(vertShader);
            gl.deleteShader(fragShader);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                const log = gl.getProgramInfoLog(program);
                gl.deleteProgram(program);
                throw new Error(`Program link error: ${log || 'Unknown error'}`);
            }
            programRef.current = program; // Store linked program

            // --- Get Locations (Check validity immediately) ---
            positionAttributeLocationRef.current = gl.getAttribLocation(program, "a_position");
            resolutionUniformLocationRef.current = gl.getUniformLocation(program, "u_resolution");
            translationUniformLocationRef.current = gl.getUniformLocation(program, "u_translation");
            dimensionsUniformLocationRef.current = gl.getUniformLocation(program, "u_dimensions");
            colorUniformLocationRef.current = gl.getUniformLocation(program, "u_color");

            if (positionAttributeLocationRef.current < 0 ||
                !resolutionUniformLocationRef.current ||
                !translationUniformLocationRef.current ||
                !dimensionsUniformLocationRef.current ||
                !colorUniformLocationRef.current) {
                const missing = [
                    positionAttributeLocationRef.current < 0 ? "a_position" : null,
                    !resolutionUniformLocationRef.current ? "u_resolution" : null,
                    !translationUniformLocationRef.current ? "u_translation" : null,
                    !dimensionsUniformLocationRef.current ? "u_dimensions" : null,
                    !colorUniformLocationRef.current ? "u_color" : null,
                ].filter(Boolean).join(', ');
                throw new Error(`Failed to get mandatory shader locations: ${missing}`);
            }

            // --- Create Quad Buffer ---
            // Represents a 1x1 quad, scaled and translated by uniforms
            const positions = new Float32Array([
                0, 0, // Top-left
                1, 0, // Top-right
                0, 1, // Bottom-left
                0, 1, // Bottom-left
                1, 0, // Top-right
                1, 1, // Bottom-right
            ]);
            const buffer = gl.createBuffer();
            if (!buffer) throw new Error("Failed to create position buffer");
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind after data setup
            positionBufferRef.current = buffer;

            if (DEBUG_GL) console.log("WebGL Initialized Successfully.");
            isInitializedRef.current = true; // Mark as ready *after* all setup
            startRenderLoop(); // Start drawing now that everything is ready

        } catch (error) {
            console.error("!!! WebGL Initialization Failed !!!", error);
            isInitializedRef.current = false;
            // Clean up any partially created GL resources
            if (glRef.current) {
                if (programRef.current) glRef.current.deleteProgram(programRef.current);
                if (positionBufferRef.current) glRef.current.deleteBuffer(positionBufferRef.current);
            }
            programRef.current = null;
            positionBufferRef.current = null;
            glRef.current = null; // Consider context lost
        }
    }, [startRenderLoop, stopRenderLoop, DEBUG_GL]); // Dependencies

    // --- AppState Effect & Unmount Cleanup ---
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (DEBUG_GL) console.log(`App state changed: ${appState.current} -> ${nextAppState}`);
            // Pause rendering when app is not active
            if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                stopRenderLoop();
            }
            // Resume rendering when app becomes active *if* GL is ready
            else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (isInitializedRef.current && glRef.current) {
                    // Important: Check pixel ratio again in case it changed while inactive (unlikely but possible)
                    pixelRatioRef.current = PixelRatio.get();
                    startRenderLoop();
                } else {
                    if (DEBUG_GL) console.warn("App became active, but GL context not ready. Waiting for onContextCreate or next render attempt.");
                    // GLView should trigger onContextCreate if needed, or renderLoop checks will prevent drawing
                }
            }
            appState.current = nextAppState;
        };
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Initial start if component mounts while active and GL already initialized (e.g., fast refresh)
        if (appState.current === 'active' && isInitializedRef.current) {
            if (DEBUG_GL) console.log("Component mounted while active and initialized, ensuring render loop starts.");
            startRenderLoop();
        }

        // Cleanup on unmount
        return () => {
            if (DEBUG_GL) console.log("Cleaning up MainGridView: stopping loop, removing listener.");
            stopRenderLoop();
            subscription.remove();

            // Explicitly release WebGL resources on unmount
            if (glRef.current) {
                if (DEBUG_GL) console.log("Cleaning up WebGL resources (Program, Buffer)...");
                if (programRef.current) {
                    try { glRef.current.deleteProgram(programRef.current); } catch(e) { console.error("Error deleting program:", e); }
                 }
                if (positionBufferRef.current) {
                     try { glRef.current.deleteBuffer(positionBufferRef.current); } catch(e) { console.error("Error deleting buffer:", e); }
                 }
            }
            // Clear refs
            programRef.current = null;
            positionBufferRef.current = null;
            isInitializedRef.current = false; // Mark as uninitialized
            glRef.current = null;
            if (DEBUG_GL) console.log("WebGL resources cleanup attempted.");
        };
    }, [startRenderLoop, stopRenderLoop, DEBUG_GL]); // Dependencies


    // --- Render ---
    return (
        <View style={styles.container}>
            {/* GLView manages the GL context lifecycle automatically */}
            {/* onContextCreate is called when the context is ready */}
            <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgb(13, 13, 13)', overflow: 'hidden' },
});

export default MainGridView;