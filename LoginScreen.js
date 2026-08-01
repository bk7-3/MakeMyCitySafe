import {
  StyleSheet, View, SafeAreaView, ScrollView,
  TouchableOpacity, Animated, Dimensions, StatusBar, ActivityIndicator
} from 'react-native';
import { Text, TextInput, Provider, DefaultTheme } from 'react-native-paper';
import React, { useState, useRef } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';

const { width } = Dimensions.get('window');

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#000666',
    accent: '#000666',
    background: '#f9f9f9',
    surface: '#ffffff',
    text: '#1a1c1c',
    placeholder: '#454652',
    border: '#c6c5d4',
    primaryContainer: '#1a237e',
    onPrimaryContainer: '#ffffff',
  },
};

const LogInScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loginFailed, setLoginFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const btnScale = useRef(new Animated.Value(1)).current;
  const isFromSignUp = route?.params?.isFromSignUp ?? false;

  const pressIn = () => Animated.spring(btnScale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(btnScale, { toValue: 1, useNativeDriver: true }).start();

  const logIn = async () => {
    setLoading(true);
    setLoginFailed(false);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigation.navigate('Main'); 
    } catch (error) {
      console.log(error.message);
      setLoginFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Text style={styles.headerIcon}>🛡️</Text>
            <Text style={styles.headerTitle}>MakeMyCitySafe</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.heroSection}>
            <View style={styles.iconBox}>
              <Text style={styles.iconBoxText}>🛡️</Text>
            </View>
            <Text style={styles.heroTitle}>Welcome Back</Text>
            <Text style={styles.heroSubtitle}>Access your safety dashboard and local alerts.</Text>
          </View>

          {/* Banners */}
          {isFromSignUp && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>
                ✅ Account created successfully — please sign in.
              </Text>
            </View>
          )}
          {loginFailed && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>
                ⚠️ Login failed. Please check your credentials and try again.
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
                keyboardType="email-address"
                placeholder="name@example.com"
                left={<TextInput.Icon icon="email" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
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
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                left={<TextInput.Icon icon="lock" color="#767683" />}
                right={
                  <TextInput.Icon
                    icon={showPassword ? "eye-off" : "eye"}
                    onPress={() => setShowPassword(!showPassword)}
                    color="#767683"
                  />
                }
                mode="outlined"
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />
            </View>

            {/* Options */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember Me</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In Button */}
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={logIn}
                onPressIn={pressIn}
                onPressOut={pressOut}
                disabled={loading}
                activeOpacity={1}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                    <Text style={styles.primaryBtnIcon}>→</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Button (placeholder) */}
            <TouchableOpacity style={styles.googleBtn} activeOpacity={0.85}>
              <Text style={styles.googleBtnText}>Sign in with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Register Link */}
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
      </SafeAreaView>
    </Provider>
  );
};

export default LogInScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    height: 56,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 20 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000666',
    letterSpacing: -0.5,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  heroSection: { alignItems: 'center', marginBottom: 20, marginTop: 12 },
  iconBox: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: '#1a237e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconBoxText: { fontSize: 32 },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#454652',
    textAlign: 'center',
    marginTop: 4,
  },
  successBanner: {
    backgroundColor: '#d1fae5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6ee7b7',
    padding: 12,
    marginBottom: 12,
  },
  successBannerText: { color: '#065f46', fontSize: 14, fontWeight: '500' },
  errorBanner: {
    backgroundColor: '#ffdad6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffb3ad',
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: { color: '#93000a', fontSize: 14, fontWeight: '500' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    padding: 20,
    gap: 14,
  },
  fieldGroup: { gap: 4 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1c1c',
    letterSpacing: 0.04,
    paddingLeft: 2,
  },
  input: {
    backgroundColor: '#f9f9f9',
    height: 48,
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#767683',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  checkboxChecked: { backgroundColor: '#000666', borderColor: '#000666' },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '700' },
  rememberText: { fontSize: 13, color: '#1a1c1c', fontWeight: '600' },
  forgotText: { fontSize: 13, color: '#000666', fontWeight: '700' },
  primaryBtn: {
    height: 54,
    backgroundColor: '#1a237e',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: 'white', fontSize: 17, fontWeight: '700' },
  primaryBtnIcon: { color: 'white', fontSize: 20 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e2e2' },
  dividerText: {
    fontSize: 10,
    color: '#767683',
    letterSpacing: 0.08,
    fontWeight: '500',
  },
  googleBtn: {
    height: 52,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#1a1c1c' },
  registerLink: { marginTop: 20, alignItems: 'center' },
  registerLinkText: { fontSize: 15, color: '#454652' },
  link: { color: '#000666', fontWeight: '700' },
});
