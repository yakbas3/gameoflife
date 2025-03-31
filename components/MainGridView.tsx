// GameOfLifeApp/components/MainGridView.tsx

import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, AppState, AppStateStatus, PixelRatio, Platform } from 'react-native';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import type { SharedValue } from 'react-native-reanimated'; // Import SharedValue type
import type { GridState, Coordinates } from '../types/game'; // Adjust path if needed
import { stringToCoords } from '../lib/gameLogic'; // Adjust path if needed

// --- Constants ---
const ALIVE_COLOR: [number, number, number, number] = [0.3, 1.0, 0.3, 1.0]; // Bright Green
const GRID_BG_COLOR: [number, number, number, number] = [0.05, 0.05, 0.05, 1.0]; // Very Dark Grey
const GRID_LINE_COLOR: [number, number, number, number] = [0.3, 0.3, 0.3, 0.5]; // Semi-transparent Grey
const DEBUG_GL = true; // Enable detailed GL error checks and logging

// --- Props Interface ---
// Updated to accept SharedValue for cellSizeDP
interface MainGridViewProps {
    liveCells: GridState; // Set of live cell coordinate strings
    viewCenterCoords: SharedValue<Coordinates>; // Center of the viewport (logical coords) - SharedValue
    cellSizeDP: SharedValue<number>;          // Cell size received in DPs - SharedValue
}

// --- WebGL Shaders ---
const vertexShaderSource = `
  attribute vec2 a_position; // Input quad vertex position (0,0 to 1,1)
  uniform vec2 u_resolution; // Canvas resolution (physical pixels)
  uniform vec2 u_translation; // Top-left corner of quad (physical pixels, Y-down from top-left)
  uniform vec2 u_dimensions; // Width/Height of quad (physical pixels)

  void main() {
    // Calculate pixel position on screen (0,0 at top-left)
    vec2 pixelPosition = (a_position * u_dimensions) + u_translation;

    // Convert pixel position to 0.0 -> 1.0 range
    vec2 zeroToOne = pixelPosition / u_resolution;

    // Convert 0->1 to 0->2 range
    vec2 zeroToTwo = zeroToOne * 2.0;

    // Convert 0->2 to -1->+1 clip space range (origin at center)
    vec2 clipSpace = zeroToTwo - 1.0;

    // Output position in clip space.
    // Flip Y axis because clip space Y is +ve up, but our pixel calcs are +ve down.
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0, 1);
  }
`;

