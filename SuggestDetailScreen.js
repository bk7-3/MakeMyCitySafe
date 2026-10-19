import React, { useState, useEffect } from 'react';
import {
  SafeAreaView, StyleSheet, View, ScrollView, Text, TouchableOpacity,
  StatusBar, Image, ActivityIndicator, Platform, Linking, Alert,
  Modal as RNModal, TextInput,
} from 'react-native';
import { IconButton, Provider, DefaultTheme } from 'react-native-paper';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';

const LOCATIONIQ_TOKEN = process.env.EXPO_PUBLIC_LOCATIONIQ_TOKEN;

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: '#000666', accent: '#000666' },
};

const CATEGORIES = {
  infrastructure: { label: 'Infrastructure', icon: '🏗️', color: '#e65100', bg: '#fff3e0' },
  construction: { label: 'Construction', icon: '🚧', color: '#2e7d32', bg: '#e8f5e9' },
  safety: { label: 'Safety Hazard', icon: '⚠️', color: '#ba1a1a', bg: '#ffdad6' },
  lighting: { label: 'Poor Lighting', icon: '💡', color: '#f9a825', bg: '#fff9c4' },
  other: { label: 'Other', icon: '📌', color: '#454652', bg: '#f0f0f0' },
};

const STATUS_CONFIG = {
  reported: { label: 'Reported', color: '#e65100', bg: '#fff3e0' },
  submitted: { label: 'Submitted', color: '#e65100', bg: '#fff3e0' },
  'in-progress': { label: 'In Progress', color: '#2e7d32', bg: '#e8f5e9' },
  resolved: { label: 'Resolved', color: '#00695c', bg: '#e0f2f1' },
};

const formatDate = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const mapUrl = (lat, lng) =>
  `https://maps.locationiq.com/v3/staticmap?key=${LOCATIONIQ_TOKEN}&center=${lat},${lng}&zoom=14&size=400x200&format=png`;

