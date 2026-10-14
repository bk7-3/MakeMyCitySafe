import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput, Provider, DefaultTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';

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

const RegisterScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const signUp = async () => {
    setErrorMsg('');

    if (!name.trim() || !email.trim() || !password.trim()) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const userId = userCredential.user.uid;

      await setDoc(doc(db, 'users', userId), {
        name: name.trim(),
        address: address.trim(),
        city: city.trim(),
        zip: zip.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });

      setRegistered(true);
    } catch (error) {
      console.error('Signup error:', error);
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters.';
      } else if (error.code === 'permission-denied') {
        msg = 'Firestore permissions error. Check your security rules.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <Provider theme={theme}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

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

          <View style={[styles.successContainer, { paddingBottom: insets.bottom }]}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={56} color="#fff" />
            </View>
            <Text style={styles.successTitle}>Account Created!</Text>
            <Text style={styles.successSubtitle}>
              Your profile is ready. Sign in to get started.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continue to Sign In</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color="#fff"
                style={{ marginLeft: 8 }}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Provider>
    );
  }

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

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
            <View style={styles.heroSection}>
              <View style={styles.iconBox}>
                <Image
                  source={require('../assets/secure-city-logo.png')}
                  style={styles.heroLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.heroTitle}>Create Safety Profile</Text>
              <Text style={styles.heroSubtitle}>
                Join the community and help secure your neighborhood.
              </Text>
            </View>

            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#93000a" />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <TouchableOpacity style={styles.googleBtn} activeOpacity={0.85}>
                <Ionicons
                  name="logo-google"
                  size={18}
                  color="#1a1c1c"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.googleBtnText}>Sign up with Google</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR SIGN UP WITH EMAIL</Text>
                <View style={styles.dividerLine} />
              </View>

              <Text style={styles.sectionLabel}>Personal Information</Text>

              <TextInput
                style={styles.input}
                label="Full Name *"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                left={<TextInput.Icon icon="account" color="#767683" />}
                mode="outlined"
                outlineColor="#DFE1E8"
                activeOutlineColor="#000666"
                theme={theme}
              />

              <TextInput
                style={styles.input}
                label="Email Address *"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                left={<TextInput.Icon icon="email" color="#767683" />}
                mode="outlined"
                outlineColor="#DFE1E8"
                activeOutlineColor="#000666"
                theme={theme}
              />

              <TextInput
                style={styles.input}
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                left={<TextInput.Icon icon="phone" color="#767683" />}
                mode="outlined"
                outlineColor="#DFE1E8"
                activeOutlineColor="#000666"
                theme={theme}
              />

              <Text style={[styles.sectionLabel, { marginTop: SPACING.sm }]}>
                Security
              </Text>

              <TextInput
                style={styles.input}
                label="Password *"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                left={<TextInput.Icon icon="lock" color="#767683" />}
                mode="outlined"
                outlineColor="#DFE1E8"
                activeOutlineColor="#000666"
                theme={theme}
              />

              <TextInput
                style={styles.input}
                label="Confirm Password *"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                left={<TextInput.Icon icon="lock-check" color="#767683" />}
                mode="outlined"
                outlineColor="#DFE1E8"
                activeOutlineColor="#000666"
                theme={theme}
              />

              <Text style={[styles.sectionLabel, { marginTop: SPACING.sm }]}>
                Home Address
              </Text>

              <TextInput
                style={styles.input}
                label="Street Address"
                value={address}
                onChangeText={setAddress}
                left={<TextInput.Icon icon="map-marker" color="#767683" />}
                mode="outlined"
                outlineColor="#DFE1E8"
                activeOutlineColor="#000666"
                theme={theme}
              />

              <View style={styles.rowFields}>
                <TextInput
                  style={[styles.input, { flex: 2, marginRight: 8 }]}
                  label="City"
                  value={city}
                  onChangeText={setCity}
                  left={<TextInput.Icon icon="city" color="#767683" />}
                  mode="outlined"
                  outlineColor="#DFE1E8"
                  activeOutlineColor="#000666"
                  theme={theme}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  label="Zip"
                  value={zip}
                  onChangeText={setZip}
                  keyboardType="numeric"
                  left={<TextInput.Icon icon="numeric" color="#767683" />}
                  mode="outlined"
                  outlineColor="#DFE1E8"
                  activeOutlineColor="#000666"
                  theme={theme}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={signUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Create Account</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color="#fff"
                      style={{ marginLeft: 8 }}
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLink}
              activeOpacity={0.7}
            >
              <Text style={styles.loginLinkText}>
                Already have an account?{' '}
                <Text style={styles.link}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Provider>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },

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

  scrollContent: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg },

  heroSection: { alignItems: 'center', marginBottom: SPACING.lg },
  iconBox: {
    width: scale(72, 84, 96),
    height: scale(72, 84, 96),
    borderRadius: scale(18, 22, 26),
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

  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  successIcon: {
    width: scale(90, 110, 120),
    height: scale(90, 110, 120),
    borderRadius: scale(45, 55, 60),
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: {
    fontSize: scale(24, 28, 32),
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: scale(14, 15, 16),
    color: '#4A4A5A',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 8,
  },
  errorBannerText: {
    color: '#93000a',
    fontSize: scale(12, 13, 14),
    fontWeight: '600',
    flex: 1,
  },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: scale(14, 16, 18),
    borderWidth: 1,
    borderColor: '#E6E8EE',
    padding: SPACING.md,
    gap: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  sectionLabel: {
    fontSize: scale(11, 12, 13),
    fontWeight: '700',
    color: '#000666',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginLeft: 2,
  },

  input: {
    backgroundColor: '#F9FAFC',
    fontSize: scale(14, 15, 16),
  },
  rowFields: {
    flexDirection: 'row',
    alignItems: 'center',
  },

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

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: SPACING.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E6E8EE' },
  dividerText: {
    fontSize: scale(9, 10, 11),
    color: '#8A8A9E',
    letterSpacing: 0.8,
    fontWeight: '600',
  },

  primaryBtn: {
    height: scale(50, 54, 56),
    backgroundColor: '#000666',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
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

  loginLink: { marginTop: SPACING.lg, alignItems: 'center' },
  loginLinkText: {
    fontSize: scale(13, 14, 15),
    color: '#4A4A5A',
  },
  link: { color: '#000666', fontWeight: '700' },
});
