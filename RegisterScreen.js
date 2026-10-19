import { StyleSheet, View, SafeAreaView, Text, TouchableOpacity, ScrollView,
  Animated, StatusBar, ActivityIndicator } from 'react-native';
import { TextInput, Provider, DefaultTheme } from 'react-native-paper';
import React, { useState, useRef } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { setDoc, doc } from 'firebase/firestore';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors,
  primary: '#000666', accent: '#000666', background: '#f9f9f9', surface: '#fff',
  text: '#1a1c1c', placeholder: '#454652', border: '#c6c5d4',
  primaryContainer: '#1a237e', onPrimaryContainer: '#fff' } };

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'This email is already registered. Please sign in.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'permission-denied': 'Firestore permissions error. Check your security rules.',
};

// Field config drives both the form and the auth payload
const FIELDS = [
  { key: 'name', label: 'Full Name', icon: 'account' },
  { key: 'email', label: 'Email Address', icon: 'email', autoCapitalize: 'none', keyboardType: 'email-address' },
  { key: 'password', label: 'Password', icon: 'lock', secureTextEntry: true, autoCapitalize: 'none' },
  { key: 'confirmPassword', label: 'Confirm Password', icon: 'check-circle', secureTextEntry: true, autoCapitalize: 'none' },
  { key: 'phone', label: 'Phone Number', icon: 'phone', keyboardType: 'phone-pad' },
  { key: 'address', label: 'Address', icon: 'map-marker' },
  { key: 'city', label: 'City', icon: 'city' },
  { key: 'zip', label: 'Zip Code', icon: 'numeric', keyboardType: 'numeric' },
];

const BrandHeader = () => (
  <View style={styles.header}>
    <View style={styles.headerBrand}>
      <Text style={styles.headerIcon}>🛡️</Text>
      <Text style={styles.headerTitle}>MakeMyCitySafe</Text>
    </View>
  </View>
);

const RegisterScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    phone: '', address: '', city: '', zip: '',
  });
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const setField = (key) => (val) => setForm((prev) => ({ ...prev, [key]: val }));

  const signUp = async () => {
    const { name, email, phone, password, confirmPassword, address, city, zip } = form;
    if (password !== confirmPassword) return alert('Passwords do not match.');
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'students', user.uid), { name, address, city, zip, phone, email });
      setRegistered(true);
    } catch (error) {
      console.error('Signup error:', error);
      alert(AUTH_ERRORS[error.code] || error.message);
    } finally {
      setLoading(false);
    }
  };

  if (registered) return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />
        <BrandHeader />
        <View style={styles.successContainer}>
          <View style={styles.successIcon}><Text style={{ fontSize: 40 }}>✅</Text></View>
          <Text style={styles.heroTitle}>Account Created!</Text>
          <Text style={styles.heroSubtitle}>Your profile is ready.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Provider>
  );

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />
        <BrandHeader />

        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>Create Safety Profile</Text>
              <Text style={styles.heroSubtitle}>Join the community and help secure your neighborhood.</Text>
            </View>

            <View style={styles.card}>
              <TouchableOpacity style={styles.googleBtn} activeOpacity={0.8}>
                <Text style={styles.googleBtnText}>Sign up with Google</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR EMAIL</Text>
                <View style={styles.dividerLine} />
              </View>

              {FIELDS.map(({ key, label, icon, ...rest }) => (
                <TextInput
                  key={key}
                  style={styles.input}
                  label={label}
                  value={form[key]}
                  onChangeText={setField(key)}
                  left={<TextInput.Icon icon={icon} color="#767683" />}
                  mode="outlined"
                  outlineColor="#c6c5d4"
                  activeOutlineColor="#000666"
                  theme={theme}
                  {...rest}
                />
              ))}

              <TouchableOpacity style={styles.primaryBtn} onPress={signUp} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="white" /> : (
                  <>
                    <Text style={styles.primaryBtnText}>Register Account</Text>
                    <Text style={styles.primaryBtnIcon}>→</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={styles.link}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </Provider>
  );
};

export default RegisterScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { height: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e2e2',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { fontSize: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#000666', letterSpacing: -0.5 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  heroSection: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a237e',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroTitle: { fontSize: 26, fontWeight: '700', color: '#1a1c1c', textAlign: 'center', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 15, color: '#454652', textAlign: 'center', marginTop: 4 },

  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#c6c5d4', padding: 20, gap: 12 },
  googleBtn: { height: 52, borderWidth: 1, borderColor: '#c6c5d4', borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#1a1c1c' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e2e2' },
  dividerText: { fontSize: 11, color: '#767683', letterSpacing: 0.05, fontWeight: '500' },
  input: { backgroundColor: '#f9f9f9', height: 48 },
  link: { color: '#000666', fontWeight: '700' },

  primaryBtn: { height: 54, backgroundColor: '#1a237e', borderRadius: 8, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  primaryBtnIcon: { color: '#fff', fontSize: 20 },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { fontSize: 15, color: '#454652' },
});
