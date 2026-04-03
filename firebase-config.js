import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, GoogleAuthProvider, signOut }
// Remote Config'i içe aktar
import { getRemoteConfig, getValue, fetchAndActivate } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-remote-config.js';
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, collection, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ── FIREBASE CONFIG ──────────────────────────────
// Bu değerleri Firebase Console'dan alın:
// console.firebase.google.com → Projeniz → Ayarlar → Genel → Web uygulaması
const FB_CONFIG = {
  apiKey: "AIzaSyADxLyBiXEf93EsXVFlyCar7rxupJU0pNM",
  authDomain: "tarlatakip-app.firebaseapp.com",
  projectId: "tarlatakip-app",
  storageBucket: "tarlatakip-app.firebasestorage.app",
  messagingSenderId: "398574086576",
  appId: "1:398574086576:web:b77d48009ec6049e3cce75",
  measurementId: "G-Z2PKPCNSXW"
};
// Remote Config Kurulumu
const remoteConfig = getRemoteConfig(app);
remoteConfig.settings.minimumFetchIntervalMillis = 3600000; // 1 saat önbelleğe alır

window.getGeminiKey = async () => {
  try {
    await fetchAndActivate(remoteConfig);
    return getValue(remoteConfig, 'GMINIK').asString();
  } catch (err) {
    console.error("Key çekilemedi:", err);
    return null;
  }
};
let app=null, auth=null, db=null;
let FB_READY = false;

function initFirebase(){
  if(!FB_CONFIG.apiKey){ window.FB_MODE=false; return; }
  try{
    app = initializeApp(FB_CONFIG);
    auth = getAuth(app);
    db   = getFirestore(app);
    window.FB_AUTH = auth;
    window.FB_DB   = db;
    window.FB_MODE = true;
    FB_READY = true;
    onAuthStateChanged(auth, user => {
      window.FB_USER = user;
      if(typeof window.onAuthChange === 'function') window.onAuthChange(user);
    });
  }catch(e){ console.warn('Firebase init error:', e); window.FB_MODE=false; }
}
initFirebase();

// Expose Firestore helpers globally
window.fbSaveField = async (uid, field) => {
  if(!db) return;
  const ref = doc(db, 'users', uid, 'fields', field.id);
  await setDoc(ref, field);
};
window.fbDeleteField = async (uid, fieldId) => {
  if(!db) return;
  await deleteDoc(doc(db, 'users', uid, 'fields', fieldId));
};
window.fbLoadFields = async (uid) => {
  if(!db) return [];
  const snap = await getDocs(collection(db, 'users', uid, 'fields'));
  return snap.docs.map(d => d.data());
};
window.fbSignInGoogle = async () => {
  const prov = new GoogleAuthProvider();
  return signInWithPopup(auth, prov);
};
window.fbSignInEmail = async (email, pass) => signInWithEmailAndPassword(auth, email, pass);
window.fbRegisterEmail = async (email, pass) => createUserWithEmailAndPassword(auth, email, pass);
window.fbSignOut = async () => signOut(auth);

