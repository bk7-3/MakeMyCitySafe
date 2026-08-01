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
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { IconButton, Provider, DefaultTheme } from 'react-native-paper';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// THEME 
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

// Static map URL generator
const getStaticMapUrl = (lat, lng, zoom = 14, width = 400, height = 200) => {
  return `https://maps.locationiq.com/v3/staticmap?key=${LOCATIONIQ_TOKEN}&center=${lat},${lng}&zoom=${zoom}&size=${width}x${height}&format=png`;
};

//  MAIN COMPONENT 
const OpportunityDetailScreen = ({ route, navigation }) => {
  const { opportunity } = route.params; 
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mapImageUrl, setMapImageUrl] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);

  const currentUserId = 'demo-user-id'; 

  useEffect(() => {
    if (opportunity.registrations && opportunity.registrations.includes(currentUserId)) {
      setRegistered(true);
    }
    if (opportunity.coordinates) {
      const url = getStaticMapUrl(opportunity.coordinates.lat, opportunity.coordinates.lng);
      setMapImageUrl(url);
    }
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const categoryLabel =
    ['cleanup', 'safety', 'neighborhood', 'education', 'health'].find(
      (c) => c.value === opportunity.category
    )?.label || opportunity.category;

  //  Registration toggle 
  const handleRegister = async () => {
    setLoading(true);
    try {
      const oppRef = doc(db, 'opportunities', opportunity.id);
      if (registered) {
        await updateDoc(oppRef, {
          registrations: arrayRemove(currentUserId),
        });
        setRegistered(false);
        Alert.alert('Unregistered', 'You have left this event.');
      } else {
        await updateDoc(oppRef, {
          registrations: arrayUnion(currentUserId),
        });
        setRegistered(true);
        Alert.alert('Registered!', 'You are now signed up for this event.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', 'Could not update registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = () => {
    if (opportunity.coordinates) {
      const { lat, lng } = opportunity.coordinates;
      const label = encodeURIComponent(opportunity.destination);
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${label})`,
      });
      Linking.openURL(url).catch(() =>
        Alert.alert('Error', 'Could not open maps app.')
      );
    } else {
      Alert.alert('Location missing', 'No coordinates available for this event.');
    }
  };

  //  RENDER 
  return (
    <Provider theme={theme}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f9f9f9" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeButton}>
            <IconButton icon="arrow-left" size={24} color="#000666" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {opportunity.eventName}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Map preview */}
          <View style={styles.mapContainer}>
            {mapLoading ? (
              <View style={styles.mapPlaceholder}>
                <ActivityIndicator size="large" color="#000666" />
              </View>
            ) : mapImageUrl ? (
              <>
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
                <View style={styles.mapAttribution}>
                  <Text style={styles.mapAttributionText}>
                    Map data © OpenStreetMap, powered by LocationIQ
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapPlaceholderText}>
                  No location preview available.
                </Text>
              </View>
            )}
          </View>

          {/* Event Details Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>ℹ️</Text>
              <Text style={styles.sectionTitle}>Event Details</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{categoryLabel}</Text>
              </View>
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
              <Text style={styles.value}>
                {opportunity.registrations?.length || 0} volunteer(s)
              </Text>
            </View>
          </View>

          {/* Where & When Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📍</Text>
              <Text style={styles.sectionTitle}>Where & When</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Destination</Text>
              <TouchableOpacity onPress={openInMaps} style={styles.mapLink}>
                <Text style={styles.valueLink} numberOfLines={2}>
                  {opportunity.destination}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Date</Text>
              <Text style={styles.value}>{formatDate(opportunity.date)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.label}>Time</Text>
              <Text style={styles.value}>{formatTime(opportunity.time)}</Text>
            </View>
          </View>

          {/* Mission & Goals Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Mission & Goals</Text>
            </View>
            <Text style={styles.description}>{opportunity.description}</Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Action Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarContent}>
            <TouchableOpacity
              style={[styles.actionButton, registered ? styles.leaveButton : styles.joinButton]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.7}
            >
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

// STYLES 
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
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
  closeButton: {
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000666',
    flex: 1,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#c6c5d4',
    marginBottom: 16,
    height: 160,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  mapPlaceholderText: {
    color: '#767683',
    fontSize: 14,
    textAlign: 'center',
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
  mapAttributionText: {
    fontSize: 9,
    color: '#333',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c6c5d4',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1c1c',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#454652',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#1a1c1c',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  valueLink: {
    fontSize: 14,
    color: '#1a237e',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    textDecorationLine: 'underline',
  },
  badge: {
    backgroundColor: '#e8eaf6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a237e',
  },
  description: {
    fontSize: 15,
    color: '#1a1c1c',
    lineHeight: 22,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#c6c5d4',
    padding: 16,
  },
  bottomBarContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButton: {
    backgroundColor: '#1a237e',
  },
  leaveButton: {
    backgroundColor: '#d32f2f',
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default OpportunityDetailScreen;
