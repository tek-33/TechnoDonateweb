import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    onSnapshot,
    query,
    orderBy,
    getDocs,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// TODO: Replace with your Firebase Project Configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

let app, db;

export function initFirebase() {
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log("Firebase initialized successfully");
        return true;
    } catch (error) {
        console.error("Firebase init error:", error);
        return false;
    }
}

export async function addMessage(nickname, message) {
    try {
        const docRef = await addDoc(collection(db, "messages"), {
            nickname: nickname,
            message: message,
            timestamp: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error("Error adding message: ", error);
        throw error;
    }
}

export function listenForMessages(callback) {
    const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docChanges());
    }, (error) => {
        console.error("Listener error:", error);
    });
}

export function getMessageCount(callback) {
    const q = query(collection(db, "messages"));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.size);
    });
}

export async function deleteAllMessages() {
    try {
        const q = query(collection(db, "messages"));
        const snapshot = await getDocs(q);
        const deletePromises = [];
        snapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(docSnap.ref));
        });
        await Promise.all(deletePromises);
        console.log("All messages deleted.");
    } catch (error) {
        console.error("Error deleting messages: ", error);
    }
}
