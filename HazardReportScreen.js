import React, { useState, useEffect } from 'react';
import { StyleSheet, Image, View, SafeAreaView, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Text, TextInput, Button, Provider, Menu, Appbar } from 'react-native-paper';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, storage, auth } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const CATEGORY_LIST = [
  { label: 'Hazard', value: 'Hazard' },
  { label: 'Crime', value: 'Crime' },
  { label: 'Safe Space', value: 'SafeSpace' },
];

const TYPE_LISTS = {
  Hazard: [
    { label: 'Traffic-Related', value: 'Traffic' },
    { label: 'Natural Hazard', value: 'Natural' },
    { label: 'Dangerous infrastructure', value: 'Infra' },
    { label: 'Path Closure', value: 'Closure' },
  ],
  Crime: [
    { label: 'Violence and Threats', value: 'Violence' },
    { label: 'Police activity', value: 'Police' },
    { label: 'Theft / Vandalism', value: 'Theft' },
  ],
  SafeSpace: [
    { label: 'Emergency Blue Light', value: 'BlueLight' },
    { label: 'Safe Haven / Building', value: 'SafeHaven' },
    { label: 'Staffed Security Post', value: 'SecurityPost' },
  ],
};

const HAZARD_STATUS = [
  { label: 'Unconfirmed', value: 'Unconfirmed' },
  { label: 'Potential', value: 'Potential' },
  { label: 'Active', value: 'Active' },
  { label: 'In-Progress', value: 'Progress' },
  { label: 'Resolved', value: 'Resolved' },
];

const FALLBACK = { latitude: 33.769217, longitude: -117.867665 };
const getLabel = (value, list) => list.find((i) => i.value === value)?.label || value;

// Reusable dropdown row
const DropdownRow = ({ label, value, visible, setVisible, onSelect, items }) => (
  <>
    <Text style={styles.menuLabel}>{label}</Text>
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button mode="outlined" onPress={() => setVisible(true)} style={styles.dropdownAnchor} contentStyle={styles.dropdownAnchorContent}>
          {value}
        </Button>
      }
    >
      {items.map((item) => (
        <Menu.Item key={item.value} onPress={() => onSelect(item.value)} title={item.label} />
      ))}
    </Menu>
  </>
);

const HazardReportScreen = ({ navigation }) => {
  const [showDropDownCategory, setShowDropDownCategory] = useState(false);
  const [showDropDownType, setShowDropDownType] = useState(false);
  const [showDropDownStatus, setShowDropDownStatus] = useState(false);
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

  const studentID = auth.currentUser?.uid || 'Anonymous_User';

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let coords = FALLBACK;
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        }
        setMapRegion({ ...coords, latitudeDelta: 0.005, longitudeDelta: 0.005 });
        setSelectedLocation(coords);
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  const uploadImage = async (uri) => {
    setIsUploading(true);
    try {
      const blob = await (await fetch(uri)).blob();
      const timestamp = new Date().toISOString().replace(/[:.-]/g, '');
      const storageRef = ref(storage, `hazards/${timestamp}_${uri.substring(uri.lastIndexOf('/') + 1)}`);
      await uploadBytes(storageRef, blob);
      setImageurl(await getDownloadURL(storageRef));
    } catch {
      Alert.alert('Upload Error', 'Failed to store image.');
    } finally {
      setIsUploading(false);
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const uri = result.assets[0].uri;
        setImage(uri);
        await uploadImage(uri);
      }
    } catch {
      Alert.alert('Error', 'Could not open image library.');
    }
  };

  const sendHazard = async () => {
    if (!description.trim()) return Alert.alert('Required Fields', 'Please type a short description of the item.');
    if (!selectedLocation) return Alert.alert('Location Required', 'Please select a pin on the map.');

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'hazards'), {
        category, type,
        description: description.trim(),
        reportDateTime: Timestamp.fromDate(new Date()),
        status,
        location: selectedLocation,
        reportedBy: studentID,
        imaguri: imageurl,
      });
      Alert.alert('Success', 'Report broadcasted successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert('Submission Error', 'Failed to log report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Provider>
      <SafeAreaView style={styles.safeArea}>
        <Appbar.Header style={styles.headerBar}>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="File a Community Report" titleStyle={styles.headerTitle} />
        </Appbar.Header>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.formContainer}>
            <DropdownRow
              label="Report Category"
              value={`Category: ${getLabel(category, CATEGORY_LIST)}`}
              visible={showDropDownCategory}
              setVisible={setShowDropDownCategory}
              items={CATEGORY_LIST}
              onSelect={(val) => { setCategory(val); setType(TYPE_LISTS[val][0].value); setShowDropDownCategory(false); }}
            />
            <View style={{ marginVertical: 6 }} />

            <DropdownRow
              label="Type Specifics"
              value={getLabel(type, TYPE_LISTS[category])}
              visible={showDropDownType}
              setVisible={setShowDropDownType}
              items={TYPE_LISTS[category]}
              onSelect={(val) => { setType(val); setShowDropDownType(false); }}
            />
            <View style={{ marginVertical: 6 }} />

            <DropdownRow
              label="Status"
              value={getLabel(status, HAZARD_STATUS)}
              visible={showDropDownStatus}
              setVisible={setShowDropDownStatus}
              items={HAZARD_STATUS}
              onSelect={(val) => { setStatus(val); setShowDropDownStatus(false); }}
            />

            <TextInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={2}
              style={{ marginTop: 15 }}
            />

            <Text style={[styles.menuLabel, { marginTop: 15 }]}>Tap Map to Specify Location:</Text>
            {mapRegion ? (
              <MapView style={styles.miniMap} initialRegion={mapRegion}
                onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)}>
                {selectedLocation && <Marker coordinate={selectedLocation} title="Selected Point" pinColor="red" />}
              </MapView>
            ) : (
              <View style={styles.mapPlaceholder}><Text>Loading positioning map...</Text></View>
            )}

            <Button icon="camera" mode="outlined" onPress={pickImage} style={{ marginTop: 15 }} disabled={isUploading || isSubmitting}>
              {isUploading ? 'Uploading Image...' : 'Pick image from gallery'}
            </Button>

            {isUploading && <ActivityIndicator size="small" color="#6200ee" style={{ marginTop: 10 }} />}

            {image && !isUploading && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: image }} style={styles.imagePreview} />
              </View>
            )}

            <Button icon="alert" mode="contained" style={{ marginTop: 20, marginBottom: 30 }}
              onPress={sendHazard} loading={isSubmitting} disabled={isUploading || isSubmitting}>
              Submit Report
            </Button>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Provider>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  headerBar: { backgroundColor: '#fff', elevation: 0, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0', height: 52 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContainer: { paddingBottom: 20 },
  formContainer: { marginTop: 15, marginHorizontal: 30 },
  menuLabel: { fontSize: 12, color: '#666', marginBottom: 4, marginLeft: 4 },
  dropdownAnchor: { borderRadius: 4, borderColor: '#79747E' },
  dropdownAnchorContent: { justifyContent: 'flex-start', height: 44 },
  miniMap: { width: '100%', height: 180, borderRadius: 8, marginVertical: 5 },
  mapPlaceholder: { width: '100%', height: 180, backgroundColor: '#eee', justifyContent: 'center',
    alignItems: 'center', borderRadius: 8 },
  imagePreviewContainer: { alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#ccc',
    borderRadius: 8, padding: 5 },
  imagePreview: { width: '100%', height: 140, borderRadius: 6 },
});

export default HazardReportScreen;
