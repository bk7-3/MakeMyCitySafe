import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Provider,
  DefaultTheme,
  TextInput,
  Button,
  IconButton,
  Divider,
  Modal,
  Portal,
} from 'react-native-paper';
import { db, auth } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

//  THEME 
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

//  REPORT CATEGORIES 
const REPORT_CATEGORIES = [
  { label: 'Infrastructure', value: 'infrastructure', icon: '🏗️' },
  { label: 'Construction', value: 'construction', icon: '🚧' },
  { label: 'Safety Hazard', value: 'safety', icon: '⚠️' },
  { label: 'Poor Lighting', value: 'lighting', icon: '💡' },
  { label: 'Other', value: 'other', icon: '📌' },
];

const SuggestAddScreen = ({ navigation }) => {
  // User state
  const [currentUser, setCurrentUser] = useState(null);

  // Form state
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('infrastructure');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [image, setImage] = useState(null); // { uri, base64 }
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth state in Add Screen:', user ? user.uid : 'No user');
      if (user) {
        setCurrentUser(user);
      } else {
        Alert.alert('Not logged in', 'Please sign in to report a hazard.', [
          { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) }
        ]);
      }
    });
    return unsubscribe;
  }, []);

  //  LOCATION HANDLING 
  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required to auto-detect your position.');
      return false;
    }
    return true;
  };

  const handleUseCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    setLocationLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setCoordinates({ lat: latitude, lng: longitude });

      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses.length > 0) {
        const addr = addresses[0];
        const parts = [addr.street, addr.city, addr.region, addr.postalCode].filter(Boolean).join(', ');
        setLocationText(parts || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      } else {
        setLocationText(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
      setUsingCurrentLocation(true);
    } catch (error) {
      Alert.alert('Error', 'Could not get current location. Please try again.');
      console.error(error);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleClearLocation = () => {
    setCoordinates(null);
    setLocationText('');
    setUsingCurrentLocation(false);
  };

  //  IMAGE PICKING 
  const requestMediaPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'We need camera roll access to attach a photo.');
      return false;
    }
    return true;
  };

  const pickImage = async () => {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setImage({ uri: asset.uri, base64: asset.base64 });
    }
  };

  const removeImage = () => setImage(null);

