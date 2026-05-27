import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/useAuthStore';

function RootLayoutNav() {
  const { session, profile, isInitialized, initialize } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inClientGroup = segments[0] === '(client)';
    const inBusinessGroup = segments[0] === '(business)';

    if (!session) {
      // No hay sesión → ir a login
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else if (profile) {
      // Hay sesión → redirigir según rol
      if (profile.role === 'business') {
        if (!inBusinessGroup) {
          router.replace('/(business)');
        }
      } else {
        // client o admin
        if (!inClientGroup) {
          router.replace('/(client)');
        }
      }
    }
  }, [session, profile, isInitialized]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(client)" options={{ headerShown: false }} />
      <Stack.Screen name="(business)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <RootLayoutNav />
    </GestureHandlerRootView>
  );
}
