import { StyleSheet, View, SafeAreaView, Text, TouchableOpacity, ScrollView, Animated, StatusBar, ActivityIndicator } from 'react-native';
import { TextInput, Provider, DefaultTheme } from 'react-native-paper';
import React, { useState, useRef } from 'react';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from '../firebase';
import { setDoc, doc } from "firebase/firestore";

// ----- Custom theme -----
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

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const signUp = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userId = userCredential.user.uid;
      await setDoc(doc(db, 'students', userId), {
        name,
        address,
        city,
        zip,
        phone,
        email,
      });
      // Show success screen
      setRegistered(true);
    } catch (error) {
      console.error("Signup error:", error);
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
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  // If registered, show success screen
  if (registered) {
    return (
      <Provider theme={theme}>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />
          <View style={styles.header}>
            <View style={styles.headerBrand}>
              <Text style={styles.headerIcon}>🛡️</Text>
              <Text style={styles.headerTitle}>MakeMyCitySafe</Text>
            </View>
          </View>
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Text style={{ fontSize: 40 }}>✅</Text>
            </View>
            <Text style={styles.heroTitle}>Account Created!</Text>
            <Text style={styles.heroSubtitle}>Your profile is ready.</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Provider>
    );
  }

  // Registration form
  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />
        <View style={styles.header}>
          <View style={styles.headerBrand}>
            <Text style={styles.headerIcon}>🛡️</Text>
            <Text style={styles.headerTitle}>MakeMyCitySafe</Text>
          </View>
        </View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.heroSection}>
              <Text style={styles.heroTitle}>Create Safety Profile</Text>
              <Text style={styles.heroSubtitle}>Join the community and help secure your neighborhood.</Text>
            </View>

            <View style={styles.card}>
              {/* Google Button (optional – keep or remove) */}
              <TouchableOpacity style={styles.googleBtn} activeOpacity={0.8}>
                <Text style={styles.googleBtnText}>Sign up with Google</Text>
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR EMAIL</Text>
                <View style={styles.dividerLine} />
              </View>

              <TextInput
                style={styles.input}
                label="Full Name"
                value={name}
                onChangeText={setName}
                left={<TextInput.Icon icon="account" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />
              <TextInput
                style={styles.input}
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                left={<TextInput.Icon icon="email" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />
              <TextInput
                style={styles.input}
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                left={<TextInput.Icon icon="lock" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />
              <TextInput
                style={styles.input}
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                left={<TextInput.Icon icon="check-circle" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
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
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />
              <TextInput
                style={styles.input}
                label="Address"
                value={address}
                onChangeText={setAddress}
                left={<TextInput.Icon icon="map-marker" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />
              <TextInput
                style={styles.input}
                label="City"
                value={city}
                onChangeText={setCity}
                left={<TextInput.Icon icon="city" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />
              <TextInput
                style={styles.input}
                label="Zip Code"
                value={zip}
                onChangeText={setZip}
                keyboardType="numeric"
                left={<TextInput.Icon icon="numeric" color="#767683" />}
                mode="outlined"
                outlineColor="#c6c5d4"
                activeOutlineColor="#000666"
                theme={theme}
              />

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={signUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    height: 56,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scrollContent: { padding: 16, paddingBottom: 32 },
  heroSection: { alignItems: 'center', marginBottom: 20, marginTop: 8 },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a237e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    padding: 20,
    gap: 12,
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e2e2' },
  dividerText: {
    fontSize: 11,
    color: '#767683',
    letterSpacing: 0.05,
    fontWeight: '500',
  },
  input: { backgroundColor: '#f9f9f9', height: 48 },
  link: { color: '#000666', fontWeight: '700' },
  primaryBtn: {
    height: 54,
    backgroundColor: '#1a237e',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  primaryBtnText: { color: 'white', fontSize: 18, fontWeight: '700' },
  primaryBtnIcon: { color: 'white', fontSize: 20 },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginLinkText: { fontSize: 15, color: '#454652' },
});

export default RegisterScreen;
