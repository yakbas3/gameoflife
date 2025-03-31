// GameOfLifeApp/components/MainGridView.tsx

import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { ExpoWebGLRenderingContext, GLView } from 'expo-gl';
import type { SharedValue } from 'react-native-reanimated';
import type { GridState, Offset } from '../types/game';
import { GRID_ROWS, GRID_COLS } from '../constants/game';

// --- Props Interface ---
interface MainGridViewProps {
    grid: GridState;
    offset: SharedValue<Offset>;
    zoom: SharedValue<number>;
}

// --- Constants for Rendering ---
const CELL_SIZE = 8; // Base size before zoom
const ALIVE_COLOR: [number, number, number, number] = [0.2, 0.9, 0.2, 1.0];
const DEAD_COLOR: [number, number, number, number] = [0.1, 0.1, 0.1, 1.0];

// --- WebGL Shaders ---
const vertexShaderSource = `
  attribute vec2 a_position;
  uniform vec2 u_resolution;
  uniform vec2 u_translation; // Cell TOP-LEFT corner position on screen (pixels)
  uniform float u_size;       // Cell size on screen (pixels)

  void main() {
    vec2 scaledPosition = a_position * u_size;
    vec2 position = scaledPosition + u_translation;
    vec2 zeroToOne = position / u_resolution;
    vec2 zeroToTwo = zeroToOne * 2.0;
    vec2 clipSpace = zeroToTwo - 1.0;
    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  }
`;
const fragmentShaderSource = `
  precision mediump float;
  uniform vec4 u_color;
  void main() {
    gl_FragColor = u_color;
  }
`;

