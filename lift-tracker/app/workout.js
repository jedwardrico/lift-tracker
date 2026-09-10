import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  PanResponder,
  Modal,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

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

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const WORKOUT_STORAGE_KEY = 'workout_in_progress';

function buildInitialSets(count, repRange) {
  const reps = repRange ? repRange.split('-')[0] : '8';
  return Array.from({ length: count || 2 }, (_, i) => ({
    id: i + 1,
    reps,
    weight: '',
    completed: false,
  }));
}

// Resolve the day the user picked on the home screen. Falls back to the first
// non-rest day if the param is missing or points at a rest / empty day.
function resolveActiveDay(data, dayIndex) {
  if (!data?.days) return null;
  if (dayIndex != null && !Number.isNaN(dayIndex)) {
    const d = data.days[dayIndex];
    if (d && !d.is_rest_day && (d.exercises?.length ?? 0) > 0) return d;
  }
  return data.days.find((d) => !d.is_rest_day) ?? null;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const { week, day } = useLocalSearchParams();
  const weekNumber = week != null && week !== '' ? parseInt(week, 10) : 1;
  const dayIndex = day != null && day !== '' ? parseInt(day, 10) : null;
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [completedExercises, setCompletedExercises] = useState(new Set());
  const [sets, setSets] = useState([
    { id: 1, reps: '8', weight: '', completed: false },
    { id: 2, reps: '8', weight: '', completed: false },
  ]);
  const [note, setNote] = useState('');
  // Session exercise swaps, keyed by exercise index. Each value is a full
  // exercise row (from the catalog or freshly created) that replaces the slot's
  // exercise for this session. The slot's set/rep scheme is kept; the swap is
  // persisted on the log as swapped_exercise_id and carried forward to the same
  // slot in later weeks. The programmed week is never modified.
  const [overrides, setOverrides] = useState({});
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [completedLogs, setCompletedLogs] = useState([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef(null);
  const savedSetsMap = useRef({});
  const { width: screenWidth } = useWindowDimensions();
  // Horizontal offset of the exercise content, driven for the slide transition
  // between exercises. Sits at 0 while an exercise is on screen.
  const slideX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(WORKOUT_STORAGE_KEY)
      .then((val) => {
        if (val) setCompletedLogs(JSON.parse(val));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${BASE_URL}/weeks/${weekNumber || 1}`)
      .then((r) => r.json())
      .then((data) => {
        setWeekData(data);
        const activeDay = resolveActiveDay(data, dayIndex);
        const firstExercise = activeDay?.exercises?.[0];
        if (firstExercise) {
          setSets(buildInitialSets(firstExercise.sets, firstExercise.reps));
        }
        // Carry forward a swap made in an earlier week: the server sends
        // carried_exercise (a full exercise row) only when a prior week's
        // logged exercise at the same slot differs from this week's program.
        // Seed it so the swapped exercise shows and stays swappable.
        const seeded = {};
        (activeDay?.exercises ?? []).forEach((ex, i) => {
          if (ex.carried_exercise) seeded[i] = ex.carried_exercise;
        });
        if (Object.keys(seeded).length > 0) setOverrides(seeded);
      })
      .catch((err) => console.error('Failed to load week:', err))
      .finally(() => setLoading(false));
  }, [weekNumber, dayIndex]);

  // Unique exercise catalog for the swap picker.
  useEffect(() => {
    fetch(`${BASE_URL}/exercises?distinct=1`)
      .then((r) => r.json())
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch((err) => console.error('Failed to load exercises:', err));
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

  const removeSet = (id) => {
    setSets((prev) =>
      prev.length > 1 ? prev.filter((s) => s.id !== id) : prev
    );
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

  const prevReps = completedLogs.reduce(
    (acc, log) =>
      acc +
      log.sets.reduce(
        (a, s) => a + (s.completed ? parseInt(s.reps) || 0 : 0),
        0
      ),
    0
  );
  const prevWeight = completedLogs.reduce(
    (acc, log) =>
      acc +
      log.sets.reduce(
        (a, s) => a + (s.completed ? parseFloat(s.weight) || 0 : 0),
        0
      ),
    0
  );
  const totalReps =
    prevReps +
    sets.reduce((acc, s) => acc + (s.completed ? parseInt(s.reps) || 0 : 0), 0);
  const totalWeight =
    prevWeight +
    sets.reduce(
      (acc, s) => acc + (s.completed ? parseFloat(s.weight) || 0 : 0),
      0
    );

  const activeDay = resolveActiveDay(weekData, dayIndex);
  const exercises = activeDay?.exercises ?? [];
  const exercise = exercises[exerciseIndex];
  const override = overrides[exerciseIndex];
  // The exercise whose identity/details (name, category, body, RPE) are shown.
  // The working set rows always stay as the slot's, per the set/rep scheme.
  const displayExercise = override ?? exercise;
  const exerciseName = displayExercise?.subtitle ?? '';
  const exerciseCategory = displayExercise?.title ?? '';

  // Swap the on-screen exercise, sliding the old content off and the new
  // content in from the direction of travel. Forward (higher index) slides out
  // to the left and in from the right; back does the reverse.
  const swapExercise = (targetIndex) => {
    savedSetsMap.current[exerciseIndex] = sets;
    const targetExercise = exercises[targetIndex];
    setSets(
      savedSetsMap.current[targetIndex] ??
        buildInitialSets(targetExercise.sets, targetExercise.reps)
    );
    setNote('');
    setSwapModalVisible(false);
    setExerciseIndex(targetIndex);
  };

  const navigateTo = (targetIndex) => {
    if (isAnimating.current || targetIndex === exerciseIndex) return;
    const direction = targetIndex > exerciseIndex ? 1 : -1;
    isAnimating.current = true;
    Animated.timing(slideX, {
      toValue: -direction * screenWidth,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      swapExercise(targetIndex);
      // Drop the incoming content just off the opposite edge, then ease it in.
      slideX.setValue(direction * screenWidth);
      Animated.timing(slideX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        isAnimating.current = false;
      });
    });
  };

  // Swap the current slot's exercise. Only the shown/logged identity changes —
  // the set/rep scheme the user is working through stays exactly as-is.
  const openSwap = () => {
    setCustomInput('');
    setSwapModalVisible(true);
  };
  const applySwap = (ex) => {
    setOverrides((prev) => ({ ...prev, [exerciseIndex]: ex }));
    setSwapModalVisible(false);
  };
  const resetSwap = () => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[exerciseIndex];
      return next;
    });
    setSwapModalVisible(false);
  };
  // Create a brand-new exercise, link it to the program catalog, then swap to
  // it. It keeps the slot's category label so it reads sensibly.
  const addCustomExercise = async () => {
    const name = customInput.trim();
    if (!name) return;
    try {
      const res = await fetch(`${BASE_URL}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: exercise?.title ?? 'Custom',
          subtitle: name,
          body: '',
        }),
      });
      const created = await res.json();
      if (created?.id) {
        setCatalog((prev) =>
          [...prev, created].sort((a, b) =>
            `${a.title}${a.subtitle}`.localeCompare(`${b.title}${b.subtitle}`)
          )
        );
        applySwap(created);
      }
    } catch (err) {
      console.error('Failed to create exercise:', err);
    }
  };

  const handleNext = async () => {
    const isLast = exerciseIndex === exercises.length - 1;
    const localSets = [...sets];

    if (exercise) {
      const allDone = localSets.every((s) => s.completed);
      setCompletedExercises((prev) => {
        const next = new Set(prev);
        if (allDone || isLast) next.add(exerciseIndex);
        else next.delete(exerciseIndex);
        return next;
      });

      // A swap only counts when the chosen exercise actually differs from the
      // programmed one. The log keeps exercise_id as the slot anchor and records
      // swapped_exercise_id; the completion screen shows the effective exercise.
      const swap = overrides[exerciseIndex];
      const isRealSwap =
        swap &&
        (swap.subtitle !== exercise.subtitle || swap.title !== exercise.title);
      const effective = isRealSwap ? swap : exercise;
      const logEntry = {
        exercise: {
          ...exercise, // keep slot id/order as the anchor for exercise_id
          title: effective.title,
          subtitle: effective.subtitle,
          body: effective.body,
          rpe: effective.rpe,
        },
        swappedExerciseId: isRealSwap ? swap.id : null,
        sets: localSets.map((s, i) => ({
          set_number: i + 1,
          reps: parseInt(s.reps) || null,
          weight: parseFloat(s.weight) || null,
          completed: s.completed,
        })),
        note,
      };

      if (!isLast) {
        const updatedLogs = [...completedLogs, logEntry];
        setCompletedLogs(updatedLogs);
        await AsyncStorage.setItem(
          WORKOUT_STORAGE_KEY,
          JSON.stringify(updatedLogs)
        );
        navigateTo(exerciseIndex + 1);
        return;
      }

      // Last exercise — post everything to the server now that the workout is done
      clearInterval(timerRef.current);
      const workoutDuration = timerSeconds;
      const allLogs = [...completedLogs, logEntry];

      const savedIds = (
        await Promise.all(
          allLogs.map((log, i) =>
            fetch(`${BASE_URL}/logs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                exercise_id: log.exercise.id,
                swapped_exercise_id: log.swappedExerciseId ?? undefined,
                // Record the full workout duration on the final log
                duration_seconds:
                  i === allLogs.length - 1 ? workoutDuration : undefined,
                sets: log.sets.map((s) => ({
                  set_number: s.set_number,
                  reps: s.reps,
                  weight: s.weight,
                })),
              }),
            })
              .then((r) => r.json())
              .then((data) => data.id ?? null)
              .catch((err) => {
                console.error('Failed to log exercise:', err);
                return null;
              })
          )
        )
      ).filter(Boolean);

      await Promise.all(
        savedIds.map((id) =>
          fetch(`${BASE_URL}/logs/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true }),
          }).catch((err) => console.error('Failed to mark log complete:', err))
        )
      );

      await AsyncStorage.removeItem(WORKOUT_STORAGE_KEY);

      const workoutTotalReps = allLogs.reduce(
        (acc, log) =>
          acc +
          log.sets.reduce(
            (a, s) => a + (s.completed ? parseInt(s.reps) || 0 : 0),
            0
          ),
        0
      );
      const workoutTotalWeight = allLogs.reduce(
        (acc, log) =>
          acc +
          log.sets.reduce(
            (a, s) => a + (s.completed ? parseFloat(s.weight) || 0 : 0),
            0
          ),
        0
      );

      router.replace({
        pathname: '/complete',
        params: {
          elapsed: timerSeconds,
          logs: JSON.stringify(allLogs),
          totalReps: workoutTotalReps,
          totalWeight: workoutTotalWeight,
        },
      });
    } else if (!isLast) {
      navigateTo(exerciseIndex + 1);
    }
  };

  const handleBack = () => {
    if (exerciseIndex > 0) navigateTo(exerciseIndex - 1);
  };

  // Leave the workout from any exercise via the header chevron.
  const exitWorkout = () => router.back();

  // Swipe left → next exercise, swipe right → previous exercise.
  // Forward swipe only navigates between exercises; finishing the workout
  // stays on the explicit Finish button so it can't be triggered accidentally.
  // A back-swipe only exits the workout from the first exercise; on any later
  // exercise it steps back to the previous one.
  const swipeHandlers = useRef({});
  swipeHandlers.current = {
    onSwipeLeft: () => {
      if (exerciseIndex < exercises.length - 1) handleNext();
    },
    onSwipeRight: () => {
      if (exerciseIndex === 0) router.back();
      else navigateTo(exerciseIndex - 1);
    },
  };

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture for clearly horizontal drags so the vertical
      // ScrollView and text inputs keep working.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -50) swipeHandlers.current.onSwipeLeft();
        else if (g.dx >= 50) swipeHandlers.current.onSwipeRight();
      },
    })
  ).current;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>
            Loading week {weekNumber || 1}…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={exitWorkout}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-down" size={26} color={COLORS.text} />
        </TouchableOpacity>

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

      <View
        style={[styles.scroll, styles.scrollClip]}
        {...panResponder.panHandlers}
      >
        <Animated.View
          style={{ flex: 1, transform: [{ translateX: slideX }] }}
        >
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
              {/* Category + Exercise */}
              <View style={styles.exerciseHeader}>
                <Text style={styles.categoryText}>{exerciseCategory}</Text>
                <View style={styles.exerciseTitleRow}>
                  <TouchableOpacity
                    style={styles.exerciseTitleLeft}
                    onPress={() => exercise && openSwap()}
                    disabled={!exercise}
                  >
                    <Text style={styles.exerciseName}>{exerciseName || '—'}</Text>
                    {exercise ? (
                      <Ionicons
                        name="swap-horizontal"
                        size={18}
                        color={COLORS.textMuted}
                      />
                    ) : null}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.moreButton}
                    onPress={() => exercise && openSwap()}
                  >
                    <Text style={styles.moreButtonText}>•••</Text>
                  </TouchableOpacity>
                </View>
                {displayExercise?.body ? (
                  <Text style={styles.exerciseBody}>{displayExercise.body}</Text>
                ) : null}
              </View>

              {/* Exercise parameters */}
              {displayExercise?.reps || displayExercise?.rpe ? (
                <View style={styles.paramsBlock}>
                  {displayExercise.reps ? (
                    <Text style={styles.paramText}>
                      Reps {displayExercise.reps}
                    </Text>
                  ) : null}
                  {displayExercise.rpe != null ? (
                    <Text style={styles.paramText}>RPE {displayExercise.rpe}</Text>
                  ) : null}
                </View>
              ) : null}

              {/* Sets table */}
              <View style={styles.setsTable}>
                <View style={styles.setsHeaderRow}>
                  <Text style={[styles.setColHeader, { width: 36 }]}>Sets</Text>
                  <Text
                    style={[styles.setColHeader, { flex: 1, textAlign: 'center' }]}
                  >
                    Reps
                  </Text>
                  <Text
                    style={[styles.setColHeader, { flex: 1, textAlign: 'center' }]}
                  >
                    Lb
                  </Text>
                  <View style={{ width: 72 }} />
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
                      style={[
                        styles.completeDot,
                        set.completed && styles.completeDotFilled,
                      ]}
                      onPress={() => toggleComplete(set.id)}
                    >
                      {set.completed && (
                        <Ionicons name="checkmark" size={16} color={COLORS.bg} />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteSetBtn}
                      onPress={() => removeSet(set.id)}
                      disabled={sets.length <= 1}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={sets.length <= 1 ? COLORS.textDim : COLORS.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add set control — remove any set via the ✕ on its row */}
                <TouchableOpacity style={styles.addSetBtn} onPress={addSet}>
                  <Ionicons name="add" size={20} color={COLORS.blue} />
                  <Text style={styles.addSetLabel}>Add Set</Text>
                </TouchableOpacity>
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
        </Animated.View>
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={handleBack}
          disabled={exerciseIndex === 0}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color={exerciseIndex === 0 ? COLORS.textDim : COLORS.blue}
          />
          <Text
            style={[
              styles.navBtnText,
              exerciseIndex === 0 && { color: COLORS.textDim },
            ]}
          >
            Back
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navCenter}>
          <Ionicons name="timer-outline" size={20} color={COLORS.blue} />
          <Text style={styles.navCenterText}>Select Timer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn} onPress={handleNext}>
          <Text style={styles.navBtnText}>
            {exerciseIndex < exercises.length - 1 ? 'Next' : 'Finish'}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={COLORS.blue} />
        </TouchableOpacity>
      </View>

      {/* Swap exercise modal */}
      <Modal
        visible={swapModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSwapModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Swap Exercise</Text>
              <TouchableOpacity onPress={() => setSwapModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Keeps this slot&apos;s sets &amp; reps — only the exercise
              changes.
            </Text>

            <View style={styles.customRow}>
              <TextInput
                style={styles.customInput}
                placeholder="Add a new exercise"
                placeholderTextColor={COLORS.textDim}
                value={customInput}
                onChangeText={setCustomInput}
                keyboardAppearance="dark"
                returnKeyType="done"
                onSubmitEditing={addCustomExercise}
              />
              <TouchableOpacity
                style={[
                  styles.customAddBtn,
                  !customInput.trim() && styles.customAddBtnDisabled,
                ]}
                onPress={addCustomExercise}
                disabled={!customInput.trim()}
              >
                <Ionicons
                  name="add"
                  size={22}
                  color={customInput.trim() ? COLORS.bg : COLORS.textDim}
                />
              </TouchableOpacity>
            </View>

            {override ? (
              <TouchableOpacity style={styles.resetRow} onPress={resetSwap}>
                <Ionicons name="refresh" size={16} color={COLORS.blue} />
                <Text style={styles.resetText}>
                  Reset to {exercise?.subtitle ?? 'original'}
                </Text>
              </TouchableOpacity>
            ) : null}

            <ScrollView
              style={styles.catalogList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {catalog.map((item) => {
                const selected =
                  exerciseName === item.subtitle &&
                  exerciseCategory === item.title;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.catalogRow}
                    onPress={() => applySwap(item)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogName}>{item.subtitle}</Text>
                      <Text style={styles.catalogCategory}>{item.title}</Text>
                    </View>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={COLORS.green}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    paddingVertical: 10,
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
  // Keep the sliding exercise content from bleeding past the screen edges
  // while a transition is in flight.
  scrollClip: {
    overflow: 'hidden',
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
  exerciseBody: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
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
  deleteSetBtn: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  addSetLabel: {
    color: COLORS.blue,
    fontSize: 16,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalHint: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  customInput: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    color: COLORS.text,
    fontSize: 16,
  },
  customAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customAddBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  resetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 4,
  },
  resetText: {
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: '600',
  },
  catalogList: {
    flexGrow: 0,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  catalogName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  catalogCategory: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
});
