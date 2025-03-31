// GameOfLifeApp/app/_layout.tsx (Modified with GestureHandlerRootView)

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated'; // Keep this import if needed by other parts

// 1. Import GestureHandlerRootView
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native'; // Import StyleSheet

import { useColorScheme } from '@/hooks/useColorScheme';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    // 2. Wrap the ThemeProvider (or the component directly inside it)
    //    with GestureHandlerRootView and apply flex: 1 style.
    <GestureHandlerRootView style={styles.container}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        {/* Keep StatusBar outside or inside ThemeProvider depending on desired behavior */}
        {/* Placing it inside makes sense if its style depends on the theme */}
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

// 3. Add the style for the container
const styles = StyleSheet.create({
    container: {
        flex: 1,
    }
});