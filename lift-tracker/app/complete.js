import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

const COLORS = {
  bg: '#0a0a0a',
  surface: '#1a1a1a',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
  green: '#4ade80',
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function CompleteScreen() {
  const router = useRouter();
  const { elapsed, logs, totalReps, totalWeight } = useLocalSearchParams();
  const completedLogs = logs ? JSON.parse(logs) : [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Ionicons name="checkmark-circle" size={72} color={COLORS.green} />
          <Text style={styles.title}>Workout Complete</Text>
          <Text style={styles.time}>{formatTime(parseInt(elapsed) || 0)}</Text>
          {(totalReps > 0 || totalWeight > 0) && (
            <Text style={styles.summaryText}>
              <Text style={styles.summaryValue}>{totalReps ?? 0}</Text>
              <Text style={styles.summaryLabel}> REPS</Text>
              {'    '}
              <Text style={styles.summaryValue}>{totalWeight ?? 0}</Text>
              <Text style={styles.summaryLabel}> LB</Text>
            </Text>
          )}
        </View>

        {completedLogs.length > 0 && (
          <View style={styles.logSection}>
            <Text style={styles.logSectionTitle}>Lift Log</Text>
            {completedLogs.map((log, i) => (
              <View key={i} style={styles.logEntry}>
                <Text style={styles.logExName}>
                  {log.exercise?.subtitle ?? '—'}
                </Text>
                <Text style={styles.logCategory}>
                  {log.exercise?.title ?? ''}
                </Text>
                {log.sets.map((s, j) => (
                  <View key={s.id ?? j} style={styles.setRow}>
                    <Text style={styles.setNum}>{s.set_number ?? j + 1}</Text>
                    <Text style={styles.setText}>
                      {s.reps ?? '—'} reps
                      {s.weight ? `  ×  ${s.weight} lb` : ''}
                    </Text>
                    {s.completed && (
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={COLORS.green}
                      />
                    )}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>

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
  scroll: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
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
  summaryText: {
    fontSize: 18,
  },
  summaryValue: {
    color: COLORS.text,
    fontWeight: '800',
    fontStyle: 'italic',
    fontSize: 22,
  },
  summaryLabel: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 14,
  },
  logSection: {
    marginHorizontal: 16,
    gap: 12,
  },
  logSectionTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  logEntry: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 4,
  },
  logExName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  logCategory: {
    color: COLORS.textDim,
    fontSize: 12,
    marginBottom: 8,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setNum: {
    color: COLORS.textDim,
    fontSize: 13,
    width: 16,
    textAlign: 'center',
  },
  setText: {
    color: COLORS.textMuted,
    fontSize: 13,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  homeBtn: {
    marginHorizontal: 16,
    marginTop: 32,
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  homeBtnText: {
    color: '#0a0a0a',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
