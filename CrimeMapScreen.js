import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity,
  ScrollView, Modal, StatusBar, Dimensions, ActivityIndicator, Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Heatmap, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { FAB } from 'react-native-paper';
import * as Location from 'expo-location';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { INCIDENT_TYPES, SEVERITY_LEVELS, STATUS_TYPES } from '../constants/incidentTypes';

const { height } = Dimensions.get('window');
const isSmallDevice = height < 700;

const SEVERITY_COLORS = {
  low: '#4CAF50',      // Green
  medium: '#FF9800',   // Orange
  high: '#F44336',     // Red
  critical: '#8B0000', // Dark Red
};

const CrimeMapScreen = ({ navigation }) => {
  const mapRef = useRef(null);
  const initialRegion = {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };
  const [incidents, setIncidents] = useState([]);
  const [filteredIncidents, setFilteredIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedSeverities, setSelectedSeverities] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateFilter, setDateFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIncidents(data);
    }, (error) => {
      console.error('Error listening to incidents:', error);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    applyFilters();
  }, [incidents, selectedTypes, selectedSeverities, selectedStatuses, dateFilter, searchQuery]);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') setLocationPermission(true);
    }
  };

  const getCurrentLocation = async () => {
    if (Platform.OS === 'web') {
      if (navigator.geolocation) {
        setIsLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            if (mapRef.current && typeof mapRef.current.animateToRegion === 'function') {
              mapRef.current.animateToRegion({
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            } else {
              alert('Location tracking on web requires a manual region update.');
            }
            setIsLoading(false);
          },
          (error) => {
            console.error('Error getting location:', error);
            alert('Unable to get your current location. Please try again.');
            setIsLoading(false);
          }
        );
      } else {
        alert('Geolocation is not supported by your browser.');
      }
      return;
    }

    if (!locationPermission) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission is required to show your current location.');
        return;
      }
      setLocationPermission(true);
    }

    setIsLoading(true);
    try {
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      alert('Unable to get your current location. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = incidents;

    if (selectedTypes.length > 0) {
      result = result.filter(inc => selectedTypes.includes(inc.type));
    }
    if (selectedSeverities.length > 0) {
      result = result.filter(inc => selectedSeverities.includes(inc.severity));
    }
    if (selectedStatuses.length > 0) {
      result = result.filter(inc => selectedStatuses.includes(inc.status));
    }
    if (dateFilter !== 'all') {
      const now = Date.now();
      result = result.filter(inc => {
        const incidentDate = inc.date ? new Date(inc.date).getTime() : (inc.createdAt?.toDate?.()?.getTime() || now);
        const diffDays = Math.floor((now - incidentDate) / (1000 * 60 * 60 * 24));
        if (dateFilter === 'today') return diffDays === 0;
        if (dateFilter === 'week') return diffDays <= 7;
        if (dateFilter === 'month') return diffDays <= 30;
        return true;
      });
    }

    if (searchQuery.length > 2) {
      const queryLower = searchQuery.toLowerCase();
      result = result.filter(inc =>
        inc.title.toLowerCase().includes(queryLower) ||
        inc.location.toLowerCase().includes(queryLower) ||
        inc.description.toLowerCase().includes(queryLower)
      );
    }

    setFilteredIncidents(result);
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
  };

  const toggleTypeFilter = (typeId) => {
    setSelectedTypes(prev =>
      prev.includes(typeId) ? prev.filter(id => id !== typeId) : [...prev, typeId]
    );
  };

  const toggleSeverityFilter = (severityId) => {
    setSelectedSeverities(prev =>
      prev.includes(severityId) ? prev.filter(id => id !== severityId) : [...prev, severityId]
    );
  };

  const toggleStatusFilter = (statusId) => {
    setSelectedStatuses(prev =>
      prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId]
    );
  };

  const clearAllFilters = () => {
    setSelectedTypes([]);
    setSelectedSeverities([]);
    setSelectedStatuses([]);
    setDateFilter('all');
    setSearchQuery('');
  };

  const handleViewDetails = () => {
    if (!selectedIncident) return;
    setModalVisible(false);
    setTimeout(() => {
      navigation.navigate('Incident Detail', { incidentId: selectedIncident.id });
    }, 300);
  };

