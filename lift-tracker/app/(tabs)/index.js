import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  PanResponder,
  Animated,
  Easing,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
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
// Must match workout.js's WORKOUT_STORAGE_KEY — this screen only reads it, to
// offer resuming a workout left in progress; workout.js owns writing/clearing it.
const WORKOUT_STORAGE_KEY = 'workout_in_progress';

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
// active program's start (see the `/program` fetch below) — always a
// Monday. The display week runs Sun–Sat; server days are stored Mon–Sun
// so serverDayIdx() maps between them.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

// programState.program_start_date from the server is always a Monday, but
// the display week runs Sun–Sat (see serverDayIdx() below) — shift back a
// day to the Sunday that actually begins the display week. Without this,
// currentWeekOffset()/todayDayIndex() undercount by a week specifically on
// Sundays, since that's the only day floor(diff/7) differs between the two.
function displayWeekStart(programStartDateKey) {
  const monday = parseDateKey(programStartDateKey);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);
  return sunday;
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

// Inverse of serverDayIdx — a stored in-progress workout keeps the server's
// Mon(0)…Sun(6) index, so this maps it back to the Sun(0)…Sat(6) index used
// to label it for display.
function displayDayIdx(serverIdx) {
  return (serverIdx + 1) % 7;
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

// Whole weeks between two YYYY-MM-DD Mondays.
function weekOffsetBetween(fromKey, toKey) {
  const days = Math.round(
    (parseDateKey(toKey) - parseDateKey(fromKey)) / MS_PER_DAY
  );
  return Math.round(days / 7);
}

// Which program (and which of *its own* week numbers) governs the display
// week at `weekOffset` (0 = the active program's week 1). A staged
// switch/restart takes over every display week from its pending_start_date
// onward — previewed here ahead of the server's own auto-commit, which only
// flips active_program once that Monday actually arrives (see
// getProgramState) — so browsing forward shows the incoming program right
// away instead of stale content from the one it's replacing.
function resolveWeekProgram(programState, weekOffset) {
  if (programState?.pending_program && programState.pending_start_date) {
    const pendingOffset = weekOffsetBetween(
      programState.program_start_date,
      programState.pending_start_date
    );
    if (weekOffset >= pendingOffset) {
      return {
        program: programState.pending_program,
        weekNumber: weekOffset - pendingOffset + 1,
      };
    }
  }
  return {
    program: programState?.active_program,
    weekNumber: weekOffset + 1,
  };
}

// The [min, max] week offsets that can be swiped to: bounded below by the
// active program's first week. Above, once a switch/restart is staged,
// resolveWeekProgram routes every offset from the pending program's start
// onward to it regardless of how many weeks the active program has left, so
// the ceiling must be the pending program's own last week — not the active
// program's, which would let swiping run past the pending program's end
// into weeks it doesn't have.
function weekOffsetBounds(programState, activeWeeks, pendingWeeks) {
  if (!activeWeeks?.length) return null;
  const minOffset = Math.min(...activeWeeks) - 1;
  if (programState?.pending_program && pendingWeeks?.length) {
    const pendingOffset = weekOffsetBetween(
      programState.program_start_date,
      programState.pending_start_date
    );
    return {
      minOffset,
      maxOffset: pendingOffset + Math.max(...pendingWeeks) - 1,
    };
  }
  return { minOffset, maxOffset: Math.max(...activeWeeks) - 1 };
}

export default function HomeScreen() {
  const router = useRouter();
  const [programState, setProgramState] = useState(null);
  const [working, setWorking] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [weekOffset, setWeekOffset] = useState(0);
  // Starts empty (not [1]) so weekOffsetBounds()'s !activeWeeks?.length guard
  // makes the clamp effect below a no-op until the real /weeks list has
  // loaded — otherwise that placeholder [1] gives a bogus {0, 0} bound that
  // clamps weekOffset back to week 1 right after applyProgramState() lands
  // it on today's real (often later) week, since /weeks resolves slightly
  // after /program.
  const [availableWeeks, setAvailableWeeks] = useState([]);
  // Week numbers of a staged switch/restart's own program, counted from its
  // own start date — null when nothing is pending. Lets swiping preview the
  // incoming program (see resolveWeekProgram) before the server auto-commits
  // it on its effective Monday.
  const [pendingWeeks, setPendingWeeks] = useState(null);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weekLoadError, setWeekLoadError] = useState(false);
  const [completedDates, setCompletedDates] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [weekPickerVisible, setWeekPickerVisible] = useState(false);
  // A workout left mid-way (e.g. exited to this screen) rather than finished
  // or replaced by starting a different one — see workout.js, which owns
  // this storage entry. Null when no workout is in progress.
  const [inProgressWorkout, setInProgressWorkout] = useState(null);

  const programStart = programState
    ? displayWeekStart(programState.program_start_date)
    : null;
  const currentOffset = programStart ? currentWeekOffset(programStart) : 0;
  const todayIdx = programStart ? todayDayIndex(programStart) : 0;
  const weekDates = programStart ? getWeekDates(programStart, weekOffset) : [];
  const resolvedWeek = programState
    ? resolveWeekProgram(programState, weekOffset)
    : null;
  const isCurrentWeek = weekOffset === currentOffset;

  // Every week offset that can be jumped to directly from the month picker,
  // rather than swiping one week at a time.
  const weekPickerOptions = useMemo(() => {
    if (!programStart) return [];
    const bounds = weekOffsetBounds(programState, availableWeeks, pendingWeeks);
    if (!bounds) return [];
    const opts = [];
    for (let offset = bounds.minOffset; offset <= bounds.maxOffset; offset++) {
      const resolved = resolveWeekProgram(programState, offset);
      opts.push({
        offset,
        weekNumber: resolved.weekNumber,
        program: resolved.program,
        start: getWeekDates(programStart, offset)[0],
      });
    }
    return opts;
  }, [programStart, programState, availableWeeks, pendingWeeks]);

  // Discover which program weeks exist so swiping can't run off the ends.
  // Also re-run after a switch/restart, since the new program can have a
  // different week count. `state` should be the freshest known /program
  // response — passed explicitly rather than read off programState, which
  // may not have finished re-rendering into its ref yet when a caller wants
  // to refresh right after applying a fetch's result.
  const refreshWeeksList = useCallback((state) => {
    const pendingProgram = state?.pending_program;
    const requests = [fetch(`${BASE_URL}/weeks`).then((r) => r.json())];
    if (pendingProgram) {
      requests.push(
        fetch(`${BASE_URL}/weeks?program=${pendingProgram}`).then((r) =>
          r.json()
        )
      );
    }
    Promise.all(requests)
      .then(([activeList, pendingList]) => {
        if (Array.isArray(activeList) && activeList.length) {
          setAvailableWeeks(activeList.map((w) => w.week_number));
        }
        setPendingWeeks(
          Array.isArray(pendingList) && pendingList.length
            ? pendingList.map((w) => w.week_number)
            : null
        );
      })
      .catch((err) => console.error('Failed to load week list:', err));
  }, []);

  // Lands the view on whichever week/day makes "today", given a fresh
  // /program response (on mount, or right after a switch/restart resolves).
  const applyProgramState = useCallback((data) => {
    if (!data?.program_start_date) return;
    setProgramState(data);
    const start = displayWeekStart(data.program_start_date);
    const offset = currentWeekOffset(start);
    const idx = todayDayIndex(start);
    setWeekOffset(offset);
    setSelectedIdx(idx);
    todayPositionRef.current = { offset, idx };
  }, []);

  // Keep the latest programState in a ref so the focus-sync effect below can
  // compare against it without needing to be recreated on every fetch.
  const programStateRef = useRef(programState);
  programStateRef.current = programState;

  // Keep mutable refs so the focus-sync effect below always sees the latest
  // browsing position without needing to be recreated on every fetch.
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;
  const weekOffsetRef = useRef(weekOffset);
  weekOffsetRef.current = weekOffset;

  // The offset/idx that represented "today" as of the last time it was
  // computed (on mount, or the last time this effect snapped to it) — lets
  // the focus effect below tell whether the calendar day has rolled forward
  // since, not just whether the program itself changed.
  const todayPositionRef = useRef({ offset: currentOffset, idx: todayIdx });

  // Re-checks /program every time this screen gains focus (including on
  // mount). The server auto-commits a staged switch/restart once its
  // effective Monday arrives (see getProgramState), so this is what notices
  // that a program change has taken effect — e.g. after switching in
  // Settings and coming back, or simply because that Monday has now passed.
  // When the active program (or its start date) actually changed, snap the
  // view back to today under the new program instead of continuing to browse
  // stale week numbers against it. Otherwise the program itself is unchanged,
  // but the calendar may still have moved on since we last computed "today"
  // (e.g. the app was simply reopened a day later) — in that case, snap
  // forward too, but only if the view was still sitting on the old "today"
  // (so deliberately browsing a different week isn't disturbed).
  useFocusEffect(
    useCallback(() => {
      fetch(`${BASE_URL}/program`)
        .then((r) => r.json())
        .then((data) => {
          const prev = programStateRef.current;
          const changed =
            !prev ||
            data.active_program !== prev.active_program ||
            data.program_start_date !== prev.program_start_date;
          if (changed) {
            applyProgramState(data);
          } else {
            setProgramState(data);
            const start = displayWeekStart(data.program_start_date);
            const freshOffset = currentWeekOffset(start);
            const freshIdx = todayDayIndex(start);
            const wasOnToday =
              weekOffsetRef.current === todayPositionRef.current.offset &&
              selectedIdxRef.current === todayPositionRef.current.idx;
            const todayMoved =
              freshOffset !== todayPositionRef.current.offset ||
              freshIdx !== todayPositionRef.current.idx;
            if (wasOnToday && todayMoved) {
              setWeekOffset(freshOffset);
              setSelectedIdx(freshIdx);
            }
            todayPositionRef.current = { offset: freshOffset, idx: freshIdx };
          }
          // Always refresh, not just when the active program changed: a
          // pending switch/restart can be staged or cancelled without
          // active_program moving at all, and pendingWeeks needs to track it.
          refreshWeeksList(data);
        })
        .catch((err) => console.error('Failed to load program:', err));
    }, [applyProgramState, refreshWeeksList])
  );

  // Keeps weekOffset inside whatever range is currently swipeable, given the
  // active program's own weeks and (once a switch/restart is staged) the
  // pending program's — e.g. if today has run past the final program week,
  // or a newly-loaded program has fewer weeks than where we'd wandered to.
  useEffect(() => {
    const bounds = weekOffsetBounds(programState, availableWeeks, pendingWeeks);
    if (!bounds) return;
    setWeekOffset((o) =>
      Math.max(bounds.minOffset, Math.min(bounds.maxOffset, o))
    );
  }, [programState, availableWeeks, pendingWeeks]);

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
          refreshWeeksList(data);
        })
        .catch((err) => {
          console.error('Failed to update program:', err);
          Alert.alert('Error', 'Could not update the program.');
        })
        .finally(() => setWorking(false));
    },
    [working, programState, applyProgramState, refreshWeeksList]
  );

  // Keep the latest available-week lists in refs so the (once-created)
  // PanResponders always clamp against fresh bounds.
  const weeksRef = useRef(availableWeeks);
  weeksRef.current = availableWeeks;
  const pendingWeeksRef = useRef(pendingWeeks);
  pendingWeeksRef.current = pendingWeeks;

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
    const bounds = weekOffsetBounds(
      programStateRef.current,
      weeksRef.current,
      pendingWeeksRef.current
    );
    if (!bounds) return;
    const newOffset = Math.max(
      bounds.minOffset,
      Math.min(bounds.maxOffset, weekOffsetRef.current + delta)
    );
    if (newOffset === weekOffsetRef.current) return;
    animatedShiftRef.current(delta, newOffset, selectedIdxRef.current);
  }, []);
  const shiftWeekRef = useRef(shiftWeek);
  shiftWeekRef.current = shiftWeek;

  const shiftDay = useCallback((delta) => {
    const bounds = weekOffsetBounds(
      programStateRef.current,
      weeksRef.current,
      pendingWeeksRef.current
    );
    if (!bounds) return;
    const { minOffset, maxOffset } = bounds;
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

  // Load the dates of completed workouts so the strip can mark them green.
  const loadCompletedDates = useCallback(() => {
    return fetch(`${BASE_URL}/logs`)
      .then((r) => r.json())
      .then((logs) => {
        if (!Array.isArray(logs)) return;
        setCompletedDates(
          new Set(logs.map((log) => log.logged_at.slice(0, 10)))
        );
      })
      .catch((err) => console.error('Failed to load completed logs:', err));
  }, []);

  // Runs on focus so a workout finished this session shows up on return.
  useFocusEffect(
    useCallback(() => {
      loadCompletedDates();
    }, [loadCompletedDates])
  );

  // Re-checks on every focus so returning from Home after exiting a workout
  // (or finishing/starting a different one) reflects the current state.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(WORKOUT_STORAGE_KEY)
        .then((val) => setInProgressWorkout(val ? JSON.parse(val) : null))
        .catch(() => setInProgressWorkout(null));
    }, [])
  );

  const loadWeekData = useCallback(
    (showSpinner = true) => {
      if (!resolvedWeek) return Promise.resolve();
      if (showSpinner) setLoading(true);
      setWeekLoadError(false);
      return fetch(
        `${BASE_URL}/weeks/${resolvedWeek.weekNumber}?program=${resolvedWeek.program}`
      )
        .then((r) => r.json())
        .then((data) => setWeekData(data))
        .catch((err) => {
          console.error('Failed to load week:', err);
          setWeekLoadError(true);
        })
        .finally(() => setLoading(false));
    },
    [resolvedWeek?.program, resolvedWeek?.weekNumber]
  );

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  // Pull-to-refresh on the day content: re-fetches this week's data and the
  // completed-dates strip. Leaves /program alone — a pull gesture shouldn't
  // reset which week/day is being browsed the way a program-change sync
  // would (see the useFocusEffect above).
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadWeekData(false), loadCompletedDates()]).finally(() =>
      setRefreshing(false)
    );
  }, [loadWeekData, loadCompletedDates]);

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

  // Whether the workout in progress (if any) is for the day currently being
  // viewed — lets the Start Workout button itself offer to resume instead of
  // needing a separate banner for this one case.
  const isResumingSelectedDay =
    !!inProgressWorkout &&
    !!resolvedWeek &&
    Number(inProgressWorkout.weekNumber) === resolvedWeek.weekNumber &&
    (inProgressWorkout.program ?? null) === (resolvedWeek.program ?? null) &&
    Number(inProgressWorkout.dayIndex) === serverDayIdx(selectedIdx);

  // Bunch consecutive exercises that share a body part into the same
  // section, without reordering — a day can interleave body parts (e.g.
  // push/pull/arms), so grouping globally by body part would scramble the
  // program's true order.
  const exerciseSections = [];
  for (const ex of exercises) {
    const last = exerciseSections[exerciseSections.length - 1];
    if (last && last.bodyPart === ex.body_part) {
      last.exercises.push(ex);
    } else {
      exerciseSections.push({ bodyPart: ex.body_part, exercises: [ex] });
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.monthPicker}
          onPress={() => setWeekPickerVisible(true)}
        >
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

      {/* Resume banner — only for a workout in progress on a day other than
          the one currently viewed; viewing that day itself resumes via the
          Start Workout button below (see isResumingSelectedDay). */}
      {inProgressWorkout && !isResumingSelectedDay ? (
        <TouchableOpacity
          style={styles.resumeBanner}
          activeOpacity={0.85}
          onPress={() =>
            router.push({
              pathname: '/workout',
              params: {
                week: inProgressWorkout.weekNumber,
                program: inProgressWorkout.program ?? undefined,
                day: inProgressWorkout.dayIndex,
              },
            })
          }
        >
          <Ionicons name="play-circle" size={18} color={COLORS.accent} />
          <Text style={styles.resumeBannerText}>
            Resume workout · Week {inProgressWorkout.weekNumber} ·{' '}
            {API_DAYS[displayDayIdx(inProgressWorkout.dayIndex)]
              .charAt(0)
              .toUpperCase() +
              API_DAYS[displayDayIdx(inProgressWorkout.dayIndex)].slice(1)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
        </TouchableOpacity>
      ) : null}

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.textMuted}
              />
            }
          >
            {loading ? (
              <View style={styles.centeredMsg}>
                <Text style={styles.mutedText}>Loading…</Text>
              </View>
            ) : weekLoadError ? (
              <View style={styles.centeredMsg}>
                <Text style={styles.restTitle}>Couldn't load this week</Text>
                <Text style={styles.mutedText}>Check your connection</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadWeekData()}
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
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
                    Week {resolvedWeek.weekNumber} · {exercises.length}{' '}
                    exercises
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
                      // screen's Sun(0)…Sat(6) display index. Also pass which
                      // program governs this week — it may be a staged
                      // switch/restart's pending program, previewed here
                      // ahead of the server's own auto-commit.
                      params: {
                        week: resolvedWeek.weekNumber,
                        program: resolvedWeek.program,
                        day: serverDayIdx(selectedIdx),
                      },
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.startBtnText}>
                    {isResumingSelectedDay ? 'Resume Workout' : 'Start Workout'}
                  </Text>
                </TouchableOpacity>

                {/* Day description */}
                <View style={styles.descCard}>
                  <Text style={styles.descTitle}>Today's Focus</Text>
                  <Text style={styles.descBody}>
                    {dayData?.focus_summary ??
                      'Session notes and coach instructions will appear here once added to your program.'}
                  </Text>
                </View>

                {/* Exercise list, grouped into body-part sections by
                    consecutive run — the program can interleave body parts
                    within a day, so this preserves order_num order instead
                    of grouping globally by body part */}
                <View style={styles.exerciseList}>
                  {exerciseSections.map((section, sectionIdx) => (
                    <View
                      key={`${section.bodyPart}-${sectionIdx}`}
                      style={styles.exerciseGroup}
                    >
                      <Text style={styles.bodyPartLabel}>
                        {section.bodyPart.toUpperCase()}
                      </Text>
                      {section.exercises.map((ex) => {
                        const setsReps =
                          ex.sets && ex.rep_range
                            ? `${ex.sets} × ${ex.rep_range}`
                            : ex.rpe
                              ? `RPE ${ex.rpe}`
                              : null;

                        return (
                          <TouchableOpacity
                            key={ex.id}
                            style={styles.exerciseRow}
                            activeOpacity={0.7}
                            onPress={() =>
                              router.push(
                                `/exercise/${encodeURIComponent(ex.exercise_name)}?bodyPart=${encodeURIComponent(section.bodyPart)}`
                              )
                            }
                          >
                            <View style={styles.exerciseIcon}>
                              <Text style={styles.exerciseIconText}>
                                {section.bodyPart.charAt(0).toUpperCase()}
                              </Text>
                            </View>
                            <View style={styles.exerciseInfo}>
                              <Text style={styles.exerciseName}>
                                {ex.exercise_name}
                              </Text>
                              {setsReps && (
                                <Text style={styles.setsReps}>{setsReps}</Text>
                              )}
                            </View>
                            <Ionicons
                              name="stats-chart"
                              size={16}
                              color={COLORS.textMuted}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </View>

      {/* Jump directly to any week, instead of swiping one at a time */}
      <Modal
        visible={weekPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setWeekPickerVisible(false)}
      >
        <View style={styles.weekModalOverlay}>
          <View style={styles.weekModalSheet}>
            <View style={styles.weekModalHeader}>
              <Text style={styles.weekModalTitle}>Jump to Week</Text>
              <TouchableOpacity
                onPress={() => setWeekPickerVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.weekModalList}
              showsVerticalScrollIndicator={false}
            >
              {weekPickerOptions.map((opt) => {
                const isSelected = opt.offset === weekOffset;
                const programLabel =
                  opt.program !== programState.active_program
                    ? programState.available_programs.find(
                        (p) => p.key === opt.program
                      )?.label
                    : null;
                return (
                  <TouchableOpacity
                    key={opt.offset}
                    style={[
                      styles.weekModalRow,
                      isSelected && styles.weekModalRowSelected,
                    ]}
                    onPress={() => {
                      setWeekOffset(opt.offset);
                      setWeekPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View>
                      <Text style={styles.weekModalRowText}>
                        Week {opt.weekNumber} · {MONTHS[opt.start.getMonth()]}{' '}
                        {opt.start.getDate()}
                      </Text>
                      {programLabel ? (
                        <Text style={styles.weekModalRowSub}>
                          {programLabel}
                        </Text>
                      ) : null}
                    </View>
                    {isSelected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={COLORS.accent}
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

  // Resume-workout banner
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accentDim,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  resumeBannerText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
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
  retryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
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

  // Week jump picker
  weekModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  weekModalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  weekModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekModalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  weekModalList: {
    marginBottom: 12,
  },
  weekModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  weekModalRowSelected: {
    backgroundColor: COLORS.accentDim,
  },
  weekModalRowText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  weekModalRowSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
