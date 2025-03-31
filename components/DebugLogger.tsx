// GameOfLifeApp/components/DebugLogger.tsx

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Button, StyleSheet, Platform } from 'react-native';
import loggerService from '../lib/loggerService'; // Adjust path if needed

interface DebugLoggerProps {
  maxHeight?: number;
}

const DebugLogger: React.FC<DebugLoggerProps> = ({ maxHeight = 150 }) => {
  const [logMessages, setLogMessages] = useState<string[]>(loggerService.getMessages());
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Subscribe to log updates
    const unsubscribe = loggerService.subscribe((messages) => {
      setLogMessages(messages);
      // Attempt to scroll to bottom (might need slight delay on some platforms)
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []); // Empty dependency array means this effect runs once on mount

  return (
    <View style={[styles.container, { maxHeight }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug Log</Text>
        <Button title="Clear" onPress={loggerService.clearLogs} />
      </View>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled={true} // Helps if inside another ScrollView
      >
        {logMessages.length === 0 ? (
          <Text style={styles.logText}>No logs yet...</Text>
        ) : (
          logMessages.map((msg, index) => (
            <Text key={index} style={styles.logText}>
              {msg}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#aaa',
    borderRadius: 4,
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#e0e0e0',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollView: {
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  scrollContent: {
    paddingBottom: 10, // Ensure last line isn't cut off
  },
  logText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', // Monospaced font
    color: '#333',
    marginVertical: 1,
  },
});

export default DebugLogger;