const fragmentShaderSource = `
  precision mediump float; // Required for GL ES 2.0 fragment shaders
  uniform vec4 u_color; // Color passed from JavaScript
  void main() {
    // Set the fragment color to the uniform color
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
        error = gl.getError(); // Check for subsequent errors in case multiple occurred
    }
    return !errorFound; // Return true if NO errors were found
};

// --- The Component ---
const MainGridView: React.FC<MainGridViewProps> = ({
    liveCells,
    viewCenterCoords, // Receive SharedValue
    cellSizeDP,       // Receive SharedValue
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
    // Updated to read cellSizeDP.value
    const drawGrid = useCallback((gl: ExpoWebGLRenderingContext) => {
        // --- Pre-computation and Validation ---
        const currentLiveCells = liveCellsRef.current;
        // Read current values from SharedValues at the start of the frame
        const centerRow = viewCenterCoords.value.row;
        const centerCol = viewCenterCoords.value.col;
        const currentCellSizeDP = cellSizeDP.value; // *** READ VALUE FROM SHARED VALUE ***
        const pRatio = pixelRatioRef.current;

        // Validate essential resources
        if (!programRef.current || !positionBufferRef.current || !isInitializedRef.current) {
            if (DEBUG_GL) console.warn("drawGrid called before GL initialized or with missing resources.");
            stopRenderLoop(); // Stop if fundamental resources missing
            return;
        }

        // Calculate cell size in physical pixels using the current value from SharedValue
        const cellSizePixel = currentCellSizeDP * pRatio;
        // Validate calculated pixel size before proceeding
        if (cellSizePixel <= 0 || !isFinite(cellSizePixel)) {
            if (DEBUG_GL) console.error(`drawGrid: Invalid calculated cellSizePixel (${cellSizePixel}). currentCellSizeDP=${currentCellSizeDP}, pixelRatio=${pRatio}. Skipping frame.`);
            stopRenderLoop(); // Stop if cell size becomes invalid
            return;
        }

        // Get canvas dimensions in physical pixels
        const canvasWidth = gl.drawingBufferWidth;
        const canvasHeight = gl.drawingBufferHeight;

        // Check for valid canvas size (can be 0 during initialization/layout changes)
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

        // Declare variables for logging in catch block outside the try block scope
        let minVisibleCol: number | undefined;
        let maxVisibleCol: number | undefined;
        let minVisibleRow: number | undefined;
        let maxVisibleRow: number | undefined;
        let cellsWidthVisible: number | undefined;
        let cellsHeightVisible: number | undefined;

        // --- Start Drawing ---
        try {
            // Clear Background
            gl.clearColor(...GRID_BG_COLOR);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (!checkGLError(gl, "glClear")) return;

            // Setup Program & Attributes
            gl.useProgram(programRef.current);
            if (!checkGLError(gl, "glUseProgram")) return;
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
            if (!checkGLError(gl, "glBindBuffer")) return;
            const posAttrLoc = positionAttributeLocationRef.current;
            if (posAttrLoc === -1) {
                if (DEBUG_GL) console.error("drawGrid: Invalid position attribute location.");
                stopRenderLoop(); return;
            }
            gl.enableVertexAttribArray(posAttrLoc);
            if (!checkGLError(gl, "glEnableVertexAttribArray")) return;
            gl.vertexAttribPointer(posAttrLoc, 2, gl.FLOAT, false, 0, 0); // 2 floats per vertex, non-normalized, stride 0, offset 0
            if (!checkGLError(gl, "glVertexAttribPointer")) return;


            // Set Resolution Uniform (essential for vertex shader mapping)
            if (!resolutionUniformLocationRef.current) {
                 if (DEBUG_GL) console.error("drawGrid: Missing resolution uniform location.");
                 stopRenderLoop(); return;
            }
            gl.uniform2f(resolutionUniformLocationRef.current, canvasWidth, canvasHeight); // Pass pixel resolution
            if (!checkGLError(gl, "glUniform2f u_resolution")) return;

            // --- Calculate Visible Grid Range (Logical Coords based on Pixel Viewport & Current Zoom) ---
            cellsWidthVisible = canvasWidth / cellSizePixel; // Use current cellSizePixel
            cellsHeightVisible = canvasHeight / cellSizePixel; // Use current cellSizePixel
            // Add sanity check for division results before using them
            if (!isFinite(cellsWidthVisible) || !isFinite(cellsHeightVisible)) {
                throw new Error(`Invalid cellsVisible calculation: W=${cellsWidthVisible}, H=${cellsHeightVisible}. Inputs: canvasW=${canvasWidth}, canvasH=${canvasHeight}, cellSizePixel=${cellSizePixel}`);
            }

            // Add buffer (+1) to include partially visible cells at edges
            minVisibleCol = Math.floor(centerCol - cellsWidthVisible / 2 - 1);
            maxVisibleCol = Math.ceil(centerCol + cellsWidthVisible / 2 + 1);
            minVisibleRow = Math.floor(centerRow - cellsHeightVisible / 2 - 1);
            maxVisibleRow = Math.ceil(centerRow + cellsHeightVisible / 2 + 1);

             // Check calculated bounds for validity before using them in loops
             if (!isFinite(minVisibleCol) || !isFinite(maxVisibleCol) || !isFinite(minVisibleRow) || !isFinite(maxVisibleRow)) {
                 throw new Error(`Invalid visible range calculation: Row(${minVisibleRow}-${maxVisibleRow}), Col(${minVisibleCol}-${maxVisibleCol})`);
             }


            // --- Draw Grid Lines (Optimized) ---
            // Use current DP size for thresholding whether lines are visible enough
            const drawGridLines = currentCellSizeDP > 4; // Use currentCellSizeDP read from SharedValue
            if (drawGridLines) {
                 // Check if uniform locations are valid before using them
                 if (!colorUniformLocationRef.current || !dimensionsUniformLocationRef.current || !translationUniformLocationRef.current) {
                     if (DEBUG_GL) console.error("drawGrid: Missing uniform location for grid lines.");
                 } else {
                    gl.uniform4fv(colorUniformLocationRef.current, GRID_LINE_COLOR);
                    if (!checkGLError(gl, "glUniform4fv grid line color")) return;
                    // Ensure lines are at least 1 physical pixel thick
                    const lineThicknessPixel = Math.max(1, Math.floor(1 * pRatio));

                    // Vertical Lines
                    gl.uniform2f(dimensionsUniformLocationRef.current, lineThicknessPixel, canvasHeight); // Use pixel dimensions
                    if (!checkGLError(gl, "glUniform2f grid line V dim")) return;
                    for (let col = minVisibleCol; col <= maxVisibleCol; col++) {
                        // Calculate screen X position (start of column) in PIXELS using current cellSizePixel
                        const screenX = canvasWidth / 2 + (col - centerCol) * cellSizePixel; // Use current cellSizePixel
                        // Culling: Skip if line is entirely off-screen
                        if (screenX + lineThicknessPixel < 0 || screenX > canvasWidth) continue;
                         // Check for calculation errors
                         if (!isFinite(screenX)) {
                              if (DEBUG_GL) console.error(`Grid Line V: Invalid screenX (${screenX}) for col ${col}`);
                              continue; // Skip this line
                         }
                        // Set translation (top-left corner) in PIXELS
                        gl.uniform2f(translationUniformLocationRef.current, screenX - lineThicknessPixel / 2, 0);
                        if (!checkGLError(gl, `glUniform2f grid line V trans col ${col}`)) continue;
                        gl.drawArrays(gl.TRIANGLES, 0, 6); // Draw quad (2 triangles making a rectangle)
                        if (!checkGLError(gl, `glDrawArrays grid line V col ${col}`)) return;
                    }

                    // Horizontal Lines
                    gl.uniform2f(dimensionsUniformLocationRef.current, canvasWidth, lineThicknessPixel); // Use pixel dimensions
                    if (!checkGLError(gl, "glUniform2f grid line H dim")) return;
                    for (let row = minVisibleRow; row <= maxVisibleRow; row++) {
                        // Calculate screen Y position (start of row) in PIXELS using current cellSizePixel
                        const screenY = canvasHeight / 2 + (row - centerRow) * cellSizePixel; // Use current cellSizePixel
                        // Culling
                        if (screenY + lineThicknessPixel < 0 || screenY > canvasHeight) continue;
                         // Check for calculation errors
                         if (!isFinite(screenY)) {
                              if (DEBUG_GL) console.error(`Grid Line H: Invalid screenY (${screenY}) for row ${row}`);
                              continue; // Skip this line
                         }
                        // Set translation in PIXELS
                        gl.uniform2f(translationUniformLocationRef.current, 0, screenY - lineThicknessPixel / 2);
                         if (!checkGLError(gl, `glUniform2f grid line H trans row ${row}`)) continue;
                        gl.drawArrays(gl.TRIANGLES, 0, 6);
                        if (!checkGLError(gl, `glDrawArrays grid line H row ${row}`)) return;
                    }
                 }
            }

            // --- Draw Live Cells ---
            // Check if uniform locations are valid
             if (!colorUniformLocationRef.current || !dimensionsUniformLocationRef.current || !translationUniformLocationRef.current) {
                 if (DEBUG_GL) console.error("drawGrid: Missing uniform location for live cells.");
             } else {
                gl.uniform4fv(colorUniformLocationRef.current, ALIVE_COLOR);
                 if (!checkGLError(gl, "glUniform4fv live cell color")) return;

                // Calculate padding in pixels based on current DP size
                const cellPaddingDP = currentCellSizeDP > 3 ? 1 : 0; // Use currentCellSizeDP read from SharedValue
                const cellPaddingPixel = Math.round(cellPaddingDP * pRatio);
                // Calculate actual drawing size in pixels, ensuring it's not negative
                const cellDrawSizePixel = Math.max(0, cellSizePixel - cellPaddingPixel); // Use current cellSizePixel

                // Only attempt to draw if the calculated size is > 0
                if (cellDrawSizePixel <= 0) {
                     if (DEBUG_GL && currentLiveCells.size > 0) console.warn(`Cell draw size is ${cellDrawSizePixel} pixels, skipping cell rendering.`);
                } else {
                    // Set cell dimensions uniform (pixels)
                    gl.uniform2f(dimensionsUniformLocationRef.current, cellDrawSizePixel, cellDrawSizePixel);
                    if (!checkGLError(gl, "glUniform2f live cell dim")) return;

                    // Iterate through the Set of live cells
                    for (const cellStr of currentLiveCells) {
                        const coords = stringToCoords(cellStr);
                        if (!coords) continue; // Skip if parsing fails (shouldn't happen if data is clean)
                        const { row, col } = coords;

                        // Culling 1: Check if cell's logical coords are within the calculated visible range
                        if (row >= minVisibleRow && row <= maxVisibleRow && col >= minVisibleCol && col <= maxVisibleCol) {

                            // Calculate cell's top-left screen position in PIXELS using current cellSizePixel
                            const screenX = canvasWidth / 2 + (col - centerCol) * cellSizePixel; // Use current cellSizePixel
                            const screenY = canvasHeight / 2 + (row - centerRow) * cellSizePixel; // Use current cellSizePixel

                            // Culling 2: Precise check if the cell box (using cellSizePixel) is completely off-screen
                            if (screenX + cellSizePixel < 0 || screenX > canvasWidth || screenY + cellSizePixel < 0 || screenY > canvasHeight) {
                                continue;
                            }

                            // Sanity check calculated pixel coordinates before passing to GL
                            if (!isFinite(screenX) || !isFinite(screenY)) {
                                 if (DEBUG_GL) console.error(`Live Cell: Invalid screen coords (${screenX.toFixed(1)}, ${screenY.toFixed(1)}) for cell [${row}, ${col}]`);
                                 continue; // Skip drawing this cell
                            }

                            // Set translation uniform for this cell's top-left corner (PIXELS), accounting for padding
                            gl.uniform2f(translationUniformLocationRef.current,
                                         screenX + cellPaddingPixel / 2,
                                         screenY + cellPaddingPixel / 2);
                             if (!checkGLError(gl, `glUniform2f live cell trans ${row},${col}`)) continue;

                            // Draw the quad for the cell
                            gl.drawArrays(gl.TRIANGLES, 0, 6);
                            if (!checkGLError(gl, `glDrawArrays live cell ${row},${col}`)) return; // Exit drawing if error occurs
                        }
                    }
                }
             }

            // --- Cleanup ---
            gl.disableVertexAttribArray(posAttrLoc); // Good practice to disable attributes
            gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer
            gl.useProgram(null); // Unbind program
            if (!checkGLError(gl, "after cleanup")) return; // Check final cleanup steps

        } catch (error) {
            console.error("!!! CRITICAL ERROR during drawGrid execution !!!", error);
            // Log context, using variables declared outside the try block
            console.error("Context:", {
                centerRow, centerCol, canvasWidth, canvasHeight, cellSizePixel, currentCellSizeDP, // Added current DP size
                cellsWidthVisible, cellsHeightVisible, // Calculated visibility
                minVisibleRow, maxVisibleRow, minVisibleCol, maxVisibleCol // Calculated bounds
            });
            // Stop the render loop to prevent repeated crashes from the same error
            stopRenderLoop();
        }

    }, [viewCenterCoords, cellSizeDP, stopRenderLoop, DEBUG_GL]); // *** Ensure cellSizeDP (SharedValue) is in dependency array ***

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
            drawGrid(gl); // Execute drawing logic for the current frame

            gl.flush(); // Ensure commands are sent to the GPU (may improve performance on some platforms)
            gl.endFrameEXP(); // Present the drawn frame buffer to the screen

        } catch (e) {
            console.error("!!! CRITICAL ERROR in render loop (during drawGrid/flush/endFrame) !!!", e);
            stopRenderLoop(); // Stop loop on any error during frame processing/presentation
            return; // Exit this loop iteration
        }

        // Schedule the next frame *only if* the loop hasn't been explicitly stopped
        // frameRequestHandle will be null if stopRenderLoop was called
        if (frameRequestHandle.current !== null) {
            frameRequestHandle.current = requestAnimationFrame(renderLoop);
        }
    }, [drawGrid, stopRenderLoop, DEBUG_GL]); // Depends on drawGrid and stopRenderLoop logic

    // 4. Start Render Loop
    const startRenderLoop = useCallback(() => {
        // Only start if initialized and not already running
        if (!isInitializedRef.current) {
            if (DEBUG_GL) console.warn("Attempted to start render loop before initialized.");
            return;
        }
        if (frameRequestHandle.current === null) { // Check if loop is not already scheduled
            if (DEBUG_GL) console.log("Starting render loop...");
            // Clear any potentially stale handle before requesting a new frame, just in case
            frameRequestHandle.current = 0; // Indicate loop is intended to run
            frameRequestHandle.current = requestAnimationFrame(renderLoop); // Schedule the *first* frame
        } else {
             // Avoid starting multiple loops
             if (DEBUG_GL) console.log("Render loop already running or scheduled.");
        }
    }, [renderLoop, DEBUG_GL]); // Depends on renderLoop logic

    // --- WebGL Context Creation ---
    const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
        if (DEBUG_GL) console.log("onContextCreate called - Initializing WebGL...");
        stopRenderLoop(); // Ensure any previous loop (e.g., from hot-reload) is stopped
        glRef.current = gl;
        isInitializedRef.current = false; // Mark as not ready during setup
        programRef.current = null; // Clear previous resources
        positionBufferRef.current = null;
        pixelRatioRef.current = PixelRatio.get(); // Get current pixel ratio for this context

        try {
            // Set initial canvas size ref and viewport (using physical pixels)
            const initialWidth = gl.drawingBufferWidth;
            const initialHeight = gl.drawingBufferHeight;
            if (initialWidth <= 0 || initialHeight <= 0) {
                // This *can* happen briefly during setup. The resize check in drawGrid should handle it.
                console.warn(`Initial canvas size invalid: ${initialWidth}x${initialHeight} [pixels]. Viewport setup deferred.`);
                 canvasSizeRef.current = { width: 0, height: 0 }; // Store 0 size
            } else {
                 canvasSizeRef.current = { width: initialWidth, height: initialHeight };
                 gl.viewport(0, 0, initialWidth, initialHeight); // Set viewport to match buffer
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
                gl.deleteShader(vertShader); // Clean up failed shader
                throw new Error(`Vertex shader compile error: ${log || 'Unknown error'}`);
            }

            const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
            if (!fragShader) { gl.deleteShader(vertShader); throw new Error("Failed to create fragment shader."); }
            gl.shaderSource(fragShader, fragmentShaderSource);
            gl.compileShader(fragShader);
            if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
                const log = gl.getShaderInfoLog(fragShader);
                gl.deleteShader(vertShader); // Clean up previously successful shader
                gl.deleteShader(fragShader); // Clean up failed shader
                throw new Error(`Fragment shader compile error: ${log || 'Unknown error'}`);
            }

            // --- Link Program ---
            const program = gl.createProgram();
            if (!program) { gl.deleteShader(vertShader); gl.deleteShader(fragShader); throw new Error("Failed to create program."); }
            gl.attachShader(program, vertShader);
            gl.attachShader(program, fragShader);
            gl.linkProgram(program);

            // --- Clean up shaders after successful linking (they are no longer needed) ---
            gl.deleteShader(vertShader);
            gl.deleteShader(fragShader);

            // Check linking status
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                const log = gl.getProgramInfoLog(program);
                gl.deleteProgram(program); // Clean up failed program
                throw new Error(`Program link error: ${log || 'Unknown error'}`);
            }
            programRef.current = program; // Store successfully linked program

            // --- Get Locations (Check validity immediately after linking) ---
            positionAttributeLocationRef.current = gl.getAttribLocation(program, "a_position");
            resolutionUniformLocationRef.current = gl.getUniformLocation(program, "u_resolution");
            translationUniformLocationRef.current = gl.getUniformLocation(program, "u_translation");
            dimensionsUniformLocationRef.current = gl.getUniformLocation(program, "u_dimensions");
            colorUniformLocationRef.current = gl.getUniformLocation(program, "u_color");

            // Validate that all required locations were found
            if (positionAttributeLocationRef.current < 0 ||
                !resolutionUniformLocationRef.current ||
                !translationUniformLocationRef.current ||
                !dimensionsUniformLocationRef.current ||
                !colorUniformLocationRef.current) {
                const missing = [
                    positionAttributeLocationRef.current < 0 ? "a_position (attrib)" : null,
                    !resolutionUniformLocationRef.current ? "u_resolution (uniform)" : null,
                    !translationUniformLocationRef.current ? "u_translation (uniform)" : null,
                    !dimensionsUniformLocationRef.current ? "u_dimensions (uniform)" : null,
                    !colorUniformLocationRef.current ? "u_color (uniform)" : null,
                ].filter(Boolean).join(', ');
                // Clean up program before throwing error
                if (programRef.current) gl.deleteProgram(programRef.current);
                programRef.current = null;
                throw new Error(`Failed to get mandatory shader locations: ${missing}`);
            }

            // --- Create Quad Buffer (Vertices for a single 1x1 quad) ---
            // This quad will be scaled and translated using uniforms for each cell/line
            const positions = new Float32Array([
                0, 0, // Top-left
                1, 0, // Top-right
                0, 1, // Bottom-left
                0, 1, // Bottom-left (completing 1st triangle)
                1, 0, // Top-right (completing 2nd triangle)
                1, 1, // Bottom-right
            ]);
            const buffer = gl.createBuffer();
            if (!buffer) {
                 // Clean up program before throwing error
                 if (programRef.current) gl.deleteProgram(programRef.current);
                 programRef.current = null;
                 throw new Error("Failed to create position buffer");
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW); // Upload data
            gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer after data setup (good practice)
            positionBufferRef.current = buffer; // Store buffer reference

            // --- Initialization Complete ---
            if (DEBUG_GL) console.log("WebGL Initialized Successfully.");
            isInitializedRef.current = true; // Mark GL state as ready *after* all setup steps
            startRenderLoop(); // Start the drawing loop now that everything is ready

        } catch (error) {
            console.error("!!! WebGL Initialization Failed !!!", error);
            isInitializedRef.current = false; // Ensure state reflects initialization failure
            // Attempt to clean up any partially created GL resources
            if (glRef.current) {
                // Use the stored refs to delete resources if they were created before the error
                if (programRef.current) {
                    try { glRef.current.deleteProgram(programRef.current); } catch(e){ console.error("Error deleting program during init cleanup:", e); }
                }
                if (positionBufferRef.current) {
                     try { glRef.current.deleteBuffer(positionBufferRef.current); } catch(e){ console.error("Error deleting buffer during init cleanup:", e); }
                }
            }
            // Clear potentially invalid refs
            programRef.current = null;
            positionBufferRef.current = null;
            glRef.current = null; // Consider the GL context lost or unusable
        }
    }, [startRenderLoop, stopRenderLoop, DEBUG_GL]); // Dependencies: functions needed within the callback

    // --- AppState Effect & Unmount Cleanup ---
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (DEBUG_GL) console.log(`App state changed: ${appState.current} -> ${nextAppState}`);
            // Pause rendering when app goes into the background or becomes inactive
            if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                if (DEBUG_GL) console.log("App inactive/background, pausing render loop.");
                stopRenderLoop();
            }
            // Resume rendering when app becomes active *only if* GL is properly initialized
            else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (isInitializedRef.current && glRef.current) {
                    if (DEBUG_GL) console.log("App active, resuming render loop.");
                    // Important: Re-check pixel ratio in case it changed while inactive (unlikely but possible)
                    pixelRatioRef.current = PixelRatio.get();
                    startRenderLoop();
                } else {
                    // If GL wasn't ready, don't start the loop. onContextCreate should handle it if the context needs re-creation.
                    if (DEBUG_GL) console.warn("App became active, but GL context not ready. Waiting for onContextCreate or next render attempt.");
                }
            }
            // Update the current app state ref
            appState.current = nextAppState;
        };

        // Subscribe to AppState changes
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        // Initial check: If component mounts while app is active and GL is already initialized (e.g., via fast refresh), ensure loop starts.
        if (appState.current === 'active' && isInitializedRef.current) {
            if (DEBUG_GL) console.log("Component mounted while active and initialized, ensuring render loop starts.");
            startRenderLoop();
        }

        // Cleanup function runs when component unmounts
        return () => {
            if (DEBUG_GL) console.log("Cleaning up MainGridView: stopping loop, removing AppState listener.");
            stopRenderLoop(); // Ensure render loop is stopped
            subscription.remove(); // Remove the AppState listener

            // Explicitly release WebGL resources on unmount
            // This helps prevent resource leaks, especially during development/hot-reloading
            if (glRef.current) {
                if (DEBUG_GL) console.log("Cleaning up WebGL resources (Program, Buffer)...");
                // Use the stored refs to delete the resources
                if (programRef.current) {
                    try { glRef.current.deleteProgram(programRef.current); } catch(e) { console.error("Error deleting program during unmount cleanup:", e); }
                 }
                if (positionBufferRef.current) {
                     try { glRef.current.deleteBuffer(positionBufferRef.current); } catch(e) { console.error("Error deleting buffer during unmount cleanup:", e); }
                 }
                // Optional: Attempt to lose context to free up more GPU resources immediately
                // Note: This extension might not always be available.
                // try {
                //     const loseContextExt = glRef.current.getExtension('WEBGL_lose_context');
                //     if (loseContextExt) loseContextExt.loseContext();
                // } catch(e) { console.warn("Could not get/use WEBGL_lose_context extension."); }

            }
            // Clear refs related to GL resources
            programRef.current = null;
            positionBufferRef.current = null;
            isInitializedRef.current = false; // Mark as uninitialized
            glRef.current = null; // Clear GL context ref
            if (DEBUG_GL) console.log("WebGL resources cleanup attempted.");
        };
    }, [startRenderLoop, stopRenderLoop, DEBUG_GL]); // Dependencies for the effect


    // --- Render ---
    return (
        // Container View fills the space allocated by the parent
        <View style={styles.container}>
            {/* GLView manages the GL context lifecycle. It fills its container. */}
            {/* onContextCreate is called when the native GL context is ready */}
            <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    // Ensure the container allows the GLView to fill it
    container: {
        flex: 1, // Take up all available space
        backgroundColor: 'rgb(13, 13, 13)', // Match grid background for seamless look
        overflow: 'hidden' // Important for GLView rendering boundaries
    },
});

export default MainGridView;