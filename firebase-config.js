import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
         createUserWithEmailAndPassword, GoogleAuthProvider, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, collection, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getRemoteConfig, fetchAndActivate, getValue } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-remote-config.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

// ── FIREBASE CONFIG ──────────────────────────────
const FB_CONFIG = {
  apiKey: "AIzaSyADxLyBiXEf93EsXVFlyCar7rxupJU0pNM",
  authDomain: "tarlatakip-app.firebaseapp.com",
  projectId: "tarlatakip-app",
  storageBucket: "tarlatakip-app.firebasestorage.app",
  messagingSenderId: "398574086576",
  appId: "1:398574086576:web:b77d48009ec6049e3cce75",
  measurementId: "G-Z2PKPCNSXW"
};

let app = null, auth = null, db = null, remoteConfig = null;
let FB_READY = false;
let GEMINI_KEY = null;          // önbellek
let remoteConfigPromise = null; // bekleme promise'i

function initFirebase(){
  if(!FB_CONFIG.apiKey){ window.FB_MODE=false; return; }
  try{
    app = initializeApp(FB_CONFIG);
    auth = getAuth(app);
    db = getFirestore(app);
    remoteConfig = getRemoteConfig(app);
    remoteConfig.settings = { minimumFetchIntervalMillis: 3600000 }; // 1 saat
    window.FB_AUTH = auth;
    window.FB_DB   = db;
    window.FB_MODE = true;
    FB_READY = true;

    // Remote Config'i hemen yükle (arka planda)
    remoteConfigPromise = fetchAndActivate(remoteConfig)
      .then(() => {
        GEMINI_KEY = getValue(remoteConfig, 'GMINIK').asString();
        if(!GEMINI_KEY) console.warn('Remote Config: GMINIK parametresi bulunamadı');
        else console.log('Remote Config: Gemini anahtarı alındı');
      })
      .catch(err => console.error('Remote Config hatası:', err));

    onAuthStateChanged(auth, user => {
      window.FB_USER = user;
      if(typeof window.onAuthChange === 'function') window.onAuthChange(user);
    });
  }catch(e){ console.warn('Firebase init error:', e); window.FB_MODE=false; }
       if (app) {
    functions = getFunctions(app);
    window.FB_FUNCTIONS = functions;
           }
                  window.fbCallFunction = async (name, data) => {
                    if (!functions) throw new Error('Functions not initialized');
                    const callable = httpsCallable(functions, name);
                    const result = await callable(data);
                    return result.data;
                  };
};

// Remote Config'ten Gemini anahtarını al (senkron/async)
window.getGeminiKey = async () => {
  if(GEMINI_KEY) return GEMINI_KEY;
  if(remoteConfigPromise) await remoteConfigPromise;
  if(!GEMINI_KEY && remoteConfig) {
    try {
      await fetchAndActivate(remoteConfig);
      GEMINI_KEY = getValue(remoteConfig, 'GMINIK').asString();
    } catch(e) { console.warn('Remote Config tekrar deneme hatası:', e); }
  }
  return GEMINI_KEY || null;
};

// Expose Firestore helpers
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
