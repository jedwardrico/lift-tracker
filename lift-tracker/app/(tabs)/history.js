/* eslint-disable no-undef */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1e1e1e',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#666666',
  textDim: '#3a3a3a',
  accent: '#6366f1',
  green: '#4ade80',
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEPT',
  'OCT',
  'NOV',
  'DEC',
];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function parseDateLocal(isoStr) {
  const [datePart] = isoStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr) {
  const d = parseDateLocal(dateStr);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatYear(dateStr) {
  const [y] = dateStr.split('-');
  return `'${y.slice(2)}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function groupByDate(logs) {
  const map = {};
  for (const log of logs) {
    const dateStr = log.logged_at.slice(0, 10);
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(log);
  }
  return Object.entries(map)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, entries]) => ({ date, logs: entries }));
}

export default function HistoryScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback((showSpinner = true) => {
    if (showSpinner) setLoading(true);
    return fetch(`${BASE_URL}/logs`)
      .then((r) => r.json())
      .then((data) => setSessions(groupByDate(data)))
      .catch((err) => console.error('Failed to load history:', err))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const deleteSession = useCallback(
    (date, logs) => {
      Alert.alert(
        'Delete workout',
        `Delete this workout from ${formatDate(date)}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await Promise.all(
                  logs.map((log) =>
                    fetch(`${BASE_URL}/logs/${log.id}`, { method: 'DELETE' })
                  )
                );
                await loadHistory(false);
              } catch (err) {
                console.error('Failed to delete workout:', err);
                Alert.alert('Error', 'Could not delete this workout.');
              }
            },
          },
        ]
      );
    },
    [loadHistory]
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>HISTORY</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centeredMsg}>
            <Text style={styles.mutedText}>Loading…</Text>
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.centeredMsg}>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.mutedText}>
              Complete a workout to see it here
            </Text>
          </View>
        ) : (
          sessions.map(({ date, logs }) => {
            const totalReps = logs.reduce(
              (acc, log) =>
                acc + log.sets.reduce((a, s) => a + (s.reps || 0), 0),
              0
            );
            const totalWeight = logs.reduce(
              (acc, log) =>
                acc + log.sets.reduce((a, s) => a + (s.weight || 0), 0),
              0
            );
            const duration = logs.reduce(
              (acc, log) => Math.max(acc, log.duration_seconds || 0),
              0
            );

            return (
              <TouchableOpacity
                key={date}
                style={styles.sessionCard}
                onPress={() => router.push(`/session/${date}`)}
                activeOpacity={0.75}
              >
                <View style={styles.cardLeft}>
                  <View style={styles.dateRow}>
                    <Text style={styles.dateLabel}>{formatDate(date)}</Text>
                    <Text style={styles.yearLabel}>{formatYear(date)}</Text>
                  </View>
                  <Text style={styles.exerciseCount}>
                    {logs.length} {logs.length === 1 ? 'exercise' : 'exercises'}
                  </Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statChip}>
                      <Text style={styles.statValue}>{totalReps}</Text>
                      <Text style={styles.statUnit}> REPS</Text>
                    </View>
                    {totalWeight > 0 && (
                      <View style={styles.statChip}>
                        <Text style={styles.statValue}>{totalWeight}</Text>
                        <Text style={styles.statUnit}> LB</Text>
                      </View>
                    )}
                    {duration > 0 && (
                      <View style={styles.statChip}>
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color={COLORS.accent}
                          style={{ marginRight: 3 }}
                        />
                        <Text style={styles.statValue}>
                          {formatDuration(duration)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteSession(date, logs)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  dateLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  yearLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  exerciseCount: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  statUnit: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  centeredMsg: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
