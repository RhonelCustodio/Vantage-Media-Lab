import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp, doc, setDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ==========================================================================
   1. FIREBASE SETUP
   ========================================================================== */
const firebaseConfig = {
    apiKey: "AIzaSyA_JTCBKnJ7zaz8wRSiCpLRU2RcQZ2catw",
    authDomain: "my-firebase-site-a35bb.firebaseapp.com",
    projectId: "my-firebase-site-a35bb",
    storageBucket: "my-firebase-site-a35bb.firebasestorage.app",
    messagingSenderId: "943328160156",
    appId: "1:943328160156:web:9acc1c41989b21b3124059"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Cache
const UI = {
    loginPage: document.getElementById('loginPage'),
    signupPage: document.getElementById('signupPage'),
    loader: document.getElementById('loadingOverlay'),
    loaderText: document.getElementById('loaderText')
};

/* ==========================================================================
   2. UI UTILITIES & NAVIGATION
   ========================================================================== */
const showLoader = (text) => {
    if (UI.loader) { UI.loader.style.display = "flex"; UI.loaderText.innerText = text; }
};
const hideLoader = () => { if (UI.loader) UI.loader.style.display = "none"; };

const navigateTo = (pageToShow, pageToHide) => {
    pageToHide.classList.add('hidden');
    pageToShow.classList.remove('hidden');
    document.querySelectorAll('input').forEach(input => input.value = "");
};

if (document.getElementById('toSignup')) document.getElementById('toSignup').onclick = () => navigateTo(UI.signupPage, UI.loginPage);
if (document.getElementById('toLogin')) document.getElementById('toLogin').onclick = () => navigateTo(UI.loginPage, UI.signupPage);

/* ==========================================================================
   3. SHARED SESSION HANDLER
   ========================================================================== */
async function finalizeUserSession(user, method, manualId = null) {
    showLoader("Syncing Secure Vault...");
    try {
        const uid = manualId || user.uid;
        // Gamit ang setDoc with merge para ma-save ang user profile
        await setDoc(doc(db, "users", uid), {
            email: user.email,
            lastLogin: serverTimestamp(),
            authProvider: method
        }, { merge: true });

        // Save local session data
        localStorage.setItem("loggedInUser", user.email);
        localStorage.setItem("userUID", uid); 
        
        // Success redirect
        setTimeout(() => { window.location.replace("dashboard.html"); }, 1000);
    } catch (e) {
        hideLoader();
        console.error("Firestore Sync Error:", e);
        alert("Database Sync Failed: " + e.message);
    }
}

/* ==========================================================================
   4. AUTHENTICATION FLOWS
   ========================================================================== */

// --- GOOGLE AUTH ---
const triggerGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    // Force account selection para iwas auto-login errors
    provider.setCustomParameters({ prompt: 'select_account' });
    
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    try {
        if (isMobile) { 
            showLoader("Redirecting to Google...");
            await signInWithRedirect(auth, provider); 
        } else {
            const result = await signInWithPopup(auth, provider);
            await finalizeUserSession(result.user, "google");
        }
    } catch (error) { 
        hideLoader();
        alert("Auth Failed: " + error.message); 
    }
};

// --- MANUAL SIGNUP ---
const handleSignup = async () => {
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    if (!email || !pass) return alert("All fields are mandatory.");
    
    try {
        showLoader("Verifying Account...");
        const q = query(collection(db, "users"), where("email", "==", email));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            hideLoader();
            return alert("This email is already registered.");
        }

        showLoader("Creating Identity...");
        const newUserRef = await addDoc(collection(db, "users"), {
            email: email,
            password: pass,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            authProvider: "manual"
        });

        localStorage.setItem("userUID", newUserRef.id);
        localStorage.setItem("loggedInUser", email);
        window.location.replace("dashboard.html"); 
    } catch (e) { 
        hideLoader(); 
        alert("Signup Error: " + e.message); 
    }
};

// --- MANUAL LOGIN ---
const handleLogin = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    if (!email || !pass) return alert("Please enter credentials.");

    try {
        showLoader("Authenticating...");
        const q = query(collection(db, "users"), 
                        where("email", "==", email), 
                        where("password", "==", pass));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const userDoc = snap.docs[0];
            const userId = userDoc.id;
            await updateDoc(doc(db, "users", userId), { lastLogin: serverTimestamp() });
            localStorage.setItem("loggedInUser", email);
            localStorage.setItem("userUID", userId); 
            setTimeout(() => { window.location.replace("dashboard.html"); }, 1000);
        } else {
            hideLoader();
            alert("Invalid Credentials.");
        }
    } catch (e) { 
        hideLoader(); 
        alert("Login Failure: " + e.message); 
    }
};

/* ==========================================================================
   5. PAGE INITIALIZATION & REDIRECT HANDLING
   ========================================================================== */

// Bind Events
if (document.getElementById('saveBtn')) document.getElementById('saveBtn').onclick = handleSignup;
if (document.getElementById('loginBtn')) document.getElementById('loginBtn').onclick = handleLogin;
if (document.getElementById('googleLogin')) document.getElementById('googleLogin').onclick = triggerGoogleAuth;

// CRITICAL: Handle the redirect result when mobile user returns to the page
window.onload = async () => {
    try {
        // 1. Check if we are returning from a Google Redirect
        const result = await getRedirectResult(auth);
        if (result && result.user) {
            console.log("Redirect success:", result.user.email);
            await finalizeUserSession(result.user, "google");
            return; // Stop here if handled
        }

        // 2. Extra safety: Check if user is already signed in via Firebase Auth
        onAuthStateChanged(auth, (user) => {
            if (user && !localStorage.getItem("userUID")) {
                // Kung may user pero walang local session, i-sync ulit
                finalizeUserSession(user, "google");
            }
        });
    } catch (error) {
        hideLoader();
        console.error("Redirect Result Error:", error);
        // Minsan nag-e-error kung na-expire ang redirect state, pero logged in na pala ang user
    }
};