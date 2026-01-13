import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
/* ==========================================================================
   1. FIREBASE CONFIGURATION & INITIALIZATION
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
const db = getFirestore(app);
/* ==========================================================================
   2. VANTAGE APPLICATION CORE
   ========================================================================== */
const VantageApp = {
    CONFIG: {
        TOTAL_ASSETS: 1000,
        BATCH_SIZE: 24,
        SOFTWARE: ["Photoshop", "Procreate", "Illustrator", "Clip Studio"]
    },
    state: {
        allData: [],
        filteredData: [],
        currentIndex: 0,
        isSyncing: false,
        activeFilter: 'All',
        // Get the UID stored during login to target the correct Firestore doc
        currentUserId: localStorage.getItem("userUID") 
    },
    /**
     * UPDATED: handleLogout
     * Sets status to Offline in Firebase by setting lastLogin to Epoch 0
     */
    async handleLogout() {
        if (confirm("Terminate secure session?")) {
            const overlay = document.getElementById('logoutOverlay');
            if (overlay) overlay.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            // --- FIREBASE SYNC: SET OFFLINE ---
            if (this.state.currentUserId) {
                try {
                    const userRef = doc(db, "users", this.state.currentUserId);
                    await updateDoc(userRef, {
                        lastLogin: new Date(0) // Marks user as offline for Admin Panel
                    });
                } catch (error) {
                    console.error("Firebase Status Update Failed:", error);
                }
            }
            // Clear local session
            localStorage.removeItem("loggedInUser");
            localStorage.removeItem("userUID");
            // Redirect after a cinematic delay
            setTimeout(() => {
                window.location.href = "index.html";
            }, 3000); // Reduced to 3s for better UX
        }
    },
    async downloadImage(url, filename) {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'vantage-art.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed:", error);
            window.open(url, '_blank');
        }
    },
    init() {
        this.verifySession();
        this.state.allData = this.generateLibrary();
        this.state.filteredData = [...this.state.allData];
        this.renderBatch();
        this.initInfiniteScroll();
        this.initPresenceTracker();
    },
    verifySession() {
        const user = localStorage.getItem("loggedInUser");
        if (!user) return window.location.href = "index.html";
        const display = document.getElementById('userDisplay');
        if(display) display.innerText = user.split('@')[0];
    },
    generateLibrary() {
        return Array.from({ length: this.CONFIG.TOTAL_ASSETS }, (_, i) => {
            const id = i + 1;
            return {
                id: `AZ-${id.toString().padStart(3, '0')}`,
                title: `Azawan Art #${id}`,
                url: `https://picsum.photos/seed/azawanArt${id}/1200/800`, 
                software: this.CONFIG.SOFTWARE[id % this.CONFIG.SOFTWARE.length],
                canvas: id % 2 === 0 ? "3000 x 4000" : "2048 x 2048"
            };
        });
    },
    filterGallery(category) {
        if (this.state.activeFilter === category || this.state.isSyncing) return;
        this.state.activeFilter = category;
        this.state.currentIndex = 0;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.innerText.includes(category));
        });
        const dropdown = document.querySelector('.mobile-filter-dropdown');
        if (dropdown) dropdown.value = category;
        this.state.filteredData = category === 'All' 
            ? [...this.state.allData] 
            : this.state.allData.filter(item => item.software === category);
        const mainGrid = document.getElementById('mainGrid');
        if (mainGrid) mainGrid.innerHTML = '';
        this.renderBatch();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    renderBatch() {
        if (this.state.isSyncing) return;
        if (this.state.currentIndex >= this.state.filteredData.length) {
            const btn = document.getElementById('loadMoreBtn');
            if(btn) btn.style.display = 'none';
            return;
        }
        this.state.isSyncing = true;
        const fragment = document.createDocumentFragment();
        const nextBatch = this.state.filteredData.slice(
            this.state.currentIndex, 
            this.state.currentIndex + this.CONFIG.BATCH_SIZE
        );
        nextBatch.forEach(item => {
            fragment.appendChild(this.createCardUI(item));
        });
        document.getElementById('mainGrid').appendChild(fragment);
        this.state.currentIndex += this.CONFIG.BATCH_SIZE;
        this.state.isSyncing = false;
    },
    createCardUI(item) {
        const card = document.createElement('div');
        card.className = 'media-card';
        card.innerHTML = `
            <div class="img-wrapper" onclick="VantageApp.openPreview('${item.url}')">
                <img src="${item.url}" alt="${item.title}" loading="lazy">
                <div class="exif-overlay">
                    <strong>Technical Overview</strong><br>
                    Tool: ${item.software}<br>
                    Canvas: ${item.canvas}
                </div>
            </div>
            <div class="card-footer">
                <div class="stats">
                    <strong style="font-size: 0.9rem; display: block; margin-bottom: 2px; color: var(--text-main);">${item.title}</strong>
                    <span class="software" style="color:var(--brand); font-size:0.7rem;">${item.software.toUpperCase()}</span>
                </div>
                <button onclick="event.stopPropagation(); VantageApp.downloadImage('${item.url}', 'Vantage-${item.id}.jpg')" class="download-link">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
            </div>
        `;
        return card;
    },
    openPreview(imgUrl) {
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImg');
        modalImg.style.opacity = '0';
        modalImg.src = imgUrl;
        modal.style.display = 'flex';
        document.body.style.top = `-${window.scrollY}px`;
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        modalImg.onload = () => {
            requestAnimationFrame(() => {
                modal.classList.add('active');
                modalImg.style.opacity = '1';
            });
        };
    },
    closePreview() {
        const modal = document.getElementById('imageModal');
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }, 300);
    },
    initInfiniteScroll() {
        const btn = document.getElementById('loadMoreBtn');
        if(!btn) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !this.state.isSyncing) {
                this.renderBatch();
            }
        }, { rootMargin: '600px' });
        observer.observe(btn);
    },
    /**
     * Handles browser/tab closing to set user offline
     */
    initPresenceTracker() {
        window.addEventListener('beforeunload', () => {
            if (this.state.currentUserId) {
                const userRef = doc(db, "users", this.state.currentUserId);
                updateDoc(userRef, { lastLogin: new Date(0) });
            }
        });
    }
};
/* ==========================================================================
   3. GLOBAL EXPOSURE
   ========================================================================== */
window.VantageApp = VantageApp;
window.filterGallery = (cat) => VantageApp.filterGallery(cat);
window.closePreview = () => VantageApp.closePreview();
window.handleLogout = () => VantageApp.handleLogout();
document.addEventListener('DOMContentLoaded', () => {
    VantageApp.init();
    // Session Guard Logic
    const loggedInUser = localStorage.getItem("loggedInUser");
    if (!loggedInUser) {
        window.location.href = "index.html"; 
    } else {
        const userDisplay = document.getElementById('userEmailDisplay');
        if(userDisplay) userDisplay.innerText = loggedInUser;
    }
});