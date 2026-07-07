import React, { useState, useEffect, useLayoutEffect } from "react";
import {
    View, SafeAreaView, FlatList, TouchableOpacity,
    Alert, StyleSheet, Modal, ScrollView, TextInput
} from "react-native";
import { Text, Button, IconButton, Divider, ActivityIndicator } from "react-native-paper";
import { collection, onSnapshot, doc, getDoc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import MapView, { Marker, Callout } from "react-native-maps";
import * as Location from 'expo-location';

const MainScreen = ({ navigation }) => {
    const [hazards, setHazards] = useState([]);
    const [alerts, setAlerts] = useState([]);
    
    // User Location States
    const [currentLocation, setCurrentLocation] = useState({
        coords: { latitude: 33.769217, longitude: -117.867665 }
    });
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [userIsTracking, setUserIsTracking] = useState(true); 

    const [studentData, setStudentData] = useState(null);
    const [weather, setWeather] = useState(null);
    const [error, setError] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
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
            Crime: { Violence: "Violence and Threats", Police: "Police Activity", Theft: "Theft / Vandalism" },
            SafeSpace: { BlueLight: "Emergency Blue Light", SafeHaven: "Safe Haven / Building", SecurityPost: "Staffed Security Post" }
        };
        return types[cat]?.[val] || val || "General";
    };

    const getStatusLabel = (val) => {
        const statuses = { Unconfirmed: "Unconfirmed", Potential: "Potential", Active: "Active", Progress: "In-Progress", Resolved: "Resolved" };
        return statuses[val] || val;
    };

    const mappedHazards = hazards.filter(h => (!h.category || h.category === 'Hazard') && h.location?.latitude && h.location?.longitude);
    const mappedCrimes = hazards.filter(h => h.category === 'Crime' && h.location?.latitude && h.location?.longitude);
    const mappedSafeSpaces = hazards.filter(h => h.category === 'SafeSpace' && h.location?.latitude && h.location?.longitude);

    // ---------------- AUTH LISTENER ----------------
    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            setStudentID(user?.uid ?? null);
        });
        return unsub;
    }, []);

    // ---------------- FETCH STUDENT DATA ----------------
    useEffect(() => {
        if (!studentID) return;
        const fetchStudentData = async () => {
            try {
                const studentDoc = await getDoc(doc(db, "students", studentID));
                if (studentDoc.exists()) {
                    setStudentData(studentDoc.data());
                }
            } catch (err) {
                console.error("Error fetching student data:", err);
            }
        };
        fetchStudentData();
    }, [studentID]);

    // ---------------- WEATHER API FETCH ----------------
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                const apiKey = "6f3a0d0256c16b6d937b2d6686b373b1";
                const city = "Irvine";
                const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=imperial&appid=${apiKey}`);
                const data = await res.json();

                if (!res.ok) throw new Error("Weather failed");
                setWeather({ temperature: Math.round(data.main.temp), condition: data.weather[0].main });
            } catch (err) {
                setError("Weather unavailable");
            }
        };
        fetchWeather();
    }, []);

    // ---------------- HEADER NAVIGATION CONFIG ----------------
    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <View style={styles.headerContainer}>
                    <Text style={styles.welcomeText}>Welcome, {studentData?.name ?? "User"}!</Text>
                    {weather ? (
                        <Text style={styles.weatherText}>{weather.temperature}°F, {weather.condition}</Text>
                    ) : (
                        <Text style={styles.weatherErrorText}>{error || "Loading weather..."}</Text>
                    )}
                </View>
            ),
            headerRight: () => (
                <IconButton
                    size={24}
                    onPress={() => navigation.navigate('Help Screen')}
                    icon="car-emergency"
                    iconColor="red"
                />
            ),
        });
    }, [navigation, studentData, weather]);

    // ---------------- REAL-TIME LOCATION ----------------
    useEffect(() => {
        let locationSubscriber = null;

        const startLocationTracking = async () => {
            try {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    setLoadingLocation(false);
                    return;
                }

                let initialLoc = await Location.getCurrentPositionAsync({});
                setCurrentLocation(initialLoc);
                setLoadingLocation(false);

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


        startLocationTracking();

        return () => {
            unsubHazards();
            unsubAlerts();
            if (locationSubscriber) {
                locationSubscriber.remove();
            }
        };
    }, []);

    // ---------------- HANDLERS ----------------
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
        if (userIsTracking) {
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
            
            <View style={styles.alertSection}>
                <View style={styles.alertHeaderRow}>
                    <Text variant="titleMedium">Alerts ({alerts.length})</Text>
                    <TouchableOpacity onPress={() => setIsAlertModalVisible(true)}>
                        <Text style={styles.createAlertLink}>Create Alert</Text>
                    </TouchableOpacity>
                </View>
                <Divider />
                <FlatList
                    data={alerts}
                    keyExtractor={(item) => item.id}
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

            <View style={styles.tabContainer}>
                {['Hazard', 'Crime', 'SafeSpace'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tabButton, activeMapTab === tab && styles.activeTabButton]}
                        onPress={() => {
                            setActiveMapTab(tab);
                            setUserIsTracking(true);
                        }}
                    >
                        <Text style={[styles.tabLabel, activeMapTab === tab && styles.activeTabLabel]}>
                            {tab === 'SafeSpace' ? '🛡️ Safe Spaces' : tab === 'Crime' ? '🚨 Crimes' : '⚠️ Hazards'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.mapWrapper}>
                {loadingLocation ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator animating={true} size="large" color="#6200ee" />
                        <Text style={styles.loadingText}>Connecting to Satellites...</Text>
                    </View>
                ) : (
                    <>
                        {!userIsTracking && (
                            <TouchableOpacity style={styles.recenterButton} onPress={() => setUserIsTracking(true)}>
                                <Text style={styles.recenterButtonText}>📍 Center on Me</Text>
                            </TouchableOpacity>
                        )}

                        <MapView
                            style={styles.map}
                            region={getMapRegion()}
                            onPanDrag={() => setUserIsTracking(false)}
                        >
                            <Marker coordinate={currentLocation.coords} title="Your Location" pinColor="blue" />

                            {activeMapTab === 'Hazard' && mappedHazards.map(h => (
                                <Marker key={h.id} coordinate={h.location} pinColor={h.status === "Active" ? "red" : "orange"}>
                                    <Callout onPress={() => navigation.navigate('HazardUpdateScreen', { hazard: h })}>
                                        <View style={styles.calloutBox}>
                                            <Text style={styles.calloutTitle}>⚠️ {getSubtypeLabel('Hazard', h.type)}</Text>
                                            <Text style={styles.calloutStatus}>Status: {getStatusLabel(h.status)}</Text>
                                            <Text numberOfLines={2} style={styles.calloutDescription}>{h.description}</Text>
                                            <Text style={styles.calloutLink}>View Details & Update →</Text>
                                        </View>
                                    </Callout>
                                </Marker>
                            ))}

                            {activeMapTab === 'Crime' && mappedCrimes.map(c => (
                                <Marker key={c.id} coordinate={c.location} pinColor="purple">
                                    <Callout onPress={() => navigation.navigate('HazardUpdateScreen', { hazard: c })}>
                                        <View style={styles.calloutBox}>
                                            <Text style={[styles.calloutTitle, { color: '#6A1B9A' }]}>🚨 Crime: {getSubtypeLabel('Crime', c.type)}</Text>
                                            <Text style={styles.calloutStatus}>Status: {getStatusLabel(c.status)}</Text>
                                            <Text numberOfLines={2} style={styles.calloutDescription}>{c.description}</Text>
                                            <Text style={styles.calloutLink}>View Details & Update →</Text>
                                        </View>
                                    </Callout>
                                </Marker>
                            ))}

                            {activeMapTab === 'SafeSpace' && mappedSafeSpaces.map(s => (
                                <Marker key={s.id} coordinate={s.location} pinColor="green">
                                    <Callout onPress={() => navigation.navigate('HazardUpdateScreen', { hazard: s })}>
                                        <View style={styles.calloutBox}>
                                            <Text style={[styles.calloutTitle, { color: '#2E7D32' }]}>🛡️ Safe Space: {getSubtypeLabel('SafeSpace', s.type)}</Text>
                                            <Text style={styles.calloutStatus}>Status: {getStatusLabel(s.status)}</Text>
                                            <Text numberOfLines={2} style={styles.calloutDescription}>{s.description}</Text>
                                            <Text style={styles.calloutLink}>View Details & Update →</Text>
                                        </View>
                                    </Callout>
                                </Marker>
                            ))}
                        </MapView>
                    </>
                )}
            </View>

            <Button mode="contained" style={styles.safetyButton} onPress={() => setIsModalVisible(true)}>
                E-Bike Safety
            </Button>

            <View style={styles.bottomActionBar}>
                <Button mode="contained" onPress={() => navigation.navigate('Hazard Report')} style={styles.actionButton} labelStyle={styles.actionButtonLabel}>
                    Report Hazard
                </Button>
                <Button mode="contained" onPress={() => navigation.navigate('Suggest Add')} style={styles.actionButton} labelStyle={styles.actionButtonLabel}>
                    Add Suggest
                </Button>
                <Button mode="contained" onPress={() => navigation.navigate('Walk Group List')} style={styles.actionButton} labelStyle={styles.actionButtonLabel}>
                    Join Group
                </Button>
            </View>

            <Modal visible={isModalVisible} transparent animationType="slide">
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>E-Bike Safety Tips</Text>
                            <Text style={{ marginVertical: 4 }}>1. Always wear an approved helmet.</Text>
                            <Text style={{ marginVertical: 4 }}>2. Follow all standard regional speed regulations.</Text>
                            <Text style={{ marginVertical: 4 }}>3. Check systems before operations.</Text>
                        </ScrollView>
                        <Button onPress={() => setIsModalVisible(false)}>Close</Button>
                    </View>
                </View>
            </Modal>

            <Modal visible={isAlertModalVisible} transparent animationType="fade">
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Create New Alert</Text>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type alert message here..."
                            placeholderTextColor="#888"
                            value={newAlertMessage}
                            onChangeText={setNewAlertMessage}
                            multiline
                            numberOfLines={3}
                        />
                        <View style={styles.modalActionRow}>
                            <Button mode="outlined" onPress={() => { setIsAlertModalVisible(false); setNewAlertMessage(""); }} style={{ flex: 1, marginRight: 5 }} disabled={isSubmitting}>Cancel</Button>
                            <Button mode="contained" onPress={handleCreateAlert} loading={isSubmitting} disabled={isSubmitting} style={{ flex: 1, marginLeft: 5 }}>Submit</Button>
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
                            <Text style={styles.detailTimestampText}>Posted: {selectedAlert?.fullDateTime}</Text>
                        </ScrollView>
                        <View style={styles.modalActionRow}>
                            <Button mode="contained" buttonColor="#D32F2F" textColor="white" onPress={handleDeleteAlert} style={{ flex: 1, marginRight: 5 }} disabled={isDeleting} icon="delete">Remove</Button>
                            <Button mode="outlined" onPress={() => { setIsViewModalVisible(false); setSelectedAlert(null); }} style={{ flex: 1, marginLeft: 5 }} disabled={isDeleting}>Close</Button>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, margin: 10 },
    alertSection: { maxHeight: '25%' },
    alertHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 },
    createAlertLink: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
    compactAlertItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E0E0E0' },
    alertItemMessage: { fontSize: 14, color: '#333', flex: 1, marginRight: 10 },
    alertItemDate: { fontSize: 12, color: '#777' },
    tabContainer: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#F5F5F5', borderRadius: 8, padding: 4, marginVertical: 5 },
    tabButton: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
    activeTabButton: { backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41 },
    tabLabel: { fontSize: 12, fontWeight: '500', color: '#666' },
    activeTabLabel: { color: '#000', fontWeight: 'bold' },
    mapWrapper: { width: "100%", height: "48%", marginVertical: 10, position: 'relative' },
    map: { width: "100%", height: "100%" },
    textInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, height: 80, textAlignVertical: 'top', marginVertical: 15, color: '#000' },
    modalActionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    detailScrollArea: { marginVertical: 10, maxHeight: 150 },
    detailMessageText: { fontSize: 15, lineHeight: 22, color: '#222' },
    detailTimestampText: { fontSize: 12, color: '#666', marginTop: 12, fontStyle: 'italic' },
    headerContainer: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    welcomeText: { fontSize: 16, fontWeight: 'bold' },
    weatherText: { fontSize: 14 },
    weatherErrorText: { color: 'red', fontSize: 14 },
    safetyButton: { marginVertical: 5 },
    bottomActionBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 5, gap: 6 },
    actionButton: { flex: 1, borderRadius: 8 },
    actionButtonLabel: { fontSize: 11, marginHorizontal: 2 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContent: { width: '85%', maxHeight: '70%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 8 },
    loadingText: { marginTop: 10, color: '#666', fontSize: 14, fontWeight: '500' },
    calloutBox: { minWidth: 170, maxWidth: 220, padding: 6 },
    calloutTitle: { fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
    calloutStatus: { fontSize: 11, color: '#666', fontStyle: 'italic', marginBottom: 4 },
    calloutDescription: { fontSize: 12, color: '#333', marginBottom: 6 },
    calloutLink: { fontSize: 12, color: '#007AFF', fontWeight: 'bold', marginTop: 2 },
    recenterButton: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(255, 255, 255, 0.9)', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, zIndex: 10, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
    recenterButtonText: { color: '#1C1B1F', fontWeight: 'bold', fontSize: 12 }
});

export default MainScreen;