//  SUBMIT 
const handleSubmit = async () => {
  if (!currentUser) {
    Alert.alert('Error', 'You must be logged in.');
    return;
  }
  if (!description.trim()) {
    Alert.alert('Missing Fields', 'Please enter a description of the hazard.');
    return;
  }
  if (!locationText.trim()) {
    Alert.alert('Missing Fields', 'Please provide a location.');
    return;
  }

  setSubmitting(true);
  try {
    const reportData = {
      description: description.trim(),
      category,
      location: locationText,
      coordinates: coordinates || null,
      reportDateTime: Timestamp.fromDate(new Date()),
      reportedBy: currentUser.uid,
      reportedByName: currentUser.displayName || currentUser.email || 'Anonymous',
      status: 'submitted',
    };

    if (image && image.base64) {
      reportData.imageBase64 = image.base64;
    }

    console.log('Attempting to save report:', reportData);
    
    const docRef = await addDoc(collection(db, 'suggestions'), reportData);
    console.log('Document written with ID:', docRef.id);
    
    setDescription('');
    setLocationText('');
    setCoordinates(null);
    setImage(null);
    setCategory('infrastructure');
    setSubmitting(false);
    
    Alert.alert(
      'Report Submitted ✅',
      'Thank you for helping keep your community safe! Your report has been recorded.',
      [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ],
      { cancelable: false }
    );
    
  } catch (error) {
    console.error('Error adding report:', error);
    let errorMessage = 'Failed to submit report. ';
    
    if (error.code === 'permission-denied') {
      errorMessage += 'Permission denied. Please check Firestore security rules.';
    } else if (error.code === 'unauthenticated') {
      errorMessage += 'Please log in again.';
    } else {
      errorMessage += error.message;
    }
    
    Alert.alert('Error', errorMessage);
    setSubmitting(false);
  }
};

  //  RENDER 
  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <IconButton icon="arrow-left" size={24} color="#000666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report a Hazard</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Impact Card */}
          <View style={styles.impactCard}>
            <Text style={styles.impactTitle}>Community Safety</Text>
            <Text style={styles.impactText}>
              Your report helps neighbors avoid unsafe areas. Please be as detailed as possible.
            </Text>
          </View>

          {/* Category Selection */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📂</Text>
              <Text style={styles.sectionTitle}>Category</Text>
            </View>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowCategoryPicker(true)}
            >
              <Text style={styles.pickerText}>
                {REPORT_CATEGORIES.find(c => c.value === category)?.icon}{'  '}
                {REPORT_CATEGORIES.find(c => c.value === category)?.label}
              </Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <TextInput
              mode="outlined"
              label="Describe the hazard"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              style={styles.textArea}
              outlineColor="#c6c5d4"
              activeOutlineColor="#000666"
              theme={theme}
              placeholder="What did you see? Where exactly is it? Any other details?"
            />
          </View>

          {/* Location */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📍</Text>
              <Text style={styles.sectionTitle}>Location</Text>
            </View>

            <View style={styles.locationButtons}>
              <Button
                mode="outlined"
                icon="crosshairs-gps"
                onPress={handleUseCurrentLocation}
                loading={locationLoading}
                disabled={locationLoading}
                style={styles.locationButton}
                labelStyle={{ color: '#000666' }}
                color="#000666"
              >
                Use Current Location
              </Button>
              {usingCurrentLocation && (
                <Button
                  mode="text"
                  icon="close"
                  onPress={handleClearLocation}
                  style={styles.locationButton}
                  labelStyle={{ color: '#ba1a1a' }}
                  color="#ba1a1a"
                >
                  Clear
                </Button>
              )}
            </View>

            <TextInput
              mode="outlined"
              label="Address or landmark"
              value={locationText}
              onChangeText={(text) => {
                setLocationText(text);
                if (usingCurrentLocation) setUsingCurrentLocation(false);
                setCoordinates(null);
              }}
              style={styles.locationInput}
              outlineColor="#c6c5d4"
              activeOutlineColor="#000666"
              theme={theme}
              placeholder="Enter manually if auto-detect fails"
              disabled={usingCurrentLocation}
            />
          </View>

          {/* Photo Evidence */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📷</Text>
              <Text style={styles.sectionTitle}>Photo Evidence</Text>
            </View>

            {image ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={removeImage}>
                  <Text style={styles.removeImageText}>✕ Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
                <Text style={styles.addPhotoIcon}>➕</Text>
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Category Picker Modal */}
        <Portal>
          <Modal
            visible={showCategoryPicker}
            onDismiss={() => setShowCategoryPicker(false)}
            contentContainerStyle={styles.modalContent}
          >
            <Text style={styles.modalTitle}>Select Category</Text>
            {REPORT_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.modalItem, category === cat.value && styles.modalItemActive]}
                onPress={() => {
                  setCategory(cat.value);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={styles.modalItemText}>
                  {cat.icon}  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCategoryPicker(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </Modal>
        </Portal>
      </SafeAreaView>
    </Provider>
  );
};

//  STYLES 
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
  impactText: { fontSize: 14, color: '#e0e0ff', lineHeight: 22 },
  card: {
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
  pickerArrow: { fontSize: 12, color: '#767683' },
  textArea: { backgroundColor: '#f9f9f9' },
  locationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  locationButton: { flex: 1 },
  locationInput: { backgroundColor: '#f9f9f9' },
  addPhotoBtn: {
    height: 120,
    borderWidth: 2,
    borderColor: '#c6c5d4',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  addPhotoIcon: { fontSize: 36, marginBottom: 8 },
  addPhotoText: { color: '#767683', fontWeight: '500' },
  imagePreviewContainer: { position: 'relative', marginBottom: 8 },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6c5d4',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  removeImageText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  submitButton: {
    backgroundColor: '#1a237e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  disabledButton: { opacity: 0.6 },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#1a1c1c' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e2e2' },
  modalItemActive: { backgroundColor: '#e0e0ff' },
  modalItemText: { fontSize: 16, color: '#1a1c1c' },
  modalCloseButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  modalCloseText: { color: '#000666', fontWeight: '500', fontSize: 16 },
});

export default SuggestAddScreen;
