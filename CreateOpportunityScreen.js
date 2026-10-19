import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { IconButton, Provider, DefaultTheme } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import MapView, { Marker } from 'react-native-maps';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// THEME
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

const categories = [
  { label: 'Cleanup', value: 'cleanup' },
  { label: 'Safety Training', value: 'safety' },
  { label: 'Neighborhood Watch', value: 'neighborhood' },
  { label: 'Education', value: 'education' },
  { label: 'Public Health', value: 'health' },
];

// LOCATIONIQ TOKEN (used for address search/autocomplete only; the map itself is Apple Maps on iOS)
const LOCATIONIQ_TOKEN = 'pk.c5f5e38514d66f974793defde833cb25';

const regionFor = (c) => ({
  latitude: c.lat,
  longitude: c.lng,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
});

// MAIN COMPONENT
const CreateOpportunityScreen = ({ navigation, route }) => {
  const [currentUser, setCurrentUser] = useState(null);

  // Form state
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState('');
  const [groupName, setGroupName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  const debounceTimer = useRef(null);
  const mapRef = useRef(null);
  const skipSearch = useRef(false); // true right after picking a suggestion, so we don't search again
  const requestId = useRef(0); // lets us ignore out-of-date autocomplete responses

  // redirect if no user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Not logged in', 'Please sign in to create an opportunity.');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      }
    });
    return unsubscribe;
  }, []);

  // Prefill group name if navigating from a group
  useEffect(() => {
    if (route.params?.groupName) {
      setGroupName(route.params.groupName);
    }
  }, [route.params?.groupName]);

  // Move the map when a new location is chosen (the map mounts with the first one)
  useEffect(() => {
    if (coordinates) {
      mapRef.current?.animateToRegion(regionFor(coordinates), 400);
    }
  }, [coordinates]);

  // Autocomplete suggestions as the user types (LocationIQ Autocomplete API)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // The text just changed because a suggestion was picked: don't reopen the list
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }

    const query = destination.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    debounceTimer.current = setTimeout(async () => {
      const id = ++requestId.current;
      try {
        const response = await fetch(
          `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(query)}&limit=5&dedupe=1&normalizecity=1`
        );
        if (id !== requestId.current) return; // a newer search or a selection replaced this one
        if (response.status === 404) {
          // LocationIQ returns 404 when nothing matches
          setSuggestions([]);
          setShowSuggestions(false);
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (id !== requestId.current) return;
        if (data && data.length > 0) {
          const items = data.map((item) => ({
            title: item.display_place || item.display_name,
            subtitle: item.display_address || '',
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
        if (error.message.includes('401') || error.message.includes('403')) {
          Alert.alert(
            'API Key Error',
            'Your LocationIQ token is invalid or expired. Please check your token at locationiq.com'
          );
        }
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [destination]);

  // Handle selection from suggestions
  const handleSuggestionSelect = (item) => {
    skipSearch.current = true;
    requestId.current += 1; // drop any in-flight search
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSearching(false);
    setDestination(item.description);
    setCoordinates({ lat: item.lat, lng: item.lng });
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // manual geocode
  const handleManualGeocode = async () => {
    if (destination.trim().length < 3) {
      Alert.alert('Please enter a valid address');
      return;
    }
    try {
      const response = await fetch(
        `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(destination)}&format=json&limit=1`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const item = data[0];
        setCoordinates({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
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

  // Date / Time
  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const onTimeChange = (event, selectedTime) => {
    const currentTime = selectedTime || time;
    setShowTimePicker(Platform.OS === 'ios');
    setTime(currentTime);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Submit
  const handleSubmit = async () => {
    if (!eventName || !category || !groupName || !destination || !description) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to post.');
      return;
    }

    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'opportunities'), {
        eventName,
        category,
        groupName,
        capacity: parseInt(capacity) || 0,
        destination,
        date: date.toISOString(),
        time: time.toISOString(),
        description,
        coordinates,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        groupId: route.params?.groupId || null,
      });
      console.log('Opportunity created with ID:', docRef.id);
      Alert.alert('Success', 'Opportunity posted successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error creating opportunity:', error);
      Alert.alert('Error', 'Failed to post opportunity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = () => {
    Alert.alert('Draft Saved', 'Your opportunity has been saved as a draft.');
  };

  // RENDER
  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <IconButton icon="close" size={24} color="#000666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Opportunity</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Community Impact Card */}
          <View style={styles.impactCard}>
            <Text style={styles.impactTitle}>Community Impact</Text>
            <Text style={styles.impactText}>
              Creating a new opportunity helps mobilize local volunteers. Be clear about your goals
              to attract the best matching help.
            </Text>
          </View>

          {/* Posting Tips */}
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Posting Tips</Text>
            <View style={styles.tipItem}>
              <Text style={styles.tipIcon}>✓</Text>
              <Text style={styles.tipText}>Use high-quality images for your event header.</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipIcon}>✓</Text>
              <Text style={styles.tipText}>Clearly state the required skills if any.</Text>
            </View>
            <View style={styles.tipItem}>
              <Text style={styles.tipIcon}>✓</Text>
              <Text style={styles.tipText}>Double-check the meeting coordinates.</Text>
            </View>
          </View>

          {/* Map preview (Apple Maps on iOS) */}
          <View style={styles.mapContainer}>
            {coordinates ? (
              <MapView
                ref={mapRef}
                style={styles.mapImage}
                initialRegion={regionFor(coordinates)}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
              >
                <Marker
                  coordinate={{ latitude: coordinates.lat, longitude: coordinates.lng }}
                  title={destination}
                />
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>
                  {destination.trim().length === 0
                    ? 'Enter a destination to see the map'
                    : 'Select a suggestion or press "Search" on the keyboard to preview the location.'}
                </Text>
              </View>
            )}
            {searching && (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="large" color="#000666" />
              </View>
            )}
          </View>

          {/* Event Details */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>ℹ️</Text>
              <Text style={styles.sectionTitle}>Event Details</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Event Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Park Cleanup Day"
                value={eventName}
                onChangeText={setEventName}
                placeholderTextColor="#767683"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Category</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowCategoryModal(true)}
                >
                  <Text style={category ? styles.pickerText : styles.pickerPlaceholder}>
                    {category ? categories.find(c => c.value === category)?.label : 'Select category'}
                  </Text>
                  <Text style={styles.pickerArrow}>▼</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Group Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Green Earth Society"
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholderTextColor="#767683"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Volunteer Capacity</Text>
              <View style={styles.capacityContainer}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="0"
                  value={capacity}
                  onChangeText={setCapacity}
                  keyboardType="numeric"
                  placeholderTextColor="#767683"
                />
                <Text style={styles.capacityLabel}>People</Text>
              </View>
            </View>
          </View>

          {/* Where & When */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📍</Text>
              <Text style={styles.sectionTitle}>Where & When</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Meeting Destination</Text>
              <View style={styles.destinationContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={[styles.input, { borderWidth: 0, paddingLeft: 36 }]}
                  placeholder="Start typing an address or landmark..."
                  value={destination}
                  onChangeText={setDestination}
                  onSubmitEditing={handleManualGeocode}
                  returnKeyType="search"
                  placeholderTextColor="#767683"
                />
              </View>
              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                    {suggestions.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.suggestionItem}
                        onPress={() => handleSuggestionSelect(item)}
                      >
                        <Text style={styles.suggestionTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        {!!item.subtitle && (
                          <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                            {item.subtitle}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>Meeting Date</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={styles.datePickerText}>{formatDate(date)}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                  />
                )}
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.label}>Meeting Time</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Text style={styles.datePickerText}>{formatTime(time)}</Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={time}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimeChange}
                  />
                )}
              </View>
            </View>
          </View>

          {/* Mission and Goals */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Mission & Goals</Text>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Meeting Goal / Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the impact of this event and what volunteers will be doing..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholderTextColor="#767683"
              />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarContent}>
            <View style={styles.bottomBarRight}>
              <TouchableOpacity style={styles.draftButton} onPress={handleSaveDraft}>
                <Text style={styles.draftButtonText}>Save as Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Posting...' : 'Post Opportunity'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Category Modal */}
        <Modal
          visible={showCategoryModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Category</Text>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.modalItem}
                  onPress={() => {
                    setCategory(item.value);
                    setShowCategoryModal(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowCategoryModal(false)}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Provider>
  );
};

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  closeButton: { marginLeft: -8 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000666',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  impactCard: {
    backgroundColor: '#1a237e',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  impactTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 4 },
  impactText: { fontSize: 16, color: '#e0e0ff', lineHeight: 24 },
  tipsCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    marginBottom: 16,
  },
  tipsTitle: { fontSize: 14, fontWeight: '500', color: '#1a1c1c', marginBottom: 8 },
  tipItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  tipIcon: { color: '#4555b7', marginRight: 8, fontSize: 16 },
  tipText: { fontSize: 12, color: '#454652' },
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
  formSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIcon: { fontSize: 20, marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1c1c' },
  formGroup: { marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', color: '#1a1c1c', marginBottom: 4 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
    color: '#1a1c1c',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  pickerButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: { fontSize: 16, color: '#1a1c1c' },
  pickerPlaceholder: { fontSize: 16, color: '#767683' },
  pickerArrow: { fontSize: 12, color: '#767683' },
  capacityContainer: { flexDirection: 'row', alignItems: 'center' },
  capacityLabel: { position: 'absolute', right: 12, fontSize: 14, color: '#454652' },
  destinationContainer: { position: 'relative' },
  searchIcon: { position: 'absolute', left: 12, top: 14, fontSize: 18, color: '#454652', zIndex: 1 },
  suggestionsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 150,
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionTitle: { fontSize: 14, fontWeight: '600', color: '#1a1c1c' },
  suggestionSubtitle: { fontSize: 12, color: '#767683', marginTop: 2 },
  datePickerButton: {
    height: 48,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
  },
  datePickerText: { fontSize: 16, color: '#1a1c1c' },
  textArea: { height: 120, paddingTop: 12 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#c6c5d4',
    padding: 16,
  },
  bottomBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  bottomBarRight: { flexDirection: 'row' },
  draftButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#000666',
    marginRight: 8,
  },
  draftButtonText: { color: '#000666', fontWeight: '500', fontSize: 14 },
  submitButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: '#1a237e',
  },
  submitButtonText: { color: '#ffffff', fontWeight: '500', fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#1a1c1c' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e2e2' },
  modalItemText: { fontSize: 16, color: '#1a1c1c' },
  modalCloseButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  modalCloseText: { color: '#000666', fontWeight: '500', fontSize: 16 },
});

export default CreateOpportunityScreen;
