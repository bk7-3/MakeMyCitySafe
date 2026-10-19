import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, ScrollView, Text, TouchableOpacity,
  StatusBar, Alert, Linking, Platform } from 'react-native';
import { IconButton, Provider, DefaultTheme } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors,
  primary: '#000666', accent: '#000666', background: '#f9f9f9', surface: '#fff',
  text: '#1a1c1c', placeholder: '#454652', border: '#c6c5d4',
  primaryContainer: '#1a237e', onPrimaryContainer: '#fff' } };

const CURRENT_USER_ID = 'demo-user-id';

const fmtDate = (s) => new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (s) => new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const OpportunityDetailScreen = ({ route, navigation }) => {
  const { opportunity } = route.params;
  const [registered, setRegistered] = useState(
    () => opportunity.registrations?.includes(CURRENT_USER_ID) ?? false
  );
  const [loading, setLoading] = useState(false);

  const lat = Number(opportunity.coordinates?.lat);
  const lng = Number(opportunity.coordinates?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  const handleRegister = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, 'opportunities', opportunity.id), {
        registrations: registered ? arrayRemove(CURRENT_USER_ID) : arrayUnion(CURRENT_USER_ID),
      });
      setRegistered(!registered);
      Alert.alert(
        registered ? 'Unregistered' : 'Registered!',
        registered ? 'You have left this event.' : 'You are now signed up for this event.'
      );
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Could not update registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = () => {
    if (!hasCoords) return Alert.alert('Location missing', 'No coordinates available for this event.');
    const label = encodeURIComponent(opportunity.destination || 'Event location');
    const url = Platform.select({
      ios: `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`,
      android: `geo:0,0?q=${lat},${lng}(${label})`,
    });
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open maps app.'));
  };

  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <IconButton icon="arrow-left" size={24} color="#000666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{opportunity.eventName}</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity style={styles.mapContainer} activeOpacity={0.9}
            onPress={openInMaps} disabled={!hasCoords}>
            {hasCoords ? (
              <View style={styles.mapImage} pointerEvents="none">
                <MapView style={styles.mapImage}
                  initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
                  scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
                  pitchEnabled={false} toolbarEnabled={false}>
                  <Marker coordinate={{ latitude: lat, longitude: lng }} title={opportunity.destination} />
                </MapView>
              </View>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>No location preview available.</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>ℹ️</Text>
              <Text style={styles.sectionTitle}>Event Details</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.badge}><Text style={styles.badgeText}>{opportunity.category}</Text></View>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Organizer</Text>
              <Text style={styles.value}>{opportunity.groupName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Capacity</Text>
              <Text style={styles.value}>
                {opportunity.capacity > 0 ? `${opportunity.capacity} volunteers` : 'Unlimited'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Registered</Text>
              <Text style={styles.value}>{opportunity.registrations?.length || 0} volunteer(s)</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📍</Text>
              <Text style={styles.sectionTitle}>Where & When</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Destination</Text>
              <TouchableOpacity onPress={openInMaps} style={styles.mapLink}>
                <Text style={styles.valueLink} numberOfLines={2}>{opportunity.destination}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{fmtDate(opportunity.date)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Time</Text>
              <Text style={styles.value}>{fmtTime(opportunity.time)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Mission & Goals</Text>
            </View>
            <Text style={styles.description}>{opportunity.description}</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <View style={styles.bottomBarContent}>
            <TouchableOpacity
              style={[styles.actionButton, registered ? styles.leaveButton : styles.joinButton]}
              onPress={handleRegister} disabled={loading} activeOpacity={0.7}>
              <Text style={styles.actionButtonText}>
                {loading ? 'Updating...' : registered ? 'Leave Event' : 'Join Event'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Provider>
  );
};

export default OpportunityDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e2e2e2' },
  closeButton: { marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#000666', flex: 1, textAlign: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  mapContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#c6c5d4',
    marginBottom: 16, height: 160, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  mapImage: { width: '100%', height: '100%' },
  mapPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  mapPlaceholderText: { color: '#767683', fontSize: 14, textAlign: 'center' },

  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#c6c5d4', marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionIcon: { fontSize: 20, marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1a1c1c' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 14, fontWeight: '500', color: '#454652', flex: 1 },
  value: { fontSize: 14, color: '#1a1c1c', fontWeight: '500', flex: 1, textAlign: 'right' },
  valueLink: { fontSize: 14, color: '#1a237e', fontWeight: '500', flex: 1, textAlign: 'right', textDecorationLine: 'underline' },
  badge: { backgroundColor: '#e8eaf6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '500', color: '#1a237e' },
  description: { fontSize: 15, color: '#1a1c1c', lineHeight: 22 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#c6c5d4', padding: 16 },
  bottomBarContent: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  actionButton: { flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  joinButton: { backgroundColor: '#1a237e' },
  leaveButton: { backgroundColor: '#d32f2f' },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
