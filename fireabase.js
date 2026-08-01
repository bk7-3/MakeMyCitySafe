import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage, ref } from "firebase/storage";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDYFXYHiC9CpYy_qPruIs4DaY2WjIxMoAE",
  authDomain: "studentsafeway-1405e.firebaseapp.com",
  projectId: "studentsafeway-1405e",
  storageBucket: "studentsafeway-1405e.firebasestorage.app",
  messagingSenderId: "1018225702716",
  appId: "1:1018225702716:web:d5438580de888a883a5039",
  measurementId: "G-JKKGD5VJGZ"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const storage = getStorage();

export const auth = getAuth();
