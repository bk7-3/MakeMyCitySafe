import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Switch, ScrollView, Alert,
  StatusBar, Dimensions, Platform, Animated, Easing } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';

const { height: SCREEN_H } = Dimensions.get('window');
const scale = (s, n, l) => (SCREEN_H < 700 ? s : SCREEN_H > 850 ? l : n);
const SPACING = { xs: scale(4, 6, 8), sm: scale(8, 10, 12), md: scale(12, 16, 20),
  lg: scale(16, 20, 24), xl: scale(20, 24, 28) };
const COLORS = { primary: '#000666', primaryLight: '#F0F2FF', background: '#F5F7FA',
  surface: '#fff', text: '#1a1c1c', subtext: '#4A4A5A', muted: '#8A8A9E',
  border: '#E6E8EE', danger: '#D32F2F', dangerLight: '#FFEBEE', success: '#2E7D32',
  successLight: '#E8F5E9', info: '#0288D1', infoLight: '#E1F5FE',
  warning: '#F57C00', warningLight: '#FFF3E0' };
const SPEED_LIMIT_MPH = 20;
const CRASH_G_THRESHOLD = 3.0;

const RIDE_TIPS = [
  { icon: 'bicycle', text: 'Always wear a helmet fitted correctly.' },
  { icon: 'bulb', text: 'Use headlight and taillight at dusk or night.' },
  { icon: 'eye', text: 'Stay visible — wear bright or reflective clothing.' },
  { icon: 'hand-left', text: 'Keep both hands on the handlebars.' },
];
const ACCIDENT_TIPS = [
  { icon: 'checkmark-circle', text: 'Check yourself and others for injuries.' },
  { icon: 'walk', text: 'Move safely off the main road if possible.' },
  { icon: 'call', text: 'Call emergency services if needed.' },
  { icon: 'swap-horizontal', text: 'Exchange contact info with others involved.' },
];

