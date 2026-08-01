import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';

const SPEED_LIMIT_MPH = 20;
const CRASH_G_THRESHOLD = 3.0; 
export default function EbikeSafetyScreen({ navigation }) {
  const [speedMph, setSpeedMph] = useState(0);
  const [isEbikeMode, setIsEbikeMode] = useState(true);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    let locationSubscription;

    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for speed tracking.');
        return;
      }

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (location) => {
          const currentSpeedMps = location.coords.speed || 0;
          const mph = currentSpeedMps < 0.5 ? 0 : Math.round(currentSpeedMps * 2.23694);
          setSpeedMph(mph);
        }
      );
    })();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isEbikeMode) return; 
    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener((data) => {
      const { x, y, z } = data;
      const totalForce = Math.sqrt(x * x + y * y + z * z);

      if (totalForce > CRASH_G_THRESHOLD) {
        subscription.remove(); 
        
        navigation.navigate('Help Screen', { triggeredByCollision: true });
      }
    });

    return () => subscription.remove();
  }, [isEbikeMode, navigation]);

  const isSpeeding = speedMph > SPEED_LIMIT_MPH;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <Text style={styles.title}>E-Bike Dashboard</Text>

      {/* Speedometer Card */}
      <View style={[styles.card, isSpeeding && styles.warningCard]}>
        <Text style={styles.cardLabel}>Current Speed</Text>
        <Text style={[styles.speedText, isSpeeding && styles.warningText]}>
          {speedMph} <Text style={styles.unitText}>MPH</Text>
        </Text>
        {isSpeeding && (
          <Text style={styles.warningBanner}>⚠️ SLOW DOWN (Exceeding {SPEED_LIMIT_MPH} MPH)</Text>
        )}
      </View>

      {/* E-Bike Mode Toggle */}
      <View style={styles.rowCard}>
        <View>
          <Text style={styles.rowLabel}>E-Bike Mode</Text>
          <Text style={styles.subLabel}>
            {isEbikeMode ? '🛡️ Collision Detection Active' : '🔴 Collision Detection Off'}
          </Text>
        </View>
        <Switch 
          value={isEbikeMode} 
          onValueChange={setIsEbikeMode}
          trackColor={{ false: '#d1d1d6', true: '#4CAF50' }}
        />
      </View>

      {/* Safety & Accident Tips Drawer */}
      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={() => setShowTips(!showTips)}
      >
        <Text style={styles.buttonText}>
          {showTips ? 'Hide Safety & Accident Tips' : 'Show Safety & Accident Tips'}
        </Text>
      </TouchableOpacity>

      {showTips && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipHeader}>🛡️ Ride Safety Tips</Text>
          <Text style={styles.tipText}>• Always wear a helmet fitted correctly.</Text>
          <Text style={styles.tipText}>• Use headlight/taillight at dusk or night.</Text>

          <Text style={[styles.tipHeader, { marginTop: 12 }]}>🚨 In Case of an Accident</Text>
          <Text style={styles.tipText}>1. Check yourself and others for injuries.</Text>
          <Text style={styles.tipText}>2. Move safely off the main road if possible.</Text>
          <Text style={styles.tipText}>3. Call emergency services if needed.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#f5f5f5',
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  warningCard: {
    borderColor: '#d32f2f',
    backgroundColor: '#ffebee',
  },
  cardLabel: {
    color: '#666666',
    fontSize: 16,
  },
  speedText: {
    fontSize: 64,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  unitText: {
    fontSize: 20,
    fontWeight: 'normal',
    color: '#777777',
  },
  warningText: {
    color: '#d32f2f',
  },
  warningBanner: {
    color: '#d32f2f',
    fontWeight: 'bold',
    marginTop: 8,
  },
  rowCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rowLabel: {
    color: '#1a1a1a',
    fontSize: 18,
    fontWeight: '600',
  },
  subLabel: {
    color: '#666666',
    fontSize: 12,
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#0288d1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tipsContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tipHeader: {
    color: '#1a1a1a',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
  },
  tipText: {
    color: '#444444',
    fontSize: 14,
    marginBottom: 4,
  },
});
