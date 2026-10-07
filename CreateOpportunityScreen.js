import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Image,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Provider, DefaultTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// ---------- Responsive helpers ----------
const { height: SCREEN_H } = Dimensions.get('window');
const isSmallDevice = SCREEN_H < 700;
const isLargeDevice = SCREEN_H > 850;

const scale = (small, normal, large) => {
  if (isSmallDevice) return small;
  if (isLargeDevice) return large;
  return normal;
};

const SPACING = {
  xs: scale(4, 6, 8),
  sm: scale(8, 10, 12),
  md: scale(12, 16, 20),
  lg: scale(16, 20, 24),
  xl: scale(20, 24, 28),
};

// ---------- Theme ----------
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#000666',
    accent: '#000666',
    background: '#F5F7FA',
    surface: '#ffffff',
    text: '#1a1c1c',
    placeholder: '#8A8A9E',
    border: '#DFE1E8',
    primaryContainer: '#1a237e',
    onPrimaryContainer: '#ffffff',
  },
};

// ---------- Categories ----------
const CATEGORIES = [
  { label: 'Cleanup', value: 'cleanup', icon: 'leaf', color: '#2E7D32' },
  { label: 'Safety Training', value: 'safety', icon: 'shield-checkmark', color: '#F9A825' },
  { label: 'Neighborhood Watch', value: 'neighborhood', icon: 'people', color: '#000666' },
  { label: 'Education', value: 'education', icon: 'school', color: '#6A1B9A' },
  { label: 'Public Health', value: 'health', icon: 'heart', color: '#BA1A1A' },
];

// ---------- LocationIQ ----------
const LOCATIONIQ_TOKEN = 'pk.c5f5e38514d66f974793defde833cb25';

const getStaticMapUrl = (lat, lng, zoom = 14, width = 400, height = 200) => {
  return `https://maps.locationiq.com/v3/staticmap?key=${LOCATIONIQ_TOKEN}&center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&format=png`;
};

const CreateOpportunityScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();

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
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  const debounceTimer = useRef(null);

  // ---------- Auth redirect ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Not signed in', 'Please sign in to create an opportunity.');
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    });
    return unsubscribe;
  }, []);

  // ---------- Prefill group name ----------
  useEffect(() => {
    if (route.params?.groupName) {
      setGroupName(route.params.groupName);
    }
  }, [route.params?.groupName]);

  // ---------- LocationIQ autocomplete ----------
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const query = destination.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setSearching(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(
            query
          )}&format=json&limit=5`
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
        if (error.message.includes('401') || error.message.includes('403')) {
          Alert.alert(
            'API Key Error',
            'Your LocationIQ token is invalid or expired.'
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

  const handleSuggestionSelect = (item) => {
    setDestination(item.description);
    setCoordinates({ lat: item.lat, lng: item.lng });
    setMapImageUrl(getStaticMapUrl(item.lat, item.lng));
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleManualGeocode = async () => {
    if (destination.trim().length < 3) {
      Alert.alert('Invalid address', 'Please enter a valid address.');
      return;
    }
    try {
      const response = await fetch(
        `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_TOKEN}&q=${encodeURIComponent(
          destination
        )}&format=json&limit=1`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const item = data[0];
        const coords = { lat: parseFloat(item.lat), lng: parseFloat(item.lon) };
        setCoordinates(coords);
        setMapImageUrl(getStaticMapUrl(coords.lat, coords.lng));
        setShowSuggestions(false);
      } else {
        Alert.alert('Location not found', 'Please try a more specific address.');
      }
    } catch (error) {
      console.error('Geocode error:', error);
      Alert.alert('Error', 'Could not find location. Please try again.');
    }
  };

  // ---------- Date/time ----------
  const formatDate = (d) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (d) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // ---------- Submit ----------
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
      await addDoc(collection(db, 'opportunities'), {
        eventName: eventName.trim(),
        category,
        groupName: groupName.trim(),
        capacity: parseInt(capacity) || 0,
        destination: destination.trim(),
        date: date.toISOString(),
        time: time.toISOString(),
        description: description.trim(),
        coordinates,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        groupId: route.params?.groupId || null,
      });
      Alert.alert('Success', 'Opportunity posted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error creating opportunity:', error);
      Alert.alert('Error', 'Failed to post opportunity. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryInfo = () =>
    CATEGORIES.find((c) => c.value === category) || null;

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={26} color="#000666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Opportunity</Text>
          <View style={{ width: 26 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 100 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Impact card */}
            <View style={styles.impactCard}>
              <View style={styles.impactHeader}>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.impactTitle}>Community Impact</Text>
              </View>
              <Text style={styles.impactText}>
                Creating a new opportunity helps mobilize local volunteers. Be clear
                about your goals to attract the best matching help.
              </Text>
            </View>

            {/* Tips card */}
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Posting Tips</Text>
              {[
                'Use high-quality images for your event header.',
                'Clearly state the required skills if any.',
                'Double-check the meeting coordinates.',
              ].map((tip, i) => (
                <View key={i} style={styles.tipItem}>
                  <Ionicons name="checkmark-circle" size={14} color="#4555b7" />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>

            {/* Map preview */}
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
                      Map data © OpenStreetMap · LocationIQ
                    </Text>
                  </View>
                </>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map-outline" size={32} color="#B0B3BF" />
                  <Text style={styles.mapPlaceholderText}>
                    {destination.trim().length === 0
                      ? 'Enter a destination to see the map'
                      : 'Location not found. Try selecting from suggestions.'}
                  </Text>
                </View>
              )}
            </View>

            {/* Event Details */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="information-circle" size={16} color="#000666" />
                </View>
                <Text style={styles.sectionTitle}>Event Details</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Event Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Park Cleanup Day"
                  value={eventName}
                  onChangeText={setEventName}
                  placeholderTextColor="#8A8A9E"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.label}>Category *</Text>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setShowCategoryModal(true)}
                    activeOpacity={0.8}
                  >
                    {category ? (
                      <View style={styles.pickerValueRow}>
                        <Ionicons
                          name={getCategoryInfo()?.icon || 'pricetag'}
                          size={16}
                          color={getCategoryInfo()?.color || '#000666'}
                        />
                        <Text style={styles.pickerText}>
                          {getCategoryInfo()?.label}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.pickerPlaceholder}>Select category</Text>
                    )}
                    <Ionicons name="chevron-down" size={16} color="#767683" />
                  </TouchableOpacity>
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Group Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Green Earth"
                    value={groupName}
                    onChangeText={setGroupName}
                    placeholderTextColor="#8A8A9E"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Volunteer Capacity</Text>
                <View style={styles.capacityContainer}>
                  <TextInput
                    style={[styles.input, { flex: 1, paddingRight: 70 }]}
                    placeholder="0"
                    value={capacity}
                    onChangeText={setCapacity}
                    keyboardType="numeric"
                    placeholderTextColor="#8A8A9E"
                  />
                  <Text style={styles.capacityLabel}>people</Text>
                </View>
              </View>
            </View>

            {/* Where & When */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="location" size={16} color="#000666" />
                </View>
                <Text style={styles.sectionTitle}>Where & When</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Meeting Destination *</Text>
                <View style={styles.destinationContainer}>
                  <Ionicons
                    name="search"
                    size={16}
                    color="#767683"
                    style={styles.destinationIcon}
                  />
                  <TextInput
                    style={styles.destinationInput}
                    placeholder="Start typing an address or landmark..."
                    value={destination}
                    onChangeText={setDestination}
                    onSubmitEditing={handleManualGeocode}
                    returnKeyType="search"
                    placeholderTextColor="#8A8A9E"
                  />
                </View>

                {showSuggestions && suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ScrollView
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 160 }}
                    >
                      {suggestions.map((item, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.suggestionItem}
                          onPress={() => handleSuggestionSelect(item)}
                        >
                          <Ionicons name="location-outline" size={14} color="#767683" />
                          <Text style={styles.suggestionText} numberOfLines={2}>
                            {item.description}
                          </Text>
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
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#000666" />
                    <Text style={styles.datePickerText}>{formatDate(date)}</Text>
                  </TouchableOpacity>
                  {showDatePicker && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selected) => {
                        setShowDatePicker(false);
                        if (selected) setDate(selected);
                      }}
                    />
                  )}
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.label}>Meeting Time</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="time-outline" size={16} color="#000666" />
                    <Text style={styles.datePickerText}>{formatTime(time)}</Text>
                  </TouchableOpacity>
                  {showTimePicker && (
                    <DateTimePicker
                      value={time}
                      mode="time"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, selected) => {
                        setShowTimePicker(false);
                        if (selected) setTime(selected);
                      }}
                    />
                  )}
                </View>
              </View>
            </View>

            {/* Mission & Goals */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconBox}>
                  <Ionicons name="document-text" size={16} color="#000666" />
                </View>
                <Text style={styles.sectionTitle}>Mission & Goals</Text>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Meeting Goal / Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Describe the impact of this event and what volunteers will be doing..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  placeholderTextColor="#8A8A9E"
                />
              </View>
            </View>
          </ScrollView>

          {/* Bottom Action Bar — centered with single Post button */}
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, SPACING.sm) },
            ]}
          >
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>Post Opportunity</Text>
                  <Ionicons name="arrow-forward" size={16} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

        {/* Category Modal */}
        <Modal
          visible={showCategoryModal}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setShowCategoryModal(false)}
        >
          <View
            style={[
              styles.modalOverlay,
              { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
            ]}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="pricetag" size={22} color="#000666" />
                <Text style={styles.modalTitle}>Select Category</Text>
              </View>

              {CATEGORIES.map((item) => {
                const isSelected = category === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      styles.modalItem,
                      isSelected && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setCategory(item.value);
                      setShowCategoryModal(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.modalItemIcon,
                        { backgroundColor: `${item.color}20` },
                      ]}
                    >
                      <Ionicons name={item.icon} size={18} color={item.color} />
                    </View>
                    <Text
                      style={[
                        styles.modalItemText,
                        isSelected && styles.modalItemTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#000666" />
                    )}
                  </TouchableOpacity>
                );
              })}

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

export default CreateOpportunityScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8EE',
  },
  headerTitle: {
    fontSize: scale(16, 18, 20),
    fontWeight: '700',
    color: '#000666',
    flex: 1,
    textAlign: 'center',
  },

  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  // Impact card
  impactCard: {
    backgroundColor: '#000666',
    padding: SPACING.md,
    borderRadius: scale(14, 16, 18),
    marginBottom: SPACING.md,
    shadowColor: '#000666',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  impactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  impactTitle: {
    fontSize: scale(14, 15, 16),
    fontWeight: '700',
    color: '#fff',
  },
  impactText: {
    fontSize: scale(12, 13, 14),
    color: '#E0E0FF',
    lineHeight: scale(18, 20, 22),
  },

  // Tips
  tipsCard: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: scale(14, 16, 18),
    borderWidth: 1,
    borderColor: '#E6E8EE',
    marginBottom: SPACING.md,
  },
  tipsTitle: {
    fontSize: scale(12, 13, 14),
    fontWeight: '700',
    color: '#000666',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  tipText: {
    fontSize: scale(11, 12, 13),
    color: '#4A4A5A',
    flex: 1,
  },

  // Map
  mapContainer: {
    borderRadius: scale(14, 16, 18),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E6E8EE',
    marginBottom: SPACING.md,
    height: scale(140, 170, 200),
    backgroundColor: '#F9FAFC',
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
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  mapPlaceholderText: {
    color: '#8A8A9E',
    fontSize: scale(12, 13, 14),
    textAlign: 'center',
  },
  mapAttribution: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mapAttributionText: { fontSize: 9, color: '#333' },

  // Form sections
  formSection: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderRadius: scale(14, 16, 18),
    borderWidth: 1,
    borderColor: '#E6E8EE',
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: 8,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F0F2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: scale(14, 15, 16),
    fontWeight: '700',
    color: '#1a1c1c',
  },
  formGroup: { marginBottom: SPACING.sm },
  label: {
    fontSize: scale(11, 12, 13),
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    minHeight: scale(44, 48, 52),
    borderWidth: 1,
    borderColor: '#DFE1E8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFC',
    fontSize: scale(13, 14, 15),
    color: '#1a1c1c',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  // Category picker
  pickerButton: {
    minHeight: scale(44, 48, 52),
    borderWidth: 1,
    borderColor: '#DFE1E8',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pickerText: {
    fontSize: scale(13, 14, 15),
    color: '#1a1c1c',
    fontWeight: '600',
  },
  pickerPlaceholder: {
    fontSize: scale(13, 14, 15),
    color: '#8A8A9E',
  },

  // Capacity
  capacityContainer: { flexDirection: 'row', alignItems: 'center' },
  capacityLabel: {
    position: 'absolute',
    right: 14,
    fontSize: scale(12, 13, 14),
    color: '#8A8A9E',
    fontWeight: '500',
  },

  // Destination
  destinationContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DFE1E8',
    borderRadius: 12,
    backgroundColor: '#F9FAFC',
    paddingHorizontal: 12,
  },
  destinationIcon: { marginRight: 8 },
  destinationInput: {
    flex: 1,
    fontSize: scale(13, 14, 15),
    color: '#1a1c1c',
    paddingVertical: 12,
  },
  suggestionsContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DFE1E8',
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  suggestionText: {
    fontSize: scale(12, 13, 14),
    color: '#1a1c1c',
    flex: 1,
  },

  // Date/time
  datePickerButton: {
    minHeight: scale(44, 48, 52),
    borderWidth: 1,
    borderColor: '#DFE1E8',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerText: {
    fontSize: scale(13, 14, 15),
    color: '#1a1c1c',
    fontWeight: '500',
  },
  textArea: {
    minHeight: scale(100, 120, 140),
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  // Bottom bar — centered single button
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E6E8EE',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: scale(12, 14, 16),
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
    backgroundColor: '#000666',
    minWidth: 220,
    shadowColor: '#000666',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: scale(14, 15, 16),
  },
  disabledButton: { opacity: 0.6 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.md,
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: scale(16, 17, 18),
    fontWeight: '700',
    color: '#1a1c1c',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalItemSelected: {
    backgroundColor: '#F0F2FF',
  },
  modalItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalItemText: {
    fontSize: scale(13, 14, 15),
    color: '#1a1c1c',
    flex: 1,
    fontWeight: '500',
  },
  modalItemTextSelected: {
    fontWeight: '700',
    color: '#000666',
  },
  modalCloseButton: {
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
  },
  modalCloseText: {
    color: '#000666',
    fontWeight: '700',
    fontSize: scale(13, 14, 15),
  },
});