export default function EbikeSafetyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [speedMph, setSpeedMph] = useState(0);
  const [isEbikeMode, setIsEbikeMode] = useState(true);
  const [showTips, setShowTips] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const speedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let sub;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Denied',
        'Location permission is required for speed tracking.');
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 },
        (loc) => {
          const mps = loc.coords.speed || 0;
          setSpeedMph(mps < 0.5 ? 0 : Math.round(mps * 2.23694));
        });
    })();
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (!isEbikeMode) return;
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      if (Math.sqrt(x * x + y * y + z * z) > CRASH_G_THRESHOLD) {
        sub.remove();
        navigation.navigate('Help Screen', { triggeredByCollision: true });
      }
    });
    return () => sub.remove();
  }, [isEbikeMode, navigation]);

  useEffect(() => {
    if (!isEbikeMode) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [isEbikeMode]);

  useEffect(() => {
    Animated.timing(speedAnim, { toValue: Math.min(speedMph / 40, 1), duration: 400, useNativeDriver: false }).start();
  }, [speedMph]);

  const isSpeeding = speedMph > SPEED_LIMIT_MPH;
  const ringSize = scale(180, 220, 260);
  const ringStroke = scale(12, 14, 16);
  const ringColor = isSpeeding ? COLORS.danger : speedMph > SPEED_LIMIT_MPH * 0.7 ? COLORS.warning : COLORS.success;
  const pct = Math.min(speedMph / 40, 1);
  const handleBack = () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main');

  const renderTips = (title, icon, iconColor, iconBg, tips, accent) => (
    <View>
      <View style={styles.tipsHeaderRow}>
        <View style={[styles.tipsIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <Text style={styles.tipHeader}>{title}</Text>
      </View>
      {tips.map((tip, i) => (
        <View key={i} style={styles.tipRow}>
          <View style={[styles.tipIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={tip.icon} size={14} color={accent} />
          </View>
          <Text style={styles.tipText}>{tip.text}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>E-Bike Safety</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xl }]} showsVerticalScrollIndicator={false}>
        <View style={styles.speedometerWrap}>
          <View style={[styles.speedometerRing, { width: ringSize, height: ringSize, borderRadius: ringSize / 2, borderWidth: ringStroke, borderColor: COLORS.border }]}>
            <Animated.View style={{ position: 'absolute', width: ringSize, height: ringSize, borderRadius: ringSize / 2,
              borderWidth: ringStroke, borderColor: ringColor, borderRightColor: 'transparent',
              borderBottomColor: pct > 0.5 ? ringColor : 'transparent',
              transform: [{ rotate: speedAnim.interpolate({ inputRange: [0, 1], outputRange: ['-45deg', '180deg'] }) }] }} />
            <View style={styles.speedometerCenter}>
              <Ionicons name={isSpeeding ? 'warning' : 'speedometer-outline'} size={scale(20, 24, 26)} color={ringColor} />
              <Text style={[styles.speedBig, { color: isSpeeding ? COLORS.danger : COLORS.text }]}>{speedMph}</Text>
              <Text style={styles.speedUnit}>MPH</Text>
              <View style={[styles.limitPill, { backgroundColor: isSpeeding ? COLORS.dangerLight : COLORS.successLight }]}>
                <Text style={[styles.limitText, { color: isSpeeding ? COLORS.danger : COLORS.success }]}>
                  {isSpeeding ? 'OVER LIMIT' : 'SAFE'}
                </Text>
              </View>
            </View>
          </View>
          {isSpeeding && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={14} color="#fff" />
              <Text style={styles.warningBannerText}>Slow down — limit is {SPEED_LIMIT_MPH} MPH</Text>
            </View>
          )}
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.toggleLeft}>
            <Animated.View style={[styles.toggleIconBox, {
              backgroundColor: isEbikeMode ? COLORS.successLight : COLORS.dangerLight,
              transform: isEbikeMode ? [{ scale: pulseAnim }] : [{ scale: 1 }] }]}>
              <Ionicons name={isEbikeMode ? 'shield-checkmark' : 'shield-outline'} size={24}
                color={isEbikeMode ? COLORS.success : COLORS.danger} />
            </Animated.View>
            <View style={styles.toggleTextContainer}>
              <Text style={styles.toggleTitle}>E-Bike Mode</Text>
              <Text style={[styles.toggleSubtitle, { color: isEbikeMode ? COLORS.success : COLORS.danger, fontWeight: '700' }]}>
                {isEbikeMode ? 'ACTIVE' : 'DISABLED'}
              </Text>
              <Text style={styles.toggleDesc}>
                {isEbikeMode ? 'Collision detection is running' : 'Enable for automatic crash detection'}
              </Text>
            </View>
          </View>
          <Switch value={isEbikeMode} onValueChange={setIsEbikeMode}
            trackColor={{ false: '#D0D3DC', true: COLORS.success }}
            thumbColor={Platform.OS === 'android' ? '#fff' : undefined} />
        </View>

        <TouchableOpacity style={styles.actionButton} onPress={() => setShowTips(!showTips)} activeOpacity={0.85}>
          <View style={styles.actionButtonLeft}>
            <Ionicons name="book" size={18} color="#fff" />
            <Text style={styles.buttonText}>Safety & Accident Tips</Text>
          </View>
          <Ionicons name={showTips ? 'chevron-up' : 'chevron-down'} size={20} color="#fff" />
        </TouchableOpacity>

        {showTips && (
          <View style={styles.tipsContainer}>
            {renderTips('Ride Safety', 'shield-checkmark', COLORS.info, COLORS.infoLight, RIDE_TIPS, COLORS.info)}
            <View style={styles.tipsDivider} />
            {renderTips('In Case of an Accident', 'warning', COLORS.danger, COLORS.dangerLight, ACCIDENT_TIPS, COLORS.danger)}
          </View>
        )}

        <Animated.View style={{ transform: [{ scale: isEbikeMode ? pulseAnim : 1 }], marginTop: SPACING.sm }}>
          <TouchableOpacity style={styles.emergencyButton} onPress={() => navigation.navigate('Help Screen')} activeOpacity={0.85}>
            <View style={styles.emergencyIconWrap}>
              <Ionicons name="call" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyButtonText}>Emergency Help</Text>
              <Text style={styles.emergencySubtext}>Tap to call for assistance</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: scale(16, 18, 20), fontWeight: '700', color: COLORS.primary },
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  speedometerWrap: { alignItems: 'center', marginBottom: SPACING.lg },
  speedometerRing: { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  speedometerCenter: { alignItems: 'center', justifyContent: 'center' },
  speedBig: { fontSize: scale(52, 62, 70), fontWeight: '900', letterSpacing: -2, lineHeight: scale(58, 68, 76) },
  speedUnit: { fontSize: scale(12, 14, 16), fontWeight: '700', color: COLORS.muted, letterSpacing: 2, marginTop: -4 },
  limitPill: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10 },
  limitText: { fontSize: scale(9, 10, 11), fontWeight: '800', letterSpacing: 1 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.danger,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: SPACING.md, gap: 6,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 3 },
  warningBannerText: { color: '#fff', fontWeight: '700', fontSize: scale(11, 12, 13) },

  toggleCard: { backgroundColor: COLORS.surface, borderRadius: scale(16, 18, 20), padding: SPACING.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: SPACING.sm },
  toggleIconBox: { width: scale(48, 52, 56), height: scale(48, 52, 56), borderRadius: scale(14, 16, 18),
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  toggleTextContainer: { flex: 1 },
  toggleTitle: { color: COLORS.text, fontSize: scale(14, 15, 16), fontWeight: '700' },
  toggleSubtitle: { fontSize: scale(10, 11, 12), letterSpacing: 1, marginTop: 2 },
  toggleDesc: { color: COLORS.muted, fontSize: scale(10, 11, 12), marginTop: 2, fontWeight: '500' },

  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.info, padding: SPACING.md, borderRadius: scale(14, 16, 18), marginBottom: SPACING.sm,
    shadowColor: COLORS.info, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  actionButtonLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: scale(13, 14, 15) },

  tipsContainer: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: scale(14, 16, 18),
    marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  tipsDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.md },
  tipsHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm, gap: 10 },
  tipsIconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  tipHeader: { color: COLORS.text, fontWeight: '700', fontSize: scale(13, 14, 15) },
  tipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  tipIconWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: COLORS.infoLight,
    justifyContent: 'center', alignItems: 'center' },
  tipText: { color: COLORS.subtext, fontSize: scale(12, 13, 14), lineHeight: scale(17, 18, 19), flex: 1 },

  emergencyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.danger, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: scale(14, 16, 18), gap: SPACING.sm, shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 6 },
  emergencyIconWrap: { width: scale(44, 48, 52), height: scale(44, 48, 52),
    borderRadius: scale(22, 24, 26), backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center' },
  emergencyButtonText: { color: '#fff', fontWeight: '800', fontSize: scale(15, 16, 17), letterSpacing: 0.3 },
  emergencySubtext: { color: 'rgba(255,255,255,0.85)', fontSize: scale(11, 12, 13), marginTop: 1, fontWeight: '500' },
});
