import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Disable the native swipe-back gesture on the workout screen so a
          back-swipe is handled in-screen (previous exercise) instead of
          always popping and exiting the workout. */}
      <Stack.Screen name="workout" options={{ gestureEnabled: false }} />
    </Stack>
  );
}
