import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUS_TYPES } from '../constants/incidentTypes';

const { height: SCREEN_H } = Dimensions.get('window');
const scale = (s, n, l) => (SCREEN_H < 700 ? s : SCREEN_H > 850 ? l : n);
const SPACING = { xs: scale(4, 6, 8), sm: scale(8, 10, 12), md: scale(12, 16, 20),
  lg: scale(16, 20, 24), xl: scale(20, 24, 28) };
const COLORS = { primary: '#000666', primaryLight: '#F0F2FF', background: '#F5F7FA',
  surface: '#fff', text: '#1a1c1c', subtext: '#4A4A5A', muted: '#8A8A9E',
  border: '#E6E8EE', danger: '#D32F2F', dangerLight: '#FFEBEE' };

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIconBox}><Ionicons name={icon} size={16} color={COLORS.primary} /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const Badge = ({ color, label, dot, icon }) => (
  <View style={[styles.badge, { backgroundColor: dot ? `${color}18` : color }]}>
    {dot && <View style={[styles.severityDot, { backgroundColor: color }]} />}
    {icon && <Ionicons name="alert-circle" size={11} color={color} />}
    <Text style={[styles.badgeText, { color: dot ? color : '#fff' }]}>{label}</Text>
  </View>
);

const IncidentDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const incidentId = route?.params?.incidentId;
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const user = auth.currentUser;

  const handleBack = () => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main');

  useEffect(() => {
    if (!incidentId) { Alert.alert('Error', 'No incident ID provided.'); return handleBack(); }
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'incidents', incidentId));
        if (snap.exists()) return setIncident({ id: snap.id, ...snap.data() });
        Alert.alert('Error', 'Incident not found.');
        handleBack();
      } catch (error) {
        console.error('Error fetching incident:', error);
        Alert.alert('Error', 'Failed to load incident details.');
        handleBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [incidentId]);

  const isOwner = user && incident?.reportedBy === user.uid;

  const handleStatusUpdate = async (newStatus) => {
    if (!isOwner || updating) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'incidents', incidentId), { status: newStatus, updatedAt: new Date() });
      setIncident({ ...incident, status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = () => {
    if (!isOwner) return;
    Alert.alert('Delete Incident', 'Are you sure you want to delete this incident? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await deleteDoc(doc(db, 'incidents', incidentId));
          handleBack();
        } catch (error) {
          console.error('Error deleting incident:', error);
          Alert.alert('Error', 'Failed to delete.');
        }
      } },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    </SafeAreaView>
  );

  if (!incident) return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.centered}>
        <View style={styles.errorIconBox}><Ionicons name="alert-circle-outline" size={48} color={COLORS.muted} /></View>
        <Text style={styles.errorTitle}>Incident not found</Text>
        <Text style={styles.errorSubtext}>This incident may have been deleted or is no longer available.</Text>
        <TouchableOpacity style={styles.errorButton} onPress={handleBack}>
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const typeInfo = INCIDENT_TYPES.find((t) => t.id === incident.type);
  const severityInfo = SEVERITY_LEVELS.find((s) => s.id === incident.severity);
  const statusInfo = STATUS_TYPES.find((s) => s.id === incident.status);
  const date = incident.date ? new Date(incident.date)
    : new Date(incident.createdAt?.toDate?.() || Date.now());
  const displayName = incident.reporterName || incident.reportedByEmail || incident.reportedBy || 'Anonymous';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Incident Details</Text>
        {isOwner ? (
          <TouchableOpacity onPress={handleDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
          </TouchableOpacity>
        ) : <View style={styles.headerBtn} />}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { borderLeftColor: typeInfo?.color || COLORS.muted }]}>
          <View style={styles.badgeRow}>
            {typeInfo && <Badge color={typeInfo.color} label={typeInfo.label} icon />}
            {severityInfo && <Badge color={severityInfo.color} label={severityInfo.label} dot />}
            {statusInfo && <Badge color={statusInfo.color} label={statusInfo.label} />}
          </View>
          <Text style={styles.title}>{incident.title || 'Untitled'}</Text>
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="location-outline" label="Location" value={incident.location || 'Unknown'} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="Reported On"
            value={`${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
          <View style={styles.divider} />
          <InfoRow icon="person-outline" label="Reported By" value={displayName} />
        </View>

        {incident.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{incident.description}</Text>
          </View>
        ) : null}

        {isOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <Text style={styles.sectionSubtext}>{updating ? 'Saving...' : 'Tap a status to update'}</Text>
            <View style={styles.statusButtons}>
              {STATUS_TYPES.map((status) => {
                const isActive = incident.status === status.id;
                return (
                  <TouchableOpacity key={status.id}
                    style={[styles.statusButton, isActive && { backgroundColor: status.color, borderColor: status.color }]}
                    onPress={() => handleStatusUpdate(status.id)} disabled={updating || isActive} activeOpacity={0.85}>
                    {isActive && <Ionicons name="checkmark" size={14} color="#fff" style={{ marginRight: 4 }} />}
                    <Text style={[styles.statusButtonText, isActive && { color: '#fff', fontWeight: '700' }]}>{status.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {!isOwner && (
          <View style={styles.footerNote}>
            <Ionicons name="information-circle-outline" size={14} color={COLORS.muted} />
            <Text style={styles.footerNoteText}>Only the reporter can update or delete this incident.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default IncidentDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: scale(16, 18, 20), fontWeight: '700', color: COLORS.primary },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.lg },
  loadingText: { marginTop: 10, color: COLORS.muted, fontSize: scale(12, 13, 14), fontWeight: '500' },
  errorIconBox: { width: scale(80, 90, 100), height: scale(80, 90, 100), borderRadius: scale(20, 22, 24),
    backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  errorTitle: { fontSize: scale(16, 17, 18), fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  errorSubtext: { fontSize: scale(12, 13, 14), color: COLORS.muted, textAlign: 'center', marginBottom: SPACING.lg },
  errorButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: 12 },
  errorButtonText: { color: '#fff', fontWeight: '700', fontSize: scale(13, 14, 15) },

  content: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },

  heroCard: { backgroundColor: '#fff', borderRadius: scale(14, 16, 18), padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, marginBottom: SPACING.md,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, gap: 4 },
  badgeText: { fontSize: scale(10, 11, 12), fontWeight: '700', letterSpacing: 0.3 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  title: { fontSize: scale(20, 22, 24), fontWeight: '800', color: COLORS.text,
    letterSpacing: -0.4, lineHeight: scale(26, 28, 30) },

  infoCard: { backgroundColor: '#fff', borderRadius: scale(14, 16, 18), padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoIconBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm },
  infoLabel: { fontSize: scale(10, 11, 12), color: COLORS.muted, fontWeight: '600',
    letterSpacing: 0.4, textTransform: 'uppercase' },
  infoValue: { fontSize: scale(13, 14, 15), color: COLORS.text, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },

  section: { backgroundColor: '#fff', borderRadius: scale(14, 16, 18), padding: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: SPACING.md,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  sectionTitle: { fontSize: scale(13, 14, 15), fontWeight: '700', color: COLORS.text,
    marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' },
  sectionSubtext: { fontSize: scale(11, 12, 13), color: COLORS.muted, marginBottom: SPACING.sm },
  description: { fontSize: scale(13, 14, 15), color: COLORS.subtext, lineHeight: scale(20, 22, 24) },

  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statusButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 20, borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#fff' },
  statusButtonText: { fontSize: scale(12, 13, 14), fontWeight: '600', color: COLORS.subtext },

  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACING.md },
  footerNoteText: { fontSize: scale(11, 12, 13), color: COLORS.muted, fontStyle: 'italic' },
});
