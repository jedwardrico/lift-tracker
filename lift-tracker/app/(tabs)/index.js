/* eslint-disable no-undef */
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  PanResponder,
  Animated,
  Easing,
  Dimensions,
  Alert,
  ActivityIndicator,
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
  accentDim: '#312e81',
  green: '#4ade80',
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const API_DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];
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

// Program week 1 is anchored to whatever date the server reports as the
// active program's start (see the `/program` fetch below) — this always
// falls on a Monday, except for the one program active before this
// per-program start date existed. The display week runs Sun–Sat; server
// days are stored Mon–Sun so serverDayIdx() maps between them.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// Whole days between the program start and today (can be negative before start).
function daysSinceStart(programStart) {
  const start = new Date(programStart);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today - start) / MS_PER_DAY);
}

// Program-week offset (0 = week 1) that contains today; clamped at 0.
function currentWeekOffset(programStart) {
  return Math.max(0, Math.floor(daysSinceStart(programStart) / 7));
}

// The Sun=0…Sat=6 display index for today within its program week.
function todayDayIndex(programStart) {
  const diff = daysSinceStart(programStart);
  return ((diff % 7) + 7) % 7;
}

// Display weeks run Sun(0)…Sat(6); the server returns days Mon(0)…Sun(6).
// This maps a display index to its position in the server's days array.
function serverDayIdx(displayIdx) {
  return (displayIdx + 6) % 7;
}

// Local YYYY-MM-DD key for a Date, used to match calendar days against the
// date portion of a completed log's `logged_at`.
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Dates for the 7 days of the program week at `offset` (0 = week 1).
function getWeekDates(programStart, offset = 0) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(programStart);
    d.setDate(programStart.getDate() + offset * 7 + i);
    return d;
  });
}

