import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StatusBar,
  Image,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
  Modal as RNModal,
  TextInput,
} from 'react-native';
import { IconButton, Provider, DefaultTheme } from 'react-native-paper';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

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

//  LOCATIONIQ TOKEN 
const LOCATIONIQ_TOKEN = 'pk.c5f5e38514d66f974793defde833cb25';

const getStaticMapUrl = (lat, lng, zoom = 14, width = 400, height = 200) => {
  return `https://maps.locationiq.com/v3/staticmap?key=${LOCATIONIQ_TOKEN}&center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&format=png`;
};

//  CATEGORY CONFIG 
const CATEGORIES = {
  infrastructure: { label: 'Infrastructure', icon: '🏗️', color: '#e65100', bg: '#fff3e0' },
  construction:  { label: 'Construction',  icon: '🚧', color: '#2e7d32', bg: '#e8f5e9' },
  safety:        { label: 'Safety Hazard',  icon: '⚠️', color: '#ba1a1a', bg: '#ffdad6' },
  lighting:      { label: 'Poor Lighting',  icon: '💡', color: '#f9a825', bg: '#fff9c4' },
  other:         { label: 'Other',          icon: '📌', color: '#454652', bg: '#f0f0f0' },
};

const STATUS_CONFIG = {
  'reported':    { label: 'Reported',    color: '#e65100', bg: '#fff3e0' },
  'submitted':   { label: 'Submitted',   color: '#e65100', bg: '#fff3e0' },
  'in-progress': { label: 'In Progress', color: '#2e7d32', bg: '#e8f5e9' },
  'resolved':    { label: 'Resolved',    color: '#00695c', bg: '#e0f2f1' },
};