// --- The Component ---
const MainGridView: React.FC<MainGridViewProps> = ({ grid, offset, zoom }) => {
    // --- Refs ---
    const glRef = useRef<ExpoWebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const positionAttributeLocationRef = useRef<number>(-1);
    const resolutionUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const translationUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const sizeUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const colorUniformLocationRef = useRef<WebGLUniformLocation | null>(null);
    const positionBufferRef = useRef<WebGLBuffer | null>(null);
    const isInitializedRef = useRef(false);
    const frameRequestHandle = useRef<number | null>(null);
    const gridRef = useRef<GridState>(grid);
    const appState = useRef(AppState.currentState);

    // --- Update gridRef ---
    useEffect(() => {
        gridRef.current = grid;
    }, [grid]);

    // --- Drawing Function (Includes Pan/Zoom/Culling) ---
    const drawGrid = useCallback((gl: ExpoWebGLRenderingContext) => {
        const currentGrid = gridRef.current;
        // Read current offset/zoom values directly inside draw function
        const currentZoom = zoom.value;
        const currentOffsetX = offset.value.x;
        const currentOffsetY = offset.value.y;

        if (!programRef.current || !positionBufferRef.current || !currentGrid || !isInitializedRef.current) {
            return;
        }
        const canvasWidth = gl.drawingBufferWidth;
        const canvasHeight = gl.drawingBufferHeight;
        if (canvasWidth === 0 || canvasHeight === 0) return;

        // Basic GL setup
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        gl.clearColor(...DEAD_COLOR);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(programRef.current);

        // Bind buffer and vertex attribute pointer
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBufferRef.current);
        const posAttrLoc = positionAttributeLocationRef.current;
        gl.vertexAttribPointer(posAttrLoc, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(posAttrLoc);

        // Set resolution uniform
        gl.uniform2f(resolutionUniformLocationRef.current, canvasWidth, canvasHeight);

        // --- Calculate visible cell range (Culling) ---
        const effectiveCellSize = CELL_SIZE * currentZoom;

        // Determine the range of cell columns/rows that could be visible based on current view
        const minVisibleCol = Math.floor(-currentOffsetX / effectiveCellSize) - 1;
        const maxVisibleCol = Math.floor((canvasWidth - currentOffsetX) / effectiveCellSize) + 1;
        const minVisibleRow = Math.floor(-currentOffsetY / effectiveCellSize) - 1;
        const maxVisibleRow = Math.floor((canvasHeight - currentOffsetY) / effectiveCellSize) + 1;

        // Clamp ranges to grid boundaries
        const startCol = Math.max(0, minVisibleCol);
        const endCol = Math.min(GRID_COLS, maxVisibleCol);
        const startRow = Math.max(0, minVisibleRow);
        const endRow = Math.min(GRID_ROWS, maxVisibleRow);

        let cellsDrawn = 0;
        // --- Iterate ONLY through potentially visible cells ---
        for (let row = startRow; row < endRow; row++) {
            for (let col = startCol; col < endCol; col++) {
                if (currentGrid[row]?.[col] === 1) { // Check if cell is alive
                    // Calculate cell's screen position using offset and zoom
                    const screenX = col * effectiveCellSize + currentOffsetX;
                    const screenY = row * effectiveCellSize + currentOffsetY;

                    // Set uniforms for this specific cell
                    gl.uniform2f(translationUniformLocationRef.current, screenX, screenY); // Position
                    gl.uniform1f(sizeUniformLocationRef.current, effectiveCellSize);      // Size
                    gl.uniform4fv(colorUniformLocationRef.current, ALIVE_COLOR);         // Color

                    // Draw the cell
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    cellsDrawn++;
                }
            }
        }
        // console.log(`Finished drawing loop. ${cellsDrawn} visible cells drawn.`); // Optional debug log

    }, [zoom, offset]); // Depends on zoom/offset SharedValues passed as props

    // --- Render Loop ---
    const renderLoop = useCallback(() => {
        if (!glRef.current || !isInitializedRef.current) return;
        const gl = glRef.current;
        drawGrid(gl);
        gl.flush();
        gl.endFrameEXP();
        frameRequestHandle.current = requestAnimationFrame(renderLoop);
    }, [drawGrid]); // Depends on drawGrid

    // --- Loop Controllers ---
    const startRenderLoop = useCallback(() => {
        if (!isInitializedRef.current || !glRef.current) return;
        if (frameRequestHandle.current) cancelAnimationFrame(frameRequestHandle.current);
        renderLoop();
    }, [renderLoop]);
     const stopRenderLoop = useCallback(() => {
        if (frameRequestHandle.current) {
             cancelAnimationFrame(frameRequestHandle.current);
             frameRequestHandle.current = null;
         }
     }, []);

    // --- WebGL Context Creation ---
    const onContextCreate = useCallback((gl: ExpoWebGLRenderingContext) => {
        if (isInitializedRef.current && gl === glRef.current) { startRenderLoop(); return; }
        glRef.current = gl; isInitializedRef.current = false; stopRenderLoop();
        try {
            console.log("Running WebGL setup...");
            gl.clearColor(...DEAD_COLOR);
            // Setup Shaders, Program, Locations, Buffer (with error checks)
            const vertShader = gl.createShader(gl.VERTEX_SHADER)!; gl.shaderSource(vertShader, vertexShaderSource); gl.compileShader(vertShader); if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) throw new Error(`VS Error: ${gl.getShaderInfoLog(vertShader)}`);
            const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!; gl.shaderSource(fragShader, fragmentShaderSource); gl.compileShader(fragShader); if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) throw new Error(`FS Error: ${gl.getShaderInfoLog(fragShader)}`);
            const program = gl.createProgram()!; gl.attachShader(program, vertShader); gl.attachShader(program, fragShader); gl.linkProgram(program); gl.detachShader(program, vertShader); gl.deleteShader(vertShader); gl.detachShader(program, fragShader); gl.deleteShader(fragShader); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Link Error: ${gl.getProgramInfoLog(program)}`); programRef.current = program;
            positionAttributeLocationRef.current = gl.getAttribLocation(program, "a_position"); resolutionUniformLocationRef.current = gl.getUniformLocation(program, "u_resolution"); translationUniformLocationRef.current = gl.getUniformLocation(program, "u_translation"); sizeUniformLocationRef.current = gl.getUniformLocation(program, "u_size"); colorUniformLocationRef.current = gl.getUniformLocation(program, "u_color"); if (positionAttributeLocationRef.current < 0 || !resolutionUniformLocationRef.current /* etc */) throw new Error("Location Error...");
            const positions = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]; const buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW); positionBufferRef.current = buffer;
            // --- End Setup ---
            isInitializedRef.current = true; console.log("WebGL setup complete.");
            startRenderLoop();
        } catch (error) { console.error("WebGL Init Error:", error); isInitializedRef.current = false; /* cleanup */ }
    }, [startRenderLoop, stopRenderLoop]);

    // --- AppState Effect & Unmount Cleanup ---
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => { if (appState.current.match(/inactive|background/) && nextAppState === 'active') { startRenderLoop(); } else if (nextAppState.match(/inactive|background/)) { stopRenderLoop(); } appState.current = nextAppState; };
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        if (AppState.currentState === 'active') startRenderLoop();
        return () => { subscription.remove(); stopRenderLoop(); const gl = glRef.current; if (gl) { const p = programRef.current; const b = positionBufferRef.current; if (p) gl.deleteProgram(p); if (b) gl.deleteBuffer(b); } programRef.current = null; positionBufferRef.current = null; glRef.current = null; isInitializedRef.current = false; };
    }, [startRenderLoop, stopRenderLoop]);

    // --- Render ---
    return (
        <View style={styles.container}>
            <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
        </View>
    );
};

// --- Styles ---
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent', overflow: 'hidden' },
});

export default MainGridView;