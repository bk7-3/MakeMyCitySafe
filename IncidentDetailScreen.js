import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUS_TYPES } from '../constants/incidentTypes';

const IncidentDetailScreen = ({ route, navigation }) => {
  const incidentId = route?.params?.incidentId;
  
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!incidentId) {
      Alert.alert('Error', 'No incident ID provided.');
      navigation.goBack();
      return;
    }
    fetchIncident();
  }, [incidentId]);

  const fetchIncident = async () => {
    try {
      const docRef = doc(db, 'incidents', incidentId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIncident({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert('Error', 'Incident not found.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error fetching incident:', error);
      Alert.alert('Error', 'Failed to load incident details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const isOwner = user && incident?.reportedBy === user.uid;

  const handleStatusUpdate = async (newStatus) => {
    if (!isOwner) return;
    setUpdating(true);
    try {
      const docRef = doc(db, 'incidents', incidentId);
      await updateDoc(docRef, { status: newStatus });
      setIncident({ ...incident, status: newStatus });
      Alert.alert('Success', 'Status updated.');
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    Alert.alert(
      'Delete Incident',
      'Are you sure you want to delete this incident? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const docRef = doc(db, 'incidents', incidentId);
              await deleteDoc(docRef);
              Alert.alert('Deleted', 'Incident removed.');
              navigation.goBack();
            } catch (error) {
              console.error('Error deleting incident:', error);
              Alert.alert('Error', 'Failed to delete.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#000666" />
      </SafeAreaView>
    );
  }

  if (!incident) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorText}>Incident not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.goBackButton}>
          <Text style={styles.goBackText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const typeInfo = INCIDENT_TYPES.find(t => t.id === incident.type);
  const severityInfo = SEVERITY_LEVELS.find(s => s.id === incident.severity);
  const statusInfo = STATUS_TYPES.find(s => s.id === incident.status);
  const date = incident.date ? new Date(incident.date) : new Date(incident.createdAt?.toDate?.() || Date.now());

  const displayName = incident.reporterName || incident.reportedByEmail || 'Anonymous';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incident Details</Text>
        {isOwner && (
          <TouchableOpacity onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#D32F2F" />
          </TouchableOpacity>
        )}
        {!isOwner && <View style={{ width: 24 }} />}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: typeInfo?.color || '#757575' }]}>
            <Text style={styles.badgeText}>{typeInfo?.label || 'Unknown'}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: severityInfo?.color || '#757575' }]}>
            <Text style={styles.badgeText}>{severityInfo?.label || 'Unknown'} Severity</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusInfo?.color || '#757575' }]}>
            <Text style={styles.badgeText}>{statusInfo?.label || 'Unknown'} Status</Text>
          </View>
        </View>

        <Text style={styles.title}>{incident.title}</Text>

        <View style={styles.detailItem}>
          <Ionicons name="location-outline" size={20} color="#666" />
          <Text style={styles.detailText}>{incident.location}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={20} color="#666" />
          <Text style={styles.detailText}>
            {date.toLocaleDateString()} at {date.toLocaleTimeString()}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="person-outline" size={20} color="#666" />
          <Text style={styles.detailText}>Reported by: {displayName}</Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{incident.description}</Text>

        {isOwner && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.statusButtons}>
              {STATUS_TYPES.map(status => (
                <TouchableOpacity
                  key={status.id}
                  style={[
                    styles.statusButton,
                    incident.status === status.id && styles.statusButtonActive,
                    { borderColor: status.color }
                  ]}
                  onPress={() => handleStatusUpdate(status.id)}
                  disabled={updating || incident.status === status.id}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      incident.status === status.id && styles.statusButtonTextActive,
                    ]}
                  >
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 18, color: '#666', marginBottom: 16 },
  goBackButton: { padding: 12, backgroundColor: '#000666', borderRadius: 8 },
  goBackText: { color: '#fff', fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c' },
  content: { padding: 16, paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, marginRight: 8, marginBottom: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1c1c', marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailText: { fontSize: 16, color: '#333', marginLeft: 10 },
  divider: { height: 1, backgroundColor: '#e2e2e2', marginVertical: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  description: { fontSize: 16, color: '#555', lineHeight: 24 },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  statusButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    backgroundColor: '#fff',
    marginRight: 10,
    marginBottom: 8,
  },
  statusButtonActive: { backgroundColor: '#000666', borderColor: '#000666' },
  statusButtonText: { fontSize: 14, fontWeight: '600', color: '#333' },
  statusButtonTextActive: { color: '#fff' },
});

export default IncidentDetailScreen;
