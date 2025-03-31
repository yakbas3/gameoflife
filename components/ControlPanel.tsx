// GameOfLifeApp/components/ControlPanel.tsx

import React from 'react';
import { View, Button, StyleSheet, Platform, Switch, Text } from 'react-native';

interface ControlPanelProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onClear: () => void;
  onRandomize: () => void;
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
  onToggleDebug,
  debugMode = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        <Button
          title={isRunning ? 'Pause' : 'Start'}
          onPress={onToggleRun}
          // Use platform-specific colors or standard ones
          color={isRunning ? (Platform.OS === 'ios' ? '#FFA500' : '#FFA500') : (Platform.OS === 'ios' ? '#4CAF50' : '#4CAF50')}
        />
        <Button
          title="Step"
          onPress={onStep}
          disabled={isRunning} // Disable Step button while running
        />
        <Button
          title="Random"
          onPress={onRandomize}
          disabled={isRunning} // Disable Randomize while running
        />
        <Button
          title="Clear"
          onPress={onClear}
          color={Platform.OS === 'ios' ? '#f44336' : '#f44336'} // Red for Clear
        />
      </View>
      
      {/* Debug Toggle - only show if the toggle handler is provided */}
      {onToggleDebug && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug Mode</Text>
          <Switch
            value={debugMode}
            onValueChange={onToggleDebug}
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={debugMode ? "#f5dd4b" : "#f4f3f4"}
          />
        </View>
      )}
      
      {/* Add Speed Slider/Buttons here later */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 5,
    backgroundColor: '#e0e0e0', // Match placeholder style or customize
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', // Space out buttons
  },
  debugContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  debugText: {
    marginRight: 10,
    fontSize: 12,
    color: '#555',
  }
});

export default ControlPanel;