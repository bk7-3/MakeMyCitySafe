import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { INCIDENT_TYPES, SEVERITY_LEVELS } from '../constants/incidentTypes';

// LocationIQ token
const LOCATIONIQ_TOKEN = 'pk.c5f5e38514d66f974793defde833cb25';

const getStaticMapUrl = (lat, lng, zoom = 14, width = 400, height = 200) => {
  return `https://maps.locationiq.com/v3/staticmap?key=${LOCATIONIQ_TOKEN}&center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&format=png`;
};

const ReportIncidentScreen = ({ navigation }) => {
  const [reporterName, setReporterName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('theft');
  const [severity, setSeverity] = useState('medium');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const debounceTimer = useRef(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      if (user.displayName) {
        setReporterName(user.displayName);
      }
      else if (user.email) {
        const emailPrefix = user.email.split('@')[0];
        setReporterName(emailPrefix);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const query = location.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(query)}&format=json&limit=5`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.length > 0) {
          const items = data.map((item) => ({
            description: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          }));
          setSuggestions(items);
          setShowSuggestions(items.length > 0);
        } else {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [location]);

  const handleSuggestionSelect = (item) => {
    setLocation(item.description);
    setLatitude(item.lat);
    setLongitude(item.lng);
    const url = getStaticMapUrl(item.lat, item.lng);
    setMapImageUrl(url);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Manual geocode
  const handleManualGeocode = async () => {
    if (location.trim().length < 3) {
      Alert.alert('Please enter a valid address');
      return;
    }
    try {
      const response = await fetch(
        `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(location)}&format=json&limit=1`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const item = data[0];
        const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
        setLatitude(coords.lat);
        setLongitude(coords.lng);
        const url = getStaticMapUrl(coords.lat, coords.lng);
        setMapImageUrl(url);
        setShowSuggestions(false);
        Alert.alert('Location found!', 'Map updated with your address.');
      } else {
        Alert.alert('Location not found', 'Please try a more specific address.');
      }
    } catch (error) {
      console.error('Geocode error:', error);
      Alert.alert('Error', 'Could not find location. Please try again.');
    }
  };

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required.');
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setLatitude(latitude);
      setLongitude(longitude);

      const address = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address.length > 0) {
        const addr = address[0];
        const formatted = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`;
        setLocation(formatted.trim());
      } else {
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
      }

      const url = getStaticMapUrl(latitude, longitude);
      setMapImageUrl(url);
    } catch (error) {
      Alert.alert('Error', 'Unable to get current location.');
    }
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not Logged In', 'You must be logged in to report an incident.');
      return;
    }
    if (!reporterName.trim()) {
      Alert.alert('Error', 'Please enter your name.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Error', 'Please enter a location.');
      return;
    }
    if (!latitude || !longitude) {
      Alert.alert('Error', 'Please select a valid location from the suggestions or use "Get Current Location".');
      return;
    }

    setIsLoading(true);
    try {
      const incidentData = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        type,
        severity,
        date: date.toISOString(),
        latitude,
        longitude,
        reportedBy: user.uid,
        reporterName: reporterName.trim(),
        reportedByEmail: user.email || 'Anonymous',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'incidents'), incidentData);
      console.log('✅ Incident created with ID:', docRef.id);
      Alert.alert('Success', 'Incident reported successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('❌ Firestore error:', error);
      let msg = 'Failed to report incident.';
      if (error.code === 'permission-denied') {
        msg = 'Permission denied – check Firestore security rules.';
      } else if (error.message) {
        msg = error.message;
      }
      Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Incident</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your full name"
            value={reporterName}
            onChangeText={setReporterName}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Brief title"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe what happened"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location *</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationInputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Start typing an address..."
                value={location}
                onChangeText={setLocation}
                onSubmitEditing={handleManualGeocode}
                returnKeyType="search"
              />
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                    {suggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionSelect(item)}
                      >
                        <Text style={styles.suggestionText} numberOfLines={2}>
                          {item.description}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={getCurrentLocation}
            >
              <Ionicons name="locate" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.mapContainer}>
          {searching ? (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color="#000666" />
              <Text style={styles.mapPlaceholderText}>Searching...</Text>
            </View>
          ) : mapImageUrl ? (
            <>
              <Image
                source={{ uri: mapImageUrl }}
                style={styles.mapImage}
                resizeMode="cover"
                onLoadStart={() => setMapLoading(true)}
                onLoadEnd={() => setMapLoading(false)}
                onError={() => setMapImageUrl(null)}
              />
              {mapLoading && (
                <View style={styles.mapLoadingOverlay}>
                  <ActivityIndicator size="large" color="#000666" />
                </View>
              )}
              <View style={styles.mapAttribution}>
                <Text style={styles.mapAttributionText}>
                  Map data © OpenStreetMap, powered by LocationIQ
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>
                {location.trim().length === 0
                  ? 'Enter a location to see the map'
                  : 'Location not found. Try selecting from suggestions or press "Get Current Location".'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Type</Text>
            <Picker selectedValue={type} onValueChange={setType} style={styles.picker}>
              {INCIDENT_TYPES.map(t => (
                <Picker.Item key={t.id} label={t.label} value={t.id} />
              ))}
            </Picker>
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Severity</Text>
            <Picker selectedValue={severity} onValueChange={setSeverity} style={styles.picker}>
              {SEVERITY_LEVELS.map(s => (
                <Picker.Item key={s.id} label={s.label} value={s.id} />
              ))}
            </Picker>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date & Time</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateButton, { marginTop: 8 }]}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.dateText}>{date.toLocaleTimeString()}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={date}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                if (selectedDate) setDate(selectedDate);
              }}
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit Report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c' },
  form: { padding: 16, paddingBottom: 40 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1a1c1c',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationInputWrapper: {
    flex: 1,
    position: 'relative',
  },
  suggestionsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 150,
    overflow: 'hidden',
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: { fontSize: 14, color: '#1a1c1c' },
  locationButton: {
    backgroundColor: '#000666',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignSelf: 'center',
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c6c5d4',
    marginBottom: 16,
    height: 160,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapImage: { width: '100%', height: '100%' },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  mapPlaceholderText: { color: '#767683', fontSize: 14, textAlign: 'center' },
  mapAttribution: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapAttributionText: { fontSize: 9, color: '#333' },
  row: { flexDirection: 'row' },
  picker: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    height: 50,
  },
  dateButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateText: { fontSize: 16, color: '#1a1c1c' },
  submitButton: {
    backgroundColor: '#000666',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
});

export default ReportIncidentScreen;
