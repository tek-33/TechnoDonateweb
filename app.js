import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, deleteDoc, initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === 1. CONFIG FIREBASE (วางค่าคีย์ของคุณตรงนี้) ===
const firebaseConfig = {
    apiKey: "AIzaSyAkEP8z5hY3MCGO2Git8ibRrPowZLF-avU",
    authDomain: "technogendonatedikub.firebaseapp.com",
    projectId: "technogendonatedikub",
    storageBucket: "technogendonatedikub.firebasestorage.app",
    messagingSenderId: "1031916391721",
    appId: "1:1031916391721:web:0aacf2514177b9cfb9fb38",
    measurementId: "G-NT9BHEBYKW"
};

const app = initializeApp(firebaseConfig);

// แก้ไขจุดนี้: ตั้งค่า Firestore ให้เขียนส่งตรงไปยัง Cloud ทันทีโดยไม่ผ่าน Cache ที่หน่วงระบบ
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// === APP STATE ===
let queue = [];
let isPlaying = false;
let ttsEnabled = true;
let processedIds = new Set();
let isSystemInitialized = false;

// === DOM ELEMENTS ===
const views = {
    submission: document.getElementById('submission-page'),
    login: document.getElementById('login-page'),
    display: document.getElementById('display-page')
};
const mainHeader = document.getElementById('main-header');
const globalNav = document.getElementById('global-nav');
const globalStatus = document.getElementById('global-status');
const navDisplayBtn = document.getElementById('nav-display-btn');

// --- หน้าสลับ View ---
function switchView(viewName) {
    Object.keys(views).forEach(key => {
        views[key].classList.add('hidden');
        views[key].classList.remove('active-view');
    });
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active-view');

    if (viewName === 'display') {
        if (mainHeader) mainHeader.classList.add('hidden');
        if (globalStatus) globalStatus.classList.add('hidden');
        if (globalNav) globalNav.classList.add('hidden');
    } else {
        if (mainHeader) mainHeader.classList.remove('hidden');
        if (globalStatus) globalStatus.classList.remove('hidden');
        if (globalNav) globalNav.classList.remove('hidden');
    }
}

if (navDisplayBtn) {
    navDisplayBtn.addEventListener('click', () => {
        if (sessionStorage.getItem('display_auth') === 'true') {
            switchView('display');
        } else {
            switchView('login');
        }
    });
}
if (document.getElementById('back-to-form')) {
    document.getElementById('back-to-form').addEventListener('click', () => switchView('submission'));
}

// === LOGIC หน้า LOGIN GATES ===
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const error = document.getElementById('login-error');

        if (email === 'xnytxs@gmail.com' && pass === 'h6h6h678') {
            sessionStorage.setItem('display_auth', 'true');
            if (error) error.classList.add('hidden');
            switchView('display');
        } else {
            if (error) error.classList.remove('hidden');
        }
    });
}

const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('display_auth');
        switchView('submission');
    });
}

// === GLOBAL REAL-TIME LISTENER (รับส่งข้อมูลแบบ Millisecond Realtime) ===
function initGlobalListener() {
    if (isSystemInitialized) return;
    isSystemInitialized = true;

    const connDot = document.getElementById('conn-dot');
    const connText = document.getElementById('conn-text');

    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));

    onSnapshot(q, (snapshot) => {
        if (connDot) connDot.classList.add('online');
        if (connText) connText.textContent = 'Connected Realtime';

        const totalCountEl = document.getElementById('total-count');
        const dispTotalCountEl = document.getElementById('disp-total-count');
        if (totalCountEl) totalCountEl.textContent = snapshot.size;
        if (dispTotalCountEl) dispTotalCountEl.textContent = snapshot.size;

        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const data = { id: change.doc.id, ...change.doc.data() };
                if (!processedIds.has(data.id)) {
                    processedIds.add(data.id);
                    queue.push(data);
                    processDisplayQueue();
                }
            }
        });
    }, (err) => {
        console.error("Firebase connection error: ", err);
        if (connDot) connDot.classList.remove('online');
        if (connText) connText.textContent = 'Disconnected';
    });
}

// === ENGINE คิวหมุนเวียน 6 วินาที และเสียงอ่าน (TTS) ===
function processDisplayQueue() {
    if (isPlaying || queue.length === 0) return;
    isPlaying = true;

    const currentMsg = queue.shift();
    const emptyState = document.getElementById('empty-state');
    const heroCard = document.getElementById('hero-card');

    if (emptyState) emptyState.classList.add('hidden');
    if (heroCard) heroCard.classList.remove('hidden');

    const heroNickEl = document.getElementById('hero-nickname');
    const heroMsgEl = document.getElementById('hero-message');
    if (heroNickEl) heroNickEl.textContent = currentMsg.nickname;
    if (heroMsgEl) heroMsgEl.textContent = currentMsg.message;

    const progress = document.getElementById('hero-progress');
    if (progress) {
        progress.style.animation = 'none';
        void progress.offsetWidth;
        progress.style.animation = 'scale-drain 6s linear forwards';
    }

    if (ttsEnabled) {
        playNaturalTTS(currentMsg.nickname, currentMsg.message);
    }

    setTimeout(() => {
        if (heroCard) heroCard.classList.add('hidden');
        pushToArchiveStrip(currentMsg);
        isPlaying = false;

        if (queue.length > 0) {
            processDisplayQueue();
        } else {
            if (emptyState) emptyState.classList.remove('hidden');
        }
    }, 6000);
}