export default function HomeScreen() {
  const router = useRouter();
  const [programState, setProgramState] = useState(null);
  const [working, setWorking] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  const [availableWeeks, setAvailableWeeks] = useState([1]);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedDates, setCompletedDates] = useState(new Set());

  const programStart = programState
    ? parseDateKey(programState.program_start_date)
    : null;
  const currentOffset = programStart ? currentWeekOffset(programStart) : 0;
  const todayIdx = programStart ? todayDayIndex(programStart) : 0;
  const weekDates = programStart ? getWeekDates(programStart, weekOffset) : [];
  const weekNumber = weekOffset + 1;
  const isCurrentWeek = weekOffset === currentOffset;

  // Discover which program weeks exist so swiping can't run off the ends.
  // Also re-run after a switch/restart, since the new program can have a
  // different week count.
  const refreshWeeksList = useCallback(() => {
    fetch(`${BASE_URL}/weeks`)
      .then((r) => r.json())
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          const nums = list.map((w) => w.week_number);
          setAvailableWeeks(nums);
          // If today has run past the final program week, land on the last one.
          const maxOffset = Math.max(...nums) - 1;
          setWeekOffset((o) => Math.min(o, maxOffset));
        }
      })
      .catch((err) => console.error('Failed to load week list:', err));
  }, []);

  // Lands the view on whichever week/day makes "today", given a fresh
  // /program response (on mount, or right after a switch/restart resolves).
  const applyProgramState = useCallback((data) => {
    if (!data?.program_start_date) return;
    setProgramState(data);
    const start = parseDateKey(data.program_start_date);
    setWeekOffset(currentWeekOffset(start));
    setSelectedIdx(todayDayIndex(start));
  }, []);

  useEffect(() => {
    fetch(`${BASE_URL}/program`)
      .then((r) => r.json())
      .then(applyProgramState)
      .catch((err) => console.error('Failed to load program:', err));
  }, [applyProgramState]);

  // Called from the "program complete" takeover screen when the user picks
  // a program to start (or the active one, to restart).
  const handleSelectProgram = useCallback(
    (programKey) => {
      if (working || !programState) return;
      const isActive = programKey === programState.active_program;
      setWorking(true);
      fetch(`${BASE_URL}/program/${isActive ? 'restart' : 'switch'}`, {
        method: 'POST',
        headers: isActive ? undefined : { 'Content-Type': 'application/json' },
        body: isActive ? undefined : JSON.stringify({ program: programKey }),
      })
        .then((r) => r.json())
        .then((data) => {
          applyProgramState(data);
          refreshWeeksList();
        })
        .catch((err) => {
          console.error('Failed to update program:', err);
          Alert.alert('Error', 'Could not update the program.');
        })
        .finally(() => setWorking(false));
    },
    [working, programState, applyProgramState, refreshWeeksList]
  );

  // Keep the latest available-week list in a ref so the (once-created)
  // PanResponder always clamps against fresh bounds.
  const weeksRef = useRef(availableWeeks);
  weeksRef.current = availableWeeks;

  // Keep mutable refs so the once-created content PanResponder always sees
  // the latest selectedIdx and weekOffset without stale closures.
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;
  const weekOffsetRef = useRef(weekOffset);
  weekOffsetRef.current = weekOffset;

  const slideAnim = useRef(new Animated.Value(0)).current;
  const SLIDE_WIDTH = Dimensions.get('window').width;

  const animatedShift = useCallback(
    (delta, newWeekOffset, newSelectedIdx) => {
      const outX = delta > 0 ? -SLIDE_WIDTH : SLIDE_WIDTH;
      Animated.timing(slideAnim, {
        toValue: outX,
        duration: 160,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        slideAnim.setValue(-outX);
        setWeekOffset(newWeekOffset);
        setSelectedIdx(newSelectedIdx);
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      });
    },
    [slideAnim, SLIDE_WIDTH]
  );
  const animatedShiftRef = useRef(animatedShift);
  animatedShiftRef.current = animatedShift;

  const shiftWeek = useCallback((delta) => {
    const weeks = weeksRef.current;
    const minOffset = Math.min(...weeks) - 1;
    const maxOffset = Math.max(...weeks) - 1;
    const newOffset = Math.max(
      minOffset,
      Math.min(maxOffset, weekOffsetRef.current + delta)
    );
    if (newOffset === weekOffsetRef.current) return;
    animatedShiftRef.current(delta, newOffset, selectedIdxRef.current);
  }, []);
  const shiftWeekRef = useRef(shiftWeek);
  shiftWeekRef.current = shiftWeek;

  const shiftDay = useCallback((delta) => {
    const weeks = weeksRef.current;
    const minOffset = Math.min(...weeks) - 1;
    const maxOffset = Math.max(...weeks) - 1;
    const curDay = selectedIdxRef.current;
    const curWeek = weekOffsetRef.current;

    let nextDay = curDay + delta;
    let nextWeek = curWeek;

    if (nextDay < 0) {
      if (curWeek <= minOffset) return;
      nextWeek = curWeek - 1;
      nextDay = 6;
    } else if (nextDay > 6) {
      if (curWeek >= maxOffset) return;
      nextWeek = curWeek + 1;
      nextDay = 0;
    }

    animatedShiftRef.current(delta, nextWeek, nextDay);
  }, []);

  const shiftDayRef = useRef(shiftDay);
  shiftDayRef.current = shiftDay;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -40) shiftWeekRef.current(1);
        else if (g.dx >= 40) shiftWeekRef.current(-1);
      },
    })
  ).current;

  const contentPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -40) shiftDayRef.current(1);
        else if (g.dx >= 40) shiftDayRef.current(-1);
      },
    })
  ).current;

  useEffect(() => {
    refreshWeeksList();
  }, [refreshWeeksList]);

  // Load the dates of completed workouts so the strip can mark them green.
  // Runs on focus so a workout finished this session shows up on return.
  useFocusEffect(
    useCallback(() => {
      fetch(`${BASE_URL}/logs`)
        .then((r) => r.json())
        .then((logs) => {
          if (!Array.isArray(logs)) return;
          setCompletedDates(
            new Set(logs.map((log) => log.logged_at.slice(0, 10)))
          );
        })
        .catch((err) => console.error('Failed to load completed logs:', err));
    }, [])
  );

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE_URL}/weeks/${weekNumber}`)
      .then((r) => r.json())
      .then((data) => setWeekData(data))
      .catch((err) => console.error('Failed to load week:', err))
      .finally(() => setLoading(false));
  }, [weekNumber]);

  if (!programStart) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centeredMsg}>
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Program finished (its last workout is logged complete) — take over the
  // screen with a "what's next" picker instead of showing stale/missing
  // weeks. Stays up through any queued switch/restart until that program's
  // Monday actually arrives and normal week content resumes.
  if (programState.program_complete) {
    const activeLabel =
      programState.available_programs.find(
        (p) => p.key === programState.active_program
      )?.label ?? programState.active_program;
    const pendingLabel = programState.pending_program
      ? (programState.available_programs.find(
          (p) => p.key === programState.pending_program
        )?.label ?? programState.pending_program)
      : null;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.takeoverBody}>
          <Ionicons name="trophy" size={44} color={COLORS.accent} />
          <Text style={styles.takeoverTitle}>Program Complete!</Text>
          <Text style={styles.takeoverSubtitle}>
            You finished every week of {activeLabel}. Nice work.
          </Text>

          {pendingLabel ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={16} color={COLORS.accent} />
              <Text style={styles.pendingText}>
                {pendingLabel} starts{' '}
                {formatDateKey(programState.pending_start_date)}
              </Text>
            </View>
          ) : null}

          <Text style={styles.takeoverPrompt}>
            Start a new program, or run this one again?
          </Text>

          <View style={styles.card}>
            {programState.available_programs.map((program, i) => {
              const isActive = program.key === programState.active_program;
              const isQueued = program.key === programState.pending_program;
              return (
                <TouchableOpacity
                  key={program.key}
                  style={[styles.programRow, i > 0 && styles.programRowBorder]}
                  disabled={working}
                  onPress={() => handleSelectProgram(program.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.programName}>{program.label}</Text>
                  <View style={styles.programRowRight}>
                    {isQueued ? (
                      <Text style={styles.queuedBadge}>QUEUED</Text>
                    ) : null}
                    <Text style={styles.actionLabel}>
                      {isActive ? 'RESTART' : 'START'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {working ? <ActivityIndicator color={COLORS.text} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  const selectedDate = weekDates[selectedIdx];
  const monthLabel = `${MONTHS[selectedDate.getMonth()]} '${selectedDate.getFullYear().toString().slice(2)}`;

  const dayData = weekData?.days?.[serverDayIdx(selectedIdx)];
  const isRestDay = dayData?.is_rest_day ?? false;
  const exercises = dayData?.exercises ?? [];

  const groupedExercises = exercises.reduce((acc, ex) => {
    if (!acc[ex.body_part]) acc[ex.body_part] = [];
    acc[ex.body_part].push(ex);
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
          onPress={() => {
            setWeekOffset(currentOffset);
            setSelectedIdx(todayIdx);
          }}
        >
          <Text style={styles.todayBtnText}>TODAY</Text>
        </TouchableOpacity>
      </View>

      {/* Week day strip (swipe left/right to change weeks) */}
      <View style={styles.weekStrip} {...panResponder.panHandlers}>
        {weekDates.map((date, i) => {
          const day = weekData?.days?.[serverDayIdx(i)];
          const hasWorkout =
            day && !day.is_rest_day && (day.exercises?.length ?? 0) > 0;
          const isSelected = i === selectedIdx;
          const isToday = isCurrentWeek && i === todayIdx;
          const isCompleted = completedDates.has(toDateKey(date));

          return (
            <TouchableOpacity
              key={i}
              style={styles.dayCell}
              onPress={() => setSelectedIdx(i)}
            >
              <Text
                style={[
                  styles.dateNum,
                  isSelected && styles.dateNumActive,
                  isToday && !isSelected && styles.dateNumToday,
                  isCompleted && styles.dateNumCompleted,
                ]}
              >
                {date.getDate()}
              </Text>
              <View style={styles.dotSlot}>
                {isCompleted ? (
                  <View style={[styles.dot, styles.dotCompleted]} />
                ) : hasWorkout ? (
                  <View style={[styles.dot, isSelected && styles.dotActive]} />
                ) : null}
              </View>
              {isSelected && <View style={styles.selectedBar} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.scrollWrapper} {...contentPanResponder.panHandlers}>
        <Animated.View
          style={{ flex: 1, transform: [{ translateX: slideAnim }] }}
        >
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
                    Week {weekNumber} · {exercises.length} exercises
                  </Text>
                </View>

                {/* Start Workout CTA */}
                <TouchableOpacity
                  style={styles.startBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/workout',
                      // workout.js indexes straight into the server's
                      // Mon(0)…Sun(6) days array, so convert from this
                      // screen's Sun(0)…Sat(6) display index.
                      params: {
                        week: weekNumber,
                        day: serverDayIdx(selectedIdx),
                      },
                    })
                  }
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
                  {Object.entries(groupedExercises).map(
                    ([bodyPart, exList]) => (
                      <View key={bodyPart} style={styles.exerciseGroup}>
                        <Text style={styles.bodyPartLabel}>
                          {bodyPart.toUpperCase()}
                        </Text>
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
                                <Text style={styles.exerciseName}>
                                  {ex.exercise_name}
                                </Text>
                                {setsReps && (
                                  <Text style={styles.setsReps}>
                                    {setsReps}
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )
                  )}
                </View>
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </View>
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
  dateNumCompleted: {
    color: COLORS.green,
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
  dotCompleted: {
    backgroundColor: COLORS.green,
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
  scrollWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
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

  // Program-complete takeover
  takeoverBody: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  takeoverTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 16,
  },
  takeoverSubtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
  },
  takeoverPrompt: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 14,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accentDim,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 20,
  },
  pendingText: {
    color: COLORS.text,
    fontSize: 13,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
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
  programRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  programName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  queuedBadge: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
