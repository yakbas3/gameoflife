// GameOfLifeApp/components/MainGridView.tsx

// No changes needed in this file for the measurement fix.
// The parent component (GameScreen) now ensures it measures itself
// correctly before rendering MainGridView.
// The AppState listener here correctly handles pausing/resuming the GL render loop.

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
    vec2 pixelPosition = (a_position * u_dimensions) + u_translation;
    vec2 zeroToOne = pixelPosition / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace.x, -clipSpace.y, 0, 1); // Flip Y
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_color;
  void main() {
    gl_FragColor = u_color;
  }
`;

// --- Helper to check GL Errors ---
const checkGLError = (gl: ExpoWebGLRenderingContext | null, label: string): boolean => {
    if (!gl || !DEBUG_GL) return true;
    let errorFound = false;
    let error = gl.getError();
    while (error !== gl.NO_ERROR) {
        console.error(`WebGL Error (${label}): ${error}`);
        errorFound = true;
        error = gl.getError();
    }
    return !errorFound;
};

// --- The Component ---
const MainGridView: React.FC<MainGridViewProps> = ({
    liveCells,
    viewCenterCoords,
    cellSizeDP,
}) => {
    // --- Refs ---
    const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const positionAttributeLocationRef = useRef<number>(-1);
    const resolutionUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const translationUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const dimensionsUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const colorUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const positionBufferRef = useRef<WebGLBuffer | null>(null);
    const isInitializedRef = useRef(false);
    const frameRequestHandle = useRef<number | null>(null);
    const appState = useRef(AppState.currentState); // Tracks app state for render loop pause/resume
    const canvasSizeRef = useRef({ width: 0, height: 0 });
    const pixelRatioRef = useRef(PixelRatio.get());

    const liveCellsRef = useRef<GridState>(liveCells);
    useEffect(() => {
        liveCellsRef.current = liveCells;
    }, [liveCells]);

    // --- Function Definitions ---

    // 1. Stop Render Loop
    const stopRenderLoop = useCallback(() => {
        if (frameRequestHandle.current !== null) {
            if (DEBUG_GL) console.log("[MainGridView] Stopping render loop.");
            cancelAnimationFrame(frameRequestHandle.current);
            frameRequestHandle.current = null;
        }
    }, [DEBUG_GL]);

    // 2. Draw Grid (Core Drawing Logic - Operates in Pixels)
    const drawGrid = useCallback((gl: ExpoWebGLRenderingContext) => {
        const currentLiveCells = liveCellsRef.current;
        const centerRow = viewCenterCoords.value.row;
        const centerCol = viewCenterCoords.value.col;
        const currentCellSizeDP = cellSizeDP.value;
        const pRatio = pixelRatioRef.current;

        if (!programRef.current || !positionBufferRef.current || !isInitializedRef.current) {
            if (DEBUG_GL) console.warn("[MainGridView] drawGrid called before GL initialized or with missing resources.");
            stopRenderLoop();
            return;
        }

        const cellSizePixel = currentCellSizeDP * pRatio;
        if (cellSizePixel <= 0 || !isFinite(cellSizePixel)) {
            if (DEBUG_GL) console.error(`[MainGridView] drawGrid: Invalid calculated cellSizePixel (${cellSizePixel}). currentCellSizeDP=${currentCellSizeDP}, pixelRatio=${pRatio}. Stopping loop.`);
            stopRenderLoop();
            return;
        }

        const canvasWidth = gl.drawingBufferWidth;
        const canvasHeight = gl.drawingBufferHeight;

        if (canvasWidth <= 0 || canvasHeight <= 0) {
            if (DEBUG_GL) console.warn(`[MainGridView] drawGrid: Canvas size is zero or invalid (${canvasWidth}x${canvasHeight}). Skipping frame.`);
            return; // Don't stop loop, might recover
        }

        if (canvasWidth !== canvasSizeRef.current.width || canvasHeight !== canvasSizeRef.current.height) {
            if (DEBUG_GL) console.log(`[MainGridView] Canvas resize detected: ${canvasWidth}x${canvasHeight} [pixels]. Updating viewport.`);
            canvasSizeRef.current = { width: canvasWidth, height: canvasHeight };
            gl.viewport(0, 0, canvasWidth, canvasHeight);
            if (!checkGLError(gl, "glViewport")) return;
        }

        let minVisibleCol: number | undefined, maxVisibleCol: number | undefined;
        let minVisibleRow: number | undefined, maxVisibleRow: number | undefined;
        let cellsWidthVisible: number | undefined, cellsHeightVisible: number | undefined;

        try {
            gl.clearColor(...GRID_BG_COLOR);
            gl.clear(gl.COLOR_BUFFER_BIT);
            if (!checkGLError(gl, "glClear")) return;

            gl.useProgram(programRef.current);
            if (!checkGLError(gl, "glUseProgram")) return;
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
            if (!checkGLError(gl, "glBindBuffer")) return;
            const posAttrLoc = positionAttributeLocationRef.current;
            if (posAttrLoc === -1) {
                if (DEBUG_GL) console.error("[MainGridView] drawGrid: Invalid position attribute location.");
                stopRenderLoop(); return;
            }
            gl.enableVertexAttribArray(posAttrLoc);
            if (!checkGLError(gl, "glEnableVertexAttribArray")) return;
            gl.vertexAttribPointer(posAttrLoc, 2, gl.FLOAT, false, 0, 0);
            if (!checkGLError(gl, "glVertexAttribPointer")) return;

            if (!resolutionUniformLocationRef.current) {
                 if (DEBUG_GL) console.error("[MainGridView] drawGrid: Missing resolution uniform location.");
                 stopRenderLoop(); return;
            }
            gl.uniform2f(resolutionUniformLocationRef.current, canvasWidth, canvasHeight);
            if (!checkGLError(gl, "glUniform2f u_resolution")) return;

            cellsWidthVisible = canvasWidth / cellSizePixel;
            cellsHeightVisible = canvasHeight / cellSizePixel;
            if (!isFinite(cellsWidthVisible) || !isFinite(cellsHeightVisible)) {
                throw new Error(`Invalid cellsVisible calculation: W=${cellsWidthVisible}, H=${cellsHeightVisible}. Inputs: canvasW=${canvasWidth}, canvasH=${canvasHeight}, cellSizePixel=${cellSizePixel}`);
            }

            minVisibleCol = Math.floor(centerCol - cellsWidthVisible / 2 - 1);
            maxVisibleCol = Math.ceil(centerCol + cellsWidthVisible / 2 + 1);
            minVisibleRow = Math.floor(centerRow - cellsHeightVisible / 2 - 1);
            maxVisibleRow = Math.ceil(centerRow + cellsHeightVisible / 2 + 1);

             if (!isFinite(minVisibleCol) || !isFinite(maxVisibleCol) || !isFinite(minVisibleRow) || !isFinite(maxVisibleRow)) {
                 throw new Error(`Invalid visible range calculation: Row(${minVisibleRow}-${maxVisibleRow}), Col(${minVisibleCol}-${maxVisibleCol})`);
             }

            const drawGridLines = currentCellSizeDP > 4;
            if (drawGridLines) {
                 if (!colorUniformLocationRef.current || !dimensionsUniformLocationRef.current || !translationUniformLocationRef.current) {
                     if (DEBUG_GL) console.error("[MainGridView] drawGrid: Missing uniform location for grid lines.");
                 } else {
                    gl.uniform4fv(colorUniformLocationRef.current, GRID_LINE_COLOR);
                    if (!checkGLError(gl, "glUniform4fv grid line color")) return;
                    const lineThicknessPixel = Math.max(1, Math.floor(1 * pRatio));

                    // Vertical Lines
                    gl.uniform2f(dimensionsUniformLocationRef.current, lineThicknessPixel, canvasHeight);
                    if (!checkGLError(gl, "glUniform2f grid line V dim")) return;
                    for (let col = minVisibleCol; col <= maxVisibleCol; col++) {
                        const screenX = canvasWidth / 2 + (col - centerCol) * cellSizePixel;
                        if (screenX + lineThicknessPixel < 0 || screenX > canvasWidth) continue;
                         if (!isFinite(screenX)) {
                              if (DEBUG_GL) console.error(`Grid Line V: Invalid screenX (${screenX}) for col ${col}`);
                              continue;
                         }
                        gl.uniform2f(translationUniformLocationRef.current, screenX - lineThicknessPixel / 2, 0);
                        if (!checkGLError(gl, `glUniform2f grid line V trans col ${col}`)) continue;
                        gl.drawArrays(gl.TRIANGLES, 0, 6);
                        if (!checkGLError(gl, `glDrawArrays grid line V col ${col}`)) return;
                    }

                    // Horizontal Lines
                    gl.uniform2f(dimensionsUniformLocationRef.current, canvasWidth, lineThicknessPixel);
                    if (!checkGLError(gl, "glUniform2f grid line H dim")) return;
                    for (let row = minVisibleRow; row <= maxVisibleRow; row++) {
                        const screenY = canvasHeight / 2 + (row - centerRow) * cellSizePixel;
                        if (screenY + lineThicknessPixel < 0 || screenY > canvasHeight) continue;
                         if (!isFinite(screenY)) {
                              if (DEBUG_GL) console.error(`Grid Line H: Invalid screenY (${screenY}) for row ${row}`);
                              continue;
                         }
                        gl.uniform2f(translationUniformLocationRef.current, 0, screenY - lineThicknessPixel / 2);
                         if (!checkGLError(gl, `glUniform2f grid line H trans row ${row}`)) continue;
                        gl.drawArrays(gl.TRIANGLES, 0, 6);
                        if (!checkGLError(gl, `glDrawArrays grid line H row ${row}`)) return;
                    }
                 }
            }

             if (!colorUniformLocationRef.current || !dimensionsUniformLocationRef.current || !translationUniformLocationRef.current) {
                 if (DEBUG_GL) console.error("[MainGridView] drawGrid: Missing uniform location for live cells.");
             } else {
                gl.uniform4fv(colorUniformLocationRef.current, ALIVE_COLOR);
                 if (!checkGLError(gl, "glUniform4fv live cell color")) return;

                const cellPaddingDP = currentCellSizeDP > 3 ? 1 : 0;
                const cellPaddingPixel = Math.round(cellPaddingDP * pRatio);
                const cellDrawSizePixel = Math.max(0, cellSizePixel - cellPaddingPixel);

                if (cellDrawSizePixel <= 0) {
                     if (DEBUG_GL && currentLiveCells.size > 0) console.warn(`[MainGridView] Cell draw size is ${cellDrawSizePixel} pixels, skipping cell rendering.`);
                } else {
                    gl.uniform2f(dimensionsUniformLocationRef.current, cellDrawSizePixel, cellDrawSizePixel);
                    if (!checkGLError(gl, "glUniform2f live cell dim")) return;

                    for (const cellStr of currentLiveCells) {
                        const coords = stringToCoords(cellStr);
                        if (!coords) continue;
                        const { row, col } = coords;

                        if (row >= minVisibleRow && row <= maxVisibleRow && col >= minVisibleCol && col <= maxVisibleCol) {
                            const screenX = canvasWidth / 2 + (col - centerCol) * cellSizePixel;
                            const screenY = canvasHeight / 2 + (row - centerRow) * cellSizePixel;

                            if (screenX + cellSizePixel < 0 || screenX > canvasWidth || screenY + cellSizePixel < 0 || screenY > canvasHeight) {
                                continue;
                            }
                            if (!isFinite(screenX) || !isFinite(screenY)) {
                                 if (DEBUG_GL) console.error(`Live Cell: Invalid screen coords (${screenX.toFixed(1)}, ${screenY.toFixed(1)}) for cell [${row}, ${col}]`);
                                 continue;
                            }
                            gl.uniform2f(translationUniformLocationRef.current,
                                         screenX + cellPaddingPixel / 2,
                                         screenY + cellPaddingPixel / 2);
                             if (!checkGLError(gl, `glUniform2f live cell trans ${row},${col}`)) continue;

                            gl.drawArrays(gl.TRIANGLES, 0, 6);
                            if (!checkGLError(gl, `glDrawArrays live cell ${row},${col}`)) return;
                        }
                    }
                }
             }

            gl.disableVertexAttribArray(posAttrLoc);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.useProgram(null);
            if (!checkGLError(gl, "after cleanup")) return;

        } catch (error) {
            console.error("!!! [MainGridView] CRITICAL ERROR during drawGrid execution !!!", error);
            console.error("Context:", {
                centerRow, centerCol, canvasWidth, canvasHeight, cellSizePixel, currentCellSizeDP,
                cellsWidthVisible, cellsHeightVisible,
                minVisibleRow, maxVisibleRow, minVisibleCol, maxVisibleCol
            });
            stopRenderLoop();
        }

    }, [viewCenterCoords, cellSizeDP, stopRenderLoop, DEBUG_GL]);

    // 3. Render Loop
    const renderLoop = useCallback(() => {
        if (!glRef.current || !isInitializedRef.current || !programRef.current) {
             if (DEBUG_GL) console.warn("[MainGridView] Render loop called but GL context/program invalid or not initialized. Stopping.");
             stopRenderLoop();
            return;
        }

        const gl = glRef.current;
        try {
            drawGrid(gl);
            gl.flush();
            gl.endFrameEXP();
        } catch (e) {
            console.error("!!! [MainGridView] CRITICAL ERROR in render loop (during drawGrid/flush/endFrame) !!!", e);
            stopRenderLoop();
            return;
        }

        if (frameRequestHandle.current !== null) {
            frameRequestHandle.current = requestAnimationFrame(renderLoop);
        }
    }, [drawGrid, stopRenderLoop, DEBUG_GL]);

    // 4. Start Render Loop
    const startRenderLoop = useCallback(() => {
        if (!isInitializedRef.current) {
            if (DEBUG_GL) console.warn("[MainGridView] Attempted to start render loop before initialized.");
            return;
        }
        if (frameRequestHandle.current === null) {
            if (DEBUG_GL) console.log("[MainGridView] Starting render loop...");
            frameRequestHandle.current = 0;
            frameRequestHandle.current = requestAnimationFrame(renderLoop);
        } else {
             if (DEBUG_GL) console.log("[MainGridView] Render loop already running or scheduled.");
        }
    }, [renderLoop, DEBUG_GL]);

    // --- WebGL Context Creation ---
    const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
        if (DEBUG_GL) console.log("[MainGridView] onContextCreate called - Initializing WebGL...");
        stopRenderLoop();
        glRef.current = gl;
        isInitializedRef.current = false;
        programRef.current = null;
        positionBufferRef.current = null;
        pixelRatioRef.current = PixelRatio.get();

        try {
            const initialWidth = gl.drawingBufferWidth;
            const initialHeight = gl.drawingBufferHeight;
            if (initialWidth <= 0 || initialHeight <= 0) {
                console.warn(`[MainGridView] Initial canvas size invalid: ${initialWidth}x${initialHeight} [pixels]. Viewport setup deferred.`);
                 canvasSizeRef.current = { width: 0, height: 0 };
            } else {
                 canvasSizeRef.current = { width: initialWidth, height: initialHeight };
                 gl.viewport(0, 0, initialWidth, initialHeight);
                 if (!checkGLError(gl, "Initial glViewport")) throw new Error("Failed initial viewport setup.");
                 if (DEBUG_GL) console.log(`[MainGridView] Initial viewport set: ${initialWidth}x${initialHeight} [pixels]`);
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
            gl.deleteShader(vertShader); // Clean up linked shaders
            gl.deleteShader(fragShader);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                const log = gl.getProgramInfoLog(program);
                gl.deleteProgram(program);
                throw new Error(`Program link error: ${log || 'Unknown error'}`);
            }
            programRef.current = program;

            // --- Get Locations ---
            positionAttributeLocationRef.current = gl.getAttribLocation(program, "a_position");
            resolutionUniformLocationRef.current = gl.getUniformLocation(program, "u_resolution");
            translationUniformLocationRef.current = gl.getUniformLocation(program, "u_translation");
            dimensionsUniformLocationRef.current = gl.getUniformLocation(program, "u_dimensions");
            colorUniformLocationRef.current = gl.getUniformLocation(program, "u_color");

            if (positionAttributeLocationRef.current < 0 || !resolutionUniformLocationRef.current || !translationUniformLocationRef.current || !dimensionsUniformLocationRef.current || !colorUniformLocationRef.current) {
                const missing = [ /* ... */ ].filter(Boolean).join(', '); // Simplified for brevity
                 if (programRef.current) gl.deleteProgram(programRef.current);
                 programRef.current = null;
                throw new Error(`Failed to get mandatory shader locations: ${missing || 'Unknown'}`);
            }

            // --- Create Quad Buffer ---
            const positions = new Float32Array([0,0, 1,0, 0,1, 0,1, 1,0, 1,1]);
            const buffer = gl.createBuffer();
            if (!buffer) {
                 if (programRef.current) gl.deleteProgram(programRef.current);
                 programRef.current = null;
                 throw new Error("Failed to create position buffer");
            }
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            positionBufferRef.current = buffer;

            // --- Initialization Complete ---
            if (DEBUG_GL) console.log("[MainGridView] WebGL Initialized Successfully.");
            isInitializedRef.current = true;
             // Start loop only if app is currently active
             if (appState.current === 'active') {
                  startRenderLoop();
             } else {
                  if (DEBUG_GL) console.log("[MainGridView] Initialized but app not active, loop remains paused.");
             }

        } catch (error) {
            console.error("!!! [MainGridView] WebGL Initialization Failed !!!", error);
            isInitializedRef.current = false;
            // Cleanup GL resources on failure
            if (glRef.current) {
                if (programRef.current) { try { glRef.current.deleteProgram(programRef.current); } catch(e){} }
                if (positionBufferRef.current) { try { glRef.current.deleteBuffer(positionBufferRef.current); } catch(e){} }
            }
            programRef.current = null;
            positionBufferRef.current = null;
            glRef.current = null;
        }
    }, [startRenderLoop, stopRenderLoop, DEBUG_GL]);

    // --- AppState Effect & Unmount Cleanup (For Render Loop) ---
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (DEBUG_GL) console.log(`[MainGridView] App state changed: ${appState.current} -> ${nextAppState}`);
            if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
                if (DEBUG_GL) console.log("[MainGridView] App inactive/background, pausing render loop.");
                stopRenderLoop();
            }
            else if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                if (isInitializedRef.current && glRef.current) {
                    if (DEBUG_GL) console.log("[MainGridView] App active, resuming render loop.");
                    pixelRatioRef.current = PixelRatio.get(); // Re-check pixel ratio
                    startRenderLoop();
                } else {
                    if (DEBUG_GL) console.warn("[MainGridView] App became active, but GL context not ready. Waiting for onContextCreate or next render attempt.");
                }
            }
            appState.current = nextAppState;
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);
        if (DEBUG_GL) console.log("[MainGridView] AppState listener added for render loop control.");

        // Initial check on mount
        if (appState.current === 'active' && isInitializedRef.current) {
            if (DEBUG_GL) console.log("[MainGridView] Mounted while active and initialized, ensuring render loop starts.");
            startRenderLoop();
        }

        return () => {
            if (DEBUG_GL) console.log("[MainGridView] Cleaning up: stopping loop, removing AppState listener.");
            stopRenderLoop();
            subscription.remove();

            // Explicitly release WebGL resources on unmount
            if (glRef.current) {
                if (DEBUG_GL) console.log("[MainGridView] Cleaning up WebGL resources (Program, Buffer)...");
                 if (programRef.current) { try { glRef.current.deleteProgram(programRef.current); } catch(e) { console.error("Error deleting program during unmount cleanup:", e); } }
                 if (positionBufferRef.current) { try { glRef.current.deleteBuffer(positionBufferRef.current); } catch(e) { console.error("Error deleting buffer during unmount cleanup:", e); } }
                // Optional: Lose context if available
                 try {
                     const loseContextExt = glRef.current.getExtension('WEBGL_lose_context');
                     if (loseContextExt) loseContextExt.loseContext();
                 } catch(e) { console.warn("Could not get/use WEBGL_lose_context extension."); }
            }
            programRef.current = null;
            positionBufferRef.current = null;
            isInitializedRef.current = false;
            glRef.current = null;
            if (DEBUG_GL) console.log("[MainGridView] WebGL resources cleanup attempted.");
        };
    }, [startRenderLoop, stopRenderLoop, DEBUG_GL]);


    // --- Render ---
    return (
        <View style={styles.container}>
            <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgb(13, 13, 13)',
        overflow: 'hidden'
    },
});

export default MainGridView;