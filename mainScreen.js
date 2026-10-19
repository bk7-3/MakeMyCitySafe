import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { View, FlatList, TouchableOpacity, Alert, StyleSheet, Modal, ScrollView,
  TextInput, Dimensions, Animated, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import { collection, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc,
  setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const H = Dimensions.get('window').height;
const scale = (s, n, l) => (H < 700 ? s : H > 850 ? l : n);
const SP = { sm: scale(6, 8, 10), md: scale(12, 16, 20), lg: scale(16, 20, 24) };
const MAP_HEIGHT = scale(240, 280, 320);
const DEFAULT_REGION = { latitude: 37.78825, longitude: -122.4324, latitudeDelta: 0.05, longitudeDelta: 0.05 };

const CATEGORIES = {
  Hazard: { label: 'Hazards', base: '#F57C00', icon: 'warning', pin: 'orange',
    subtypes: { Traffic: 'Traffic-Related', Natural: 'Natural Hazard', Infra: 'Dangerous Infrastructure', Closure: 'Path Closure' } },
  Crime: { label: 'Crimes', base: '#D32F2F', icon: 'alert-circle', pin: 'red',
    subtypes: { Violence: 'Violence and Threats', Police: 'Police Activity', Theft: 'Theft / Vandalism' } },
  SafeSpace: { label: 'Safe', base: '#2E7D32', icon: 'shield-checkmark', pin: 'green',
    subtypes: { BlueLight: 'Emergency Blue Light', SafeHaven: 'Safe Haven / Building', SecurityPost: 'Staffed Security Post' } },
};
const OPPORTUNITY_ICONS = { cleanup: 'leaf', safety: 'shield-checkmark', neighborhood: 'people', education: 'school', health: 'heart' };
const HUB_TILES = [
  { label: 'Incidents', icon: 'list', color: '#7C3AED', bg: '#F3E5F5', route: 'Incident List' },
  { label: 'Community', icon: 'bulb', color: '#6A1B9A', bg: '#F3E5F5', route: 'Suggest List' },
  { label: 'Volunteer', icon: 'people', color: '#2E7D32', bg: '#E8F5E9', route: 'VolunteerDashboard' },
  { label: 'E-Bike', icon: 'bicycle', color: '#00838F', bg: '#E0F7FA', route: 'EBikeSafetyScreen' },
  { label: 'Social', icon: 'people-circle', color: '#7C3AED', bg: '#F3E5F5', route: 'socialScreen' },
  { label: 'SOS', icon: 'shield-checkmark', color: '#D32F2F', bg: '#FFEBEE', route: 'Help Screen' },
];
const FAB_ITEMS = [
  { label: 'Report Incident', icon: 'shield-checkmark', color: '#D32F2F', route: 'Report Incident' },
  { label: 'Report Hazard', icon: 'warning', color: '#F57C00', route: 'Hazard Report' },
  { label: 'Add Suggestion', icon: 'bulb', color: '#000666', route: 'Suggest Add' },
];
const BTN_COLORS = { primary: '#000666', secondary: '#F0F2FF', danger: '#D32F2F' };

const getSubtypeLabel = (cat, val) => CATEGORIES[cat]?.subtypes?.[val] || val || 'General';
const statusLabel = (s) => (s === 'Progress' ? 'In-Progress' : s);
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

const normalizeHazard = (d) => {
  const data = d.data();
  return { id: d.id, ...data, category: data.category || 'Hazard', type: data.type || data.hazardType || '',
    description: data.description || data.hazardMessage || data.message || '', status: data.status || 'Unconfirmed',
    location: { latitude: Number(data.location?.latitude) || 0, longitude: Number(data.location?.longitude) || 0 } };
};

const listen = (name, setter, mapDocs) =>
  onSnapshot(collection(db, name), (snap) => setter(mapDocs(snap.docs)),
    (e) => console.error(`${name} subscription error:`, e));

const confirmAction = (title, message, confirmText, action, errorMsg) =>
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: confirmText, style: 'destructive', onPress: async () => {
      try { await action(); } catch (e) { console.error(`${title} failed:`, e); Alert.alert('Error', errorMsg); }
    } },
  ]);

