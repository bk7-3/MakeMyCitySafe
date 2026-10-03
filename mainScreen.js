import React, { useState, useEffect, useLayoutEffect } from 'react';
import { View, SafeAreaView, FlatList, TouchableOpacity, Alert, StyleSheet, Modal, ScrollView, TextInput } from 'react-native';
import { Text, Button, IconButton, Divider, ActivityIndicator } from 'react-native-paper';
import { collection, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';

const COLORS = {
  primary: '#0F172A',
  accent: '#2563EB',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  danger: '#DC2626',
  warning: '#D97706',
  crime: '#7C3AED',
  safe: '#059669',
};

const CATEGORY_ICONS = { cleanup: '🧹', safety: '🧠', neighborhood: '👥', education: '📚', health: '❤️' };

const SUBTYPES = {
  Hazard: { Traffic: 'Traffic-Related', Natural: 'Natural Hazard', Infra: 'Dangerous Infrastructure', Closure: 'Path Closure' },
  Crime: { Violence: 'Violence & Threats', Police: 'Police Activity', Theft: 'Theft / Vandalism' },
  SafeSpace: { BlueLight: 'Emergency Phone', SafeHaven: 'Safe Haven Facility', SecurityPost: 'Security Post' },
};

const TABS = [
  { key: 'Hazard', label: 'Hazards' },
  { key: 'Crime', label: 'Crimes' },
  { key: 'SafeSpace', label: 'Safe Spaces' },
];
const TAB_COLOR = { Hazard: COLORS.textPrimary, Crime: COLORS.crime, SafeSpace: COLORS.safe };

const NAV_BUTTONS = [
  ['Report Hazard', 'Hazard Report'],
  ['Add Suggestion', 'Suggest Add'],
  ['Social', 'socialScreen'],
];

const getSubtypeLabel = (cat, val) => SUBTYPES[cat]?.[val] || val || 'General';
const getStatusLabel = (val) => (val === 'Progress' ? 'In Progress' : val);
const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

const watch = (name, set, map = (d) => d) =>
  onSnapshot(collection(db, name), (snap) =>
    set(snap.docs.map((d) => map({ id: d.id, ...d.data() })))
  );

const confirmAction = (title, message, label, run, errorMsg) =>
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: label, style: 'destructive', onPress: () => run().catch(() => Alert.alert('Error', errorMsg)) },
  ]);

