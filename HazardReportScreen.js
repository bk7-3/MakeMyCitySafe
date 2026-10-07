import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Image,
  View,
  Alert,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput, Menu } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

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

// ---------- Colors ----------
const COLORS = {
  primary: '#000666',
  primaryLight: '#F0F2FF',
  background: '#F5F7FA',
  surface: '#ffffff',
  text: '#1a1c1c',
  subtext: '#4A4A5A',
  muted: '#8A8A9E',
  border: '#E6E8EE',
  inputBg: '#F9FAFC',
  danger: '#D32F2F',
  success: '#2E7D32',
  warning: '#F57C00',
};

// ---------- Config: Categories ----------
const CATEGORY_LIST = [
  { label: 'Hazard', value: 'Hazard', icon: 'warning', color: '#F57C00' },
  { label: 'Crime', value: 'Crime', icon: 'alert-circle', color: '#D32F2F' },
  { label: 'Safe Space', value: 'SafeSpace', icon: 'shield-checkmark', color: '#2E7D32' },
];

const TYPE_LISTS = {
  Hazard: [
    { label: 'Traffic-Related', value: 'Traffic' },
    { label: 'Natural Hazard', value: 'Natural' },
    { label: 'Dangerous Infrastructure', value: 'Infra' },
    { label: 'Path Closure', value: 'Closure' },
  ],
  Crime: [
    { label: 'Violence and Threats', value: 'Violence' },
    { label: 'Police Activity', value: 'Police' },
    { label: 'Theft / Vandalism', value: 'Theft' },
  ],
  SafeSpace: [
    { label: 'Emergency Blue Light', value: 'BlueLight' },
    { label: 'Safe Haven / Building', value: 'SafeHaven' },
    { label: 'Staffed Security Post', value: 'SecurityPost' },
  ],
};

const STATUS_LIST = [
  { label: 'Unconfirmed', value: 'Unconfirmed', icon: 'help-circle', color: '#8A8A9E' },
  { label: 'Potential', value: 'Potential', icon: 'alert-circle', color: '#F57C00' },
  { label: 'Active', value: 'Active', icon: 'warning', color: '#D32F2F' },
  { label: 'In-Progress', value: 'Progress', icon: 'time', color: '#0288D1' },
  { label: 'Resolved', value: 'Resolved', icon: 'checkmark-circle', color: '#2E7D32' },
];

const getLabel = (value, list) => {
  const found = list.find((item) => item.value === value);
  return found ? found.label : value;
};

const getItem = (value, list) => {
  return list.find((item) => item.value === value) || list[0];
};

const HazardReportScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const [category, setCategory] = useState('Hazard');
  const [type, setType] = useState('Traffic');
  const [status, setStatus] = useState('Unconfirmed');
  const [description, setDescription] = useState('');
  const [mapRegion, setMapRegion] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [image, setImage] = useState(null);
  const [imageurl, setImageurl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const studentID = auth.currentUser?.uid || 'Anonymous_User';

  // -------- Initial location --------
  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          const fallback = { latitude: 33.769217, longitude: -117.867665 };
          setMapRegion({
            ...fallback,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
          setSelectedLocation(fallback);
          return;
        }
        let locData = await Location.getCurrentPositionAsync({});
        const coords = {
          latitude: locData.coords.latitude,
          longitude: locData.coords.longitude,
        };
        setMapRegion({
          ...coords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
        setSelectedLocation(coords);
      } catch (error) {
        console.error('Location error:', error);
      }
    };
    getInitialLocation();
  }, []);

  // -------- Image picker --------
  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const pickedUri = result.assets[0].uri;
        setImage(pickedUri);
        await uploadImage(pickedUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open image library.');
    }
  };

  const uploadImage = async (uri) => {
    setIsUploading(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
      const filename = `hazards/${timestamp}_${uri.substring(
        uri.lastIndexOf('/') + 1
      )}`;

      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setImageurl(url);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', 'Failed to store image.');
      setImage(null);
      setImageurl('');
    } finally {
      setIsUploading(false);
    }
  };

  // -------- Submit --------
  const sendHazard = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please enter a short description.');
      return;
    }
    if (!selectedLocation) {
      Alert.alert('Location Required', 'Please tap on the map to set a location.');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'hazards'), {
        category,
        type,
        description: description.trim(),
        reportDateTime: Timestamp.fromDate(new Date()),
        status,
        location: selectedLocation,
        reportedBy: studentID,
        imaguri: imageurl,
      });

      Alert.alert('Success', 'Report submitted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.error('Submission error:', e);
      Alert.alert('Error', 'Failed to log report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Main');
  };

  const selectedCategory = getItem(category, CATEGORY_LIST);
  const selectedTypeLabel = getLabel(type, TYPE_LISTS[category]);
  const selectedStatus = getItem(status, STATUS_LIST);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>File a Report</Text>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Info banner */}
          <View style={styles.infoBanner}>
            <View style={styles.infoIconBox}>
              <Ionicons
                name="information-circle"
                size={22}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Help keep your city safe</Text>
              <Text style={styles.infoText}>
                Fill in the details below. Reports are visible to the community.
              </Text>
            </View>
          </View>

          {/* ---------- Category ---------- */}
          <Text style={styles.sectionLabel}>Report Category</Text>
          <Menu
            visible={showCategoryMenu}
            onDismiss={() => setShowCategoryMenu(false)}
            anchor={
              <TouchableOpacity
                style={styles.pickerAnchor}
                onPress={() => setShowCategoryMenu(true)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.pickerIconBox,
                    { backgroundColor: `${selectedCategory.color}20` },
                  ]}
                >
                  <Ionicons
                    name={selectedCategory.icon}
                    size={18}
                    color={selectedCategory.color}
                  />
                </View>
                <Text style={styles.pickerText}>{selectedCategory.label}</Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            }
          >
            {CATEGORY_LIST.map((item) => (
              <Menu.Item
                key={item.value}
                onPress={() => {
                  setCategory(item.value);
                  setType(TYPE_LISTS[item.value][0].value);
                  setShowCategoryMenu(false);
                }}
                title={item.label}
                leadingIcon={item.icon}
              />
            ))}
          </Menu>

          {/* ---------- Type ---------- */}
          <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>
            Type Specifics
          </Text>
          <Menu
            visible={showTypeMenu}
            onDismiss={() => setShowTypeMenu(false)}
            anchor={
              <TouchableOpacity
                style={styles.pickerAnchor}
                onPress={() => setShowTypeMenu(true)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.pickerIconBox,
                    { backgroundColor: `${selectedCategory.color}20` },
                  ]}
                >
                  <Ionicons
                    name="pricetag"
                    size={18}
                    color={selectedCategory.color}
                  />
                </View>
                <Text style={styles.pickerText}>{selectedTypeLabel}</Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            }
          >
            {TYPE_LISTS[category].map((item) => (
              <Menu.Item
                key={item.value}
                onPress={() => {
                  setType(item.value);
                  setShowTypeMenu(false);
                }}
                title={item.label}
              />
            ))}
          </Menu>

          {/* ---------- Status ---------- */}
          <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>
            Status
          </Text>
          <Menu
            visible={showStatusMenu}
            onDismiss={() => setShowStatusMenu(false)}
            anchor={
              <TouchableOpacity
                style={styles.pickerAnchor}
                onPress={() => setShowStatusMenu(true)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.pickerIconBox,
                    { backgroundColor: `${selectedStatus.color}20` },
                  ]}
                >
                  <Ionicons
                    name={selectedStatus.icon}
                    size={18}
                    color={selectedStatus.color}
                  />
                </View>
                <Text style={styles.pickerText}>{selectedStatus.label}</Text>
                <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            }
          >
            {STATUS_LIST.map((item) => (
              <Menu.Item
                key={item.value}
                onPress={() => {
                  setStatus(item.value);
                  setShowStatusMenu(false);
                }}
                title={item.label}
                leadingIcon={item.icon}
              />
            ))}
          </Menu>

          {/* ---------- Description ---------- */}
          <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>
            Description
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            numberOfLines={4}
            placeholder="Describe what you saw..."
            placeholderTextColor={COLORS.muted}
            style={styles.textArea}
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.primary}
            theme={{ colors: { background: COLORS.surface } }}
          />

          {/* ---------- Map Picker ---------- */}
          <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>
            Location
          </Text>
          <Text style={styles.helperText}>
            Tap the map to place a pin at the exact spot
          </Text>
          <View
            style={styles.mapContainer}
            onLayout={() => setMapReady(true)}
          >
            {!mapReady || !mapRegion ? (
              <View style={styles.mapPlaceholder}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.mapPlaceholderText}>
                  Loading map...
                </Text>
              </View>
            ) : (
              <MapView
                style={styles.miniMap}
                initialRegion={mapRegion}
                onPress={(e) =>
                  setSelectedLocation(e.nativeEvent.coordinate)
                }
              >
                {selectedLocation && (
                  <Marker
                    coordinate={selectedLocation}
                    title="Selected Point"
                    pinColor={COLORS.danger}
                  />
                )}
              </MapView>
            )}
          </View>

          {selectedLocation && (
            <View style={styles.coordsRow}>
              <Ionicons name="location" size={12} color={COLORS.muted} />
              <Text style={styles.coordsText}>
                {selectedLocation.latitude.toFixed(5)},{' '}
                {selectedLocation.longitude.toFixed(5)}
              </Text>
            </View>
          )}

          {/* ---------- Image Picker ---------- */}
          <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>
            Photo (Optional)
          </Text>
          <TouchableOpacity
            style={styles.imageButton}
            onPress={pickImage}
            disabled={isUploading || isSubmitting}
            activeOpacity={0.8}
          >
            <Ionicons
              name={image ? 'image' : 'camera'}
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.imageButtonText}>
              {isUploading
                ? 'Uploading...'
                : image
                ? 'Change photo'
                : 'Add photo from gallery'}
            </Text>
            {isUploading && (
              <ActivityIndicator size="small" color={COLORS.primary} />
            )}
          </TouchableOpacity>

          {image && !isUploading && (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: image }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => {
                  setImage(null);
                  setImageurl('');
                }}
              >
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* ---------- Submit ---------- */}
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting || isUploading) && styles.submitButtonDisabled,
            ]}
            onPress={sendHazard}
            disabled={isSubmitting || isUploading}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Report</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default HazardReportScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: scale(16, 18, 20),
    fontWeight: '700',
    color: COLORS.primary,
  },

  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.md,
    borderRadius: scale(12, 14, 16),
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: scale(13, 14, 15),
    fontWeight: '700',
    color: COLORS.primary,
  },
  infoText: {
    fontSize: scale(11, 12, 13),
    color: COLORS.subtext,
    marginTop: 2,
  },

  // Section labels
  sectionLabel: {
    fontSize: scale(12, 13, 14),
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
    marginLeft: 2,
  },
  helperText: {
    fontSize: scale(10, 11, 12),
    color: COLORS.muted,
    marginBottom: 8,
    marginLeft: 2,
  },

  // Picker
  pickerAnchor: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  pickerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: {
    flex: 1,
    fontSize: scale(13, 14, 15),
    fontWeight: '600',
    color: COLORS.text,
  },

  // Text area
  textArea: {
    backgroundColor: COLORS.surface,
    fontSize: scale(13, 14, 15),
  },

  // Map
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    height: scale(160, 190, 220),
    backgroundColor: COLORS.surface,
  },
  miniMap: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mapPlaceholderText: {
    color: COLORS.muted,
    fontSize: scale(11, 12, 13),
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: 2,
  },
  coordsText: {
    fontSize: scale(10, 11, 12),
    color: COLORS.muted,
  },

  // Image
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: scale(12, 14, 16),
  },
  imageButtonText: {
    fontSize: scale(12, 13, 14),
    fontWeight: '600',
    color: COLORS.primary,
  },
  imagePreviewWrap: {
    marginTop: SPACING.sm,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: scale(160, 190, 220),
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Submit
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: scale(14, 16, 18),
    borderRadius: 14,
    marginTop: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: scale(14, 15, 16),
  },
});
