import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform, Keyboard } from 'react-native';
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
const PICKER_HEIGHT = Platform.OS === 'ios' ? 120 : 50;
const formatAddress = (a) =>
  [[a.streetNumber, a.street].filter(Boolean).join(' ') || a.name, a.city, a.region]
    .filter(Boolean).join(', ');

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
  const [suggestions, setSuggestions] = useState([]);
  const mapRef = useRef(null);
  const debounceTimer = useRef(null);
  const requestId = useRef(0);
  const hasCoords = latitude != null && longitude != null;

  useEffect(() => {
    const user = auth.currentUser;
    if (user) setReporterName(user.displayName || user.email?.split('@')[0] || '');
    return () => clearTimeout(debounceTimer.current);
  }, []);

  useEffect(() => {
    if (hasCoords) mapRef.current?.animateToRegion(
      { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
  }, [latitude, longitude]);

  const clearSuggestions = () => {
    requestId.current += 1;
    clearTimeout(debounceTimer.current);
    setSuggestions([]);
  };

  const fetchSuggestions = (query) => {
    const id = ++requestId.current;
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(query)}&limit=5&format=json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (id !== requestId.current) return;
        setSuggestions(Array.isArray(data)
          ? data.map((i) => ({ description: i.display_name, lat: parseFloat(i.lat), lng: parseFloat(i.lon) }))
          : []);
      } catch (error) {
        console.warn('Autocomplete error:', error);
        if (id === requestId.current) setSuggestions([]);
      }
    }, 350);
  };

  const handleLocationChange = (text) => {
    setLocation(text);
    setLatitude(null);
    setLongitude(null);
    clearTimeout(debounceTimer.current);
    const query = text.trim();
    query.length < 3 ? clearSuggestions() : fetchSuggestions(query);
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
      if (results.length > 0) return setLocation(formatAddress(results[0]));
    } catch (e) {
      console.warn('Reverse geocode error:', e);
    }
    setLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  const handleSearch = async () => {
    const query = location.trim();
    if (query.length < 3) return Alert.alert('Please enter a valid address');
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
    if (status !== 'granted') return Alert.alert('Permission denied', 'Location permission is required.');
    try {
      clearSuggestions();
      const { coords } = await Location.getCurrentPositionAsync({});
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      await reverseGeocode(coords.latitude, coords.longitude);
    } catch {
      Alert.alert('Error', 'Unable to get current location.');
    }
  };

  const handleMapPress = async (coord) => {
    clearSuggestions();
    setLatitude(coord.latitude);
    setLongitude(coord.longitude);
    await reverseGeocode(coord.latitude, coord.longitude);
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) return Alert.alert('Not Logged In', 'You must be logged in to report an incident.');
    if (!reporterName.trim()) return Alert.alert('Error', 'Please enter your name.');
    if (!title.trim()) return Alert.alert('Error', 'Please enter a title.');
    if (!description.trim()) return Alert.alert('Error', 'Please enter a description.');
    if (!location.trim()) return Alert.alert('Error', 'Please enter a location.');
    if (!hasCoords) return Alert.alert('Error', 'Please pick a suggestion, tap the map, or use "Get Current Location".');

    setIsLoading(true);
    try {
      await addDoc(collection(db, 'incidents'), {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        type, severity,
        date: date.toISOString(),
        latitude, longitude,
        reportedBy: user.uid,
        reporterName: reporterName.trim(),
        reportedByEmail: user.email || 'Anonymous',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Success', 'Incident reported successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('❌ Firestore error:', error);
      Alert.alert('Error', error.code === 'permission-denied'
        ? 'Permission denied – check Firestore security rules.'
        : error.message || 'Failed to report incident.');
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

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {[
          { label: 'Your Name *', value: reporterName, onChangeText: setReporterName, placeholder: 'Enter your full name' },
          { label: 'Title *', value: title, onChangeText: setTitle, placeholder: 'Brief title' },
        ].map((f) => (
          <View key={f.label} style={styles.inputGroup}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput style={styles.input} placeholder={f.placeholder} value={f.value} onChangeText={f.onChangeText} />
          </View>
        ))}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput style={[styles.input, styles.textArea]} placeholder="Describe what happened"
            value={description} onChangeText={setDescription} multiline numberOfLines={4} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Location *</Text>
          <View style={styles.locationRow}>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Start typing an address..."
              value={location} onChangeText={handleLocationChange} onSubmitEditing={handleSearch}
              returnKeyType="search" autoCorrect={false} />
            <TouchableOpacity style={styles.locationButton} onPress={handleSearch}>
              {searching ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={24} color="#fff" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
              <Ionicons name="locate" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {suggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {suggestions.map((item, i) => (
                <TouchableOpacity key={`${item.lat},${item.lng},${i}`}
                  style={[styles.suggestionItem, i === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => handleSuggestionSelect(item)}>
                  <Ionicons name="location-outline" size={18} color="#767683" />
                  <Text style={styles.suggestionText} numberOfLines={2}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.mapContainer}>
          <MapView ref={mapRef} style={styles.map}
            initialRegion={{ latitude: 37.0902, longitude: -95.7129, latitudeDelta: 40, longitudeDelta: 40 }}
            onPress={(e) => handleMapPress(e.nativeEvent.coordinate)}
            scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
            {hasCoords && (
              <Marker coordinate={{ latitude, longitude }} draggable
                onDragEnd={(e) => handleMapPress(e.nativeEvent.coordinate)} />
            )}
          </MapView>
          {!hasCoords && (
            <View style={styles.mapHint} pointerEvents="none">
              <Text style={styles.mapHintText}>Search an address, use your location, or tap the map to drop a pin</Text>
            </View>
          )}
        </View>

        <View style={styles.row}>
          {[
            { label: 'Type', value: type, onChange: setType, items: INCIDENT_TYPES, margin: { marginRight: 8 } },
            { label: 'Severity', value: severity, onChange: setSeverity, items: SEVERITY_LEVELS, margin: { marginLeft: 8 } },
          ].map((p) => (
            <View key={p.label} style={[styles.inputGroup, { flex: 1, ...p.margin }]}>
              <Text style={styles.label}>{p.label}</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={p.value} onValueChange={p.onChange} style={styles.picker} itemStyle={styles.pickerItem}>
                  {p.items.map((it) => <Picker.Item key={it.id} label={it.label} value={it.id} />)}
                </Picker>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Date & Time</Text>
          {[
            { show: showDatePicker, setShow: setShowDatePicker, mode: 'date', text: date.toLocaleDateString(), margin: 0 },
            { show: showTimePicker, setShow: setShowTimePicker, mode: 'time', text: date.toLocaleTimeString(), margin: 8 },
          ].map((d) => (
            <React.Fragment key={d.mode}>
              <TouchableOpacity style={[styles.dateButton, { marginTop: d.margin }]} onPress={() => d.setShow(true)}>
                <Text style={styles.dateText}>{d.text}</Text>
              </TouchableOpacity>
              {d.show && (
                <DateTimePicker value={date} mode={d.mode}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, sel) => { d.setShow(false); if (sel) setDate(sel); }} />
              )}
            </React.Fragment>
          ))}
        </View>

        <TouchableOpacity style={[styles.submitButton, isLoading && styles.disabledButton]}
          onPress={handleSubmit} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Report</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ReportIncidentScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e2e2' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c' },
  form: { padding: 16, paddingBottom: 40 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#1a1c1c' },
  textArea: { height: 100, textAlignVertical: 'top' },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationButton: { backgroundColor: '#000666', width: 46, height: 46, borderRadius: 8,
    marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  suggestionsContainer: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#c6c5d4',
    borderRadius: 8, marginTop: 6, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  suggestionText: { flex: 1, fontSize: 14, color: '#1a1c1c', marginLeft: 8 },
  mapContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#c6c5d4',
    marginBottom: 16, height: 180, backgroundColor: '#f0f0f0' },
  map: { width: '100%', height: '100%' },
  mapHint: { position: 'absolute', left: 8, right: 8, bottom: 8, backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8, padding: 8 },
  mapHintText: { color: '#767683', fontSize: 13, textAlign: 'center' },
  row: { flexDirection: 'row' },
  pickerWrapper: { height: PICKER_HEIGHT, backgroundColor: '#fff', borderWidth: 1,
    borderColor: '#ddd', borderRadius: 8, overflow: 'hidden', justifyContent: 'center' },
  picker: { width: '100%', height: PICKER_HEIGHT },
  pickerItem: { height: PICKER_HEIGHT, fontSize: 16, color: '#1a1c1c' },
  dateButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10 },
  dateText: { fontSize: 16, color: '#1a1c1c' },
  submitButton: { backgroundColor: '#000666', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabledButton: { opacity: 0.6 },
});
