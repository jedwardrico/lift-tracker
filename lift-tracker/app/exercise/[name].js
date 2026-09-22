import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Linking,
  Alert,
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

const SHORT_MONTHS = [
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

// Sessions shown on the bar chart — enough to see a trend without the bars
// becoming too thin to tap/read on a phone-width screen.
const MAX_CHART_BARS = 8;
const CHART_HEIGHT = 120;

function formatShortDate(isoString) {
  const d = new Date(isoString);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

// Collapses a log's sets into the numbers a progress view cares about: the
// heaviest set actually completed (the usual "how much am I lifting"
// signal) and total volume (weight × reps, summed).
function summarizeLog(log) {
  const topWeight = log.sets.reduce(
    (max, s) => (s.weight != null && s.weight > max ? s.weight : max),
    0
  );
  const volume = log.sets.reduce(
    (acc, s) => acc + (s.weight || 0) * (s.reps || 0),
    0
  );
  return {
    id: log.id,
    loggedAt: log.logged_at,
    topWeight,
    volume,
    sets: log.sets,
  };
}

export default function ExerciseProgressScreen() {
  const { name, bodyPart } = useLocalSearchParams();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState(null);

  useEffect(() => {
    fetch(`${BASE_URL}/logs`)
      .then((r) => r.json())
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to load exercise history:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!name) return;
    fetch(`${BASE_URL}/exercises?exercise_name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) => {
        const target = name.trim().toLowerCase();
        const matches = (Array.isArray(data) ? data : []).filter(
          (e) => (e.exercise_name || '').trim().toLowerCase() === target
        );
        // Same exercise name can exist across programs; prefer whichever
        // match actually has a video, rather than just the first row.
        const withVideo = matches.find((e) => e.video_url);
        setVideoUrl(withVideo?.video_url ?? null);
      })
      .catch((err) => console.error('Failed to load exercise details:', err));
  }, [name]);

  const openVideo = async () => {
    if (!videoUrl) return;
    const canOpen = await Linking.canOpenURL(videoUrl);
    if (canOpen) {
      Linking.openURL(videoUrl);
    } else {
      Alert.alert('Unable to open link', videoUrl);
    }
  };

  // Oldest-first, matched by name (see workout.js's findPrevLog for why —
  // the same lift's exercise_id changes from week to week).
  const sessions = useMemo(() => {
    const target = (name || '').trim().toLowerCase();
    return logs
      .filter((l) => (l.exercise_name || '').trim().toLowerCase() === target)
      .map(summarizeLog)
      .sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));
  }, [logs, name]);

  const bestWeight = sessions.reduce((max, s) => Math.max(max, s.topWeight), 0);
  const chartSessions = sessions.slice(-MAX_CHART_BARS);
  const chartMax = Math.max(...chartSessions.map((s) => s.topWeight), 1);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.headerName}>{name}</Text>
          {bodyPart ? (
            <Text style={styles.headerCategory}>{bodyPart}</Text>
          ) : null}
        </View>
        <View style={{ width: 36 }} />
      </View>

      {videoUrl ? (
        <TouchableOpacity style={styles.watchRow} onPress={openVideo}>
          <Ionicons name="play-circle" size={18} color={COLORS.accent} />
          <Text style={styles.watchRowText}>Watch exercise demo</Text>
          <Ionicons name="open-outline" size={16} color={COLORS.textMuted} />
        </TouchableOpacity>
      ) : null}

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
            <Text style={styles.mutedText}>
              No logged sets for this exercise yet
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{sessions.length}</Text>
                <Text style={styles.statLabel}>SESSIONS</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>{bestWeight || '—'}</Text>
                <Text style={styles.statLabel}>BEST SET</Text>
              </View>
            </View>

            {chartMax > 0 && (
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>Top set weight</Text>
                <View style={styles.chart}>
                  {chartSessions.map((s) => (
                    <View key={s.id} style={styles.chartBarWrap}>
                      <Text style={styles.chartBarValue}>
                        {s.topWeight || '—'}
                      </Text>
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: Math.max(
                              4,
                              (s.topWeight / chartMax) * CHART_HEIGHT
                            ),
                          },
                        ]}
                      />
                      <Text style={styles.chartBarLabel}>
                        {formatShortDate(s.loggedAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>HISTORY</Text>
            {sessions
              .slice()
              .reverse()
              .map((s) => (
                <View key={s.id} style={styles.sessionCard}>
                  <Text style={styles.sessionDate}>
                    {formatShortDate(s.loggedAt)}
                  </Text>
                  <Text style={styles.sessionSets}>
                    {s.sets
                      .map((set) =>
                        set.weight != null
                          ? `${set.weight}×${set.reps ?? '—'}`
                          : `${set.reps ?? '—'} reps`
                      )
                      .join(', ')}
                  </Text>
                </View>
              ))}
          </>
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
  headerTitles: {
    alignItems: 'center',
  },
  headerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  headerCategory: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  watchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  watchRowText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centeredMsg: {
    paddingTop: 80,
    alignItems: 'center',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statChip: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.accent,
    fontSize: 22,
    fontWeight: '800',
    fontStyle: 'italic',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  chartTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 16,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: CHART_HEIGHT + 40,
  },
  chartBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartBarValue: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartBar: {
    width: 14,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },
  chartBarLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 6,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 8,
  },
  sessionDate: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  sessionSets: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
