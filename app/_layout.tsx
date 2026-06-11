import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/useAuthStore';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';

// Mantener el splash visible mientras se cargan las fuentes
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, profile, isInitialized, initialize } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup     = segments[0] === '(auth)';
    const inClientGroup   = segments[0] === '(client)';
    const inBusinessGroup = segments[0] === '(business)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/login');
    } else if (profile) {
      if (profile.role === 'business') {
        if (!inBusinessGroup) router.replace('/(business)');
      } else {
        if (!inClientGroup) router.replace('/(client)');
      }
    }
  }, [session, profile, isInitialized]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)"     options={{ headerShown: false }} />
      <Stack.Screen name="(client)"   options={{ headerShown: false }} />
      <Stack.Screen name="(business)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Mientras las fuentes cargan, mostrar el color principal de la app
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#FF6B2B' }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}
