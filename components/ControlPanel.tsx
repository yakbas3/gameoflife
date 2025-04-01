// GameOfLifeApp/components/ControlPanel.tsx

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Pressable, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

interface ControlPanelProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onClear: () => void;
  onRandomize: () => void;
  onShowPatterns: () => void;
  onToggleDebug?: () => void;
  debugMode?: boolean;
  // Add props for speed control later if needed
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isRunning,
  onToggleRun,
  onStep,
  onClear,
  onRandomize,
  onShowPatterns,
  onToggleDebug,
  debugMode = false,
}) => {
  // Animation for the puzzle piece button
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Set up the glowing animation
  useEffect(() => {
    const startAnimation = () => {
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ]).start(() => startAnimation());
    };
    
    startAnimation();
    
    return () => {
      glowAnim.stopAnimation();
    };
  }, [glowAnim]);
  
  // Generate shadow color for the glowing effect
  const glowShadowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 123, 255, 0.3)', 'rgba(0, 123, 255, 0.9)']
  });
  
  // Define button order
  const buttonOrder = [
    {
      type: 'step',
      component: (
        <Pressable
          style={({pressed}) => [
            styles.iconButton,
            styles.stepButton,
            pressed && styles.buttonPressed,
            isRunning && styles.disabledButton
          ]}
          onPress={onStep}
          disabled={isRunning}
          accessibilityLabel="Step"
        >
          <FontAwesome5
            name="step-forward"
            size={22}
            color="#fff"
          />
        </Pressable>
      )
    },
    {
      type: 'random',
      component: (
        <Pressable
          style={({pressed}) => [
            styles.iconButton,
            styles.randomButton,
            pressed && styles.buttonPressed,
            isRunning && styles.disabledButton
          ]}
          onPress={onRandomize}
          disabled={isRunning}
          accessibilityLabel="Random"
        >
          <FontAwesome5
            name="random"
            size={22}
            color="#fff"
          />
        </Pressable>
      )
    },
    {
      type: 'play-pause',
      component: (
        <Pressable
          style={({pressed}) => [
            styles.iconButton,
            styles.playPauseButton,
            isRunning ? styles.pauseButton : styles.startButton,
            pressed && styles.buttonPressed
          ]}
          onPress={onToggleRun}
          accessibilityLabel={isRunning ? "Pause" : "Start"}
        >
          <FontAwesome5
            name={isRunning ? 'pause' : 'play'}
            size={24} // Slightly larger icon
            color="#fff"
          />
        </Pressable>
      )
    },
    {
      type: 'patterns',
      component: (
        <Animated.View style={{
          shadowColor: glowShadowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 10,
          elevation: 5,
          borderRadius: 25,
        }}>
          <Pressable
            style={({pressed}) => [
              styles.iconButton,
              styles.patternsButton,
              pressed && styles.buttonPressed,
              isRunning && styles.disabledButton
            ]}
            onPress={onShowPatterns}
            disabled={isRunning}
            accessibilityLabel="Patterns"
          >
            <FontAwesome5
              name="puzzle-piece"
              size={22}
              color="#fff"
            />
          </Pressable>
        </Animated.View>
      )
    },
    {
      type: 'clear',
      component: (
        <Pressable
          style={({pressed}) => [
            styles.iconButton,
            styles.clearButton,
            pressed && styles.buttonPressed
          ]}
          onPress={onClear}
          accessibilityLabel="Clear"
        >
          <FontAwesome5
            name="trash-alt"
            size={22}
            color="#fff"
          />
        </Pressable>
      )
    }
  ];

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        {buttonOrder.map((button, index) => (
          <View key={button.type}>
            {button.component}
          </View>
        ))}
      </View>
      
      {/* Debug Toggle is removed from UI but props are kept for functionality */}
      
      {/* Add Speed Slider/Buttons here later */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 15,
    paddingHorizontal: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  playPauseButton: {
    width: 60, // Slightly larger button
    height: 60, // Slightly larger button
    borderRadius: 30, // Keep it circular
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  disabledButton: {
    opacity: 0.5,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  pauseButton: {
    backgroundColor: '#FF9800',
  },
  stepButton: {
    backgroundColor: '#2196F3',
  },
  randomButton: {
    backgroundColor: '#9C27B0',
  },
  patternsButton: {
    backgroundColor: '#007bff',
  },
  clearButton: {
    backgroundColor: '#f44336',
  },
});

export default ControlPanel;