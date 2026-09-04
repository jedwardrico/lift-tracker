import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

const COLORS = {
  bg: '#0a0a0a',
  surface: '#1a1a1a',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#888888',
  textDim: '#555555',
  green: '#4ade80',
  blue: '#3b82f6',
  yellow: '#facc15',
  inputBg: '#1e1e1e',
};

// Change to your machine's local IP when testing on a physical device
const BASE_URL = 'http://localhost:3000';

function buildInitialSets(count, repRange) {
  const reps = repRange ? repRange.split('-')[0] : '8';
  return Array.from({ length: count || 2 }, (_, i) => ({
    id: i + 1,
    reps,
    weight: '',
    completed: false,
  }));
}

export default function App() {
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [workoutDone, setWorkoutDone] = useState(false);
  const [completedExercises, setCompletedExercises] = useState(new Set());
  const [sets, setSets] = useState([
    { id: 1, reps: '8', weight: '', completed: false },
    { id: 2, reps: '8', weight: '', completed: false },
  ]);
  const [note, setNote] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);
  const savedSetsMap = useRef({});

  useEffect(() => {
    fetch(`${BASE_URL}/weeks/1`)
      .then((r) => r.json())
      .then((data) => {
        setWeekData(data);
        const firstActiveDay = data.days?.find((d) => !d.is_rest_day);
        const firstExercise = firstActiveDay?.exercises?.[0];
        if (firstExercise) {
          setSets(buildInitialSets(firstExercise.sets, firstExercise.rep_range));
        }
      })
      .catch((err) => console.error('Failed to load week:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => setTimerSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const addSet = () => {
    setSets((prev) => [
      ...prev,
      { id: Date.now(), reps: '8', weight: '', completed: false },
    ]);
  };

  const removeSet = () => {
    if (sets.length > 1) setSets((prev) => prev.slice(0, -1));
  };

  const toggleComplete = (id) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
    );
  };

  const updateReps = (id, val) => {
    setSets((prev) => prev.map((s) => (s.id === id ? { ...s, reps: val } : s)));
  };

  const updateWeight = (id, val) => {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, weight: val } : s))
    );
  };

  const totalReps = sets.reduce(
    (acc, s) => acc + (s.completed ? parseInt(s.reps) || 0 : 0),
    0
  );
  const totalWeight = sets.reduce(
    (acc, s) => acc + (s.completed ? parseFloat(s.weight) || 0 : 0),
    0
  );

  const firstActiveDay = weekData?.days?.find((d) => !d.is_rest_day);
  const exercises = firstActiveDay?.exercises ?? [];
  const exercise = exercises[exerciseIndex];
  const totalSets = sets.length;

  const navigateTo = (targetIndex) => {
    savedSetsMap.current[exerciseIndex] = sets;
    const targetExercise = exercises[targetIndex];
    setSets(savedSetsMap.current[targetIndex] ?? buildInitialSets(targetExercise.sets, targetExercise.rep_range));
    setNote('');
    setExerciseIndex(targetIndex);
  };

  const handleNext = () => {
    if (exercise) {
      const allDone = sets.every((s) => s.completed);
      setCompletedExercises((prev) => {
        const next = new Set(prev);
        if (allDone) next.add(exerciseIndex); else next.delete(exerciseIndex);
        return next;
      });
      fetch(`${BASE_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: exercise.id,
          sets: sets.map((s, i) => ({
            set_number: i + 1,
            reps: parseInt(s.reps) || null,
            weight: parseFloat(s.weight) || null,
          })),
        }),
      }).catch((err) => console.error('Failed to log exercise:', err));
    }

    const nextIndex = exerciseIndex + 1;
    if (nextIndex < exercises.length) {
      navigateTo(nextIndex);
    } else {
      clearInterval(timerRef.current);
      setWorkoutDone(true);
    }
  };

  const handleBack = () => {
    if (exerciseIndex > 0) navigateTo(exerciseIndex - 1);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>Loading week 1…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (workoutDone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Ionicons name="checkmark-circle" size={72} color={COLORS.green} />
          <Text style={{ color: COLORS.text, fontSize: 26, fontWeight: '800' }}>Workout Complete</Text>
          <Text style={{ color: COLORS.textMuted, fontSize: 18 }}>{formatTimer(timerSeconds)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dotsRow}>
          {exercises.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                completedExercises.has(i) && styles.dotCompleted,
                i === exerciseIndex && styles.dotCurrent,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity>
          <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>
        </TouchableOpacity>
      </View>

      {/* Rep / Weight summary */}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryValue}>{totalReps}</Text>
          <Text style={styles.summaryLabel}> REPS</Text>
          {'    '}
          <Text style={styles.summaryValue}>{totalWeight || 0}</Text>
          <Text style={styles.summaryLabel}> LB</Text>
        </Text>
      </View>

      <View style={styles.divider} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Category + Exercise */}
        <View style={styles.exerciseHeader}>
          <Text style={styles.categoryText}>{exercise?.title ?? ''}</Text>
          <View style={styles.exerciseTitleRow}>
            <View style={styles.exerciseTitleLeft}>
              <Text style={styles.exerciseName}>{exercise?.subtitle ?? '—'}</Text>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <Text style={styles.moreButtonText}>•••</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Exercise parameters */}
        {exercise?.rep_range || exercise?.rpe ? (
          <View style={styles.paramsBlock}>
            {exercise.rep_range ? (
              <Text style={styles.paramText}>Reps {exercise.rep_range}</Text>
            ) : null}
            {exercise.rpe != null ? (
              <Text style={styles.paramText}>RPE {exercise.rpe}</Text>
            ) : null}
          </View>
        ) : null}

        {/* Sets table */}
        <View style={styles.setsTable}>
          <View style={styles.setsHeaderRow}>
            <Text style={[styles.setColHeader, { width: 36 }]}>Sets</Text>
            <Text style={[styles.setColHeader, { flex: 1, textAlign: 'center' }]}>Reps</Text>
            <Text style={[styles.setColHeader, { flex: 1, textAlign: 'center' }]}>Lb</Text>
            <View style={{ width: 44 }} />
          </View>

          {sets.map((set, idx) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNumber}>{idx + 1}</Text>
              <TextInput
                style={styles.setInput}
                value={set.reps}
                onChangeText={(v) => updateReps(set.id, v)}
                keyboardType="numeric"
                keyboardAppearance="dark"
                selectTextOnFocus
              />
              <TextInput
                style={styles.setInput}
                value={set.weight}
                onChangeText={(v) => updateWeight(set.id, v)}
                keyboardType="numeric"
                keyboardAppearance="dark"
                placeholder=""
                placeholderTextColor={COLORS.textDim}
                selectTextOnFocus
              />
              <TouchableOpacity
                style={[styles.completeDot, set.completed && styles.completeDotFilled]}
                onPress={() => toggleComplete(set.id)}
              >
                {set.completed && (
                  <Ionicons name="checkmark" size={16} color={COLORS.bg} />
                )}
              </TouchableOpacity>
            </View>
          ))}

          {/* Add/Remove set controls */}
          <View style={styles.setControls}>
            <TouchableOpacity style={styles.setControlBtn} onPress={removeSet}>
              <Ionicons name="remove" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.setControlLabel}>Set</Text>
            <TouchableOpacity style={[styles.setControlBtn, styles.setControlBtnBlue]} onPress={addSet}>
              <Ionicons name="add" size={22} color={COLORS.blue} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Note input */}
        <View style={styles.noteContainer}>
          <TextInput
            style={styles.noteInput}
            placeholder="Add exercise note"
            placeholderTextColor={COLORS.textDim}
            value={note}
            onChangeText={setNote}
            multiline
            keyboardAppearance="dark"
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navBtn} onPress={handleBack} disabled={exerciseIndex === 0}>
          <Ionicons name="arrow-back" size={20} color={exerciseIndex === 0 ? COLORS.textDim : COLORS.blue} />
          <Text style={[styles.navBtnText, exerciseIndex === 0 && { color: COLORS.textDim }]}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navBtn} onPress={handleNext}>
          <Text style={styles.navBtnText}>
            {exerciseIndex < exercises.length - 1 ? 'Next' : 'Finish'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.blue} />
        </TouchableOpacity>
      </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerIcon: {
    width: 32,
  },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.green,
    backgroundColor: 'transparent',
  },
  dotCompleted: {
    backgroundColor: COLORS.green,
  },
  dotCurrent: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.green,
    backgroundColor: 'transparent',
  },
  timerText: {
    color: COLORS.blue,
    fontSize: 17,
    fontWeight: '600',
  },
  summaryRow: {
    alignItems: 'center',
    paddingVertical: 4,
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
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 6,
  },
  scroll: {
    flex: 1,
  },
  exerciseHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  categoryText: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 6,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
  },
  swapIcon: {
    padding: 2,
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButtonText: {
    color: COLORS.textMuted,
    fontSize: 13,
    letterSpacing: 1,
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statsTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 16,
  },
  statsTab: {
    paddingVertical: 2,
  },
  statsTabTextMuted: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  proBadge: {
    marginLeft: 'auto',
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  proBadgeSmall: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginHorizontal: 6,
  },
  proBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '700',
  },
  upgradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  upgradeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeTextWrap: {
    flex: 1,
  },
  upgradeText: {
    color: COLORS.text,
    fontSize: 13,
  },
  upgradeCtaText: {
    color: COLORS.yellow,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  videoThumb: {
    width: 110,
    height: 110,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoStats: {
    flex: 1,
    justifyContent: 'space-around',
    padding: 12,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  infoValue: {
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: '700',
  },
  infoValueBlue: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  addText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: '600',
  },
  paramsBlock: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
  },
  paramText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  setsTable: {
    paddingHorizontal: 16,
  },
  setsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  setColHeader: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 15,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  setNumber: {
    width: 28,
    color: COLORS.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  setInput: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  completeDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeDotFilled: {
    backgroundColor: COLORS.green,
  },
  setControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    gap: 20,
  },
  setControlBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setControlBtnBlue: {
    borderColor: COLORS.blue,
  },
  setControlLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  noteContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noteInput: {
    padding: 14,
    color: COLORS.textMuted,
    fontSize: 14,
    minHeight: 48,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBtnText: {
    color: COLORS.blue,
    fontSize: 16,
    fontWeight: '600',
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navCenterText: {
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: '600',
  },
});
