/* eslint-disable no-undef */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1e1e1e',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#666666',
  accent: '#6366f1',
  accentDim: '#1e1b4b',
  green: '#4ade80',
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export default function SettingsScreen() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const loadProgram = useCallback(() => {
    return fetch(`${BASE_URL}/program`)
      .then((r) => r.json())
      .then(setState)
      .catch((err) => console.error('Failed to load program:', err))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgram();
    }, [loadProgram])
  );

  const confirmSwitch = useCallback((program) => {
    Alert.alert(
      `Switch to ${program.label}?`,
      `This week continues as-is. ${program.label} starts on the next Monday, from week 1.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              const res = await fetch(`${BASE_URL}/program/switch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ program: program.key }),
              });
              setState(await res.json());
            } catch (err) {
              console.error('Failed to switch program:', err);
              Alert.alert('Error', 'Could not switch programs.');
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }, []);

  const confirmRestart = useCallback(() => {
    if (!state) return;
    const activeLabel =
      state.available_programs.find((p) => p.key === state.active_program)
        ?.label ?? state.active_program;
    Alert.alert(
      'Restart program?',
      `This week continues as-is. ${activeLabel} restarts from week 1 on the next Monday.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              const res = await fetch(`${BASE_URL}/program/restart`, {
                method: 'POST',
              });
              setState(await res.json());
            } catch (err) {
              console.error('Failed to restart program:', err);
              Alert.alert('Error', 'Could not restart the program.');
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }, [state]);

  const confirmCancel = useCallback(() => {
    Alert.alert(
      'Cancel scheduled change?',
      'Your current program keeps running as-is.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel change',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              const res = await fetch(`${BASE_URL}/program/cancel`, {
                method: 'POST',
              });
              setState(await res.json());
            } catch (err) {
              console.error('Failed to cancel scheduled change:', err);
              Alert.alert('Error', 'Could not cancel the scheduled change.');
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>SETTINGS</Text>
      </View>

      {loading ? (
        <View style={styles.centeredMsg}>
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>PROGRAM</Text>

          {state.pending_program ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={16} color={COLORS.accent} />
              <Text style={styles.pendingText}>
                {state.pending_program === state.active_program
                  ? 'Restarting'
                  : `Switching to ${
                      state.available_programs.find(
                        (p) => p.key === state.pending_program
                      )?.label ?? state.pending_program
                    }`}{' '}
                on {formatDateKey(state.pending_start_date)}
              </Text>
              <TouchableOpacity
                onPress={confirmCancel}
                disabled={working}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.pendingCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.card}>
            {state.available_programs.map((program, i) => {
              const isActive = program.key === state.active_program;
              return (
                <TouchableOpacity
                  key={program.key}
                  style={[styles.programRow, i > 0 && styles.programRowBorder]}
                  disabled={isActive || working}
                  onPress={() => confirmSwitch(program)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.programName}>{program.label}</Text>
                  {isActive ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.textMuted}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.restartBtn}
            onPress={confirmRestart}
            disabled={working}
            activeOpacity={0.8}
          >
            {working ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color={COLORS.text} />
                <Text style={styles.restartBtnText}>Restart Program</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  centeredMsg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accentDim,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  pendingText: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  pendingCancel: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  programRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  programName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  restartBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
