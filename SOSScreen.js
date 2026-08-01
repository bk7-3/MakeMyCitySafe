import React, { useState, useEffect } from 'react';
import { StyleSheet, View, SafeAreaView, ScrollView, Alert, Linking, Platform } from 'react-native';
import { Text, Button, TextInput, Card } from 'react-native-paper';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '../firebase';

const SOSScreen = ({ route, navigation }) => {
  const [message, setMessage] = useState('');
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const school = { studentid: '1', schoolID: 'aaa' };

  const isCollision = route?.params?.triggeredByCollision;

  useEffect(() => {
    if (isCollision) {
      setMessage('E-Bike collision detected! I may need assistance.');
      Alert.alert(
        '🚨 Collision Detected',
        'A sudden impact was detected on your e-bike. You have been redirected to the emergency screen.',
        [{ text: 'OK' }]
      );
    }
  }, [isCollision]);

  useEffect(() => {
    let isMounted = true;
    let locationSubscription;

    const startLocationTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (newLocation) => {
          if (isMounted) {
            setLocation(newLocation.coords);
          }
        }
      );

      if (isMounted) {
        locationSubscription = sub;
      } else {
        sub.remove();
      }
    };

    startLocationTracking();

    return () => {
      isMounted = false;
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, []);

  const makeCall = async (number) => {
    const phoneNumber = Platform.OS === 'android' ? `tel:${number}` : `telprompt:${number}`;
    try {
      const supported = await Linking.canOpenURL(phoneNumber);
      if (!supported) {
        Alert.alert('Error', 'Phone call facility is not available on this device');
      } else {
        await Linking.openURL(phoneNumber);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sendSOS = async () => {
    if (!message.trim()) {
      Alert.alert('Validation Error', 'Please enter a message before sending.');
      return;
    }

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'help_messages'), {
        schoolID: school.schoolID,
        message: message.trim(),
        createdDateTime: Timestamp.fromDate(new Date()),
        createdBy: school.studentid,
        location: location ? {
          latitude: location.latitude,
          longitude: location.longitude,
        } : null,
        status: 'active',
      });

      console.log('Document written with ID: ', docRef.id);
      Alert.alert('Alert Sent', 'Your message and location have been broadcasted to the map.', [
        {
          text: 'OK',
          onPress: () => {
            setMessage('');
            // Redirect back to Main Screen
            navigation.goBack();
          },
        },
      ]);
    } catch (e) {
      console.error('Error adding document: ', e);
      Alert.alert('Error', 'Failed to send help message.');
    } finally {
      setLoading(false);
    }
  };

  const sendSOSAndCall = async (number) => {
    makeCall(number);
    await sendSOS();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <Card.Title title="Emergency Contacts" subtitle="Direct Dial Lines" />
          <Card.Content>
            <Button 
              mode="contained" 
              buttonColor="#d32f2f" 
              icon="phone" 
              onPress={() => makeCall('911')}
            >
              Call 911
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Broadcast Assistance Request" subtitle="Shares message & live location with others" />
          <Card.Content>
            <TextInput
              label="Describe your situation..."
              value={message}
              onChangeText={setMessage}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
            />

            <View style={styles.locationBadge}>
              <Text variant="bodySmall">
                {location 
                  ? `📍 Live Location Active (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})` 
                  : '⏳ Connecting live location stream...'}
              </Text>
            </View>

            <Button 
              mode="contained" 
              icon="alert-octagon" 
              onPress={sendSOS} 
              loading={loading}
              disabled={loading}
              style={styles.actionBtn}
            >
              Send Help Message
            </Button>

            <Button 
              mode="contained-tonal" 
              icon="phone-alert" 
              onPress={() => sendSOSAndCall('911')}
              loading={loading}
              disabled={loading}
              style={styles.actionBtn}
            >
              Send Message & Call 911
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SOSScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 16 },
  card: { marginBottom: 16, backgroundColor: '#ffffff' },
  input: { marginBottom: 12 },
  locationBadge: { backgroundColor: '#e8f5e9', padding: 8, borderRadius: 6, marginBottom: 16, alignItems: 'center' },
  actionBtn: { marginTop: 8 },
});
