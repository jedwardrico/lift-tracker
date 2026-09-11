/* eslint-disable no-undef */
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

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

function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(dateStr) {
  const d = parseDateLocal(dateStr);
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SessionDetailScreen() {
  const { date } = useLocalSearchParams();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/logs?date=${date}`)
      .then((r) => r.json())
      .then(setLogs)
      .catch((err) => console.error('Failed to load session:', err))
      .finally(() => setLoading(false));
  }, [date]);

  const totalReps = logs.reduce(
    (acc, log) => acc + log.sets.reduce((a, s) => a + (s.reps || 0), 0),
    0
  );
  const totalWeight = logs.reduce(
    (acc, log) => acc + log.sets.reduce((a, s) => a + (s.weight || 0), 0),
    0
  );
  const duration = logs.reduce(
    (acc, log) => Math.max(acc, log.duration_seconds || 0),
    0
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerDate}>{date ? formatDate(date) : ''}</Text>
        <View style={{ width: 36 }} />
      </View>

      {!loading && logs.length > 0 && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{logs.length}</Text>
            <Text style={styles.summaryLabel}>EXERCISES</Text>
          </View>
          <View style={styles.summarySeparator} />
          <View style={styles.summaryStat}>
            <Text style={styles.summaryValue}>{totalReps}</Text>
            <Text style={styles.summaryLabel}>REPS</Text>
          </View>
          {totalWeight > 0 && (
            <>
              <View style={styles.summarySeparator} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>{totalWeight}</Text>
                <Text style={styles.summaryLabel}>LB</Text>
              </View>
            </>
          )}
          {duration > 0 && (
            <>
              <View style={styles.summarySeparator} />
              <View style={styles.summaryStat}>
                <Text style={styles.summaryValue}>
                  {formatDuration(duration)}
                </Text>
                <Text style={styles.summaryLabel}>TIME</Text>
              </View>
            </>
          )}
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.centeredMsg}>
            <Text style={styles.mutedText}>Loading…</Text>
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.centeredMsg}>
            <Text style={styles.mutedText}>No data for this session</Text>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.exerciseCard}>
              <Text style={styles.exerciseCategory}>{log.body_part}</Text>
              <Text style={styles.exerciseName}>{log.exercise_name}</Text>

              <View style={styles.setsHeader}>
                <Text style={[styles.setCol, styles.setColNum]}>Set</Text>
                <Text style={[styles.setCol, styles.setColData]}>Reps</Text>
                <Text style={[styles.setCol, styles.setColData]}>Weight</Text>
              </View>

              {log.sets.map((s, i) => (
                <View key={s.id ?? i} style={styles.setRow}>
                  <Text
                    style={[
                      styles.setCell,
                      styles.setColNum,
                      styles.setNumText,
                    ]}
                  >
                    {s.set_number ?? i + 1}
                  </Text>
                  <Text style={[styles.setCell, styles.setColData]}>
                    {s.reps ?? '—'}
                  </Text>
                  <Text style={[styles.setCell, styles.setColData]}>
                    {s.weight ? `${s.weight} ${s.weight_unit ?? 'lb'}` : '—'}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDate: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 0,
  },
  summaryStat: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  summarySeparator: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.border,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 10,
  },
  exerciseCategory: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  setsHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  setCol: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  setColNum: {
    width: 36,
    textAlign: 'left',
  },
  setColData: {
    flex: 1,
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  setCell: {
    color: COLORS.text,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  setNumText: {
    color: COLORS.textDim,
    fontWeight: '600',
  },
  centeredMsg: {
    paddingTop: 80,
    alignItems: 'center',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
