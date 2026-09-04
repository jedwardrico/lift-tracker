import React from 'react';
import { View, Text, SafeAreaView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

const COLORS = {
  bg: '#0a0a0a',
  text: '#ffffff',
  textMuted: '#888888',
  green: '#4ade80',
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CompleteScreen() {
  const { elapsed } = useLocalSearchParams();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="checkmark-circle" size={72} color={COLORS.green} />
        <Text style={styles.title}>Workout Complete</Text>
        <Text style={styles.time}>{formatTime(parseInt(elapsed) || 0)}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
  },
  time: {
    color: COLORS.textMuted,
    fontSize: 18,
  },
});
