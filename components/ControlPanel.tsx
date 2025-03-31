// GameOfLifeApp/components/ControlPanel.tsx

import React from 'react';
import { View, Button, StyleSheet, Platform } from 'react-native';

interface ControlPanelProps {
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onClear: () => void;
  onRandomize: () => void;
  // Add props for speed control later if needed
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isRunning,
  onToggleRun,
  onStep,
  onClear,
  onRandomize,
}) => {
  return (
    <View style={styles.container}>
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
      {/* Add Speed Slider/Buttons here later */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 80, // Match placeholder height or adjust as needed
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', // Space out buttons
    backgroundColor: '#e0e0e0', // Match placeholder style or customize
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ccc',
  },
});

export default ControlPanel;