//  MAIN COMPONENT 
const SuggestDetailScreen = ({ route, navigation }) => {
  const { suggestion: initialSuggestion } = route.params;
  const [suggestion, setSuggestion] = useState(initialSuggestion);
  const [currentUser, setCurrentUser] = useState(null);
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDescription, setEditDescription] = useState(suggestion.description || '');
  const [editLocation, setEditLocation] = useState(suggestion.location || '');

  //  Confirmation modal states
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Update local state if route params change
  useEffect(() => {
    setSuggestion(initialSuggestion);
    setEditDescription(initialSuggestion.description || '');
    setEditLocation(initialSuggestion.location || '');
  }, [initialSuggestion]);

  // Generate map preview
  useEffect(() => {
    if (suggestion.coordinates?.lat && suggestion.coordinates?.lng) {
      const url = getStaticMapUrl(suggestion.coordinates.lat, suggestion.coordinates.lng);
      setMapImageUrl(url);
    }
  }, [suggestion.coordinates]);

  const isOwner = currentUser && suggestion.reportedBy === currentUser.uid;
  const isResolved = suggestion.status === 'resolved';

  const cat = CATEGORIES[suggestion.category] || CATEGORIES.other;
  const status = STATUS_CONFIG[suggestion.status] || { label: suggestion.status || 'Unknown', color: '#454652', bg: '#f0f0f0' };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  //  RESOLVE REPORT 
  const handleResolve = () => {
    if (!isOwner) return;
    setShowResolveModal(true);
  };

  const confirmResolve = async () => {
    setShowResolveModal(false);
    setUpdating(true);
    try {
      const docRef = doc(db, 'suggestions', suggestion.id);
      await updateDoc(docRef, { status: 'resolved' });
      setSuggestion(prev => ({ ...prev, status: 'resolved' }));
      Alert.alert('Resolved ✅', 'Report marked as resolved.');
    } catch (error) {
      console.error('Resolve error:', error);
      Alert.alert('Error', 'Failed to resolve: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  //  DELETE REPORT 
  const handleDelete = () => {
    if (!isOwner) return;
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setShowDeleteModal(false);
    setUpdating(true);
    try {
      const docRef = doc(db, 'suggestions', suggestion.id);
      await deleteDoc(docRef);
      // Navigate back immediately – screen will unmount
      navigation.goBack();
    } catch (error) {
      console.error('Delete error:', error);
      Alert.alert('Error', 'Failed to delete: ' + error.message);
      setUpdating(false);
    }
  };

  //  EDIT REPORT 
  const handleEdit = () => {
    setEditDescription(suggestion.description || '');
    setEditLocation(suggestion.location || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editDescription.trim() || !editLocation.trim()) {
      Alert.alert('Missing Fields', 'Both fields are required.');
      return;
    }

    setUpdating(true);
    try {
      const docRef = doc(db, 'suggestions', suggestion.id);
      await updateDoc(docRef, {
        description: editDescription.trim(),
        location: editLocation.trim(),
      });

      setSuggestion(prev => ({
        ...prev,
        description: editDescription.trim(),
        location: editLocation.trim(),
      }));
      setShowEditModal(false);
      Alert.alert('Updated ✅', 'Report updated.');
    } catch (error) {
      console.error('Edit error:', error);
      Alert.alert('Error', 'Failed to update: ' + error.message);
    } finally {
      setUpdating(false);
    }
  };

  // Open maps
  const openInMaps = () => {
    if (suggestion.coordinates) {
      const { lat, lng } = suggestion.coordinates;
      const label = encodeURIComponent(suggestion.location || 'Report Location');
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${label})`,
      });
      Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps app.'));
    } else {
      Alert.alert('Location missing', 'No coordinates available for this report.');
    }
  };

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <IconButton icon="arrow-left" size={24} color="#000666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Details</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Category & Status Badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: cat.bg }]}>
              <Text style={[styles.badgeText, { color: cat.color }]}>
                {cat.icon} {cat.label}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: status.bg }]}>
              <Text style={[styles.badgeText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
            {isOwner && (
              <View style={[styles.badge, { backgroundColor: '#00066620' }]}>
                <Text style={[styles.badgeText, { color: '#000666' }]}>Your Report</Text>
              </View>
            )}
          </View>

          {/* Owner Actions */}
          {isOwner && (
            <View style={styles.actionRow}>
              {!isResolved && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.resolveButton]}
                  onPress={handleResolve}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>✅ Mark Resolved</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionButton, styles.editButton]}
                onPress={handleEdit}
                disabled={updating}
              >
                <Text style={styles.actionButtonText}>✏️ Edit Report</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Description Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Description</Text>
            </View>
            <Text style={styles.descriptionText}>{suggestion.description || 'No description provided.'}</Text>
          </View>

          {/* Location Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📍</Text>
              <Text style={styles.sectionTitle}>Location</Text>
            </View>
            <Text style={styles.locationText}>{suggestion.location || 'No location provided.'}</Text>

            {mapImageUrl && (
              <View style={styles.mapContainer}>
                <Image
                  source={{ uri: mapImageUrl }}
                  style={styles.mapImage}
                  resizeMode="cover"
                  onLoadStart={() => setMapLoading(true)}
                  onLoadEnd={() => setMapLoading(false)}
                  onError={() => {
                    setMapLoading(false);
                    setMapImageUrl(null);
                  }}
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
              </View>
            )}

            {suggestion.coordinates && (
              <TouchableOpacity style={styles.mapButton} onPress={openInMaps}>
                <Text style={styles.mapButtonText}>Open in Maps App</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Photo Evidence */}
          {suggestion.imageBase64 || suggestion.imageUrl ? (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>📷</Text>
                <Text style={styles.sectionTitle}>Photo Evidence</Text>
              </View>
              <Image
                source={{
                  uri: suggestion.imageUrl
                    ? suggestion.imageUrl
                    : `data:image/jpeg;base64,${suggestion.imageBase64}`,
                }}
                style={styles.evidencePhoto}
                resizeMode="cover"
              />
            </View>
          ) : null}

          {/* Meta Card */}
          <View style={styles.card}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Reported by</Text>
              <Text style={styles.metaValue}>{suggestion.reportedByName || suggestion.reportedBy || 'Anonymous'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{formatDate(suggestion.reportDateTime)}</Text>
            </View>
          </View>

          {/* Delete Button */}
          {isOwner && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              disabled={updating}
            >
              {updating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.deleteButtonText}>🗑️ Delete Report</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* RESOLVE CONFIRMATION */}
        <RNModal
          visible={showResolveModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowResolveModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalConfirmContent}>
              <Text style={styles.modalTitle}>Resolve Report</Text>
              <Text style={styles.modalMessage}>
                Mark this report as resolved? The issue will be considered fixed.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowResolveModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: '#2e7d32' }]}
                  onPress={confirmResolve}
                >
                  <Text style={styles.modalSaveText}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        {/* DELETE CONFIRMATION*/}
        <RNModal
          visible={showDeleteModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDeleteModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalConfirmContent}>
              <Text style={styles.modalTitle}>Delete Report</Text>
              <Text style={styles.modalMessage}>
                Are you sure? This cannot be undone.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowDeleteModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, { backgroundColor: '#d32f2f' }]}
                  onPress={confirmDelete}
                >
                  <Text style={styles.modalSaveText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        {/* Edit Modal */}
        <RNModal
          visible={showEditModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Report</Text>
              
              <Text style={styles.modalLabel}>Description</Text>
              <TextInput
                style={styles.modalInput}
                value={editDescription}
                onChangeText={setEditDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Describe the hazard"
              />
              
              <Text style={styles.modalLabel}>Location</Text>
              <TextInput
                style={styles.modalInput}
                value={editLocation}
                onChangeText={setEditLocation}
                placeholder="Address or landmark"
              />
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowEditModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSaveText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000666', flex: 1, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 14, fontWeight: '600' },
  
  // Action buttons
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolveButton: { backgroundColor: '#2e7d32' },
  editButton: { backgroundColor: '#1a237e' },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  
  // Delete button
  deleteButton: {
    backgroundColor: '#d32f2f',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  
  // Cards
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
  descriptionText: { fontSize: 16, lineHeight: 24, color: '#1a1c1c' },
  locationText: { fontSize: 16, color: '#1a1c1c', marginBottom: 12, lineHeight: 22 },
  
  // Map
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c6c5d4',
    height: 160,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  mapImage: { width: '100%', height: '100%' },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  mapButton: { backgroundColor: '#1a237e', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  mapButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  
  // Photo
  evidencePhoto: { width: '100%', height: 200, borderRadius: 12, borderWidth: 1, borderColor: '#c6c5d4' },
  
  // Meta
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  metaLabel: { fontSize: 15, color: '#454652', fontWeight: '500' },
  metaValue: { fontSize: 15, color: '#1a1c1c', fontWeight: '600', textAlign: 'right', flex: 1 },
  
  // Modals
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
    width: '90%',
    maxHeight: '80%',
  },

  modalConfirmContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c', marginBottom: 12, textAlign: 'center' },
  modalMessage: { fontSize: 16, color: '#1a1c1c', marginBottom: 20, textAlign: 'center', lineHeight: 22 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#454652', marginBottom: 6 },
  modalInput: {
    borderWidth: 1,
    borderColor: '#c6c5d4',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1a1c1c',
    backgroundColor: '#f9f9f9',
    marginBottom: 14,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    alignItems: 'center',
  },
  modalCancelText: { color: '#454652', fontWeight: '600', fontSize: 15 },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1a237e',
    alignItems: 'center',
  },
  modalSaveText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
});

export default SuggestDetailScreen;
