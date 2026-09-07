import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';

const COLORS = {
  bg: '#0a0a0a',
  border: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#666666',
};

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.title}>SETTINGS</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.placeholderText}>Coming soon</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
});