const ModalCard = ({ visible, icon, iconColor, title, children }) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.modalContainer, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name={icon} size={22} color={iconColor} />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const Btn = ({ type = 'secondary', label, icon, onPress, disabled, loading }) => (
  <TouchableOpacity style={[styles.modalButton, { backgroundColor: BTN_COLORS[type] }]} onPress={onPress} disabled={disabled}>
    {loading ? <ActivityIndicator size="small" color="#fff" /> : (
      <>
        {icon && <Ionicons name={icon} size={16} color="#fff" />}
        <Text style={[styles.modalButtonText, type === 'secondary' && { color: '#000666' }]}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

const CardHeader = ({ leading, title, count, color = '#D32F2F', bg = '#FFEBEE', action }) => (
  <View style={styles.cardHeaderRow}>
    <View style={styles.cardTitleRow}>
      {leading}
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={[styles.badge, { backgroundColor: bg }]}><Text style={[styles.badgeText, { color }]}>{count}</Text></View>
    </View>
    {action}
  </View>
);

const MainScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [hazards, setHazards] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sosMessages, setSosMessages] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [userIsTracking, setUserIsTracking] = useState(true);
  const [studentData, setStudentData] = useState(null);
  const [studentID, setStudentID] = useState(null);
  const [activeMapTab, setActiveMapTab] = useState('Hazard');
  const [isAlertModalVisible, setIsAlertModalVisible] = useState(false);
  const [newAlertMessage, setNewAlertMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);

  useLayoutEffect(() => { navigation.setOptions({ headerShown: false }); }, [navigation]);

  useEffect(() => auth.onAuthStateChanged(async (user) => {
    setStudentID(user?.uid ?? null);
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'students', user.uid));
      if (snap.exists()) setStudentData(snap.data());
    } catch (e) { console.error('Error fetching user data:', e); }
  }), []);

  useEffect(() => {
    let sub = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCurrentLocation(loc);
        const user = auth.currentUser;
        if (user) setDoc(doc(db, 'students', user.uid),
          { location: { latitude: loc.coords.latitude, longitude: loc.coords.longitude, lastUpdated: new Date().toISOString() } },
          { merge: true }).catch((e) => console.error('Failed to update user last location:', e));
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 }, setCurrentLocation);
      } catch (e) { console.error('Location tracking error:', e); }
      finally { setLoadingLocation(false); }
    })();
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    const c = currentLocation?.coords;
    if (userIsTracking && c) mapRef.current?.animateCamera({ center: { latitude: c.latitude, longitude: c.longitude } }, { duration: 300 });
  }, [userIsTracking, currentLocation]);

  useEffect(() => {
    const unsubs = [
      listen('hazards', setHazards, (docs) => docs.map(normalizeHazard)),
      listen('alerts', setAlerts, (docs) => docs.map((d) => {
        const data = d.data();
        const date = data.createdDateTime?.toDate?.() ?? null;
        return { id: d.id, ...data, createdDateTime: date ? date.toLocaleDateString() : '',
          fullDateTime: date ? date.toLocaleString() : 'Just Now' };
      })),
      listen('help_messages', setSosMessages, (docs) => docs
        .map((d) => {
          const data = d.data();
          return { id: d.id, ...data,
            createdDateTime: data.createdDateTime?.toDate?.()?.toLocaleString() ?? 'Just now',
            location: data.location ? { latitude: Number(data.location.latitude), longitude: Number(data.location.longitude) } : null };
        })
        .filter((i) => i.status === 'active' && i.location?.latitude && i.location?.longitude)),
      listen('opportunities', setOpportunities, (docs) => docs.map((d) => ({ id: d.id, ...d.data() }))),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const pins = hazards.filter((h) => h.location.latitude && h.location.longitude);
  const pinsFor = (cat) => pins.filter((h) => h.category === cat);
  const initialRegion = currentLocation?.coords
    ? { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : DEFAULT_REGION;
  const initials = (studentData?.name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const fabRotate = fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  const toggleFab = () => {
    Animated.spring(fabAnim, { toValue: fabOpen ? 0 : 1, useNativeDriver: true, friction: 6 }).start();
    setFabOpen(!fabOpen);
  };
  const handleResolveSOS = (id) => confirmAction('Clear SOS Marker',
    'Are you sure you want to resolve and remove this emergency SOS pin?', 'Clear SOS',
    () => updateDoc(doc(db, 'help_messages', id), { status: 'resolved' }), 'Could not remove SOS pin.');
  const handleDeleteHazardPin = (id) => confirmAction('Remove Pin',
    'Are you sure you want to delete this marker from the map?', 'Delete Pin',
    () => deleteDoc(doc(db, 'hazards', id)), 'Could not delete map marker.');
  const closeAlertModal = () => { setIsAlertModalVisible(false); setNewAlertMessage(''); };

  const handleCreateAlert = async () => {
    if (!newAlertMessage.trim()) return Alert.alert('Required', 'Please type an alert message.');
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'alerts'), { message: newAlertMessage.trim(), createdDateTime: serverTimestamp() });
      closeAlertModal();
    } catch { Alert.alert('Error', 'Could not save alert.'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteAlert = async () => {
    if (!selectedAlert) return;
    setIsDeleting(true);
    try { await deleteDoc(doc(db, 'alerts', selectedAlert.id)); setSelectedAlert(null); }
    catch { Alert.alert('Error', 'Failed to remove alert.'); }
    finally { setIsDeleting(false); }
  };

  const renderPin = ({ id, location, pin, color, icon, title, status, description, chat, onDelete, deleteLabel }) => (
    <Marker key={id} coordinate={location} pinColor={pin}>
      <Callout onPress={() => Alert.alert(title, 'What would you like to do?', [
        { text: 'Join Live Chat', onPress: () => navigation.navigate('PinChatScreen', chat) },
        { text: deleteLabel, style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ])}>
        <View style={styles.calloutBox}>
          <View style={styles.calloutHeader}>
            {icon && <Ionicons name={icon} size={16} color={color} />}
            <Text style={[styles.calloutTitle, { color }]}>{title}</Text>
          </View>
          <Text style={styles.calloutStatus}>{status}</Text>
          <Text numberOfLines={2} style={styles.calloutDescription}>{description}</Text>
          <Text style={styles.calloutLink}>Tap for options →</Text>
        </View>
      </Callout>
    </Marker>
  );

  const renderHazardPin = (item) => {
    const cfg = CATEGORIES[item.category];
    const title = getSubtypeLabel(item.category, item.type);
    return renderPin({ id: item.id, location: item.location, pin: cfg.pin, color: cfg.base, icon: cfg.icon, title,
      status: `Status: ${statusLabel(item.status)}`, description: item.description,
      chat: { hazardId: item.id, hazardTitle: title, category: item.category },
      onDelete: () => handleDeleteHazardPin(item.id), deleteLabel: 'Delete Pin' });
  };

  const renderSosPin = (sos) => renderPin({ id: sos.id, location: sos.location, pin: 'red', color: '#D32F2F',
    title: 'EMERGENCY SOS', status: `Sent: ${sos.createdDateTime}`, description: sos.message,
    chat: { hazardId: sos.id, hazardTitle: 'Emergency SOS', category: 'SOS' },
    onDelete: () => handleResolveSOS(sos.id), deleteLabel: 'Resolve & Remove Pin' });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 + SP.md }}
        keyboardShouldPersistTaps="handled" nestedScrollEnabled>

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}><Text style={styles.avatarLabel}>{initials}</Text></View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greetingText}>Welcome back</Text>
              <Text style={styles.userName} numberOfLines={1}>{studentData?.name ?? 'User'}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.emergencyButton} onPress={() => navigation.navigate('Help Screen')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <CardHeader leading={<View style={styles.alertDot} />} title="Live Alerts" count={alerts.length}
            action={
              <TouchableOpacity style={styles.pillButton} onPress={() => setIsAlertModalVisible(true)}>
                <Ionicons name="add" size={14} color="#000666" />
                <Text style={styles.pillButtonText}>New</Text>
              </TouchableOpacity>
            } />
          {alerts.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="notifications-off-outline" size={20} color="#999" />
              <Text style={styles.emptyText}>No alerts at this time</Text>
            </View>
          ) : (
            <FlatList data={alerts.slice(0, 5)} keyExtractor={(item) => item.id} horizontal
              showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.alertChip} onPress={() => setSelectedAlert(item)}>
                  <View style={styles.alertChipHeader}>
                    <Ionicons name="warning" size={12} color="#F57C00" />
                    <Text style={styles.alertChipDate}>{item.createdDateTime || 'Just now'}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.alertChipText}>{item.message}</Text>
                </TouchableOpacity>
              )} />
          )}
        </View>

        {opportunities.length > 0 && (
          <View style={styles.card}>
            <CardHeader leading={<Ionicons name="people" size={16} color="#2E7D32" style={{ marginRight: 6 }} />}
              title="Volunteer" count={opportunities.length} color="#2E7D32" bg="#E8F5E9"
              action={
                <TouchableOpacity style={styles.pillButton} onPress={() => navigation.navigate('VolunteerDashboard')}>
                  <Text style={styles.pillButtonText}>View All</Text>
                  <Ionicons name="chevron-forward" size={12} color="#000666" />
                </TouchableOpacity>
              } />
            {opportunities.slice(0, 2).map((item) => (
              <TouchableOpacity key={item.id} style={styles.opportunityRow}
                onPress={() => navigation.navigate('VolunteerDashboard')}>
                <View style={styles.oppIconBox}>
                  <Ionicons name={OPPORTUNITY_ICONS[item.category] || 'pricetag'} size={16} color="#2E7D32" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.oppTitleRow}>
                    <Text numberOfLines={1} style={styles.oppTitle}>{item.eventName || 'Volunteer Opportunity'}</Text>
                    {studentID && item.createdBy === studentID && (
                      <View style={styles.ownTag}><Text style={styles.ownTagText}>Mine</Text></View>
                    )}
                  </View>
                  <View style={styles.oppMetaRow}>
                    <Ionicons name="location-outline" size={11} color="#8A8A9E" />
                    <Text numberOfLines={1} style={styles.oppMeta}>{item.destination || 'Campus Area'}</Text>
                  </View>
                </View>
                <Text style={styles.oppDate}>{formatDate(item.date)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.segmentedControl}>
          {Object.entries(CATEGORIES).map(([key, cfg]) => {
            const active = activeMapTab === key;
            const count = pinsFor(key).length;
            return (
              <TouchableOpacity key={key} style={[styles.segmentButton, active && styles.segmentButtonActive]}
                onPress={() => { setActiveMapTab(key); setUserIsTracking(true); }}>
                <Ionicons name={cfg.icon} size={13} color={active ? cfg.base : '#666'} />
                <Text style={[styles.segmentLabel, active && { color: cfg.base, fontWeight: '700' }]} numberOfLines={1}>
                  {cfg.label}
                </Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, active && { backgroundColor: cfg.base }]}>
                    <Text style={[styles.tabBadgeText, active && { color: '#fff' }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.mapSection}>
          {loadingLocation ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#000666" />
              <Text style={styles.loadingText}>Finding your location...</Text>
            </View>
          ) : (
            <>
              {!userIsTracking && (
                <TouchableOpacity style={styles.recenterButton} onPress={() => setUserIsTracking(true)}>
                  <Ionicons name="locate" size={14} color="#000666" />
                  <Text style={styles.recenterButtonText}>Recenter</Text>
                </TouchableOpacity>
              )}
              <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion} mapType="standard"
                onPanDrag={() => setUserIsTracking(false)}
                onRegionChangeComplete={(_, d) => d?.isGesture && setUserIsTracking(false)}>
                {currentLocation?.coords && (
                  <Marker coordinate={currentLocation.coords} title="Your Location">
                    <View style={styles.userMarker}><View style={styles.userMarkerInner} /></View>
                  </Marker>
                )}
                {sosMessages.map(renderSosPin)}
                {pinsFor(activeMapTab).map(renderHazardPin)}
              </MapView>
            </>
          )}
        </View>

        <View style={styles.hubSection}>
          <Text style={styles.hubTitle}>Quick Access</Text>
          <View style={styles.hubGrid}>
            {HUB_TILES.map((tile) => (
              <TouchableOpacity key={tile.label} style={styles.hubCard}
                onPress={() => navigation.navigate(tile.route)} activeOpacity={0.7}>
                <View style={[styles.hubIcon, { backgroundColor: tile.bg }]}>
                  <Ionicons name={tile.icon} size={22} color={tile.color} />
                </View>
                <Text style={styles.hubLabel}>{tile.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Animated.View style={[styles.fabContainer, { bottom: insets.bottom + SP.md, transform: [{ rotate: fabRotate }] }]}>
        <TouchableOpacity style={styles.fab} onPress={toggleFab}>
          <Ionicons name={fabOpen ? 'close' : 'add'} size={26} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {fabOpen && (
        <View style={[styles.fabMenu, { bottom: insets.bottom + SP.md + 70 }]}>
          {FAB_ITEMS.map((item) => (
            <TouchableOpacity key={item.label} style={styles.fabMenuItem}
              onPress={() => { toggleFab(); navigation.navigate(item.route); }}>
              <Text style={styles.fabMenuLabel}>{item.label}</Text>
              <View style={[styles.fabMenuIcon, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon} size={18} color="#fff" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ModalCard visible={isAlertModalVisible} icon="notifications" iconColor="#000666" title="Create Alert">
        <TextInput style={styles.textInput} placeholder="Type your alert message..." placeholderTextColor="#999"
          value={newAlertMessage} onChangeText={setNewAlertMessage} multiline numberOfLines={4} />
        <View style={styles.modalActionRow}>
          <Btn label="Cancel" onPress={closeAlertModal} disabled={isSubmitting} />
          <Btn type="primary" label="Post Alert" onPress={handleCreateAlert} disabled={isSubmitting} loading={isSubmitting} />
        </View>
      </ModalCard>

      <ModalCard visible={!!selectedAlert} icon="warning" iconColor="#F57C00" title="Alert Details">
        <ScrollView style={styles.detailScrollArea}>
          <Text style={styles.detailMessageText}>{selectedAlert?.message}</Text>
          <Text style={styles.detailTimestampText}>Posted: {selectedAlert?.fullDateTime}</Text>
        </ScrollView>
        <View style={styles.modalActionRow}>
          <Btn type="danger" icon="trash" label="Remove" onPress={handleDeleteAlert} disabled={isDeleting} loading={isDeleting} />
          <Btn label="Close" onPress={() => setSelectedAlert(null)} disabled={isDeleting} />
        </View>
      </ModalCard>
    </SafeAreaView>
  );
};

export default MainScreen;

const row = { flexDirection: 'row', alignItems: 'center' };
const center = { justifyContent: 'center', alignItems: 'center' };
const shadow = (opacity, radius, elevation, y = 2) => ({
  shadowColor: '#000', shadowOffset: { width: 0, height: y }, shadowOpacity: opacity, shadowRadius: radius, elevation });
const circle = (a, b, c) => { const s = scale(a, b, c); return { width: s, height: s, borderRadius: s / 2, ...center }; };
const txt = (sizes, color, fontWeight) => ({ fontSize: scale(...sizes), color, fontWeight });

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  header: { ...row, justifyContent: 'space-between', paddingHorizontal: SP.md, paddingVertical: SP.sm },
  headerLeft: { ...row, flex: 1, marginRight: SP.sm },
  headerTextContainer: { marginLeft: SP.sm, flex: 1 },
  avatar: { ...circle(38, 42, 46), backgroundColor: '#000666' },
  avatarLabel: txt([14, 15, 16], '#fff', '700'),
  greetingText: txt([11, 12, 13], '#666', '500'),
  userName: txt([15, 17, 19], '#1a1c1c', '700'),
  emergencyButton: { ...circle(38, 42, 46), ...shadow(0.3, 4, 4), backgroundColor: '#D32F2F', shadowColor: '#D32F2F' },

  card: { ...shadow(0.04, 8, 2), marginHorizontal: SP.md, marginTop: SP.sm, backgroundColor: '#fff', borderRadius: 16, padding: SP.md },
  cardHeaderRow: { ...row, justifyContent: 'space-between', marginBottom: SP.sm },
  cardTitleRow: { ...row, flex: 1 },
  cardTitle: txt([13, 14, 15], '#1a1c1c', '700'),
  alertDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#D32F2F', marginRight: 8 },
  badge: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 8, marginLeft: 8 },
  badgeText: txt([10, 11, 12], undefined, '700'),
  pillButton: { ...row, backgroundColor: '#F0F2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 3 },
  pillButtonText: txt([11, 12, 13], '#000666', '600'),
  emptyRow: { ...row, justifyContent: 'center', paddingVertical: SP.sm, gap: 6 },
  emptyText: txt([12, 13, 14], '#999'),

  alertChip: { width: scale(170, 200, 220), backgroundColor: '#FFF9F0', borderRadius: 12, padding: SP.sm,
    marginRight: SP.sm, borderLeftWidth: 3, borderLeftColor: '#F57C00' },
  alertChipHeader: { ...row, justifyContent: 'space-between', marginBottom: 4 },
  alertChipText: { ...txt([12, 13, 14], '#333'), lineHeight: scale(16, 18, 20) },
  alertChipDate: txt([9, 10, 11], '#999'),

  opportunityRow: { ...row, paddingVertical: SP.sm, borderTopWidth: 1, borderTopColor: '#F0F2FF', gap: SP.sm },
  oppIconBox: { ...center, width: scale(32, 36, 40), height: scale(32, 36, 40), borderRadius: scale(10, 12, 14), backgroundColor: '#E8F5E9' },
  oppTitleRow: { ...row, gap: 6 },
  oppTitle: { ...txt([12, 13, 14], '#1a1c1c', '700'), flexShrink: 1 },
  oppMetaRow: { ...row, gap: 3, marginTop: 2 },
  oppMeta: { ...txt([10, 11, 12], '#8A8A9E'), flexShrink: 1 },
  oppDate: txt([10, 11, 12], '#8A8A9E', '600'),
  ownTag: { backgroundColor: '#000666', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  ownTagText: txt([8, 9, 10], '#fff', '700'),

  segmentedControl: { flexDirection: 'row', backgroundColor: '#E8EEF5', padding: 4, borderRadius: 12,
    marginHorizontal: SP.md, marginTop: SP.sm },
  segmentButton: { ...row, flex: 1, justifyContent: 'center', paddingVertical: scale(6, 8, 10), paddingHorizontal: 2, borderRadius: 8, gap: 3 },
  segmentButtonActive: { ...shadow(0.08, 2, 2, 1), backgroundColor: '#fff' },
  segmentLabel: txt([10, 11, 12], '#666', '500'),
  tabBadge: { ...center, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#E0E0E0', marginLeft: 2 },
  tabBadgeText: { fontSize: 9, fontWeight: '700', color: '#666' },

  mapSection: { ...shadow(0.06, 8, 3), height: MAP_HEIGHT, marginHorizontal: SP.md, marginTop: SP.sm,
    borderRadius: 16, overflow: 'hidden', backgroundColor: '#E8EEF5' },
  map: { width: '100%', height: '100%' },
  loadingContainer: { ...center, flex: 1 },
  loadingText: { ...txt([12, 13, 14], '#666', '500'), marginTop: 10 },
  userMarker: { ...center, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0, 102, 102, 0.2)' },
  userMarkerInner: { width: 13, height: 13, borderRadius: 6.5, backgroundColor: '#000666', borderWidth: 2, borderColor: '#fff' },
  recenterButton: { ...row, ...shadow(0.15, 4, 4), position: 'absolute', top: 10, right: 10, zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', paddingVertical: 5, paddingHorizontal: 9, borderRadius: 18 },
  recenterButtonText: { ...txt([11, 12, 13], '#000666', '600'), marginLeft: 3 },

  calloutBox: { minWidth: 170, maxWidth: 230, padding: 8 },
  calloutHeader: { ...row, marginBottom: 4 },
  calloutTitle: { ...txt([12, 13, 14], undefined, 'bold'), marginLeft: 6 },
  calloutStatus: { ...txt([10, 11, 12], '#666'), fontStyle: 'italic', marginBottom: 4 },
  calloutDescription: { ...txt([11, 12, 13], '#333'), marginBottom: 5 },
  calloutLink: { ...txt([11, 12, 13], '#007AFF', 'bold'), marginTop: 2 },

  hubSection: { marginTop: SP.md, paddingHorizontal: SP.md },
  hubTitle: { ...txt([12, 13, 14], '#000666', '700'), marginBottom: SP.sm, letterSpacing: 0.4, textTransform: 'uppercase' },
  hubGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  hubCard: { ...shadow(0.04, 4, 1, 1), width: '31.5%', backgroundColor: '#fff', borderRadius: 14,
    paddingVertical: SP.sm, paddingHorizontal: 4, alignItems: 'center', marginBottom: SP.sm },
  hubIcon: { ...center, width: scale(38, 42, 46), height: scale(38, 42, 46), borderRadius: scale(12, 14, 16), marginBottom: 5 },
  hubLabel: { ...txt([10, 11, 12], '#1a1c1c', '700'), textAlign: 'center' },

  fabContainer: { position: 'absolute', right: SP.md, zIndex: 100 },
  fab: { ...circle(52, 56, 60), ...shadow(0.3, 8, 6, 4), backgroundColor: '#000666', shadowColor: '#000666' },
  fabMenu: { position: 'absolute', right: SP.md, zIndex: 99, alignItems: 'flex-end' },
  fabMenuItem: { ...row, justifyContent: 'flex-end', marginBottom: SP.sm },
  fabMenuIcon: { ...circle(40, 44, 48), ...shadow(0.2, 4, 4) },
  fabMenuLabel: { ...txt([11, 12, 13], '#1a1c1c', '600'), backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 10, elevation: 2 },

  modalContainer: { ...center, flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', paddingHorizontal: SP.lg },
  modalContent: { width: '100%', maxWidth: 480, maxHeight: '80%', backgroundColor: '#fff', padding: SP.lg, borderRadius: 20, elevation: 8 },
  modalHeader: { ...row, marginBottom: SP.md },
  modalTitle: { ...txt([16, 18, 20], '#1a1c1c', '700'), marginLeft: 8 },
  textInput: { ...txt([14, 15, 16], '#000'), borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, padding: 14,
    minHeight: scale(80, 100, 110), textAlignVertical: 'top', marginBottom: SP.md, backgroundColor: '#F9F9F9' },
  detailScrollArea: { maxHeight: 220, marginBottom: SP.md },
  detailMessageText: { ...txt([14, 15, 16], '#222'), lineHeight: scale(20, 22, 24) },
  detailTimestampText: { ...txt([11, 12, 13], '#999'), marginTop: 10, fontStyle: 'italic' },
  modalActionRow: { flexDirection: 'row', gap: 10 },
  modalButton: { ...row, justifyContent: 'center', flex: 1, height: scale(44, 48, 52), borderRadius: 12, gap: 6 },
  modalButtonText: txt([13, 14, 15], '#fff', '600'),
});
