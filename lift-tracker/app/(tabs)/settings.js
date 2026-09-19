import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import appConfig from '../../app.json';

const COLORS = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1e1e1e',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#666666',
  accent: '#6366f1',
  accentDim: '#1e1b4b',
  green: '#4ade80',
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const APP_VERSION = appConfig.expo.version;

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const MONTHS = [
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

function formatDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Programs only ever start on a Monday, so the picker offers a range of
// Mondays (past ones to correct/backdate a start, future ones to push it
// out) instead of a full calendar.
function mondayOptions(weeksBack = 8, weeksForward = 16) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSinceMonday = (today.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysSinceMonday);

  const keys = [];
  for (let i = -weeksBack; i <= weeksForward; i++) {
    const d = new Date(thisMonday);
    d.setDate(thisMonday.getDate() + i * 7);
    keys.push(toDateKey(d));
  }
  return keys;
}

export default function SettingsScreen() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [serverVersion, setServerVersion] = useState(null);
  const [previewProgram, setPreviewProgram] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const mondays = useMemo(() => mondayOptions(), []);

  const loadProgram = useCallback(() => {
    return fetch(`${BASE_URL}/program`)
      .then((r) => r.json())
      .then(setState)
      .catch((err) => console.error('Failed to load program:', err))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgram();
    }, [loadProgram])
  );

  useFocusEffect(
    useCallback(() => {
      fetch(`${BASE_URL}/health`)
        .then((r) => r.json())
        .then((data) => setServerVersion(data.version ?? 'unknown'))
        .catch((err) => {
          console.error('Failed to load server version:', err);
          setServerVersion('unreachable');
        });
    }, [])
  );

  const openPreview = useCallback((program) => {
    setPreviewProgram(program);
    setPreview(null);
    setPreviewLoading(true);
    fetch(`${BASE_URL}/program/${program.key}/preview`)
      .then((r) => r.json())
      .then(setPreview)
      .catch((err) => {
        console.error('Failed to load program preview:', err);
        Alert.alert('Error', 'Could not load the program preview.');
        setPreviewProgram(null);
      })
      .finally(() => setPreviewLoading(false));
  }, []);

  const closePreview = useCallback(() => {
    setPreviewProgram(null);
    setPreview(null);
  }, []);

  const confirmSwitch = useCallback(async () => {
    if (!previewProgram) return;
    setWorking(true);
    try {
      const res = await fetch(`${BASE_URL}/program/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ program: previewProgram.key }),
      });
      setState(await res.json());
      closePreview();
    } catch (err) {
      console.error('Failed to switch program:', err);
      Alert.alert('Error', 'Could not switch programs.');
    } finally {
      setWorking(false);
    }
  }, [previewProgram, closePreview]);

  const confirmRestart = useCallback(() => {
    if (!state) return;
    const activeLabel =
      state.available_programs.find((p) => p.key === state.active_program)
        ?.label ?? state.active_program;
    Alert.alert(
      'Restart program?',
      `This week continues as-is. ${activeLabel} restarts from week 1 on the next Monday.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              const res = await fetch(`${BASE_URL}/program/restart`, {
                method: 'POST',
              });
              setState(await res.json());
            } catch (err) {
              console.error('Failed to restart program:', err);
              Alert.alert('Error', 'Could not restart the program.');
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }, [state]);

  const confirmCancel = useCallback(() => {
    Alert.alert(
      'Cancel scheduled change?',
      'Your current program keeps running as-is.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel change',
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              const res = await fetch(`${BASE_URL}/program/cancel`, {
                method: 'POST',
              });
              setState(await res.json());
            } catch (err) {
              console.error('Failed to cancel scheduled change:', err);
              Alert.alert('Error', 'Could not cancel the scheduled change.');
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }, []);

  const changeStartDate = useCallback(async (dateKey) => {
    setDatePickerVisible(false);
    setWorking(true);
    try {
      const res = await fetch(`${BASE_URL}/program/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: dateKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to reschedule');
      setState(json);
    } catch (err) {
      console.error('Failed to change start date:', err);
      Alert.alert('Error', 'Could not change the start date.');
    } finally {
      setWorking(false);
    }
  }, []);

  const startDate = state?.pending_program
    ? state.pending_start_date
    : state?.program_start_date;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>SETTINGS</Text>
      </View>

      {loading ? (
        <View style={styles.centeredMsg}>
          <Text style={styles.mutedText}>Loading…</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>PROGRAM</Text>

          {state.pending_program ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="time-outline" size={16} color={COLORS.accent} />
              <Text style={styles.pendingText}>
                {state.pending_program === state.active_program
                  ? 'Restarting'
                  : `Switching to ${
                      state.available_programs.find(
                        (p) => p.key === state.pending_program
                      )?.label ?? state.pending_program
                    }`}{' '}
                on {formatDateKey(state.pending_start_date)}
              </Text>
              <TouchableOpacity
                onPress={confirmCancel}
                disabled={working}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.pendingCancel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.card}>
            {state.available_programs.map((program, i) => {
              const isActive = program.key === state.active_program;
              const isScheduled =
                !isActive && program.key === state.pending_program;
              return (
                <TouchableOpacity
                  key={program.key}
                  style={[styles.programRow, i > 0 && styles.programRowBorder]}
                  disabled={isActive || working}
                  onPress={() => openPreview(program)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.programName}>{program.label}</Text>
                  {isActive ? (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ACTIVE</Text>
                    </View>
                  ) : isScheduled ? (
                    <View style={styles.scheduledBadge}>
                      <Text style={styles.scheduledBadgeText}>SCHEDULED</Text>
                    </View>
                  ) : (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.textMuted}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.restartBtn}
            onPress={confirmRestart}
            disabled={working}
            activeOpacity={0.8}
          >
            {working ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color={COLORS.text} />
                <Text style={styles.restartBtnText}>Restart Program</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>START DATE</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => setDatePickerVisible(true)}
            disabled={working}
            activeOpacity={0.7}
          >
            <View style={styles.programRow}>
              <View>
                <Text style={styles.programName}>
                  {formatDateKey(startDate)}
                </Text>
                <Text style={styles.startDateHint}>
                  {state.pending_program
                    ? 'Upcoming program starts this date'
                    : 'Current program started this date'}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textMuted}
              />
            </View>
          </TouchableOpacity>

          <Modal
            visible={datePickerVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setDatePickerVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Start Date</Text>
                  <TouchableOpacity
                    onPress={() => setDatePickerVisible(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalSubtitle}>
                  Programs always start on a Monday.
                </Text>
                <FlatList
                  data={mondays}
                  keyExtractor={(item) => item}
                  style={styles.modalList}
                  renderItem={({ item }) => {
                    const selected = item === startDate;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.modalRow,
                          selected && styles.modalRowSelected,
                        ]}
                        onPress={() => changeStartDate(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modalRowText}>
                          {formatDateKey(item)}
                        </Text>
                        {selected ? (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color={COLORS.accent}
                          />
                        ) : null}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

          <Modal
            visible={!!previewProgram}
            transparent
            animationType="slide"
            onRequestClose={closePreview}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{previewProgram?.label}</Text>
                  <TouchableOpacity
                    onPress={closePreview}
                    disabled={working}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>

                {previewLoading || !preview ? (
                  <View style={styles.previewLoading}>
                    <ActivityIndicator color={COLORS.text} />
                  </View>
                ) : (
                  <>
                    <Text style={styles.modalSubtitle}>
                      {preview.description}
                    </Text>
                    <Text style={styles.previewWeeksLabel}>
                      {preview.total_weeks} weeks · week 1 shown below
                    </Text>
                    <ScrollView style={styles.modalList}>
                      {preview.days.map((day) => (
                        <View
                          key={day.day_of_week}
                          style={styles.previewDayRow}
                        >
                          <Text style={styles.previewDayName}>
                            {DAY_LABELS[day.day_of_week]}
                          </Text>
                          <View style={styles.previewDayInfo}>
                            <Text
                              style={[
                                styles.previewDayFocus,
                                day.is_rest_day && styles.mutedText,
                              ]}
                            >
                              {day.is_rest_day ? 'Rest Day' : day.focus_summary}
                            </Text>
                            {!day.is_rest_day ? (
                              <Text style={styles.previewDayCount}>
                                {day.exercise_count} exercise
                                {day.exercise_count === 1 ? '' : 's'}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                    <Text style={styles.previewNotice}>
                      This week continues as-is. {previewProgram?.label} starts
                      on the next Monday, from week 1.
                    </Text>
                    <View style={styles.previewActions}>
                      <TouchableOpacity
                        style={styles.previewCancelBtn}
                        onPress={closePreview}
                        disabled={working}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.previewCancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.previewConfirmBtn}
                        onPress={confirmSwitch}
                        disabled={working}
                        activeOpacity={0.8}
                      >
                        {working ? (
                          <ActivityIndicator color={COLORS.text} />
                        ) : (
                          <Text style={styles.previewConfirmText}>
                            Switch to {previewProgram?.label}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>

          <Text style={styles.sectionLabel}>ABOUT</Text>
          <View style={styles.card}>
            <View style={styles.programRow}>
              <Text style={styles.programName}>App Version</Text>
              <Text style={styles.mutedText}>{APP_VERSION}</Text>
            </View>
            <View style={[styles.programRow, styles.programRowBorder]}>
              <Text style={styles.programName}>Server Version</Text>
              <Text style={styles.mutedText}>
                {serverVersion ?? 'Loading…'}
              </Text>
            </View>
          </View>
        </View>
      )}
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
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  centeredMsg: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accentDim,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  pendingText: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  pendingCancel: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    marginBottom: 20,
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
  programName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scheduledBadge: {
    backgroundColor: COLORS.accentDim,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  scheduledBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  restartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 28,
  },
  restartBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  startDateHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 8,
  },
  modalList: {
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  modalRowSelected: {
    backgroundColor: COLORS.accentDim,
  },
  modalRowText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  previewLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  previewWeeksLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  previewDayRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  previewDayName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    width: 78,
  },
  previewDayInfo: {
    flex: 1,
  },
  previewDayFocus: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  previewDayCount: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  previewNotice: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 14,
    marginBottom: 14,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  previewCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 14,
  },
  previewCancelText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  previewConfirmBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
  },
  previewConfirmText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
});
