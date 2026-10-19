import React, { useState, useLayoutEffect } from 'react';
import { SafeAreaView, View, Image, StyleSheet, Alert } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { TextInput, Text, Button, Portal } from 'react-native-paper';
import { Dropdown } from 'react-native-element-dropdown';
import { db } from '../firebase';

const HAZARD_STATUS = [
  { label: 'Unconfirmed', value: 'Unconfirmed' },
  { label: 'Potential', value: 'Potential' },
  { label: 'Active', value: 'Active' },
  { label: 'In-Progress', value: 'Progress' },
  { label: 'Resolved', value: 'Resolved' },
];

const HazardUpdateScreen = ({ navigation, route }) => {
  const { hazard } = route.params || {};
  const [status, setStatus] = useState(hazard?.status || 'Unconfirmed');
  const [description, setDescription] = useState(hazard?.description || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFocus, setIsFocus] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: hazard?.type ? `Update ${hazard.type}` : 'Hazard Details' });
  }, [navigation, hazard]);

  const updateStatusInFirebase = async () => {
    if (!hazard?.id) return Alert.alert('Error', 'Missing valid hazard reference id.');
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'hazards', hazard.id), {
        status,
        description: description.trim(),
      });
      Alert.alert('Success', 'Status successfully updated!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating document: ', error);
      Alert.alert('Update Error', 'Failed to modify hazard state.');
    } finally {
      setIsUpdating(false);
    }
  };

  const imageUri = hazard?.imaguri || hazard?.imageUri;

  return (
    <Portal.Host>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.row}>
            <Text variant="titleMedium">
              {hazard?.locationDescription || 'Location Unknown'} : {hazard?.type || 'General'}
            </Text>
          </View>

          <View style={styles.dateMargin}>
            <Text variant="titleSmall">
              Report Date: {hazard?.reportDateTime ? String(hazard.reportDateTime) : 'N/A'}
            </Text>
          </View>

          <Text style={styles.dropdownLabel}>Hazard Status</Text>
          <Dropdown
            style={[styles.dropdown, isFocus && styles.dropdownFocused]}
            placeholderStyle={styles.placeholderStyle}
            selectedTextStyle={styles.selectedTextStyle}
            containerStyle={styles.dropdownContainer}
            data={HAZARD_STATUS}
            labelField="label"
            valueField="value"
            placeholder={isFocus ? '...' : 'Select Status'}
            value={status}
            onFocus={() => setIsFocus(true)}
            onBlur={() => setIsFocus(false)}
            onChange={(item) => { setStatus(item.value); setIsFocus(false); }}
          />

          <TextInput
            label="Update Description"
            value={description}
            onChangeText={setDescription}
            mode="outlined"
            multiline
            style={styles.inputSpacing}
          />

          <Button
            mode="contained"
            onPress={updateStatusInFirebase}
            loading={isUpdating}
            disabled={isUpdating}
            style={styles.inputSpacing}
          >
            Update Status
          </Button>

          {imageUri && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.image} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Portal.Host>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { margin: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  dateMargin: { marginVertical: 15 },
  inputSpacing: { marginTop: 20 },
  imageContainer: { marginTop: 30, justifyContent: 'center', alignItems: 'center' },
  image: { width: 300, height: 300, borderRadius: 8, resizeMode: 'cover' },

  dropdownLabel: { fontSize: 12, color: '#666', marginBottom: 4, marginLeft: 4 },
  dropdown: { height: 50, borderColor: '#79747E', borderWidth: 1, borderRadius: 4,
    paddingHorizontal: 12, backgroundColor: '#fff' },
  dropdownFocused: { borderColor: '#6200ee', borderWidth: 2 },
  dropdownContainer: { borderRadius: 8, backgroundColor: '#fff', elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  placeholderStyle: { fontSize: 16, color: '#49454F' },
  selectedTextStyle: { fontSize: 16, color: '#1C1B1F' },
});

export default HazardUpdateScreen;