export default function SuggestDetailScreen({ route, navigation }) {
  const { suggestion: initial } = route.params;
  const [suggestion, setSuggestion] = useState(initial);
  const [user, setUser] = useState(null);
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editDesc, setEditDesc] = useState(initial.description || '');
  const [editLoc, setEditLoc] = useState(initial.location || '');

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    setSuggestion(initial);
    setEditDesc(initial.description || '');
    setEditLoc(initial.location || '');
  }, [initial]);

  useEffect(() => {
    const { lat, lng } = suggestion.coordinates || {};
    if (lat && lng) setMapImageUrl(mapUrl(lat, lng));
  }, [suggestion.coordinates]);

  const isOwner = user && suggestion.reportedBy === user.uid;
  const isResolved = suggestion.status === 'resolved';
  const cat = CATEGORIES[suggestion.category] || CATEGORIES.other;
  const status = STATUS_CONFIG[suggestion.status] || { label: suggestion.status || 'Unknown', color: '#454652', bg: '#f0f0f0' };

  const update = async (payload, onSuccess) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'suggestions', suggestion.id), payload);
      onSuccess();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setUpdating(false);
    }
  };

  const confirmResolve = () => {
    setShowResolve(false);
    update({ status: 'resolved' }, () => {
      setSuggestion((p) => ({ ...p, status: 'resolved' }));
      Alert.alert('Resolved ✅', 'Report marked as resolved.');
    });
  };

  const confirmDelete = async () => {
    setShowDelete(false);
    setUpdating(true);
    try {
      await deleteDoc(doc(db, 'suggestions', suggestion.id));
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.message);
      setUpdating(false);
    }
  };

  const handleSaveEdit = () => {
    if (!editDesc.trim() || !editLoc.trim()) return Alert.alert('Missing Fields', 'Both fields are required.');
    update(
      { description: editDesc.trim(), location: editLoc.trim() },
      () => {
        setSuggestion((p) => ({ ...p, description: editDesc.trim(), location: editLoc.trim() }));
        setShowEdit(false);
        Alert.alert('Updated ✅', 'Report updated.');
      }
    );
  };

  const openInMaps = () => {
    const { lat, lng } = suggestion.coordinates || {};
    if (!lat || !lng) return Alert.alert('Location missing', 'No coordinates available.');
    const label = encodeURIComponent(suggestion.location || 'Report Location');
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${lat},${lng}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
    });
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps app.'));
  };

  return (
    <Provider theme={theme}>
      <SafeAreaView style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />

        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginLeft: -8 }}>
            <IconButton icon="arrow-left" size={24} color="#000666" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Report Details</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: cat.bg }]}>
              <Text style={[s.badgeText, { color: cat.color }]}>{cat.icon} {cat.label}</Text>
            </View>
            <View style={[s.badge, { backgroundColor: status.bg }]}>
              <Text style={[s.badgeText, { color: status.color }]}>{status.label}</Text>
            </View>
            {isOwner && (
              <View style={[s.badge, { backgroundColor: '#00066620' }]}>
                <Text style={[s.badgeText, { color: '#000666' }]}>Your Report</Text>
              </View>
            )}
          </View>

          {isOwner && (
            <View style={s.actionRow}>
              {!isResolved && (
                <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#2e7d32' }]} onPress={() => setShowResolve(true)} disabled={updating}>
                  {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.actionText}>✅ Mark Resolved</Text>}
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#1a237e' }]} onPress={() => setShowEdit(true)} disabled={updating}>
                <Text style={s.actionText}>✏️ Edit Report</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={s.card}>
            <View style={s.sectionHeader}><Text style={s.sectionIcon}>📝</Text><Text style={s.sectionTitle}>Description</Text></View>
            <Text style={s.descText}>{suggestion.description || 'No description provided.'}</Text>
          </View>

          <View style={s.card}>
            <View style={s.sectionHeader}><Text style={s.sectionIcon}>📍</Text><Text style={s.sectionTitle}>Location</Text></View>
            <Text style={s.locText}>{suggestion.location || 'No location provided.'}</Text>

            {mapImageUrl && (
              <View style={s.mapBox}>
                <Image
                  source={{ uri: mapImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  onLoadStart={() => setMapLoading(true)}
                  onLoadEnd={() => setMapLoading(false)}
                  onError={() => { setMapLoading(false); setMapImageUrl(null); }}
                />
                {mapLoading && (
                  <View style={s.mapOverlay}><ActivityIndicator size="large" color="#000666" /></View>
                )}
                <View style={s.mapAttribution}>
                  <Text style={s.mapAttributionText}>© OpenStreetMap · LocationIQ</Text>
                </View>
              </View>
            )}

            {suggestion.coordinates && (
              <TouchableOpacity style={s.mapBtn} onPress={openInMaps}>
                <Text style={s.mapBtnText}>Open in Maps App</Text>
              </TouchableOpacity>
            )}
          </View>

          {(suggestion.imageBase64 || suggestion.imageUrl) && (
            <View style={s.card}>
              <View style={s.sectionHeader}><Text style={s.sectionIcon}>📷</Text><Text style={s.sectionTitle}>Photo Evidence</Text></View>
              <Image
                source={{ uri: suggestion.imageUrl || `data:image/jpeg;base64,${suggestion.imageBase64}` }}
                style={{ width: '100%', height: 200, borderRadius: 12, borderWidth: 1, borderColor: '#c6c5d4' }}
                resizeMode="cover"
              />
            </View>
          )}

          <View style={s.card}>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Reported by</Text>
              <Text style={s.metaValue}>{suggestion.reportedByName || suggestion.reportedBy || 'Anonymous'}</Text>
            </View>
            <View style={s.metaRow}>
              <Text style={s.metaLabel}>Date</Text>
              <Text style={s.metaValue}>{formatDate(suggestion.reportDateTime)}</Text>
            </View>
          </View>

          {isOwner && (
            <TouchableOpacity style={s.deleteBtn} onPress={() => setShowDelete(true)} disabled={updating}>
              {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.deleteText}>🗑️ Delete Report</Text>}
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        <RNModal visible={showResolve} transparent animationType="fade" onRequestClose={() => setShowResolve(false)}>
          <View style={s.overlay}>
            <View style={s.confirmBox}>
              <Text style={s.modalTitle}>Resolve Report</Text>
              <Text style={s.modalMsg}>Mark this report as resolved? The issue will be considered fixed.</Text>
              <View style={s.btnRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowResolve(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#2e7d32' }]} onPress={confirmResolve}>
                  <Text style={s.saveText}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        <RNModal visible={showDelete} transparent animationType="fade" onRequestClose={() => setShowDelete(false)}>
          <View style={s.overlay}>
            <View style={s.confirmBox}>
              <Text style={s.modalTitle}>Delete Report</Text>
              <Text style={s.modalMsg}>Are you sure? This cannot be undone.</Text>
              <View style={s.btnRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowDelete(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: '#d32f2f' }]} onPress={confirmDelete}>
                  <Text style={s.saveText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>

        <RNModal visible={showEdit} transparent animationType="slide" onRequestClose={() => setShowEdit(false)}>
          <View style={s.overlay}>
            <View style={s.editBox}>
              <Text style={s.modalTitle}>Edit Report</Text>
              <Text style={s.modalLabel}>Description</Text>
              <TextInput
                style={s.modalInput}
                value={editDesc}
                onChangeText={setEditDesc}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Describe the hazard"
              />
              <Text style={s.modalLabel}>Location</Text>
              <TextInput
                style={s.modalInput}
                value={editLoc}
                onChangeText={setEditLoc}
                placeholder="Address or landmark"
              />
              <View style={s.btnRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setShowEdit(false)}>
                  <Text style={s.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={updating}>
                  {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveText}>Save Changes</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </RNModal>
      </SafeAreaView>
    </Provider>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e2e2',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000666', flex: 1, textAlign: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  badgeText: { fontSize: 14, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  deleteBtn: {
    backgroundColor: '#d32f2f', paddingVertical: 14, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  deleteText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  card: {
    backgroundColor: '#fff', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#c6c5d4', marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIcon: { fontSize: 20, marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1c1c' },
  descText: { fontSize: 16, lineHeight: 24, color: '#1a1c1c' },
  locText: { fontSize: 16, color: '#1a1c1c', marginBottom: 12, lineHeight: 22 },
  mapBox: {
    borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#c6c5d4',
    height: 160, backgroundColor: '#f0f0f0', justifyContent: 'center',
    alignItems: 'center', marginTop: 8, marginBottom: 12,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  mapAttribution: {
    position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.8)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  mapAttributionText: { fontSize: 9, color: '#333' },
  mapBtn: { backgroundColor: '#1a237e', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  mapBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  metaLabel: { fontSize: 15, color: '#454652', fontWeight: '500' },
  metaValue: { fontSize: 15, color: '#1a1c1c', fontWeight: '600', textAlign: 'right', flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '90%', maxHeight: '80%' },
  confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c', marginBottom: 12, textAlign: 'center' },
  modalMsg: { fontSize: 16, color: '#1a1c1c', marginBottom: 20, textAlign: 'center', lineHeight: 22 },
  modalLabel: { fontSize: 14, fontWeight: '600', color: '#454652', marginBottom: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#c6c5d4', borderRadius: 8, padding: 12,
    fontSize: 16, color: '#1a1c1c', backgroundColor: '#f9f9f9', marginBottom: 14,
  },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#c6c5d4', alignItems: 'center' },
  cancelText: { color: '#454652', fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#1a237e', alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
