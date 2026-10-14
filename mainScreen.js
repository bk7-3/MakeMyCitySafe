import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, ActivityIndicator } from 'react-native-paper';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_H } = Dimensions.get('window');
const isSmallDevice = SCREEN_H < 700;
const isLargeDevice = SCREEN_H > 850;

const scale = (small, normal, large) => {
  if (isSmallDevice) return small;
  if (isLargeDevice) return large;
  return normal;
};

const SPACING = {
  xs: scale(4, 6, 8),
  sm: scale(6, 8, 10),
  md: scale(12, 16, 20),
  lg: scale(16, 20, 24),
  xl: scale(20, 24, 30),
};

const MAP_HEIGHT = scale(240, 280, 320);

const DEFAULT_REGION = {
  latitude: 37.78825,
  longitude: -122.4324,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const CATEGORY_CONFIG = {
  Hazard: {
    base: '#F57C00',
    light: '#FFF3E0',
    icon: 'warning',
    pin: 'orange',
    subtypes: {
      Traffic: 'Traffic-Related',
      Natural: 'Natural Hazard',
      Infra: 'Dangerous Infrastructure',
      Closure: 'Path Closure',
    },
  },
  Crime: {
    base: '#D32F2F',
    light: '#FFEBEE',
    icon: 'alert-circle',
    pin: 'red',
    subtypes: {
      Violence: 'Violence and Threats',
      Police: 'Police Activity',
      Theft: 'Theft / Vandalism',
    },
  },
  SafeSpace: {
    base: '#2E7D32',
    light: '#E8F5E9',
    icon: 'shield-checkmark',
    pin: 'green',
    subtypes: {
      BlueLight: 'Emergency Blue Light',
      SafeHaven: 'Safe Haven / Building',
      SecurityPost: 'Staffed Security Post',
    },
  },
};

const OPPORTUNITY_ICONS = {
  cleanup: 'leaf',
  safety: 'shield-checkmark',
  neighborhood: 'people',
  education: 'school',
  health: 'heart',
};

const getCategoryConfig = (cat) =>
  CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.Hazard;

const getSubtypeLabel = (cat, val) => {
  return CATEGORY_CONFIG[cat]?.subtypes?.[val] || val || 'General';
};

const getStatusLabel = (val) => {
  const statuses = {
    Unconfirmed: 'Unconfirmed',
    Potential: 'Potential',
    Active: 'Active',
    Progress: 'In-Progress',
    Resolved: 'Resolved',
  };
  return statuses[val] || val;
};

const formatDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : '';

const normalizeHazard = (doc) => {
  const data = doc.data();
  const category = data.category || 'Hazard';
  const type = data.type || data.hazardType || '';
  const description =
    data.description || data.hazardMessage || data.message || '';
  const status = data.status || 'Unconfirmed';
  const imageUri = data.imaguri || data.imageUri || '';
  const location = {
    latitude: Number(data.location?.latitude) || 0,
    longitude: Number(data.location?.longitude) || 0,
  };

  let reportDateTime = 'N/A';
  if (data.reportDateTime?.toDate) {
    reportDateTime = data.reportDateTime.toDate().toLocaleString();
  } else if (data.reportDateTime) {
    reportDateTime = String(data.reportDateTime);
  } else if (data.createdDateTime?.toDate) {
    reportDateTime = data.createdDateTime.toDate().toLocaleString();
  }

  return {
    id: doc.id,
    ...data,
    category,
    type,
    description,
    status,
    imageUri,
    reportDateTime,
    location,
  };
};

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
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  const mappedHazards = hazards.filter(
    (h) =>
      h.category === 'Hazard' &&
      h.location?.latitude &&
      h.location?.longitude
  );
  const mappedCrimes = hazards.filter(
    (h) =>
      h.category === 'Crime' &&
      h.location?.latitude &&
      h.location?.longitude
  );
  const mappedSafeSpaces = hazards.filter(
    (h) =>
      h.category === 'SafeSpace' &&
      h.location?.latitude &&
      h.location?.longitude
  );

  const tabCounts = {
    Hazard: mappedHazards.length,
    Crime: mappedCrimes.length,
    SafeSpace: mappedSafeSpaces.length,
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setStudentID(user?.uid ?? null);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!studentID) return;
    const fetchStudentData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', studentID));
        if (userDoc.exists()) {
          setStudentData(userDoc.data());
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    };
    fetchStudentData();
  }, [studentID]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    let locationSubscriber = null;

    const startLocationTracking = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLoadingLocation(false);
          return;
        }

        let initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation(initialLoc);
        setLoadingLocation(false);

        const user = auth.currentUser;
        if (user) {
          setDoc(
            doc(db, 'users', user.uid),
            {
              location: {
                latitude: initialLoc.coords.latitude,
                longitude: initialLoc.coords.longitude,
                lastUpdated: new Date().toISOString(),
              },
            },
            { merge: true }
          ).catch((e) =>
            console.error('Failed to update user last location:', e)
          );
        }

        locationSubscriber = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 2,
            timeInterval: 2000,
          },
          (newLocation) => setCurrentLocation(newLocation)
        );
      } catch (e) {
        console.error('Location tracking error:', e);
        setLoadingLocation(false);
      }
    };

    const unsubHazards = onSnapshot(
      collection(db, 'hazards'),
      (snap) => {
        const arr = snap.docs.map(normalizeHazard);
        setHazards(arr);
      },
      (error) => console.error('Hazards subscription error:', error)
    );

    const unsubAlerts = onSnapshot(
      collection(db, 'alerts'),
      (snap) => {
        const arr = snap.docs.map((d) => {
          const data = d.data();
          const rawDate = data.createdDateTime?.toDate?.() ?? null;
          return {
            id: d.id,
            ...data,
            createdDateTime: rawDate ? rawDate.toLocaleDateString() : '',
            fullDateTime: rawDate ? rawDate.toLocaleString() : 'Just Now',
          };
        });
        setAlerts(arr);
      },
      (error) => console.error('Alerts subscription error:', error)
    );

    const unsubSOS = onSnapshot(
      collection(db, 'help_messages'),
      (snap) => {
        const arr = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              createdDateTime:
                data.createdDateTime?.toDate?.()?.toLocaleString() ??
                'Just now',
              location: data.location
                ? {
                    latitude: Number(data.location.latitude),
                    longitude: Number(data.location.longitude),
                  }
                : null,
            };
          })
          .filter(
            (item) =>
              item.status === 'active' &&
              item.location?.latitude &&
              item.location?.longitude
          );

        setSosMessages(arr);
      },
      (error) => console.error('SOS subscription error:', error)
    );

    const unsubOpportunities = onSnapshot(
      collection(db, 'opportunities'),
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOpportunities(arr);
      },
      (error) => console.error('Opportunities subscription error:', error)
    );

    startLocationTracking();

    return () => {
      unsubHazards();
      unsubAlerts();
      unsubSOS();
      unsubOpportunities();
      if (locationSubscriber) locationSubscriber.remove();
    };
  }, []);

  const toggleFab = () => {
    const toValue = fabOpen ? 0 : 1;
    Animated.spring(fabAnim, {
      toValue,
      useNativeDriver: true,
      friction: 6,
    }).start();
    setFabOpen(!fabOpen);
  };

  const fabRotate = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const handleResolveSOS = (sosId) => {
    Alert.alert(
      'Clear SOS Marker',
      'Are you sure you want to resolve and remove this emergency SOS pin?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear SOS',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'help_messages', sosId), {
                status: 'resolved',
              });
            } catch (err) {
              Alert.alert('Error', 'Could not remove SOS pin.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteHazardPin = (hazardId) => {
    Alert.alert(
      'Remove Pin',
      'Are you sure you want to delete this marker from the map?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Pin',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'hazards', hazardId));
            } catch (err) {
              Alert.alert('Error', 'Could not delete map marker.');
            }
          },
        },
      ]
    );
  };

  const handleCreateAlert = async () => {
    if (!newAlertMessage.trim()) {
      Alert.alert('Required', 'Please type an alert message.');
      return;
    }
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

  const getMapRegion = () => {
    if (userIsTracking && currentLocation?.coords) {
      return {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return DEFAULT_REGION;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMarker = (item, category) => {
    const config = getCategoryConfig(category);
    return (
      <Marker
        key={item.id}
        coordinate={item.location}
        pinColor={config.pin}
      >
        <Callout
          onPress={() =>
            navigation.navigate('PinChatScreen', {
              hazardId: item.id,
              hazardTitle: getSubtypeLabel(category, item.type),
              category,
            })
          }
        >
          <View style={styles.calloutBox}>
            <View style={styles.calloutHeader}>
              <Ionicons name={config.icon} size={16} color={config.base} />
              <Text style={[styles.calloutTitle, { color: config.base }]}>
                {getSubtypeLabel(category, item.type)}
              </Text>
            </View>
            <Text style={styles.calloutStatus}>
              Status: {getStatusLabel(item.status)}
            </Text>
            <Text numberOfLines={2} style={styles.calloutDescription}>
              {item.description}
            </Text>
            <Text style={styles.calloutLink}>Join Live Chat →</Text>
            <TouchableOpacity
              onPress={() => handleDeleteHazardPin(item.id)}
              style={styles.calloutDeleteBtn}
            >
              <Ionicons name="trash" size={12} color="#D32F2F" />
              <Text style={styles.deleteLink}>Delete Pin</Text>
            </TouchableOpacity>
          </View>
        </Callout>
      </Marker>
    );
  };

  const MAP_TABS = [
    {
      key: 'Hazard',
      label: 'Hazards',
      icon: CATEGORY_CONFIG.Hazard.icon,
      color: CATEGORY_CONFIG.Hazard.base,
    },
    {
      key: 'Crime',
      label: 'Crimes',
      icon: CATEGORY_CONFIG.Crime.icon,
      color: CATEGORY_CONFIG.Crime.base,
    },
    {
      key: 'SafeSpace',
      label: 'Safe',
      icon: CATEGORY_CONFIG.SafeSpace.icon,
      color: CATEGORY_CONFIG.SafeSpace.base,
    },
  ];

  const HUB_TILES = [
    { key: 'incidents', label: 'Incidents', icon: 'list', color: '#7C3AED', bg: '#F3E5F5', route: 'Incident List' },
    { key: 'suggest', label: 'Community', icon: 'bulb', color: '#6A1B9A', bg: '#F3E5F5', route: 'Suggest List' },
    { key: 'volunteer', label: 'Volunteer', icon: 'people', color: '#2E7D32', bg: '#E8F5E9', route: 'VolunteerDashboard' },
    { key: 'ebike', label: 'E-Bike', icon: 'bicycle', color: '#00838F', bg: '#E0F7FA', route: 'E-Bike Safety' },
    { key: 'social', label: 'Social', icon: 'people-circle', color: '#7C3AED', bg: '#F3E5F5', route: 'socialScreen' },
    { key: 'sos', label: 'SOS', icon: 'shield-checkmark', color: '#D32F2F', bg: '#FFEBEE', route: 'Help Screen' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7FA" />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>
                {getInitials(studentData?.name)}
              </Text>
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.greetingText}>Welcome back</Text>
              <Text style={styles.userName} numberOfLines={1}>
                {studentData?.name ?? 'User'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.emergencyButton}
            onPress={() => navigation.navigate('Help Screen')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.alertsCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleRow}>
              <View style={styles.alertDot} />
              <Text style={styles.cardTitle}>Live Alerts</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{alerts.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.pillButton}
              onPress={() => setIsAlertModalVisible(true)}
            >
              <Ionicons name="add" size={14} color="#000666" />
              <Text style={styles.pillButtonText}>New</Text>
            </TouchableOpacity>
          </View>

          {alerts.length === 0 ? (
            <View style={styles.emptyRow}>
              <Ionicons name="notifications-off-outline" size={20} color="#999" />
              <Text style={styles.emptyText}>No alerts at this time</Text>
            </View>
          ) : (
            <FlatList
              data={alerts.slice(0, 5)}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.alertsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.alertChip}
                  onPress={() => {
                    setSelectedAlert(item);
                    setIsViewModalVisible(true);
                  }}
                >
                  <View style={styles.alertChipHeader}>
                    <Ionicons name="warning" size={12} color="#F57C00" />
                    <Text style={styles.alertChipDate}>
                      {item.createdDateTime || 'Just now'}
                    </Text>
                  </View>
                  <Text numberOfLines={2} style={styles.alertChipText}>
                    {item.message}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {opportunities.length > 0 && (
          <View style={styles.volunteerCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="people" size={16} color="#2E7D32" />
                <Text style={[styles.cardTitle, { marginLeft: 6 }]}>
                  Volunteer
                </Text>
                <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                  <Text style={[styles.badgeText, { color: '#2E7D32' }]}>
                    {opportunities.length}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.pillButton}
                onPress={() => navigation.navigate('VolunteerDashboard')}
              >
                <Text style={styles.pillButtonText}>View All</Text>
                <Ionicons name="chevron-forward" size={12} color="#000666" />
              </TouchableOpacity>
            </View>

            {opportunities.slice(0, 2).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.opportunityRow}
                onPress={() => navigation.navigate('VolunteerDashboard')}
              >
                <View style={[styles.oppIconBox, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons
                    name={OPPORTUNITY_ICONS[item.category] || 'pricetag'}
                    size={16}
                    color="#2E7D32"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.oppTitleRow}>
                    <Text numberOfLines={1} style={styles.oppTitle}>
                      {item.eventName || 'Volunteer Opportunity'}
                    </Text>
                    {studentID && item.createdBy === studentID && (
                      <View style={styles.ownTag}>
                        <Text style={styles.ownTagText}>Mine</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.oppMetaRow}>
                    <Ionicons name="location-outline" size={11} color="#8A8A9E" />
                    <Text numberOfLines={1} style={styles.oppMeta}>
                      {item.destination || 'Campus Area'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.oppDate}>{formatDate(item.date)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.segmentedControl}>
          {MAP_TABS.map((tab) => {
            const isActive = activeMapTab === tab.key;
            const count = tabCounts[tab.key] || 0;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.segmentButton,
                  isActive && styles.segmentButtonActive,
                ]}
                onPress={() => {
                  setActiveMapTab(tab.key);
                  setUserIsTracking(true);
                }}
              >
                <Ionicons
                  name={tab.icon}
                  size={13}
                  color={isActive ? tab.color : '#666'}
                />
                <Text
                  style={[
                    styles.segmentLabel,
                    isActive && { color: tab.color, fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.tabBadge,
                      isActive && { backgroundColor: tab.color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabBadgeText,
                        isActive && { color: '#fff' },
                      ]}
                    >
                      {count}
                    </Text>
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
                <TouchableOpacity
                  style={styles.recenterButton}
                  onPress={() => setUserIsTracking(true)}
                >
                  <Ionicons name="locate" size={14} color="#000666" />
                  <Text style={styles.recenterButtonText}>Recenter</Text>
                </TouchableOpacity>
              )}

              <MapView
                style={styles.map}
                region={getMapRegion()}
                onPanDrag={() => setUserIsTracking(false)}
                mapType="standard"
              >
                {currentLocation?.coords && (
                  <Marker
                    coordinate={currentLocation.coords}
                    title="Your Location"
                  >
                    <View style={styles.userMarker}>
                      <View style={styles.userMarkerInner} />
                    </View>
                  </Marker>
                )}

                {sosMessages.map((sos) => (
                  <Marker key={sos.id} coordinate={sos.location} pinColor="red">
                    <Callout
                      onPress={() =>
                        navigation.navigate('PinChatScreen', {
                          hazardId: sos.id,
                          hazardTitle: 'Emergency SOS',
                          category: 'SOS',
                        })
                      }
                    >
                      <View style={styles.calloutBox}>
                        <Text style={[styles.calloutTitle, { color: '#D32F2F' }]}>
                          EMERGENCY SOS
                        </Text>
                        <Text style={styles.calloutStatus}>
                          Sent: {sos.createdDateTime}
                        </Text>
                        <Text style={styles.calloutDescription}>
                          {sos.message}
                        </Text>
                        <Text style={styles.calloutLink}>Join Live Chat →</Text>
                        <TouchableOpacity
                          onPress={() => handleResolveSOS(sos.id)}
                        >
                          <Text style={styles.deleteLink}>
                            Resolve & Remove Pin
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </Callout>
                  </Marker>
                ))}

                {activeMapTab === 'Hazard' &&
                  mappedHazards.map((h) => renderMarker(h, 'Hazard'))}

                {activeMapTab === 'Crime' &&
                  mappedCrimes.map((c) => renderMarker(c, 'Crime'))}

                {activeMapTab === 'SafeSpace' &&
                  mappedSafeSpaces.map((s) => renderMarker(s, 'SafeSpace'))}
              </MapView>
            </>
          )}
        </View>

        <View style={styles.hubSection}>
          <Text style={styles.hubTitle}>Quick Access</Text>
          <View style={styles.hubGrid}>
            {HUB_TILES.map((tile) => (
              <TouchableOpacity
                key={tile.key}
                style={styles.hubCard}
                onPress={() => navigation.navigate(tile.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.hubIcon, { backgroundColor: tile.bg }]}>
                  <Ionicons name={tile.icon} size={22} color={tile.color} />
                </View>
                <Text style={styles.hubLabel}>{tile.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: insets.bottom + 80 }} />
      </ScrollView>

      <Animated.View
        style={[
          styles.fabContainer,
          {
            bottom: insets.bottom + SPACING.md,
            transform: [{ rotate: fabRotate }],
          },
        ]}
      >
        <TouchableOpacity style={styles.fab} onPress={toggleFab}>
          <Ionicons name={fabOpen ? 'close' : 'add'} size={26} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {fabOpen && (
        <View
          style={[
            styles.fabMenu,
            { bottom: insets.bottom + SPACING.md + 70 },
          ]}
        >
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              toggleFab();
              navigation.navigate('Report Incident');
            }}
          >
            <Text style={styles.fabMenuLabel}>Report Incident</Text>
            <View style={[styles.fabMenuIcon, { backgroundColor: '#D32F2F' }]}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              toggleFab();
              navigation.navigate('Hazard Report');
            }}
          >
            <Text style={styles.fabMenuLabel}>Report Hazard</Text>
            <View style={[styles.fabMenuIcon, { backgroundColor: '#F57C00' }]}>
              <Ionicons name="warning" size={18} color="#fff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              toggleFab();
              navigation.navigate('Suggest Add');
            }}
          >
            <Text style={styles.fabMenuLabel}>Add Suggestion</Text>
            <View style={[styles.fabMenuIcon, { backgroundColor: '#000666' }]}>
              <Ionicons name="bulb" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={isAlertModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalContainer,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="notifications" size={22} color="#000666" />
              <Text style={styles.modalTitle}>Create Alert</Text>
            </View>
            <TextInput
              style={styles.textInput}
              placeholder="Type your alert message..."
              placeholderTextColor="#999"
              value={newAlertMessage}
              onChangeText={setNewAlertMessage}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setIsAlertModalVisible(false);
                  setNewAlertMessage('');
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleCreateAlert}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Post Alert</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isViewModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View
          style={[
            styles.modalContainer,
            {
              paddingTop: insets.top + 20,
              paddingBottom: insets.bottom + 20,
            },
          ]}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={22} color="#F57C00" />
              <Text style={styles.modalTitle}>Alert Details</Text>
            </View>
            <ScrollView style={styles.detailScrollArea}>
              <Text style={styles.detailMessageText}>
                {selectedAlert?.message}
              </Text>
              <Text style={styles.detailTimestampText}>
                Posted: {selectedAlert?.fullDateTime}
              </Text>
            </ScrollView>
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonDanger]}
                onPress={handleDeleteAlert}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.modalButtonPrimaryText}>Remove</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setIsViewModalVisible(false);
                  setSelectedAlert(null);
                }}
                disabled={isDeleting}
              >
                <Text style={styles.modalButtonSecondaryText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MainScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: SPACING.md },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: SPACING.sm,
  },
  avatar: {
    width: scale(38, 42, 46),
    height: scale(38, 42, 46),
    borderRadius: scale(19, 21, 23),
    backgroundColor: '#000666',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: scale(14, 15, 16),
  },
  headerTextContainer: { marginLeft: SPACING.sm, flex: 1 },
  greetingText: {
    fontSize: scale(11, 12, 13),
    color: '#666',
    fontWeight: '500',
  },
  userName: {
    fontSize: scale(15, 17, 19),
    fontWeight: '700',
    color: '#1a1c1c',
  },
  emergencyButton: {
    width: scale(38, 42, 46),
    height: scale(38, 42, 46),
    borderRadius: scale(19, 21, 23),
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  alertsCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  volunteerCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#D32F2F',
    marginRight: 8,
  },
  cardTitle: {
    fontSize: scale(13, 14, 15),
    fontWeight: '700',
    color: '#1a1c1c',
  },
  badge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: scale(10, 11, 12),
    fontWeight: '700',
    color: '#D32F2F',
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 3,
  },
  pillButtonText: {
    fontSize: scale(11, 12, 13),
    fontWeight: '600',
    color: '#000666',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    gap: 6,
  },
  emptyText: {
    fontSize: scale(12, 13, 14),
    color: '#999',
  },
  alertsList: { paddingRight: 4 },
  alertChip: {
    width: scale(170, 200, 220),
    backgroundColor: '#FFF9F0',
    borderRadius: 12,
    padding: SPACING.sm,
    marginRight: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: '#F57C00',
  },
  alertChipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertChipText: {
    fontSize: scale(12, 13, 14),
    color: '#333',
    lineHeight: scale(16, 18, 20),
  },
  alertChipDate: {
    fontSize: scale(9, 10, 11),
    color: '#999',
  },

  opportunityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F2FF',
    gap: SPACING.sm,
  },
  oppIconBox: {
    width: scale(32, 36, 40),
    height: scale(32, 36, 40),
    borderRadius: scale(10, 12, 14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  oppTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  oppTitle: {
    fontSize: scale(12, 13, 14),
    fontWeight: '700',
    color: '#1a1c1c',
    flexShrink: 1,
  },
  oppMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  oppMeta: {
    fontSize: scale(10, 11, 12),
    color: '#8A8A9E',
    flexShrink: 1,
  },
  oppDate: {
    fontSize: scale(10, 11, 12),
    color: '#8A8A9E',
    fontWeight: '600',
  },
  ownTag: {
    backgroundColor: '#000666',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  ownTagText: {
    color: '#fff',
    fontSize: scale(8, 9, 10),
    fontWeight: '700',
  },

  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E8EEF5',
    padding: 4,
    borderRadius: 12,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(6, 8, 10),
    borderRadius: 8,
    paddingHorizontal: 2,
    gap: 3,
  },
  segmentButtonActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentLabel: {
    fontSize: scale(10, 11, 12),
    fontWeight: '500',
    color: '#666',
  },
  tabBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#666',
  },

  mapSection: {
    height: MAP_HEIGHT,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E8EEF5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8EEF5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: scale(12, 13, 14),
    fontWeight: '500',
  },
  userMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 102, 102, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#000666',
    borderWidth: 2,
    borderColor: '#fff',
  },
  recenterButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 18,
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  recenterButtonText: {
    color: '#000666',
    fontWeight: '600',
    fontSize: scale(11, 12, 13),
    marginLeft: 3,
  },
  calloutBox: { minWidth: 170, maxWidth: 230, padding: 8 },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: scale(12, 13, 14),
    marginLeft: 6,
  },
  calloutStatus: {
    fontSize: scale(10, 11, 12),
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: scale(11, 12, 13),
    color: '#333',
    marginBottom: 5,
  },
  calloutLink: {
    fontSize: scale(11, 12, 13),
    color: '#007AFF',
    fontWeight: 'bold',
    marginTop: 2,
  },
  calloutDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  deleteLink: {
    fontSize: scale(11, 12, 13),
    color: '#D32F2F',
    fontWeight: 'bold',
    marginLeft: 4,
    marginTop: 4,
  },

  hubSection: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  hubTitle: {
    fontSize: scale(12, 13, 14),
    fontWeight: '700',
    color: '#000666',
    marginBottom: SPACING.sm,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  hubCard: {
    width: '31.5%',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: SPACING.sm,
  },
  hubIcon: {
    width: scale(38, 42, 46),
    height: scale(38, 42, 46),
    borderRadius: scale(12, 14, 16),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  hubLabel: {
    fontSize: scale(10, 11, 12),
    fontWeight: '700',
    color: '#1a1c1c',
    textAlign: 'center',
  },

  fabContainer: {
    position: 'absolute',
    right: SPACING.md,
    zIndex: 100,
  },
  fab: {
    width: scale(52, 56, 60),
    height: scale(52, 56, 60),
    borderRadius: scale(26, 28, 30),
    backgroundColor: '#000666',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000666',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabMenu: {
    position: 'absolute',
    right: SPACING.md,
    zIndex: 99,
    alignItems: 'flex-end',
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
  },
  fabMenuIcon: {
    width: scale(40, 44, 48),
    height: scale(40, 44, 48),
    borderRadius: scale(20, 22, 24),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabMenuLabel: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 10,
    fontSize: scale(11, 12, 13),
    fontWeight: '600',
    color: '#1a1c1c',
    elevation: 2,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: '#fff',
    padding: SPACING.lg,
    borderRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: scale(16, 18, 20),
    fontWeight: '700',
    color: '#1a1c1c',
    marginLeft: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 14,
    minHeight: scale(80, 100, 110),
    textAlignVertical: 'top',
    marginBottom: SPACING.md,
    color: '#000',
    fontSize: scale(14, 15, 16),
    backgroundColor: '#F9F9F9',
  },
  detailScrollArea: { maxHeight: 220, marginBottom: SPACING.md },
  detailMessageText: {
    fontSize: scale(14, 15, 16),
    lineHeight: scale(20, 22, 24),
    color: '#222',
  },
  detailTimestampText: {
    fontSize: scale(11, 12, 13),
    color: '#999',
    marginTop: 10,
    fontStyle: 'italic',
  },
  modalActionRow: { flexDirection: 'row', gap: 10 },
  modalButton: {
    flex: 1,
    height: scale(44, 48, 52),
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  modalButtonPrimary: { backgroundColor: '#000666' },
  modalButtonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: scale(13, 14, 15),
    marginLeft: 6,
  },
  modalButtonSecondary: { backgroundColor: '#F0F2FF' },
  modalButtonSecondaryText: {
    color: '#000666',
    fontWeight: '600',
    fontSize: scale(13, 14, 15),
  },
  modalButtonDanger: { backgroundColor: '#D32F2F' },
});
