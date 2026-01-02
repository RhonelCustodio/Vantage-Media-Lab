import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider 
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
/**
 * FIXED: Navigation logic to switch between Login and Signup screens
 */
const navigateTo = (pageToShow, pageToHide) => {
    pageToHide.classList.add('hidden');
    pageToShow.classList.remove('hidden');
    // Clear inputs when switching
    document.querySelectorAll('input').forEach(input => input.value = "");
};
// Bind navigation buttons
document.getElementById('toSignup').onclick = () => navigateTo(UI.signupPage, UI.loginPage);
document.getElementById('toLogin').onclick = () => navigateTo(UI.loginPage, UI.signupPage);
/* ==========================================================================
   3. SHARED SESSION HANDLER
   ========================================================================== */
async function finalizeUserSession(user, method, manualId = null) {
    showLoader("Syncing Secure Vault...");
    try {
        const uid = manualId || user.uid;
        // Update user status to ONLINE in Firestore
        await setDoc(doc(db, "users", uid), {
            email: user.email,
            lastLogin: serverTimestamp(),
            authProvider: method
        }, { merge: true });
        // Save local session data
        localStorage.setItem("loggedInUser", user.email);
        localStorage.setItem("userUID", uid); 
        setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
    } catch (e) {
        hideLoader();
        alert("Database Sync Failed: " + e.message);
    }
}
/* ==========================================================================
   4. AUTHENTICATION FLOWS
   ========================================================================== */
// --- GOOGLE AUTH ---
const triggerGoogleAuth = async () => {
    const provider = new GoogleAuthProvider();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    try {
        if (isMobile) { 
            await signInWithRedirect(auth, provider); 
        } else {
            const result = await signInWithPopup(auth, provider);
            await finalizeUserSession(result.user, "google");
        }
    } catch (error) { 
        alert("Auth Failed: " + error.message); 
    }
};
// --- MANUAL SIGNUP (FIXED: Checks for duplicates) ---
document.getElementById('saveBtn').onclick = async () => {
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPass').value.trim();
    if (!email || !pass) return alert("All fields are mandatory.");
    try {
        showLoader("Verifying Account...");
        // Step 1: Check if email already exists
        const q = query(collection(db, "users"), where("email", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
            hideLoader();
            return alert("This email is already registered.");
        }
        // Step 2: Create new user
        showLoader("Creating Identity...");
        const newUserRef = await addDoc(collection(db, "users"), {
            email: email,
            password: pass,
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
            authProvider: "manual"
        });
        // Step 3: Save session and redirect
        localStorage.setItem("userUID", newUserRef.id);
        localStorage.setItem("loggedInUser", email);
        window.location.href = "dashboard.html"; 
    } catch (e) { 
        hideLoader(); 
        alert("Signup Error: " + e.message); 
    }
};
// --- MANUAL LOGIN ---
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
            // Refresh lastLogin to mark as ONLINE
            await updateDoc(doc(db, "users", userId), {
                lastLogin: serverTimestamp() 
            });
            localStorage.setItem("loggedInUser", email);
            localStorage.setItem("userUID", userId); 
            setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
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
   5. PAGE INITIALIZATION
   ========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    // Handle redirect results for mobile Google login
    try {
        const result = await getRedirectResult(auth);
        if (result) await finalizeUserSession(result.user, "google");
    } catch (error) {
        console.error("Redirect Error:", error);
    }
    // Attach Google Auth to button
    const googleBtn = document.getElementById('googleLogin');
    if (googleBtn) googleBtn.onclick = triggerGoogleAuth;
});
