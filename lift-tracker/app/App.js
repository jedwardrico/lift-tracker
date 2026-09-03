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

const TOTAL_SETS = 11;

const WORKOUT = {
  category: 'A. Strength/Power',
  exercise: 'Flat DB Bench',
  workingMax: 434,
  last: '11, 6 @ 315, 365 lb',
  repRange: 'Reps 5-8',
  rest: 'Rest 2-3min',
  tempo: 'Tempo 3-0-1-0',
};

export default function App() {
  const [sets, setSets] = useState([
    { id: 1, reps: '8', weight: '', completed: false },
    { id: 2, reps: '8', weight: '', completed: false },
  ]);
  const [note, setNote] = useState('');
  const [currentSetIndex, setCurrentSetIndex] = useState(2); // 0-indexed dot
  const [timerSeconds, setTimerSeconds] = useState(14);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimerSeconds((s) => s + 1);
    }, 1000);
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="chevron-down" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_SETS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < currentSetIndex && styles.dotCompleted,
                i === currentSetIndex && styles.dotCurrent,
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
          <Text style={styles.categoryText}>{WORKOUT.category}</Text>
          <View style={styles.exerciseTitleRow}>
            <View style={styles.exerciseTitleLeft}>
              <Text style={styles.exerciseName}>{WORKOUT.exercise}</Text>
              <TouchableOpacity style={styles.swapIcon}>
                <Ionicons name="swap-horizontal" size={18} color={COLORS.blue} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.moreButton}>
              <Text style={styles.moreButtonText}>•••</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statsTabRow}>
            <TouchableOpacity style={styles.statsTab}>
              <Text style={styles.statsTabTextMuted}>8RM</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.statsTab}>
              <Text style={styles.statsTabTextMuted}>PERCENTILES</Text>
            </TouchableOpacity>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>
          <View style={styles.upgradeRow}>
            <View style={styles.upgradeIconWrap}>
              <MaterialCommunityIcons name="lightning-bolt" size={20} color={COLORS.yellow} />
            </View>
            <View style={styles.upgradeTextWrap}>
              <Text style={styles.upgradeText}>See how you StackUp to the crowd.</Text>
              <Text style={styles.upgradeCtaText}>UPGRADE TO PRO</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.text} />
          </View>
        </View>

        {/* Video + Working Max card */}
        <View style={styles.infoCard}>
          <View style={styles.videoThumb}>
            <View style={styles.videoPlay}>
              <Ionicons name="play" size={22} color={COLORS.text} />
            </View>
          </View>
          <View style={styles.infoStats}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>GOAL</Text>
              <View style={styles.proBadgeSmall}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
              <TouchableOpacity>
                <Text style={styles.addText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>WORKING MAX</Text>
              <View style={styles.infoValueRow}>
                <Text style={styles.infoValue}>{WORKOUT.workingMax}</Text>
                <Ionicons name="chevron-forward" size={16} color={COLORS.blue} />
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>LAST</Text>
              <Text style={styles.infoValueBlue}>{WORKOUT.last}</Text>
            </View>
          </View>
        </View>

        {/* Exercise parameters */}
        <View style={styles.paramsBlock}>
          <Text style={styles.paramText}>{WORKOUT.repRange}</Text>
          <Text style={styles.paramText}>{WORKOUT.rest}</Text>
          <Text style={styles.paramText}>{WORKOUT.tempo}</Text>
        </View>

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
        <TouchableOpacity style={styles.navBtn}>
          <Ionicons name="arrow-back" size={20} color={COLORS.blue} />
          <Text style={styles.navBtnText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navCenter}>
          <Ionicons name="timer-outline" size={20} color={COLORS.blue} />
          <Text style={styles.navCenterText}>Select Timer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navBtn}>
          <Text style={styles.navBtnText}>Next</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerIcon: {
    width: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