const getMarkerColor = (incident) => {
  const severityInfo = SEVERITY_LEVELS.find(s => s.id === incident.severity);
  return severityInfo?.color || '#757575';
};

  const getSeverityWeight = (severity) => {
    switch(severity) {
      case 'critical': return 1.0;
      case 'high': return 0.8;
      case 'medium': return 0.5;
      case 'low': return 0.3;
      default: return 0.2;
    }
  };

  const renderModal = () => {
    if (!selectedIncident) return null;
    const typeInfo = INCIDENT_TYPES.find(t => t.id === selectedIncident.type);
    const severityInfo = SEVERITY_LEVELS.find(s => s.id === selectedIncident.severity);
    const statusInfo = STATUS_TYPES.find(s => s.id === selectedIncident.status);
    const date = selectedIncident.date ? new Date(selectedIncident.date) : new Date(selectedIncident.createdAt?.toDate?.() || Date.now());
    const displayName = selectedIncident.reporterName || selectedIncident.reportedByEmail || 'Anonymous';

    return (
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalTypeBadge, { backgroundColor: typeInfo?.color || '#757575' }]}>
                <Text style={styles.modalTypeText}>{typeInfo?.label || 'Incident'}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTitle}>{selectedIncident.title}</Text>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.modalDetails}>
                <View style={styles.modalDetailRow}>
                  <Ionicons name="location-outline" size={20} color="#666" />
                  <Text style={styles.modalDetailText}>{selectedIncident.location}</Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                  <Text style={styles.modalDetailText}>
                    {date.toLocaleDateString()} at {date.toLocaleTimeString()}
                  </Text>
                </View>
                <View style={styles.modalDetailRow}>
                  <Ionicons name="person-outline" size={20} color="#666" />
                  <Text style={styles.modalDetailText}>Reported by: {displayName}</Text>
                </View>
              </View>
              <View style={styles.modalStatusContainer}>
                <View style={[styles.modalStatusBadge, { backgroundColor: severityInfo?.color || '#757575' }]}>
                  <Text style={styles.modalStatusText}>{severityInfo?.label || 'Unknown'} Severity</Text>
                </View>
                <View style={[styles.modalStatusBadge, { backgroundColor: statusInfo?.color || '#757575' }]}>
                  <Text style={styles.modalStatusText}>{statusInfo?.label || 'Unknown'} Status</Text>
                </View>
              </View>
              <Text style={styles.modalDescription}>{selectedIncident.description}</Text>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: '#000666' }]}
                onPress={handleViewDetails}
              >
                <Text style={styles.modalActionButtonText}>View Full Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crime Map</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#000666" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by location or incident..."
          value={searchQuery}
          onChangeText={handleSearch}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.quickFilters}>
        <TouchableOpacity
          style={[styles.quickFilterButton, showFilters && styles.quickFilterActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options-outline" size={isSmallDevice ? 16 : 20} color={showFilters ? '#fff' : '#000666'} />
          <Text style={[styles.quickFilterText, showFilters && styles.quickFilterTextActive]}>Filters</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickFilterButton} onPress={getCurrentLocation}>
          <Ionicons name="locate" size={isSmallDevice ? 16 : 20} color="#000666" />
          <Text style={styles.quickFilterText}>Near Me</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickFilterButton} onPress={clearAllFilters}>
          <Ionicons name="refresh" size={isSmallDevice ? 16 : 20} color="#000666" />
          <Text style={styles.quickFilterText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickFilterButton} onPress={() => navigation.navigate('Incident List')}>
          <Ionicons name="list" size={isSmallDevice ? 16 : 20} color="#000666" />
          <Text style={styles.quickFilterText}>List</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterChipContainer}
        contentContainerStyle={styles.filterChipContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, selectedTypes.length === 0 && styles.filterChipActive]}
          onPress={() => setSelectedTypes([])}
        >
          <Text style={[styles.filterChipText, selectedTypes.length === 0 && styles.filterChipTextActive]}>All Types</Text>
        </TouchableOpacity>
        {INCIDENT_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.filterChip,
              selectedTypes.includes(type.id) && styles.filterChipActive,
              { borderColor: selectedTypes.includes(type.id) ? type.color : '#ddd' }
            ]}
            onPress={() => toggleTypeFilter(type.id)}
          >
            <Text style={[styles.filterChipText, selectedTypes.includes(type.id) && styles.filterChipTextActive]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {showFilters && (
        <View style={styles.expandedFilters}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            <Text style={styles.filterSectionTitle}>Severity</Text>
            <View style={styles.filterOptions}>
              {SEVERITY_LEVELS.map(severity => (
                <TouchableOpacity
                  key={severity.id}
                  style={[
                    styles.filterOption,
                    selectedSeverities.includes(severity.id) && styles.filterOptionActive,
                    { borderColor: severity.color }
                  ]}
                  onPress={() => toggleSeverityFilter(severity.id)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    selectedSeverities.includes(severity.id) && styles.filterOptionTextActive
                  ]}>
                    {severity.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterSectionTitle}>Status</Text>
            <View style={styles.filterOptions}>
              {STATUS_TYPES.map(status => (
                <TouchableOpacity
                  key={status.id}
                  style={[
                    styles.filterOption,
                    selectedStatuses.includes(status.id) && styles.filterOptionActive,
                    { borderColor: status.color }
                  ]}
                  onPress={() => toggleStatusFilter(status.id)}
                >
                  <Text style={[
                    styles.filterOptionText,
                    selectedStatuses.includes(status.id) && styles.filterOptionTextActive
                  ]}>
                    {status.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.filterSectionTitle}>Date Range</Text>
            <View style={styles.filterOptions}>
              {['all', 'today', 'week', 'month'].map(range => (
                <TouchableOpacity
                  key={range}
                  style={[styles.filterOption, dateFilter === range && styles.filterOptionActive]}
                  onPress={() => setDateFilter(range)}
                >
                  <Text style={[styles.filterOptionText, dateFilter === range && styles.filterOptionTextActive]}>
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          provider={PROVIDER_GOOGLE}
          showsUserLocation={locationPermission}
          showsMyLocationButton={false}
          showsCompass={true}
        >
          {filteredIncidents.length > 0 && (
            <Heatmap
              points={filteredIncidents.map(inc => ({
                latitude: inc.latitude,
                longitude: inc.longitude,
                weight: getSeverityWeight(inc.severity),
              }))}
              opacity={0.6}
              radius={50}
              maxIntensity={1}
              colorMap={{
                0: 'rgba(255,255,255,0)',
                0.2: 'rgba(76,175,80,0.4)',    // Green (low)
                0.4: 'rgba(255,193,7,0.5)',    // Amber (medium)
                0.6: 'rgba(255,87,34,0.7)',    // Deep Orange (high)
                1: 'rgba(198,40,40,0.9)',      // Red (critical)
              }}
            />
          )}
          {filteredIncidents.map(incident => {
            const color = getMarkerColor(incident);
            const severity = SEVERITY_LEVELS.find(s => s.id === incident.severity);
            return (
              <Marker
                key={incident.id}
                coordinate={{ latitude: incident.latitude, longitude: incident.longitude }}
                onPress={() => { setSelectedIncident(incident); setModalVisible(true); }}
                tracksViewChanges={false}
              >
                <View style={[styles.markerContainer, { borderColor: color }]}>
                  <View style={[styles.markerInner, { backgroundColor: color }]}>
                    <View style={[styles.markerDot, { backgroundColor: severity?.color || '#757575' }]} />
                  </View>
                </View>
              </Marker>
            );
          })}
        </MapView>


        <View style={styles.legendContainer}>
          <View style={styles.legendHeader}>
            <Text style={styles.legendTitle}>Severity</Text>
          </View>
          <ScrollView style={styles.legendContent}>
            {SEVERITY_LEVELS.map(severity => (
              <View key={severity.id} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: severity.color }]} />
                <Text style={styles.legendText}>{severity.label}</Text>
              </View>
            ))}
            <View style={styles.legendHeatmapItem}>
              <View style={styles.legendHeatmapGradient}>
                <View style={[styles.legendHeatmapColor, { backgroundColor: 'rgba(76,175,80,0.4)' }]} />
                <View style={[styles.legendHeatmapColor, { backgroundColor: 'rgba(255,193,7,0.5)' }]} />
                <View style={[styles.legendHeatmapColor, { backgroundColor: 'rgba(255,87,34,0.7)' }]} />
                <View style={[styles.legendHeatmapColor, { backgroundColor: 'rgba(198,40,40,0.9)' }]} />
              </View>
              <Text style={styles.legendText}>Low → Critical</Text>
            </View>
          </ScrollView>
        </View>
      </View>

      {renderModal()}

      <FAB
        style={[styles.fab, styles.fabReport]}
        icon="shield-plus"
        color="#fff"
        label="Report"
        onPress={() => navigation.navigate('Report Incident')}
      />
      <FAB
        style={[styles.fab, styles.fabLocation]}
        icon="crosshairs-gps"
        color="#fff"
        onPress={getCurrentLocation}
      />

      {isLoading && <View style={styles.loadingOverlay}><ActivityIndicator size="large" color="#000666" /></View>}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: height * 0.018,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e2e2',
  },
  headerTitle: { fontSize: isSmallDevice ? 18 : 22, fontWeight: '700', color: '#000666' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: height * 0.012,
    paddingHorizontal: 12,
    paddingVertical: isSmallDevice ? 6 : 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: isSmallDevice ? 14 : 16, color: '#1a1c1c', paddingVertical: 4 },
  quickFilters: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: isSmallDevice ? 6 : 10,
  },
  quickFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: isSmallDevice ? 10 : 14,
    paddingVertical: isSmallDevice ? 4 : 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000666',
    marginRight: isSmallDevice ? 6 : 10,
  },
  quickFilterActive: { backgroundColor: '#000666' },
  quickFilterText: { fontSize: isSmallDevice ? 11 : 13, fontWeight: '500', color: '#000666' },
  quickFilterTextActive: { color: '#fff' },
  filterChipContainer: { maxHeight: isSmallDevice ? 35 : 40 },
  filterChipContent: { paddingHorizontal: 16, paddingVertical: isSmallDevice ? 4 : 6 },
  filterChip: {
    paddingHorizontal: isSmallDevice ? 10 : 14,
    paddingVertical: isSmallDevice ? 4 : 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginRight: isSmallDevice ? 6 : 8,
  },
  filterChipActive: { backgroundColor: '#000666', borderColor: '#000666' },
  filterChipText: { fontSize: isSmallDevice ? 10 : 12, color: '#666' },
  filterChipTextActive: { color: '#fff', fontWeight: '600' },
  expandedFilters: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 4,
    padding: isSmallDevice ? 12 : 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: isSmallDevice ? 180 : 220,
  },
  filterSectionTitle: { fontSize: isSmallDevice ? 12 : 14, fontWeight: '600', color: '#333', marginTop: isSmallDevice ? 8 : 12, marginBottom: isSmallDevice ? 4 : 8 },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: isSmallDevice ? 8 : 12,
    paddingVertical: isSmallDevice ? 4 : 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
    marginRight: isSmallDevice ? 4 : 8,
    marginBottom: isSmallDevice ? 4 : 8,
  },
  filterOptionActive: { backgroundColor: '#000666', borderColor: '#000666' },
  filterOptionText: { fontSize: isSmallDevice ? 10 : 12, color: '#666' },
  filterOptionTextActive: { color: '#fff', fontWeight: '600' },
  mapContainer: { flex: 1, position: 'relative' },
  map: { width: '100%', height: '100%' },
  markerContainer: {
    width: isSmallDevice ? 26 : 30,
    height: isSmallDevice ? 26 : 30,
    borderRadius: isSmallDevice ? 13 : 15,
    borderWidth: 3,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerInner: {
    width: isSmallDevice ? 14 : 18,
    height: isSmallDevice ? 14 : 18,
    borderRadius: isSmallDevice ? 7 : 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerDot: {
    width: isSmallDevice ? 6 : 8,
    height: isSmallDevice ? 6 : 8,
    borderRadius: isSmallDevice ? 3 : 4,
    borderWidth: 1,
    borderColor: '#fff',
  },
  legendContainer: {
  position: 'absolute',
  top: 10,
  right: 10,
  backgroundColor: 'rgba(255,255,255,0.95)',
  borderRadius: 8,
  minWidth: isSmallDevice ? 90 : 110,
  maxWidth: isSmallDevice ? 120 : 140,
  maxHeight: isSmallDevice ? 140 : 170,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
  overflow: 'hidden',
},
  legendHeader: { paddingVertical: isSmallDevice ? 4 : 6, paddingHorizontal: isSmallDevice ? 8 : 10, backgroundColor: '#000666' },
  legendTitle: { fontSize: isSmallDevice ? 10 : 12, fontWeight: '700', color: '#fff', textAlign: 'center' },
  legendContent: { paddingHorizontal: isSmallDevice ? 8 : 10, paddingVertical: isSmallDevice ? 6 : 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  legendColor: { width: isSmallDevice ? 10 : 12, height: isSmallDevice ? 10 : 12, borderRadius: isSmallDevice ? 5 : 6, marginRight: 6 },
  legendText: { fontSize: isSmallDevice ? 9 : 11, color: '#333' },
  legendHeatmapItem: { 
    flexDirection: 'column', 
    marginTop: 4, 
    paddingTop: 4, 
    borderTopWidth: 1, 
    borderTopColor: '#eee' 
  },
  legendHeatmapGradient: { 
    flexDirection: 'row', 
    marginBottom: 2,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  legendHeatmapColor: { 
    flex: 1,
    height: 12,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTypeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  modalTypeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1c1c', marginBottom: 12 },
  modalBody: { flex: 1 },
  modalDetails: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, marginBottom: 12 },
  modalDetailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  modalDetailText: { fontSize: 14, color: '#333', marginLeft: 8 },
  modalStatusContainer: { flexDirection: 'row', marginBottom: 12 },
  modalStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  modalStatusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  modalDescription: { fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 20 },
  modalActions: { flexDirection: 'row', marginTop: 4 },
  modalActionButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalActionButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  fab: { position: 'absolute', margin: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 },
  fabReport: { right: 0, bottom: 20, backgroundColor: '#000666' },
  fabLocation: { right: 0, bottom: 90, backgroundColor: '#000666' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)' },
});

export default CrimeMapScreen;
