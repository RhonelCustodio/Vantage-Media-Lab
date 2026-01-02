import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    signInWithRedirect, 
    getRedirectResult, 
    GoogleAuthProvider 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    serverTimestamp, 
    doc, 
    setDoc,
    updateDoc 
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
const loader = document.getElementById('loadingOverlay');
const loaderText = document.getElementById('loaderText');
const showLoader = (text) => {
    if (loader) { loader.style.display = "flex"; loaderText.innerText = text; }
};
const hideLoader = () => { if (loader) loader.style.display = "none"; };
/* ==========================================================================
   2. SHARED SESSION HANDLER
   ========================================================================== */
async function finalizeUserSession(user, method, manualId = null) {
    showLoader("Syncing Secure Vault...");
    try {
        const uid = manualId || user.uid;
        // This line makes the user "Online" in the Admin Panel
        await setDoc(doc(db, "users", uid), {
            email: user.email,
            lastLogin: serverTimestamp(), // SETS TO CURRENT TIME
            authProvider: method
        }, { merge: true });
        localStorage.setItem("loggedInUser", user.email);
        localStorage.setItem("userUID", uid); 
        setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
    } catch (e) {
        hideLoader();
        alert("Database Sync Failed: " + e.message);
    }
}
/* ==========================================================================
   3. AUTHENTICATION FLOWS
   ========================================================================== */
// --- GOOGLE AUTH ---
const triggerGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    try {
        if (isMobile) { await signInWithRedirect(auth, provider); } 
        else {
            const result = await signInWithPopup(auth, provider);
            await finalizeUserSession(result.user, "google");
        }
    } catch (error) { alert("Auth Failed: " + error.message); }
};
// --- MANUAL SIGNUP (FIXED) ---
document.getElementById('saveBtn').onclick = async () => {
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    if (!email || !pass) return alert("Fields mandatory.");
    try {
        showLoader("Creating Identity...");
        const newUserRef = await addDoc(collection(db, "users"), {
            email,
            password: pass,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(), // INDICATES ONLINE IMMEDIATELY
            authProvider: "manual"
        });
        localStorage.setItem("userUID", newUserRef.id);
        localStorage.setItem("loggedInUser", email);
        window.location.href = "dashboard.html"; 
    } catch (e) { hideLoader(); alert("Error: " + e.message); }
};
// --- MANUAL LOGIN (FIXED: NOW UPDATES ONLINE STATUS) ---
document.getElementById('loginBtn').onclick = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value.trim();
    try {
        showLoader("Authenticating...");
        const q = query(collection(db, "users"), 
                        where("email", "==", email), 
                        where("password", "==", pass));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const userDoc = snap.docs[0];
            const userId = userDoc.id;
            // CRITICAL FIX: Update lastLogin so Admin Panel sees "Online"
            await updateDoc(doc(db, "users", userId), {
                lastLogin: serverTimestamp() 
            });
            // Save for the Dashboard Logout script
            localStorage.setItem("loggedInUser", email);
            localStorage.setItem("userUID", userId); 
            setTimeout(() => { window.location.href = "dashboard.html"; }, 2000);
        } else {
            hideLoader();
            alert("Invalid Credentials.");
        }
    } catch (e) { hideLoader(); alert("Login Failure: " + e.message); }
};
/* ==========================================================================
   4. INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    const result = await getRedirectResult(auth);
    if (result) await finalizeUserSession(result.user, "google");
    const googleBtn = document.getElementById('googleLogin');
    if (googleBtn) googleBtn.onclick = triggerGoogleAuth;
});