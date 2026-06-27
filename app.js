import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === 1. CONFIG FIREBASE (นำคีย์ของคุณมาวางทับที่นี่ได้เลยครับ) ===
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === DOM ELEMENTS ===
const views = {
    submission: document.getElementById('submission-page'),
    login: document.getElementById('login-page'),
    display: document.getElementById('display-page')
};
const globalHeader = document.querySelector('.global-header');
const globalStatus = document.getElementById('global-status');
const navDisplayBtn = document.getElementById('nav-display-btn');

// --- Navigation Logic ---
function switchView(viewName) {
    Object.keys(views).forEach(key => {
        views[key].classList.add('hidden');
        views[key].classList.remove('active-view');
    });
    views[viewName].classList.remove('hidden');
    views[viewName].classList.add('active-view');

    // จัดการการแสดงผล Header/Footer ส่วนกลาง
    if (viewName === 'display') {
        globalHeader.classList.add('hidden');
        globalStatus.classList.add('hidden');
        navDisplayBtn.classList.add('hidden');
    } else {
        globalHeader.classList.remove('hidden');
        globalStatus.classList.remove('hidden');
        navDisplayBtn.classList.remove('hidden');
    }
}

navDisplayBtn.addEventListener('click', () => {
    if (sessionStorage.getItem('display_auth') === 'true') {
        switchView('display');
        startLiveDisplay();
    } else {
        switchView('login');
    }
});

document.getElementById('back-to-form').addEventListener('click', () => switchView('submission'));

// === PAGE 2: ADMIN LOGIN GATE ===
document.getElementById('login-btn').addEventListener('click', () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    const error = document.getElementById('login-error');

    if (email === 'xnytxs@gmail.com' && pass === 'h6h6h678') {
        sessionStorage.setItem('display_auth', 'true');
        error.classList.add('hidden');
        switchView('display');
        startLiveDisplay();
    } else {
        error.classList.remove('hidden');
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('display_auth');
    switchView('submission');
});


// === PAGE 1: SUBMISSION FORM LOGIC ===
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

messageInput.addEventListener('input', () => {
    charCounter.textContent = `${messageInput.value.length} / 200`;
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nick = document.getElementById('nickname').value.trim();
    const msg = messageInput.value.trim();

    if (badWords.some(w => nick.toLowerCase().includes(w) || msg.toLowerCase().includes(w))) {
        profanityWarning.classList.remove('hidden');
        return;
    }
    profanityWarning.classList.add('hidden');

    loadingOverlay.classList.remove('hidden');
    try {
        await addDoc(collection(db, "messages"), {
            nickname: nick,
            message: msg,
            timestamp: serverTimestamp()
        });
        loadingOverlay.classList.add('hidden');
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
        form.reset();
        charCounter.textContent = '0 / 200';

        // Cooldown 10s
        submitBtn.disabled = true;
        cooldownContainer.classList.remove('hidden');
        cooldownBar.style.animation = 'none';
        void cooldownBar.offsetWidth;
        cooldownBar.style.animation = 'progress-drain 10s linear forwards';
        setTimeout(() => {
            submitBtn.disabled = false;
            cooldownContainer.classList.add('hidden');
        }, 10000);

    } catch (err) {
        loadingOverlay.classList.add('hidden');
        alert("Error sending message.");
    }
});


// === PAGE 3: LIVE DISPLAY & TTS (TEXT TO SPEECH) LOGIC ===
let queue = [];
let isPlaying = false;
let ttsEnabled = true;
let processedIds = new Set();
let unsubMessages, unsubCount;

function startLiveDisplay() {
    if (unsubMessages) return; // ป้องกันการผูก Event ซ้ำซ้อน

    // Live Count
    unsubCount = onSnapshot(collection(db, "messages"), (snap) => {
        document.getElementById('disp-total-count').textContent = snap.size;
    });

    // Real-time Queue Listener
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    unsubMessages = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const data = { id: change.doc.id, ...change.doc.data() };
                if (!processedIds.has(data.id)) {
                    queue.push(data);
                    processedIds.add(data.id);
                    processQueue();
                }
            }
        });
    });
}

function processQueue() {
    if (isPlaying || queue.length === 0) return;
    isPlaying = true;

    const currentMsg = queue.shift();
    const emptyState = document.getElementById('empty-state');
    const heroCard = document.getElementById('hero-card');

    emptyState.classList.add('hidden');
    heroCard.classList.remove('hidden');

    document.getElementById('hero-nickname').textContent = currentMsg.nickname;
    document.getElementById('hero-message').textContent = currentMsg.message;

    // เอฟเฟกต์หลอดเวลานับถอยหลัง 6 วินาที
    const progress = document.getElementById('hero-progress');
    progress.style.animation = 'none';
    void progress.offsetWidth;
    progress.style.animation = 'progress-drain 6s linear forwards';

    // 🔥 ฟังก์ชันอ่านออกเสียงชื่อและข้อความ (TTS)
    if (ttsEnabled) {
        playTTS(currentMsg.nickname, currentMsg.message);
    }

    setTimeout(() => {
        heroCard.classList.add('hidden');
        moveToArchive(currentMsg);
        isPlaying = false;
        if (queue.length > 0) {
            processQueue();
        } else {
            emptyState.classList.remove('hidden');
        }
    }, 6000);
}

function playTTS(nickname, message) {
    if (!('speechSynthesis' in window)) return;

    // บังคับรูปแบบการอ่านคำตามเงื่อนไข: [ชื่อ] ส่งข้อความว่า [ข้อความ]
    const fullTextToRead = `${nickname} ส่งข้อความว่า ${message}`;
    const utterance = new SpeechSynthesisUtterance(fullTextToRead);

    // ตรวจสอบภาษาเพื่อเลือก Voice Engine (ถ้ามีภาษาไทยให้ใช้ th-TH)
    const isThai = /[\u0E00-\u0E7F]/.test(fullTextToRead);
    utterance.lang = isThai ? 'th-TH' : 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
}

function moveToArchive(msg) {
    const container = document.getElementById('archive-container');
    const item = document.createElement('div');
    item.className = 'archive-item glass-panel';
    item.innerHTML = `<span class="gold-accent">${msg.nickname}:</span> <span>${msg.message}</span>`;
    container.appendChild(item);
    container.scrollLeft = container.scrollWidth;
}

// --- Admin Control Handlers ---
document.getElementById('tts-toggle').addEventListener('click', (e) => {
    ttsEnabled = !ttsEnabled;
    e.target.textContent = ttsEnabled ? '🔊 TTS: ON' : '🔇 TTS: OFF';
    e.target.classList.toggle('active', ttsEnabled);
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    if (confirm('Reset all messages? This cannot be undone.')) {
        const snap = await getDocs(collection(db, "messages"));
        snap.forEach(docSnap => deleteDoc(docSnap.ref));
        queue = [];
        processedIds.clear();
        document.getElementById('archive-container').innerHTML = '';
        document.getElementById('hero-card').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
        isPlaying = false;
    }
});

document.getElementById('fullscreen-btn').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});

// Sync counter for Form view
onSnapshot(collection(db, "messages"), (snap) => {
    document.getElementById('total-count').textContent = snap.size;
    const dot = document.getElementById('conn-dot');
    dot.classList.add('online');
    document.getElementById('conn-text').textContent = 'Online';
});

// Check auto auth
if (sessionStorage.getItem('display_auth') === 'true') {
    // เริ่มทำงานเงียบๆ เผื่อกรณีแอดมิน f5 หน้าเว็บ
}