// PatternsTest.tsx - Simple component to test pattern imports
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Try importing the patterns directly
import { allPatterns, getPatternsByCategory } from '../lib/patterns';

const PatternsTest: React.FC = () => {
  // Run this effect when component mounts
  useEffect(() => {
    console.log('===== PATTERNS TEST =====');
    console.log(`Total patterns: ${allPatterns?.length || 'undefined'}`);
    
    if (allPatterns && allPatterns.length > 0) {
      console.log('First pattern:', allPatterns[0]);
      
      // Try to get patterns by category
      const stillLifes = getPatternsByCategory('still-life');
      const oscillators = getPatternsByCategory('oscillator');
      const spaceships = getPatternsByCategory('spaceship');
      
      console.log('Patterns by category:', {
        'still-life': stillLifes.length,
        'oscillator': oscillators.length,
        'spaceship': spaceships.length
      });
    } else {
      console.error('ERROR: No patterns found in allPatterns array');
    }
    console.log('========================');
  }, []);
  
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Pattern Test Component</Text>
      <Text style={styles.text}>Found {allPatterns?.length || 0} total patterns</Text>
      
      {allPatterns && allPatterns.length > 0 ? (
        <View>
          <Text style={styles.subheading}>First pattern:</Text>
          <Text style={styles.code}>{JSON.stringify(allPatterns[0], null, 2)}</Text>
          
          <Text style={styles.subheading}>Pattern categories:</Text>
          <Text style={styles.text}>Still life: {getPatternsByCategory('still-life').length}</Text>
          <Text style={styles.text}>Oscillators: {getPatternsByCategory('oscillator').length}</Text>
          <Text style={styles.text}>Spaceships: {getPatternsByCategory('spaceship').length}</Text>
        </View>
      ) : (
        <Text style={styles.error}>No patterns found!</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 10,
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subheading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  text: {
    fontSize: 14,
    marginBottom: 5,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: '#eee',
    padding: 8,
    borderRadius: 4,
  },
  error: {
    color: 'red',
    fontWeight: 'bold',
    marginTop: 10,
  }
});

export default PatternsTest; 