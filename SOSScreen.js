import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Text, Button, TextInput, Card, List, Divider, Portal, Dialog } from 'react-native-paper';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../firebase';

const ACCIDENT_TIPS = [
  { id: 'injuries', title: '1. Check for Injuries', shortDesc: 'Assess yourself and others for immediate danger.',
    icon: 'medical-bag', fullDetails: 'Check yourself first before moving. Look for bleeding, fractures, or signs of shock. Check passengers or other involved parties. If anyone is injured, unresponsive, or experiencing severe pain, call 911 immediately and do not move them unless there is an immediate fire or hazard.' },
  { id: 'safety', title: '2. Move to safe location', shortDesc: 'Get out of oncoming traffic if possible.',
    icon: 'run', fullDetails: 'If you and your e-bike/vehicle are blocking active traffic and it is safe to move, step to the sidewalk, shoulder, or safe area nearby. Turn on hazard lights if applicable. Avoid standing directly in live traffic lanes while inspecting damage.' },
  { id: 'photos', title: '3. Document the Scene', shortDesc: 'Take pictures of damage, road conditions, and markers.',
    icon: 'camera', fullDetails: 'Take photos of all vehicles or bikes involved, close-ups of damage, overall street layout, skid marks, road surface conditions, weather, traffic signs, and any visible injuries. Note the exact time and street intersection.' },
  { id: 'info', title: '4. Exchange Information', shortDesc: 'Collect names, phone numbers, and driver details.',
    icon: 'card-account-details', fullDetails: 'Exchange full names, phone numbers, driver license numbers, vehicle registration, and insurance policies with all drivers involved. Gather names and contact info of any witnesses nearby.' },
];

const SOSScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedTip, setSelectedTip] = useState(null);
  const school = { studentid: '1', schoolID: 'aaa' };
  const isCollision = route?.params?.triggeredByCollision;

  useEffect(() => {
    if (!isCollision) return;
    setMessage('E-Bike collision detected! I may need assistance.');
    Alert.alert('🚨 Collision Detected',
      'A sudden impact was detected on your e-bike. You have been redirected to the emergency screen.',
      [{ text: 'OK' }]);
  }, [isCollision]);

  useEffect(() => {
    let sub;
    let mounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Permission Denied', 'Permission to access location was denied');
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
        (newLoc) => mounted && setLocation(newLoc.coords));
      mounted ? (sub = s) : s.remove();
    })();
    return () => { mounted = false; sub?.remove(); };
  }, []);

  const makeCall = async (number) => {
    const phoneNumber = Platform.OS === 'android' ? `tel:${number}` : `telprompt:${number}`;
    try {
      const supported = await Linking.canOpenURL(phoneNumber);
      if (!supported) return Alert.alert('Error', 'Phone call facility is not available on this device');
      await Linking.openURL(phoneNumber);
    } catch (err) {
      console.error(err);
    }
  };

  const sendSOS = async () => {
    if (!message.trim()) return Alert.alert('Validation Error', 'Please enter a message before sending.');
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'help_messages'), {
        schoolID: school.schoolID,
        message: message.trim(),
        createdDateTime: Timestamp.fromDate(new Date()),
        createdBy: school.studentid,
        location: location ? { latitude: location.latitude, longitude: location.longitude } : null,
        status: 'active',
      });
      console.log('Document written with ID: ', docRef.id);
      Alert.alert('Alert Sent', 'Your message and location have been broadcasted to the map.', [
        { text: 'OK', onPress: () => { setMessage(''); navigation.goBack(); } },
      ]);
    } catch (e) {
      console.error('Error adding document: ', e);
      Alert.alert('Error', 'Failed to send help message.');
    } finally {
      setLoading(false);
    }
  };

  const sendSOSAndCall = async (number) => { makeCall(number); await sendSOS(); };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Title title="Emergency Contacts" subtitle="Direct Dial Lines" />
          <Card.Content>
            <Button mode="contained" buttonColor="#d32f2f" icon="phone" onPress={() => makeCall('911')}>
              Call 911
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Broadcast Assistance Request" subtitle="Shares message & live location with others" />
          <Card.Content>
            <TextInput label="Describe your situation..." value={message} onChangeText={setMessage}
              mode="outlined" multiline numberOfLines={4} style={styles.input} />

            <View style={styles.locationBadge}>
              <Text variant="bodySmall">
                {location
                  ? `📍 Live Location Active (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`
                  : '⏳ Connecting live location stream...'}
              </Text>
            </View>

            <Button mode="contained" icon="alert-octagon" onPress={sendSOS}
              loading={loading} disabled={loading} style={styles.actionBtn}>
              Send Help Message
            </Button>
            <Button mode="contained-tonal" icon="phone-alert" onPress={() => sendSOSAndCall('911')}
              loading={loading} disabled={loading} style={styles.actionBtn}>
              Send Message & Call 911
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Accident Response Guide" subtitle="Tap a step to view details" />
          <Card.Content style={styles.noPadding}>
            {ACCIDENT_TIPS.map((tip, index) => (
              <React.Fragment key={tip.id}>
                <List.Item title={tip.title} description={tip.shortDesc} descriptionNumberOfLines={2}
                  onPress={() => setSelectedTip(tip)}
                  left={(props) => <List.Icon {...props} icon={tip.icon} />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />} />
                {index < ACCIDENT_TIPS.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        <Dialog visible={Boolean(selectedTip)} onDismiss={() => setSelectedTip(null)}>
          {selectedTip && (
            <>
              <Dialog.Title>{selectedTip.title}</Dialog.Title>
              <Dialog.Content><Text variant="bodyMedium">{selectedTip.fullDetails}</Text></Dialog.Content>
              <Dialog.Actions><Button onPress={() => setSelectedTip(null)}>Got It</Button></Dialog.Actions>
            </>
          )}
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

export default SOSScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { flexGrow: 1, padding: 16 },
  card: { marginBottom: 16, backgroundColor: '#fff' },
  input: { marginBottom: 12 },
  locationBadge: { backgroundColor: '#e8f5e9', padding: 8, borderRadius: 6, marginBottom: 16, alignItems: 'center' },
  actionBtn: { marginTop: 8 },
  noPadding: { paddingHorizontal: 0 },
});
