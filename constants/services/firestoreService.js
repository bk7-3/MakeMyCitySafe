import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  limit,
} from 'firebase/firestore';

const INCIDENTS_COLLECTION = 'incidents';

const getIncidentsRef = () => {
  if (!db) throw new Error('Firestore is not initialized');
  return collection(db, INCIDENTS_COLLECTION);
};

export const createIncident = async (incidentData) => {
  try {
    const ref = getIncidentsRef();
    const data = {
      ...incidentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const docRef = await addDoc(ref, data);
    return docRef.id;
  } catch (error) {
    console.error('Error creating incident:', error);
    throw error;
  }
};

export const getIncidents = async () => {
  try {
    const ref = getIncidentsRef();
    const q = query(ref, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return [];
  }
};

export const getIncidentById = async (incidentId) => {
  try {
    const docRef = doc(db, INCIDENTS_COLLECTION, incidentId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    throw new Error('Incident not found');
  } catch (error) {
    console.error('Error fetching incident:', error);
    throw error;
  }
};

export const updateIncident = async (incidentId, updates) => {
  try {
    const docRef = doc(db, INCIDENTS_COLLECTION, incidentId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    throw error;
  }
};

export const deleteIncident = async (incidentId) => {
  try {
    const docRef = doc(db, INCIDENTS_COLLECTION, incidentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting incident:', error);
    throw error;
  }
};

export const subscribeToIncidents = (callback, filters = {}) => {
  try {
    let constraints = [];
    
    if (filters.type) {
      constraints.push(where('type', '==', filters.type));
    }
    if (filters.severity) {
      constraints.push(where('severity', '==', filters.severity));
    }
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    constraints.push(orderBy('createdAt', 'desc'));
    
    let q = query(collection(db, INCIDENTS_COLLECTION), ...constraints);
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        try {
          const incidents = snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }));
          callback(incidents);
        } catch (mapError) {
          console.error('Error mapping snapshot:', mapError);
          callback([]);
        }
      },
      (error) => {
        console.error('Firestore subscription error:', error);
        callback([]);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error('Error setting up subscription:', error);
    return () => {};
  }
};

export const getRecentIncidents = async (count = 10) => {
  try {
    const ref = getIncidentsRef();
    const q = query(ref, orderBy('createdAt', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching recent incidents:', error);
    return [];
  }
};
