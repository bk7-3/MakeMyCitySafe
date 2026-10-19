import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, ScrollView, Text, TouchableOpacity,
  Image, Alert, ActivityIndicator } from 'react-native';
import { Provider, DefaultTheme, TextInput, Button, IconButton, Modal, Portal } from 'react-native-paper';
import { db, auth } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors,
  primary: '#000666', accent: '#000666', background: '#f9f9f9', surface: '#fff',
  text: '#1a1c1c', placeholder: '#454652', border: '#c6c5d4',
  primaryContainer: '#1a237e', onPrimaryContainer: '#fff' } };

const REPORT_CATEGORIES = [
  { label: 'Infrastructure', value: 'infrastructure', icon: '🏗️' },
  { label: 'Construction', value: 'construction', icon: '🚧' },
  { label: 'Safety Hazard', value: 'safety', icon: '⚠️' },
  { label: 'Poor Lighting', value: 'lighting', icon: '💡' },
  { label: 'Other', value: 'other', icon: '📌' },
];

const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionIcon}>{icon}</Text>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const SuggestAddScreen = ({ navigation }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('infrastructure');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [coordinates, setCoordinates] = useState(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    if (user) return setCurrentUser(user);
    Alert.alert('Not logged in', 'Please sign in to report a hazard.', [
      { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
    ]);
  }), []);

  const handleUseCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied', 'Location permission is required to auto-detect your position.');
    setLocationLoading(true);
    try {
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoordinates({ lat: coords.latitude, lng: coords.longitude });
      const addresses = await Location.reverseGeocodeAsync(coords);
      const addr = addresses[0];
      const parts = addr ? [addr.street, addr.city, addr.region, addr.postalCode].filter(Boolean).join(', ') : '';
      setLocationText(parts || `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
      setUsingCurrentLocation(true);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not get current location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleClearLocation = () => {
    setCoordinates(null);
    setLocationText('');
    setUsingCurrentLocation(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied', 'We need camera roll access to attach a photo.');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true,
      aspect: [4, 3], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const handleSubmit = async () => {
    if (!currentUser) return Alert.alert('Error', 'You must be logged in.');
    if (!description.trim()) return Alert.alert('Missing Fields', 'Please enter a description of the hazard.');
    if (!locationText.trim()) return Alert.alert('Missing Fields', 'Please provide a location.');

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
        ...(image?.base64 && { imageBase64: image.base64 }),
      };
      await addDoc(collection(db, 'suggestions'), reportData);
      setDescription(''); setLocationText(''); setCoordinates(null);
      setImage(null); setCategory('infrastructure'); setSubmitting(false);
      Alert.alert('Report Submitted ✅',
        'Thank you for helping keep your community safe! Your report has been recorded.',
        [{ text: 'OK', onPress: () => navigation.goBack() }], { cancelable: false });
    } catch (error) {
      console.error('Error adding report:', error);
      const msg = error.code === 'permission-denied' ? 'Permission denied. Please check Firestore security rules.'
        : error.code === 'unauthenticated' ? 'Please log in again.'
        : error.message;
      Alert.alert('Error', `Failed to submit report. ${msg}`);
      setSubmitting(false);
    }
  };

  const selectedCat = REPORT_CATEGORIES.find((c) => c.value === category);

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <IconButton icon="arrow-left" size={24} color="#000666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report a Hazard</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.impactCard}>
            <Text style={styles.impactTitle}>Community Safety</Text>
            <Text style={styles.impactText}>Your report helps neighbors avoid unsafe areas. Please be as detailed as possible.</Text>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="📂" title="Category" />
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
              <Text style={styles.pickerText}>{selectedCat?.icon}{'  '}{selectedCat?.label}</Text>
              <Text style={styles.pickerArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="📝" title="Description" />
            <TextInput mode="outlined" label="Describe the hazard" value={description}
              onChangeText={setDescription} multiline numberOfLines={5} style={styles.textArea}
              outlineColor="#c6c5d4" activeOutlineColor="#000666" theme={theme}
              placeholder="What did you see? Where exactly is it? Any other details?" />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="📍" title="Location" />
            <View style={styles.locationButtons}>
              <Button mode="outlined" icon="crosshairs-gps" onPress={handleUseCurrentLocation}
                loading={locationLoading} disabled={locationLoading}
                style={styles.locationButton} color="#000666">
                Use Current Location
              </Button>
              {usingCurrentLocation && (
                <Button mode="text" icon="close" onPress={handleClearLocation}
                  style={styles.locationButton} color="#ba1a1a">
                  Clear
                </Button>
              )}
            </View>
            <TextInput mode="outlined" label="Address or landmark" value={locationText}
              onChangeText={(text) => {
                setLocationText(text);
                if (usingCurrentLocation) setUsingCurrentLocation(false);
                setCoordinates(null);
              }}
              style={styles.locationInput} outlineColor="#c6c5d4" activeOutlineColor="#000666"
              theme={theme} placeholder="Enter manually if auto-detect fails" disabled={usingCurrentLocation} />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="📷" title="Photo Evidence" />
            {image ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
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

          <TouchableOpacity style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Report</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        <Portal>
          <Modal visible={showCategoryPicker} onDismiss={() => setShowCategoryPicker(false)}
            contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            {REPORT_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat.value}
                style={[styles.modalItem, category === cat.value && styles.modalItemActive]}
                onPress={() => { setCategory(cat.value); setShowCategoryPicker(false); }}>
                <Text style={styles.modalItemText}>{cat.icon}  {cat.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowCategoryPicker(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </Modal>
        </Portal>
      </SafeAreaView>
    </Provider>
  );
};

export default SuggestAddScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e2e2' },
  closeButton: { marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000666', flex: 1, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  impactCard: { backgroundColor: '#1a237e', padding: 16, borderRadius: 12, marginBottom: 16 },
  impactTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
  impactText: { fontSize: 14, color: '#e0e0ff', lineHeight: 22 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#c6c5d4', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIcon: { fontSize: 20, marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1c1c' },

  pickerButton: { height: 48, borderWidth: 1, borderColor: '#c6c5d4', borderRadius: 8,
    paddingHorizontal: 12, backgroundColor: '#f9f9f9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { fontSize: 16, color: '#1a1c1c' },
  pickerArrow: { fontSize: 12, color: '#767683' },
  textArea: { backgroundColor: '#f9f9f9' },
  locationButtons: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  locationButton: { flex: 1 },
  locationInput: { backgroundColor: '#f9f9f9' },

  addPhotoBtn: { height: 120, borderWidth: 2, borderColor: '#c6c5d4', borderStyle: 'dashed',
    borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
  addPhotoIcon: { fontSize: 36, marginBottom: 8 },
  addPhotoText: { color: '#767683', fontWeight: '500' },
  imagePreviewContainer: { position: 'relative', marginBottom: 8 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12, borderWidth: 1, borderColor: '#c6c5d4' },
  removeImageBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  removeImageText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  submitButton: { backgroundColor: '#1a237e', borderRadius: 12, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  disabledButton: { opacity: 0.6 },

  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginHorizontal: 20 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#1a1c1c' },
  modalItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e2e2' },
  modalItemActive: { backgroundColor: '#e0e0ff' },
  modalItemText: { fontSize: 16, color: '#1a1c1c' },
  modalCloseButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  modalCloseText: { color: '#000666', fontWeight: '500', fontSize: 16 },
});