const MainScreen = ({ navigation }) => {
  const [hazards, setHazards] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sosMessages, setSosMessages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);

  const [currentLocation, setCurrentLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [userIsTracking, setUserIsTracking] = useState(true);

  const [name, setName] = useState(null);
  const [studentID, setStudentID] = useState(null);

  const [activeMapTab, setActiveMapTab] = useState('Hazard');

  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => auth.onAuthStateChanged((user) => setStudentID(user?.uid ?? null)), []);

  useEffect(() => {
    if (!studentID) return;
    getDoc(doc(db, 'users', studentID))
      .then((snap) => snap.exists() && setName(snap.data().name))
      .catch((err) => console.error('Error fetching user data:', err));
  }, [studentID]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerContainer}>
          <Text style={styles.welcomeText}>Welcome, {name ?? 'User'}</Text>
        </View>
      ),
      headerRight: () => (
        <IconButton
          size={22}
          onPress={() => navigation.navigate('Help Screen')}
          icon="shield-alert"
          iconColor={COLORS.danger}
        />
      ),
    });
  }, [navigation, name]);

  useEffect(() => {
    let locationSub;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoadingLocation(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation(loc);
        setLoadingLocation(false);

        // Save last known location
        const user = auth.currentUser;
        if (user) {
          setDoc(
            doc(db, 'users', user.uid),
            {
              location: {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
                lastUpdated: new Date().toISOString(),
              },
            },
            { merge: true }
          ).catch((e) => console.error('Failed to update user last location:', e));
        }

        locationSub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 },
          setCurrentLocation
        );
      } catch (e) {
        console.error('Location tracking error:', e);
        setLoadingLocation(false);
      }
    })();

    const unsubs = [
      watch('hazards', setHazards, (h) => ({
        ...h,
        location: { latitude: Number(h.location?.latitude) || 0, longitude: Number(h.location?.longitude) || 0 },
      })),
      watch('alerts', setAlerts, (a) => {
        const date = a.createdDateTime?.toDate?.();
        return {
          ...a,
          createdDateTime: date ? date.toLocaleDateString() : '',
          fullDateTime: date ? date.toLocaleString() : 'Just Now',
        };
      }),
      watch(
        'help_messages',
        (arr) => setSosMessages(arr.filter((s) => s.status === 'active' && s.location?.latitude && s.location?.longitude)),
        (s) => ({
          ...s,
          createdDateTime: s.createdDateTime?.toDate?.()?.toLocaleString() ?? 'Just now',
          location: s.location
            ? { latitude: Number(s.location.latitude), longitude: Number(s.location.longitude) }
            : null,
        })
      ),
      watch('opportunities', setOpportunities),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
      locationSub?.remove();
    };
  }, []);

  const handleCreateAlert = async () => {
    if (!newAlertMessage.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'alerts'), {
        message: newAlertMessage.trim(),
        createdDateTime: serverTimestamp(),
      });
      setNewAlertMessage('');
      setIsAlertModalVisible(false);
    } catch (err) {
      Alert.alert('Error', 'Could not save alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAlert = async () => {
    if (!selectedAlert) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'alerts', selectedAlert.id));
      setIsViewModalVisible(false);
      setSelectedAlert(null);
    } catch (err) {
      Alert.alert('Error', 'Failed to remove alert.');
    } finally {
      setIsDeleting(false);
    }
  };

  const { coords } = currentLocation || {};
  const region =
    userIsTracking && coords
      ? { latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
      : undefined;

  const visiblePins = hazards.filter(
    (h) => (h.category || 'Hazard') === activeMapTab && h.location.latitude && h.location.longitude
  );

  const pin = ({ id, coordinate, pinColor, titleColor, title, subtitle, description, lines, chat, deleteLabel, onDelete }) => (
    <Marker key={id} coordinate={coordinate} pinColor={pinColor}>
      <Callout onPress={() => navigation.navigate('PinChatScreen', chat)}>
        <View style={styles.calloutBox}>
          <Text style={[styles.calloutTitle, { color: titleColor }]}>{title}</Text>
          <Text style={styles.calloutStatus}>{subtitle}</Text>
          <Text numberOfLines={lines} style={styles.calloutDescription}>{description}</Text>
          <Text style={styles.calloutLink}>💬 Join Live Chat Room →</Text>
          <TouchableOpacity onPress={onDelete}>
            <Text style={styles.deleteLink}>{deleteLabel}</Text>
          </TouchableOpacity>
        </View>
      </Callout>
    </Marker>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Broadcast Alerts Card */}
      <View style={styles.alertSection}>
        <View style={styles.alertHeaderRow}>
          <Text style={styles.alertTitle}>Alerts ({alerts.length})</Text>
          <TouchableOpacity onPress={() => setIsAlertModalVisible(true)}>
            <Text style={styles.createAlertLink}>+ New Alert</Text>
          </TouchableOpacity>
        </View>
        <Divider style={styles.divider} />
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.compactAlertItem}
              onPress={() => {
                setSelectedAlert(item);
                setIsViewModalVisible(true);
              }}
            >
              <Text numberOfLines={1} style={styles.alertItemMessage}>{item.message}</Text>
              <Text style={styles.alertItemDate}>{item.createdDateTime}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Volunteer Opportunities Card */}
      <View style={styles.volunteerSection}>
        <View style={styles.alertHeaderRow}>
          <Text style={styles.alertTitle}>Volunteer Opportunities ({opportunities.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('VolunteerDashboard')}>
            <Text style={styles.createAlertLink}>View All →</Text>
          </TouchableOpacity>
        </View>
        <Divider style={styles.divider} />
        {opportunities.length === 0 ? (
          <TouchableOpacity onPress={() => navigation.navigate('VolunteerDashboard')}>
            <Text style={styles.emptyText}>No events currently listed. Tap to view dashboard.</Text>
          </TouchableOpacity>
        ) : (
          <FlatList
            data={opportunities.slice(0, 3)}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.compactOpportunityItem}
                onPress={() => navigation.navigate('VolunteerDashboard')}
              >
                <Text style={{ marginRight: 6 }}>{CATEGORY_ICONS[item.category] || '📌'}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text numberOfLines={1} style={styles.oppTitle}>
                      {item.eventName || 'Volunteer Opportunity'}
                    </Text>
                    {studentID && item.createdBy === studentID && (
                      <View style={styles.ownTag}>
                        <Text style={styles.ownTagText}>Mine</Text>
                      </View>
                    )}
                  </View>
                  <Text numberOfLines={1} style={styles.oppLocation}>
                    📍 {item.destination || 'Campus Area'}
                  </Text>
                </View>
                <Text style={styles.alertItemDate}>{formatDate(item.date)}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, activeMapTab === tab.key && styles.activeTabButton]}
            onPress={() => {
              setActiveMapTab(tab.key);
              setUserIsTracking(true);
            }}
          >
            <Text style={[styles.tabLabel, activeMapTab === tab.key && styles.activeTabLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.mapWrapper}>
        {loadingLocation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator animating size="small" color={COLORS.accent} />
            <Text style={styles.loadingText}>Acquiring location data...</Text>
          </View>
        ) : (
          <>
            {!userIsTracking && (
              <TouchableOpacity style={styles.recenterButton} onPress={() => setUserIsTracking(true)}>
                <Text style={styles.recenterButtonText}>Center Map</Text>
              </TouchableOpacity>
            )}

            <MapView style={styles.map} region={region} onPanDrag={() => setUserIsTracking(false)}>
              {coords && <Marker coordinate={coords} title="Your Location" pinColor={COLORS.accent} />}

              {sosMessages.map((sos) =>
                pin({
                  id: sos.id,
                  coordinate: sos.location,
                  pinColor: COLORS.danger,
                  titleColor: COLORS.danger,
                  title: 'Emergency SOS',
                  subtitle: `Sent: ${sos.createdDateTime}`,
                  description: sos.message,
                  chat: { hazardId: sos.id, hazardTitle: 'Emergency SOS', category: 'SOS' },
                  deleteLabel: 'Resolve & Remove Marker',
                  onDelete: () =>
                    confirmAction(
                      'Clear SOS Marker',
                      'Are you sure you want to resolve and remove this emergency SOS pin?',
                      'Clear SOS',
                      () => updateDoc(doc(db, 'help_messages', sos.id), { status: 'resolved' }),
                      'Could not remove SOS pin.'
                    ),
                })
              )}

              {visiblePins.map((h) => {
                const title = getSubtypeLabel(activeMapTab, h.type);
                return pin({
                  id: h.id,
                  coordinate: h.location,
                  pinColor:
                    activeMapTab === 'Hazard'
                      ? h.status === 'Active' ? COLORS.danger : COLORS.warning
                      : TAB_COLOR[activeMapTab],
                  titleColor: TAB_COLOR[activeMapTab],
                  title,
                  subtitle: `Status: ${getStatusLabel(h.status)}`,
                  description: h.description,
                  lines: 2,
                  chat: { hazardId: h.id, hazardTitle: title, category: activeMapTab },
                  deleteLabel: 'Delete Marker',
                  onDelete: () =>
                    confirmAction(
                      'Remove Pin',
                      'Are you sure you want to delete this marker from the map?',
                      'Delete Pin',
                      () => deleteDoc(doc(db, 'hazards', h.id)),
                      'Could not delete map marker.'
                    ),
                });
              })}
            </MapView>
          </>
        )}
      </View>

      <View style={styles.actionContainer}>
        <Button
          mode="contained"
          buttonColor={COLORS.primary}
          textColor="#FFFFFF"
          style={styles.safetyButton}
          labelStyle={styles.safetyButtonLabel}
          onPress={() => navigation.navigate('EbikeSafetyScreen')}
        >
          E-Bike Safety
        </Button>

        <View style={styles.bottomActionBar}>
          {NAV_BUTTONS.map(([label, route]) => (
            <Button
              key={route}
              mode="outlined"
              onPress={() => navigation.navigate(route)}
              style={styles.actionButton}
              labelStyle={styles.actionButtonLabel}
            >
              {label}
            </Button>
          ))}
        </View>
      </View>

      <Modal visible={isAlertModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Broadcast Alert</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Enter details for the alert broadcast..."
              placeholderTextColor={COLORS.textSecondary}
              value={newAlertMessage}
              onChangeText={setNewAlertMessage}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActionRow}>
              <Button
                mode="text"
                textColor={COLORS.textSecondary}
                onPress={() => { setIsAlertModalVisible(false); setNewAlertMessage(''); }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                buttonColor={COLORS.accent}
                onPress={handleCreateAlert}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Publish
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isViewModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Alert Details</Text>
            <ScrollView style={styles.detailScrollArea}>
              <Text style={styles.detailMessageText}>{selectedAlert?.message}</Text>
              <Text style={styles.detailTimestampText}>Broadcasted: {selectedAlert?.fullDateTime}</Text>
            </ScrollView>
            <View style={styles.modalActionRow}>
              <Button
                mode="text"
                textColor={COLORS.danger}
                onPress={handleDeleteAlert}
                disabled={isDeleting}
                icon="delete-outline"
              >
                Delete
              </Button>
              <Button
                mode="contained"
                buttonColor={COLORS.primary}
                onPress={() => { setIsViewModalVisible(false); setSelectedAlert(null); }}
                disabled={isDeleting}
              >
                Close
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const card = {
  maxHeight: '17%',
  backgroundColor: COLORS.cardBg,
  borderRadius: 10,
  padding: 12,
  borderWidth: 1,
  borderColor: COLORS.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 2,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 14, paddingTop: 8, margin: 10 },
  headerContainer: { flexDirection: 'row', alignItems: 'center' },
  welcomeText: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  alertSection: { ...card, marginBottom: 8 },
  volunteerSection: card,
  alertHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  createAlertLink: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },
  divider: { marginVertical: 6, backgroundColor: COLORS.border },
  compactAlertItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  compactOpportunityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  oppTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  oppLocation: { fontSize: 10, color: COLORS.textSecondary },
  ownTag: { marginLeft: 6, backgroundColor: '#000666', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  ownTagText: { color: '#FFF', fontSize: 8, fontWeight: '700' },
  alertItemMessage: { fontSize: 13, color: COLORS.textPrimary, flex: 1, marginRight: 10 },
  alertItemDate: { fontSize: 11, color: COLORS.textSecondary },
  emptyText: { fontSize: 12, color: COLORS.textSecondary, paddingVertical: 6, fontStyle: 'italic' },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 3,
    marginTop: 10,
    marginBottom: 6,
  },
  tabButton: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 6 },
  activeTabButton: {
    backgroundColor: COLORS.cardBg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 1,
  },
  tabLabel: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary },
  activeTabLabel: { color: COLORS.textPrimary, fontWeight: '700' },
  mapWrapper: {
    width: '100%',
    height: '38%',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 4,
  },
  map: { width: '100%', height: '100%' },
  recenterButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.cardBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    zIndex: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  recenterButtonText: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 12 },
  actionContainer: { marginTop: 8 },
  safetyButton: { borderRadius: 8, marginBottom: 8 },
  safetyButtonLabel: { fontSize: 13, fontWeight: '600', paddingVertical: 2 },
  bottomActionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  actionButton: { flex: 1, borderRadius: 8, borderColor: COLORS.border, backgroundColor: COLORS.cardBg },
  actionButtonLabel: { fontSize: 11, color: COLORS.textPrimary, fontWeight: '600', marginHorizontal: 0 },
  calloutBox: { minWidth: 180, maxWidth: 220, padding: 4 },
  calloutTitle: { fontWeight: '700', fontSize: 13, color: COLORS.textPrimary, marginBottom: 2 },
  calloutStatus: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  calloutDescription: { fontSize: 12, color: COLORS.textPrimary, marginBottom: 6 },
  calloutLink: { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  deleteLink: { fontSize: 11, color: COLORS.danger, fontWeight: '600', marginTop: 6 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.cardBg },
  loadingText: { marginTop: 8, color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalContent: { width: '88%', maxHeight: '70%', backgroundColor: COLORS.cardBg, padding: 20, borderRadius: 12, elevation: 6 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 10 },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    height: 90,
    textAlignVertical: 'top',
    marginVertical: 10,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    fontSize: 14,
  },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  detailScrollArea: { marginVertical: 10, maxHeight: 150 },
  detailMessageText: { fontSize: 14, lineHeight: 20, color: COLORS.textPrimary },
  detailTimestampText: { fontSize: 11, color: COLORS.textSecondary, marginTop: 10, fontStyle: 'italic' },
});

export default MainScreen;
