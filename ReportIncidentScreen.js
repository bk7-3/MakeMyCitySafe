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
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { INCIDENT_TYPES, SEVERITY_LEVELS } from '../constants/incidentTypes';

const LOCATIONIQ_TOKEN = process.env.EXPO_PUBLIC_LOCATIONIQ_TOKEN;

const formatAddress = (addr) => {
  const line1 = [addr.streetNumber, addr.street].filter(Boolean).join(' ');
  return [line1 || addr.name, addr.city, addr.region].filter(Boolean).join(', ');
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
  const [searching, setSearching] = useState(false);
  const mapRef = useRef(null);

  const [suggestions, setSuggestions] = useState([]);
  const debounceTimer = useRef(null);
  const requestId = useRef(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      if (user.displayName) {
        setReporterName(user.displayName);
      } else if (user.email) {
        setReporterName(user.email.split('@')[0]);
      }
    }
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Keep the map centered on the selected coordinates
  useEffect(() => {
    if (latitude != null && longitude != null && mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400
      );
    }
  }, [latitude, longitude]);

  const clearSuggestions = () => {
    requestId.current += 1; // invalidate any in-flight request
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSuggestions([]);
  };

  const fetchSuggestions = (query) => {
    const id = ++requestId.current;
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(
            query
          )}&limit=5&format=json`
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (id !== requestId.current) return; // stale response
        if (Array.isArray(data)) {
          setSuggestions(
            data.map((item) => ({
              description: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            }))
          );
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.warn('Autocomplete error:', error);
        if (id === requestId.current) setSuggestions([]);
      }
    }, 350);
  };

  // Only user typing triggers autocomplete; programmatic setLocation calls don't
  const handleLocationChange = (text) => {
    setLocation(text);
    setLatitude(null);
    setLongitude(null);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const query = text.trim();
    if (query.length < 3) {
      clearSuggestions();
      return;
    }
    fetchSuggestions(query);
  };

  const handleSuggestionSelect = (item) => {
    clearSuggestions();
    Keyboard.dismiss();
    setLocation(item.description);
    setLatitude(item.lat);
    setLongitude(item.lng);
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        setLocation(formatAddress(results[0]));
        return;
      }
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
    setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  // Fallback when the user hits return without picking a suggestion
  const handleSearch = async () => {
    const query = location.trim();
    if (query.length < 3) {
      Alert.alert('Please enter a valid address');
      return;
    }
    clearSuggestions();
    Keyboard.dismiss();
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (results.length > 0) {
        setLatitude(results[0].latitude);
        setLongitude(results[0].longitude);
      } else {
        Alert.alert('Location not found', 'Please try a more specific address.');
      }
    } catch (error) {
      console.error('Geocode error:', error);
      Alert.alert('Error', 'Could not find location. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required.');
      return;
    }
    try {
      clearSuggestions();
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lng } = loc.coords;
      setLatitude(lat);
      setLongitude(lng);
      await reverseGeocode(lat, lng);
    } catch (error) {
      Alert.alert('Error', 'Unable to get current location.');
    }
  };

  // Tap or drag the pin on the map
  const handleMapPress = async (coord) => {
    clearSuggestions();
    setLatitude(coord.latitude);
    setLongitude(coord.longitude);
    await reverseGeocode(coord.latitude, coord.longitude);
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
    if (latitude == null || longitude == null) {
      Alert.alert(
        'Error',
        'Please pick a suggestion, tap the map, or use "Get Current Location".'
      );
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

  const hasCoords = latitude != null && longitude != null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Incident</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
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
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Start typing an address..."
              value={location}
              onChangeText={handleLocationChange}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.locationButton} onPress={handleSearch}>
              {searching ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="search" size={24} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
              <Ionicons name="locate" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {suggestions.map((item, index) => (
                <TouchableOpacity
                  key={`${item.lat},${item.lng},${index}`}
                  style={[
                    styles.suggestionItem,
                    index === suggestions.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => handleSuggestionSelect(item)}
                >
                  <Ionicons name="location-outline" size={18} color="#767683" />
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {item.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: 37.0902,
              longitude: -95.7129,
              latitudeDelta: 40,
              longitudeDelta: 40,
            }}
            onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
          >
            {hasCoords && (
              <Marker
                coordinate={{ latitude, longitude }}
                draggable
                onDragEnd={(e) => handleMapPress(e.nativeEvent.coordinate)}
              />
            )}
          </MapView>
          {!hasCoords && (
            <View style={styles.mapHint} pointerEvents="none">
              <Text style={styles.mapHintText}>
                Search an address, use your location, or tap the map to drop a pin
              </Text>
            </View>
          )}
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={type}
                onValueChange={setType}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {INCIDENT_TYPES.map((t) => (
                  <Picker.Item key={t.id} label={t.label} value={t.id} />
                ))}
              </Picker>
            </View>
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Severity</Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={severity}
                onValueChange={setSeverity}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {SEVERITY_LEVELS.map((s) => (
                  <Picker.Item key={s.id} label={s.label} value={s.id} />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date & Time</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
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

const PICKER_HEIGHT = Platform.OS === 'ios' ? 120 : 50;

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
    alignItems: 'center',
  },
  locationButton: {
    backgroundColor: '#000666',
    width: 46,
    height: 46,
    borderRadius: 8,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionText: { flex: 1, fontSize: 14, color: '#1a1c1c', marginLeft: 8 },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c6c5d4',
    marginBottom: 16,
    height: 180,
    backgroundColor: '#f0f0f0',
  },
  map: { width: '100%', height: '100%' },
  mapHint: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 8,
  },
  mapHintText: { color: '#767683', fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row' },
  pickerWrapper: {
    height: PICKER_HEIGHT,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: {
    width: '100%',
    height: PICKER_HEIGHT,
  },
  pickerItem: {
    height: PICKER_HEIGHT,
    fontSize: 16,
    color: '#1a1c1c',
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