function playNaturalTTS(nickname, message) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const textTemplate = `${nickname} ส่งข้อความว่า ${message}`;
    const utterance = new SpeechSynthesisUtterance(textTemplate);

    const isThai = /[\u0E00-\u0E7F]/.test(textTemplate);
    utterance.lang = isThai ? 'th-TH' : 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
}

function pushToArchiveStrip(msg) {
    const container = document.getElementById('archive-container');
    if (!container) return;
    const item = document.createElement('div');
    item.className = 'archive-item';
    item.innerHTML = `<span class="gold-accent">${msg.nickname}:</span> <span>${msg.message}</span>`;
    container.appendChild(item);
    container.scrollLeft = container.scrollWidth;
}

// === SUBMISSION FORM ENGINE (แก้ปัญหาค้างที่หน้าหมุน) ===
const form = document.getElementById('donate-form');
const messageInput = document.getElementById('message');
const charCounter = document.getElementById('char-counter');
const submitBtn = document.getElementById('submit-btn');
const cooldownContainer = document.getElementById('cooldown-container');
const cooldownBar = document.getElementById('cooldown-bar');
const profanityWarning = document.getElementById('profanity-warning');
const loadingOverlay = document.getElementById('loading-overlay');
const toast = document.getElementById('toast');

const badWords = ['fuck', 'shit', 'ควย', 'สัส', 'เหี้ย', 'เย็ด'];

if (messageInput && charCounter) {
    messageInput.addEventListener('input', () => {
        charCounter.textContent = `${messageInput.value.length} / 200`;
    });
}

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nick = document.getElementById('nickname').value.trim();
        const msg = messageInput.value.trim();

        if (badWords.some(w => nick.toLowerCase().includes(w) || msg.toLowerCase().includes(w))) {
            if (profanityWarning) profanityWarning.classList.remove('hidden');
            return;
        }
        if (profanityWarning) profanityWarning.classList.add('hidden');

        if (loadingOverlay) loadingOverlay.classList.remove('hidden');

        try {
            // บันทึกข้อมูลลงฐานข้อมูลโดยตรง
            await addDoc(collection(db, "messages"), {
                nickname: nick,
                message: msg,
                timestamp: serverTimestamp()
            });

            // ปลดล็อค UI ทันทีเมื่อ Firebase บันทึกเรียบร้อย
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
            if (toast) {
                toast.classList.remove('hidden');
                setTimeout(() => toast.classList.add('hidden'), 3000);
            }
            form.reset();
            if (charCounter) charCounter.textContent = '0 / 200';

            // จัดการ Cooldown แถบอนิเมชั่น 10 วินาที
            if (submitBtn && cooldownContainer && cooldownBar) {
                submitBtn.disabled = true;
                cooldownContainer.classList.remove('hidden');
                cooldownBar.style.animation = 'none';
                void cooldownBar.offsetWidth;
                cooldownBar.style.animation = 'scale-drain 10s linear forwards';

                setTimeout(() => {
                    submitBtn.disabled = false;
                    cooldownContainer.classList.add('hidden');
                }, 10000);
            }

        } catch (err) {
            if (loadingOverlay) loadingOverlay.classList.add('hidden');
            console.error(err);
            alert("ไม่สามารถส่งข้อมูลได้ กรุณาตรวจสอบให้แน่ใจว่าได้เปิด Firestore ในโหมด Test Mode แล้วบน Firebase Console");
        }
    });
}

// === CONTROLS ZONE ===
const ttsToggle = document.getElementById('tts-toggle');
if (ttsToggle) {
    ttsToggle.addEventListener('click', (e) => {
        ttsEnabled = !ttsEnabled;
        e.target.textContent = ttsEnabled ? '🔊 TTS: ON' : '🔇 TTS: OFF';
        e.target.classList.toggle('active', ttsEnabled);
    });
}

const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (confirm('Delete all records in Firestore? This cannot be undone.')) {
            const snap = await getDocs(collection(db, "messages"));
            snap.forEach(docSnap => deleteDoc(docSnap.ref));
            queue = [];
            processedIds.clear();
            const archContainer = document.getElementById('archive-container');
            const heroCard = document.getElementById('hero-card');
            const emptyState = document.getElementById('empty-state');

            if (archContainer) archContainer.innerHTML = '';
            if (heroCard) heroCard.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
            isPlaying = false;
            if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        }
    });
}

const fsBtn = document.getElementById('fullscreen-btn');
if (fsBtn) {
    fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
    });
}

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });
}

// STARTUP APPLICATION RUNTIME
initGlobalListener();
