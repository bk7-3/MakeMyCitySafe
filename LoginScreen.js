import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput, Provider, DefaultTheme } from 'react-native-paper';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';

// ---------- Responsive helpers ----------
const { height: SCREEN_H } = Dimensions.get('window');
const isSmallDevice = SCREEN_H < 700;
const isLargeDevice = SCREEN_H > 850;

const scale = (small, normal, large) => {
  if (isSmallDevice) return small;
  if (isLargeDevice) return large;
  return normal;
};

const SPACING = {
  xs: scale(4, 6, 8),
  sm: scale(8, 10, 12),
  md: scale(14, 16, 20),
  lg: scale(20, 24, 28),
  xl: scale(28, 32, 40),
};

// ---------- Theme ----------
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#000666',
    accent: '#000666',
    background: '#F5F7FA',
    surface: '#ffffff',
    text: '#1a1c1c',
    placeholder: '#8A8A9E',
    border: '#DFE1E8',
    primaryContainer: '#1a237e',
    onPrimaryContainer: '#ffffff',
  },
};

const LogInScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const btnScale = useRef(new Animated.Value(1)).current;
  const isFromSignUp = route?.params?.isFromSignUp ?? false;

  const pressIn = () =>
    Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

  const logIn = async () => {
    if (!email.trim() || !password.trim()) {
      setLoginFailed(true);
      return;
    }
    setLoading(true);
    setLoginFailed(false);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigation.navigate('Main');
    } catch (error) {
      console.log('Login error:', error.message);
      setLoginFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

        {/* Header with logo */}
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Image
              source={require('../assets/secure-city-logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>Secure City</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + SPACING.xl },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Hero with logo */}
            <View style={styles.heroSection}>
              <View style={styles.iconBox}>
                <Image
                  source={require('../assets/secure-city-logo.png')}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.heroTitle}>Welcome Back</Text>
              <Text style={styles.heroSubtitle}>
                Access your safety dashboard and local alerts.
              </Text>
            </View>

            {/* Banners */}
            {isFromSignUp && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#065f46" />
                <Text style={styles.successBannerText}>
                  Account created successfully — please sign in.
                </Text>
              </View>
            )}
            {loginFailed && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#93000a" />
                <Text style={styles.errorBannerText}>
                  Login failed. Please check your credentials and try again.
                </Text>
              </View>
            )}

            {/* Form Card */}
            <View style={styles.card}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder="name@example.com"
                  left={<TextInput.Icon icon="email" color="#767683" />}
                  mode="outlined"
                  outlineColor="#DFE1E8"
                  activeOutlineColor="#000666"
                  theme={theme}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPassword}
                  placeholder="Enter your password"
                  left={<TextInput.Icon icon="lock" color="#767683" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                      color="#767683"
                    />
                  }
                  mode="outlined"
                  outlineColor="#DFE1E8"
                  activeOutlineColor="#000666"
                  theme={theme}
                />
              </View>

              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      rememberMe && styles.checkboxChecked,
                    ]}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={logIn}
                  onPressIn={pressIn}
                  onPressOut={pressOut}
                  disabled={loading}
                  activeOpacity={1}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Sign In</Text>
                      <Ionicons
                        name="arrow-forward"
                        size={18}
                        color="#fff"
                        style={{ marginLeft: 8 }}
                      />
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity style={styles.googleBtn} activeOpacity={0.85}>
                <Ionicons
                  name="logo-google"
                  size={18}
                  color="#1a1c1c"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.googleBtnText}>Sign in with Google</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.registerLink}
              activeOpacity={0.7}
            >
              <Text style={styles.registerLinkText}>
                Don't have an account?{' '}
                <Text style={styles.link}>Register Now</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Provider>
  );
};

export default LogInScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },

  // Header
  header: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EE',
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: {
    width: scale(28, 32, 34),
    height: scale(28, 32, 34),
    marginRight: 8,
  },
  headerTitle: {
    fontSize: scale(16, 18, 20),
    fontWeight: '700',
    color: '#000666',
    letterSpacing: -0.4,
  },

  // Scroll
  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg },

  // Hero
  heroSection: { alignItems: 'center', marginBottom: SPACING.lg },
  iconBox: {
    width: scale(80, 96, 110),
    height: scale(80, 96, 110),
    borderRadius: scale(20, 24, 28),
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#000666',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E6E8EE',
  },
  heroLogo: { width: '75%', height: '75%' },
  heroTitle: {
    fontSize: scale(22, 26, 30),
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: scale(13, 14, 15),
    color: '#4A4A5A',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.md,
  },

  // Banners
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A5D6A7',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: 8,
  },
  successBannerText: {
    color: '#1B5E20',
    fontSize: scale(12, 13, 14),
    fontWeight: '600',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: 8,
  },
  errorBannerText: {
    color: '#93000a',
    fontSize: scale(12, 13, 14),
    fontWeight: '600',
    flex: 1,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: scale(14, 16, 18),
    borderWidth: 1,
    borderColor: '#E6E8EE',
    padding: SPACING.md,
    gap: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: scale(12, 13, 14),
    fontWeight: '600',
    color: '#1a1c1c',
    paddingLeft: 2,
  },
  input: { backgroundColor: '#F9FAFC', fontSize: scale(14, 15, 16) },

  // Options
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: scale(20, 22, 22),
    height: scale(20, 22, 22),
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#B0B3BF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFC',
  },
  checkboxChecked: { backgroundColor: '#000666', borderColor: '#000666' },
  rememberText: {
    fontSize: scale(12, 13, 14),
    color: '#1a1c1c',
    fontWeight: '600',
  },
  forgotText: {
    fontSize: scale(12, 13, 14),
    color: '#000666',
    fontWeight: '700',
  },

  // Primary button
  primaryBtn: {
    height: scale(50, 54, 56),
    backgroundColor: '#000666',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000666',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: {
    color: '#fff',
    fontSize: scale(15, 16, 17),
    fontWeight: '700',
  },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E6E8EE' },
  dividerText: {
    fontSize: scale(9, 10, 11),
    color: '#8A8A9E',
    letterSpacing: 0.8,
    fontWeight: '600',
  },

  // Google
  googleBtn: {
    height: scale(48, 52, 54),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DFE1E8',
    borderRadius: 12,
    backgroundColor: '#F9FAFC',
  },
  googleBtnText: {
    fontSize: scale(14, 15, 16),
    fontWeight: '600',
    color: '#1a1c1c',
  },

  // Register
  registerLink: { marginTop: SPACING.lg, alignItems: 'center' },
  registerLinkText: {
    fontSize: scale(13, 14, 15),
    color: '#4A4A5A',
  },
  link: { color: '#000666', fontWeight: '700' },
});
