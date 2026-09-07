import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';

const COLORS = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1e1e1e',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#666666',
  textDim: '#3a3a3a',
  accent: '#6366f1',
  accentDim: '#312e81',
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const API_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];

function getWeekDates() {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function todayDayIndex() {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
}

export default function HomeScreen() {
  const router = useRouter();
  const weekDates = getWeekDates();
  const todayIdx = todayDayIndex();
  const [selectedIdx, setSelectedIdx] = useState(todayIdx);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/weeks/1`)
      .then((r) => r.json())
      .then((data) => setWeekData(data))
      .catch((err) => console.error('Failed to load week:', err))
      .finally(() => setLoading(false));
  }, []);

  const selectedDate = weekDates[selectedIdx];
  const monthLabel = `${MONTHS[selectedDate.getMonth()]} '${selectedDate.getFullYear().toString().slice(2)}`;

  const dayData = weekData?.days?.[selectedIdx];
  const isRestDay = dayData?.is_rest_day ?? false;
  const exercises = dayData?.exercises ?? [];

  const groupedExercises = exercises.reduce((acc, ex) => {
    if (!acc[ex.title]) acc[ex.title] = [];
    acc[ex.title].push(ex);
    return acc;
  }, {});

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.monthPicker}>
          <Text style={styles.monthText}>{monthLabel}</Text>
          <Text style={styles.chevron}>{'  ›'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={() => setSelectedIdx(todayIdx)}
        >
          <Text style={styles.todayBtnText}>TODAY</Text>
        </TouchableOpacity>
      </View>

      {/* Week day strip */}
      <View style={styles.weekStrip}>
        {weekDates.map((date, i) => {
          const day = weekData?.days?.[i];
          const hasWorkout = day && !day.is_rest_day && (day.exercises?.length ?? 0) > 0;
          const isSelected = i === selectedIdx;
          const isToday = i === todayIdx;

          return (
            <TouchableOpacity
              key={i}
              style={styles.dayCell}
              onPress={() => setSelectedIdx(i)}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelActive]}>
                {DAY_LABELS[i]}
              </Text>
              <Text
                style={[
                  styles.dateNum,
                  isSelected && styles.dateNumActive,
                  isToday && !isSelected && styles.dateNumToday,
                ]}
              >
                {date.getDate()}
              </Text>
              <View style={styles.dotSlot}>
                {hasWorkout && (
                  <View style={[styles.dot, isSelected && styles.dotActive]} />
                )}
              </View>
              {isSelected && <View style={styles.selectedBar} />}
            </TouchableOpacity>
          );
        })}
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
        ) : isRestDay ? (
          <View style={styles.centeredMsg}>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.mutedText}>Recovery & regeneration</Text>
          </View>
        ) : exercises.length === 0 ? (
          <View style={styles.centeredMsg}>
            <Text style={styles.mutedText}>No workout scheduled</Text>
          </View>
        ) : (
          <>
            {/* Day name + count */}
            <View style={styles.dayTitleRow}>
              <Text style={styles.dayName}>
                {API_DAYS[selectedIdx].charAt(0).toUpperCase() +
                  API_DAYS[selectedIdx].slice(1)}
              </Text>
              <Text style={styles.exerciseCount}>
                {exercises.length} exercises
              </Text>
            </View>

            {/* Start Workout CTA */}
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() => router.push('/workout')}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnText}>Start Workout</Text>
            </TouchableOpacity>

            {/* Day description */}
            <View style={styles.descCard}>
              <Text style={styles.descTitle}>Today's Focus</Text>
              <Text style={styles.descBody}>
                {dayData?.description ??
                  'Session notes and coach instructions will appear here once added to your program.'}
              </Text>
            </View>

            {/* Exercise list */}
            <View style={styles.exerciseList}>
              {Object.entries(groupedExercises).map(([bodyPart, exList]) => (
                <View key={bodyPart} style={styles.exerciseGroup}>
                  <Text style={styles.bodyPartLabel}>{bodyPart.toUpperCase()}</Text>
                  {exList.map((ex) => {
                    const setsReps =
                      ex.sets && ex.rep_range
                        ? `${ex.sets} × ${ex.rep_range}`
                        : ex.rpe
                        ? `RPE ${ex.rpe}`
                        : null;

                    return (
                      <View key={ex.id} style={styles.exerciseRow}>
                        <View style={styles.exerciseIcon}>
                          <Text style={styles.exerciseIconText}>
                            {bodyPart.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.exerciseInfo}>
                          <Text style={styles.exerciseName}>{ex.subtitle}</Text>
                          {setsReps && (
                            <Text style={styles.setsReps}>{setsReps}</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
  chevron: {
    color: COLORS.textMuted,
    fontSize: 20,
    fontWeight: '300',
  },
  todayBtn: {
    borderWidth: 1,
    borderColor: COLORS.text,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  todayBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Week strip
  weekStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 0,
    position: 'relative',
  },
  dayLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayLabelActive: {
    color: COLORS.text,
  },
  dateNum: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '500',
  },
  dateNumActive: {
    color: COLORS.text,
    fontWeight: '700',
  },
  dateNumToday: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  dotSlot: {
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textMuted,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },
  selectedBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.text,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Day title row
  dayTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dayName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  exerciseCount: {
    color: COLORS.textMuted,
    fontSize: 13,
  },

  // Start button
  startBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  startBtnText: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Description card
  descCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  descTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  descBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },

  // Exercise list
  exerciseList: {
    gap: 8,
  },
  exerciseGroup: {
    marginBottom: 12,
  },
  bodyPartLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  exerciseIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exerciseIconText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  setsReps: {
    color: COLORS.accent,
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },

  // States
  centeredMsg: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 8,
  },
  restTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
