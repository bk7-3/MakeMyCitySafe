import React, { useState, useEffect, useLayoutEffect } from "react";
import { View, SafeAreaView, FlatList, TouchableOpacity, Alert, StyleSheet, Modal, ScrollView, TextInput } from "react-native";
import { Text, Button, IconButton, Divider, ActivityIndicator } from "react-native-paper";
import { collection, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from 'expo-location';

const COLORS = {
  primary: "#0F172A",
  accent: "#2563EB",
  background: "#F8FAFC",
  cardBg: "#FFFFFF",
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  danger: "#DC2626",
  warning: "#D97706",
  crime: "#7C3AED",
  safe: "#059669",
};

const getCategoryConfig = (category = '') => {
  switch (category) {
    case 'cleanup':
      return { bg: '#c8e6c9', text: '#1b5e20', icon: '🧹' };
    case 'safety':
      return { bg: '#fff9c4', text: '#795548', icon: '🧠' };
    case 'neighborhood':
      return { bg: '#e0e0ff', text: '#000767', icon: '👥' };
    case 'education':
      return { bg: '#e1bee7', text: '#4a0072', icon: '📚' };
    case 'health':
      return { bg: '#ffdad6', text: '#93000a', icon: '❤️' };
    default:
      return { bg: '#f5f5f5', text: '#454652', icon: '📌' };
  }
};

const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const MainScreen = ({ navigation }) => {
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
  const [newAlertMessage, setNewAlertMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedAlert, setSelectedAlert] = useState(null);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getSubtypeLabel = (cat, val) => {
    const types = {
      Hazard: { Traffic: "Traffic-Related", Natural: "Natural Hazard", Infra: "Dangerous Infrastructure", Closure: "Path Closure" },
      Crime: { Violence: "Violence & Threats", Police: "Police Activity", Theft: "Theft / Vandalism" },
      SafeSpace: { BlueLight: "Emergency Phone", SafeHaven: "Safe Haven Facility", SecurityPost: "Security Post" }
    };
    return types[cat]?.[val] || val || "General";
  };

  const getStatusLabel = (val) => {
    const statuses = { Unconfirmed: "Unconfirmed", Potential: "Potential", Active: "Active", Progress: "In Progress", Resolved: "Resolved" };
    return statuses[val] || val;
  };

  const mappedHazards = hazards.filter(h => (!h.category || h.category === 'Hazard') && h.location?.latitude && h.location?.longitude);
  const mappedCrimes = hazards.filter(h => h.category === 'Crime' && h.location?.latitude && h.location?.longitude);
  const mappedSafeSpaces = hazards.filter(h => h.category === 'SafeSpace' && h.location?.latitude && h.location?.longitude);

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
        const userDoc = await getDoc(doc(db, "users", studentID));
        if (userDoc.exists()) {
          setStudentData(userDoc.data());
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      }
    };
    fetchStudentData();
  }, [studentID]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerContainer}>
          <Text style={styles.welcomeText}>Welcome, {studentData?.name ?? "User"}</Text>
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
  }, [navigation, studentData]);

  useEffect(() => {
    let locationSubscriber = null;

    const startLocationTracking = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLoadingLocation(false);
          return;
        }

        let initialLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation(initialLoc);
        setLoadingLocation(false);

        // --- SAVE LAST KNOWN LOCATION ON LOGIN/MOUNT ---
        const currentUser = auth.currentUser;
        if (currentUser && initialLoc?.coords) {
          try {
            await setDoc(
              doc(db, "users", currentUser.uid),
              {
                location: {
                  latitude: initialLoc.coords.latitude,
                  longitude: initialLoc.coords.longitude,
                  lastUpdated: new Date().toISOString(),
                },
              },
              { merge: true }
            );
          } catch (locErr) {
            console.error("Failed to update user last location on login:", locErr);
          }
        }
        // ----------------------------------------------

        locationSubscriber = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 2, timeInterval: 2000 },
          (newLocation) => { setCurrentLocation(newLocation); }
        );
      } catch (e) {
        console.error("Location tracking error:", e);
        setLoadingLocation(false);
      }
    };

    const unsubHazards = onSnapshot(collection(db, "hazards"), (snap) => {
      const arr = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          reportDateTime: data.reportDateTime?.toDate?.()?.toLocaleString() ?? "N/A",
          location: {
            latitude: Number(data.location?.latitude) || 0,
            longitude: Number(data.location?.longitude) || 0,
          }
        };
      });
      setHazards(arr);
    });

    const unsubAlerts = onSnapshot(collection(db, "alerts"), (snap) => {
      const arr = snap.docs.map(d => {
        const data = d.data();
        const rawDate = data.createdDateTime?.toDate?.() ?? null;
        return {
          id: d.id,
          ...data,
          createdDateTime: rawDate ? rawDate.toLocaleDateString() : "",
          fullDateTime: rawDate ? rawDate.toLocaleString() : "Just Now",
        };
      });
      setAlerts(arr);
    });

    const unsubSOS = onSnapshot(collection(db, "help_messages"), (snap) => {
      const arr = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdDateTime: data.createdDateTime?.toDate?.()?.toLocaleString() ?? "Just now",
            location: data.location ? {
              latitude: Number(data.location.latitude),
              longitude: Number(data.location.longitude)
            } : null
          };
        })
        .filter(item => item.status === 'active' && item.location?.latitude && item.location?.longitude);

      setSosMessages(arr);
    });

    const unsubOpportunities = onSnapshot(collection(db, "opportunities"), (snap) => {
      const arr = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));
      setOpportunities(arr);
    });

    startLocationTracking();

    return () => {
      unsubHazards();
      unsubAlerts();
      unsubSOS();
      unsubOpportunities();
      if (locationSubscriber) {
        locationSubscriber.remove();
      }
    };
  }, []);

  const handleResolveSOS = (sosId) => {
    Alert.alert(
      "Clear SOS Marker",
      "Are you sure you want to resolve and remove this emergency SOS pin?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear SOS",
          style: "destructive",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "help_messages", sosId), { status: "resolved" });
            } catch (err) {
              Alert.alert("Error", "Could not remove SOS pin.");
            }
          }
        }
      ]
    );
  };

  const handleDeleteHazardPin = (hazardId) => {
    Alert.alert(
      "Remove Pin",
      "Are you sure you want to delete this marker from the map?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Pin",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "hazards", hazardId));
            } catch (err) {
              Alert.alert("Error", "Could not delete map marker.");
            }
          }
        }
      ]
    );
  };

  const handleCreateAlert = async () => {
    if (!newAlertMessage.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "alerts"), {
        message: newAlertMessage.trim(),
        createdDateTime: serverTimestamp()
      });
      setNewAlertMessage("");
      setIsAlertModalVisible(false);
    } catch (err) {
      Alert.alert("Error", "Could not save alert.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAlert = async () => {
    if (!selectedAlert) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "alerts", selectedAlert.id));
      setIsViewModalVisible(false);
      setSelectedAlert(null);
    } catch (err) {
      Alert.alert("Error", "Failed to remove alert.");
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
    return undefined;
  };

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
            renderItem={({ item }) => {
              const config = getCategoryConfig(item.category);
              const isOwn = studentID && item.createdBy === studentID;

              return (
                <TouchableOpacity
                  style={styles.compactOpportunityItem}
                  onPress={() => navigation.navigate('VolunteerDashboard')}
                >
                  <Text style={{ marginRight: 6 }}>{config.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text numberOfLines={1} style={styles.oppTitle}>
                        {item.eventName || 'Volunteer Opportunity'}
                      </Text>
                      {isOwn && (
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
              );
            }}
          />
        )}
      </View>

      <View style={styles.tabContainer}>
        {[
          { key: 'Hazard', label: 'Hazards' },
          { key: 'Crime', label: 'Crimes' },
          { key: 'SafeSpace', label: 'Safe Spaces' }
        ].map((tab) => (
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
            <ActivityIndicator animating={true} size="small" color={COLORS.accent} />
            <Text style={styles.loadingText}>Acquiring location data...</Text>
          </View>
        ) : (
          <>
            {!userIsTracking && (
              <TouchableOpacity style={styles.recenterButton} onPress={() => setUserIsTracking(true)}>
                <Text style={styles.recenterButtonText}>Center Map</Text>
              </TouchableOpacity>
            )}

            <MapView
              style={styles.map}
              region={getMapRegion()}
              onPanDrag={() => setUserIsTracking(false)}
            >
              {currentLocation?.coords && (
                <Marker 
                  coordinate={currentLocation.coords} 
                  title="Your Location" 
                  pinColor={COLORS.accent} 
                />
              )}

              {sosMessages.map((sos) => (
                <Marker key={sos.id} coordinate={sos.location} pinColor={COLORS.danger}>
                  <Callout
                    onPress={() =>
                      navigation.navigate('PinChatScreen', {
                        hazardId: sos.id,
                        hazardTitle: 'Emergency SOS',
                        category: 'SOS'
                      })
                    }
                  >
                    <View style={styles.calloutBox}>
                      <Text style={[styles.calloutTitle, { color: COLORS.danger }]}>Emergency SOS</Text>
                      <Text style={styles.calloutStatus}>Sent: {sos.createdDateTime}</Text>
                      <Text style={styles.calloutDescription}>{sos.message}</Text>
                      <Text style={styles.calloutLink}>💬 Join Live Chat Room →</Text>
                      <TouchableOpacity onPress={() => handleResolveSOS(sos.id)}>
                        <Text style={styles.deleteLink}>Resolve & Remove Marker</Text>
                      </TouchableOpacity>
                    </View>
                  </Callout>
                </Marker>
              ))}

              {activeMapTab === 'Hazard' && mappedHazards.map(h => (
                <Marker key={h.id} coordinate={h.location} pinColor={h.status === "Active" ? COLORS.danger : COLORS.warning}>
                  <Callout
                    onPress={() =>
                      navigation.navigate('PinChatScreen', {
                        hazardId: h.id,
                        hazardTitle: getSubtypeLabel('Hazard', h.type),
                        category: 'Hazard'
                      })
                    }
                  >
                    <View style={styles.calloutBox}>
                      <Text style={styles.calloutTitle}>{getSubtypeLabel('Hazard', h.type)}</Text>
                      <Text style={styles.calloutStatus}>Status: {getStatusLabel(h.status)}</Text>
                      <Text numberOfLines={2} style={styles.calloutDescription}>{h.description}</Text>
                      <Text style={styles.calloutLink}>💬 Join Live Chat Room →</Text>
                      <TouchableOpacity onPress={() => handleDeleteHazardPin(h.id)}>
                        <Text style={styles.deleteLink}>Delete Marker</Text>
                      </TouchableOpacity>
                    </View>
                  </Callout>
                </Marker>
              ))}

              {activeMapTab === 'Crime' && mappedCrimes.map(c => (
                <Marker key={c.id} coordinate={c.location} pinColor={COLORS.crime}>
                  <Callout
                    onPress={() =>
                      navigation.navigate('PinChatScreen', {
                        hazardId: c.id,
                        hazardTitle: getSubtypeLabel('Crime', c.type),
                        category: 'Crime'
                      })
                    }
                  >
                    <View style={styles.calloutBox}>
                      <Text style={[styles.calloutTitle, { color: COLORS.crime }]}>{getSubtypeLabel('Crime', c.type)}</Text>
                      <Text style={styles.calloutStatus}>Status: {getStatusLabel(c.status)}</Text>
                      <Text numberOfLines={2} style={styles.calloutDescription}>{c.description}</Text>
                      <Text style={styles.calloutLink}>💬 Join Live Chat Room →</Text>
                      <TouchableOpacity onPress={() => handleDeleteHazardPin(c.id)}>
                        <Text style={styles.deleteLink}>Delete Marker</Text>
                      </TouchableOpacity>
                    </View>
                  </Callout>
                </Marker>
              ))}

              {activeMapTab === 'SafeSpace' && mappedSafeSpaces.map(s => (
                <Marker key={s.id} coordinate={s.location} pinColor={COLORS.safe}>
                  <Callout
                    onPress={() =>
                      navigation.navigate('PinChatScreen', {
                        hazardId: s.id,
                        hazardTitle: getSubtypeLabel('SafeSpace', s.type),
                        category: 'SafeSpace'
                      })
                    }
                  >
                    <View style={styles.calloutBox}>
                      <Text style={[styles.calloutTitle, { color: COLORS.safe }]}>{getSubtypeLabel('SafeSpace', s.type)}</Text>
                      <Text style={styles.calloutStatus}>Status: {getStatusLabel(s.status)}</Text>
                      <Text numberOfLines={2} style={styles.calloutDescription}>{s.description}</Text>
                      <Text style={styles.calloutLink}>💬 Join Live Chat Room →</Text>
                      <TouchableOpacity onPress={() => handleDeleteHazardPin(s.id)}>
                        <Text style={styles.deleteLink}>Delete Marker</Text>
                      </TouchableOpacity>
                    </View>
                  </Callout>
                </Marker>
              ))}
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
          <Button 
            mode="outlined" 
            onPress={() => navigation.navigate('Hazard Report')} 
            style={styles.actionButton} 
            labelStyle={styles.actionButtonLabel}
          >
            Report Hazard
          </Button>
          <Button 
            mode="outlined" 
            onPress={() => navigation.navigate('Suggest Add')} 
            style={styles.actionButton} 
            labelStyle={styles.actionButtonLabel}
          >
            Add Suggestion
          </Button>
          <Button 
            mode="outlined" 
            onPress={() => navigation.navigate('socialScreen')} 
            style={styles.actionButton} 
            labelStyle={styles.actionButtonLabel}
          >
            Social
          </Button>
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
                onPress={() => { setIsAlertModalVisible(false); setNewAlertMessage(""); }} 
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

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background,
    paddingHorizontal: 14,
    paddingTop: 8,
    margin: 10,
  },
  headerContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  welcomeText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.textPrimary 
  },
  alertSection: { 
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
    marginBottom: 8,
  },
  volunteerSection: { 
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
  },
  alertHeaderRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingBottom: 4 
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  createAlertLink: { 
    color: COLORS.accent, 
    fontWeight: '600', 
    fontSize: 13 
  },
  divider: {
    marginVertical: 6,
    backgroundColor: COLORS.border,
  },
  compactAlertItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 6, 
    borderBottomWidth: StyleSheet.hairlineWidth, 
    borderBottomColor: COLORS.border 
  },
  compactOpportunityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  oppTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  oppLocation: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  ownTag: {
    marginLeft: 6,
    backgroundColor: '#000666',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ownTagText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '700',
  },
  alertItemMessage: { 
    fontSize: 13, 
    color: COLORS.textPrimary, 
    flex: 1, 
    marginRight: 10 
  },
  alertItemDate: { 
    fontSize: 11, 
    color: COLORS.textSecondary 
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingVertical: 6,
    fontStyle: 'italic',
  },
  tabContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    backgroundColor: '#E2E8F0', 
    borderRadius: 8, 
    padding: 3, 
    marginTop: 10,
    marginBottom: 6,
  },
  tabButton: { 
    flex: 1, 
    paddingVertical: 7, 
    alignItems: 'center', 
    borderRadius: 6 
  },
  activeTabButton: { 
    backgroundColor: COLORS.cardBg, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 1.5,
    elevation: 1,
  },
  tabLabel: { 
    fontSize: 13, 
    fontWeight: '500', 
    color: COLORS.textSecondary 
  },
  activeTabLabel: { 
    color: COLORS.textPrimary, 
    fontWeight: '700' 
  },
  mapWrapper: { 
    width: "100%", 
    height: "38%", 
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 4,
  },
  map: { 
    width: "100%", 
    height: "100%" 
  },
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
  recenterButtonText: { 
    color: COLORS.textPrimary, 
    fontWeight: '600', 
    fontSize: 12 
  },
  actionContainer: {
    marginTop: 8,
  },
  safetyButton: { 
    borderRadius: 8,
    marginBottom: 8,
  },
  safetyButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 2,
  },
  bottomActionBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    gap: 8 
  },
  actionButton: { 
    flex: 1, 
    borderRadius: 8,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  actionButtonLabel: { 
    fontSize: 11, 
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginHorizontal: 0,
  },
  calloutBox: { 
    minWidth: 180, 
    maxWidth: 220, 
    padding: 4 
  },
  calloutTitle: { 
    fontWeight: '700', 
    fontSize: 13, 
    color: COLORS.textPrimary,
    marginBottom: 2 
  },
  calloutStatus: { 
    fontSize: 11, 
    color: COLORS.textSecondary, 
    marginBottom: 4 
  },
  calloutDescription: { 
    fontSize: 12, 
    color: COLORS.textPrimary, 
    marginBottom: 6 
  },
  calloutLink: { 
    fontSize: 11, 
    color: COLORS.accent, 
    fontWeight: '600', 
    marginTop: 2 
  },
  deleteLink: { 
    fontSize: 11, 
    color: COLORS.danger, 
    fontWeight: '600', 
    marginTop: 6 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: COLORS.cardBg 
  },
  loadingText: { 
    marginTop: 8, 
    color: COLORS.textSecondary, 
    fontSize: 13, 
    fontWeight: '500' 
  },
  modalContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(15, 23, 42, 0.4)' 
  },
  modalContent: { 
    width: '88%', 
    maxHeight: '70%', 
    backgroundColor: COLORS.cardBg, 
    padding: 20, 
    borderRadius: 12, 
    elevation: 6 
  },
  modalTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.textPrimary,
    marginBottom: 10 
  },
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
  modalActionRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 8,
    marginTop: 10 
  },
  detailScrollArea: { 
    marginVertical: 10, 
    maxHeight: 150 
  },
  detailMessageText: { 
    fontSize: 14, 
    lineHeight: 20, 
    color: COLORS.textPrimary 
  },
  detailTimestampText: { 
    fontSize: 11, 
    color: COLORS.textSecondary, 
    marginTop: 10, 
    fontStyle: 'italic' 
  },
});

export default MainScreen;
