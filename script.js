import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDGQSe7gM2B98dM-dyWQntnW5-xoGszqHM",
    authDomain: "arkibo-main.firebaseapp.com",
    projectId: "arkibo-main",
    storageBucket: "arkibo-main.firebasestorage.app",
    messagingSenderId: "1046866357001",
    appId: "1:1046866357001:web:218c5a551c6cdaead301d8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- NAVIGATION ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const targetPage = document.getElementById(id);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        if (id === 'reminderListPage') loadReminders();
        if (id === 'scheduleListPage') loadSchedules();
    }
};

window.gotoSignUp = () => showPage("signupPage");
window.gotoLogin = () => showPage("loginPage");
window.backToMenu = () => showPage("menuPage");
window.goTo = (section) => showPage(section + "Page");

window.showSignUpForm = () => {
    document.getElementById("signupFormFields").classList.remove("hidden");
    document.getElementById("termsBox").classList.add("hidden");
};

// --- DYNAMIC FIELDS ---
const roleSelect = document.getElementById("roleSelect");
if(roleSelect) {
    roleSelect.addEventListener("change", (e) => {
        const role = e.target.value;
        document.getElementById("signupLRN").classList.toggle("hidden", role !== "student");
        document.getElementById("signupSection").classList.toggle("hidden", role !== "student");
        document.getElementById("signupEmpID").classList.toggle("hidden", role !== "teacher");
    });
}

// --- FIREBASE AUTH ---
document.getElementById("signupBtn").addEventListener("click", async () => {
    const name = document.getElementById("signupName").value;
    const email = document.getElementById("signupEmail").value;
    const pass = document.getElementById("signupPass").value;
    const role = document.getElementById("roleSelect").value;
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const userData = {
            uid: userCredential.user.uid,
            fullName: name,
            role: role,
            email: email,
            reminders: [],
            schedules: []
        };
        if (role === 'student') {
            userData.lrn = document.getElementById("signupLRN").value;
            userData.section = document.getElementById("signupSection").value;
        } else {
            userData.empID = document.getElementById("signupEmpID").value;
        }
        await setDoc(doc(db, "users", userCredential.user.uid), userData);
        alert("Account Created Successfully!");
    } catch (error) { alert(error.message); }
});

document.getElementById("loginBtn").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const pass = document.getElementById("loginPass").value;
    try { await signInWithEmailAndPassword(auth, email, pass); } 
    catch (error) { alert("Login Failed: " + error.message); }
});

window.logout = () => {
    signOut(auth).then(() => {
        localStorage.removeItem("arkiboUser");
        showPage("loginPage");
    });
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            localStorage.setItem("arkiboUser", JSON.stringify(docSnap.data()));
            showPage("menuPage");
            startNotificationCheck();
        }
    } else { showPage("loginPage"); }
});

window.showProfile = () => {
    const user = JSON.parse(localStorage.getItem("arkiboUser"));
    if (user) {
        document.getElementById("profileName").innerText = user.fullName;
        document.getElementById("profileRole").innerText = user.role.toUpperCase();
        document.getElementById("profileExtra").innerText = user.lrn || user.empID || "N/A";
        showPage("profilePage");
    }
};

// --- CLOUD DATA HELPERS ---
async function syncLocalData() {
    const user = auth.currentUser;
    if (user) {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            localStorage.setItem("arkiboUser", JSON.stringify(docSnap.data()));
            return docSnap.data();
        }
    }
    return JSON.parse(localStorage.getItem("arkiboUser"));
}

window.addReminder = async () => {
    const name = document.getElementById("reminderName").value;
    const date = document.getElementById("reminderDate").value;
    if (!name || !date) return alert("Fill all fields");
    if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            reminders: arrayUnion({ name, date })
        });
        await syncLocalData();
        alert("Reminder Saved!");
        document.getElementById("reminderName").value = "";
        document.getElementById("reminderDate").value = "";
        enableNotifications();
    }
};

window.addSchedule = async () => {
    const subj = document.getElementById("subject").value;
    const time = document.getElementById("studyTime").value;
    if (!subj || !time) return alert("Fill all fields");
    if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            schedules: arrayUnion({ subj, time })
        });
        await syncLocalData();
        alert("Schedule Saved!");
        document.getElementById("subject").value = "";
        document.getElementById("studyTime").value = "";
        enableNotifications();
    }
};

window.loadReminders = async () => {
    const data = await syncLocalData();
    const list = data.reminders || [];
    const container = document.getElementById("reminderList");
    container.innerHTML = list.length === 0 ? "<li>No reminders</li>" : list.map((r, i) => `
        <li><span><strong>${r.name}</strong><br><small>${new Date(r.date).toLocaleString()}</small></span>
        <button onclick="deleteCloudItem('reminders', ${i})" style="width:auto; background:red;">🗑️</button></li>`).join('');
};

window.loadSchedules = async () => {
    const data = await syncLocalData();
    const list = data.schedules || [];
    const container = document.getElementById("scheduleList");
    container.innerHTML = list.length === 0 ? "<li>No schedules</li>" : list.map((s, i) => `
        <li><span><strong>${s.subj}</strong><br><small>${new Date(s.time).toLocaleString()}</small></span>
        <button onclick="deleteCloudItem('schedules', ${i})" style="width:auto; background:red;">🗑️</button></li>`).join('');
};

window.deleteCloudItem = async (key, index) => {
    const user = auth.currentUser;
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);
    const itemToRemove = docSnap.data()[key][index];
    await updateDoc(docRef, { [key]: arrayRemove(itemToRemove) });
    await syncLocalData();
    key === 'reminders' ? loadReminders() : loadSchedules();
};

// --- NOTIFICATIONS ---
window.enableNotifications = () => {
    if (Notification.permission !== "granted") { Notification.requestPermission(); }
};

function startNotificationCheck() {
    console.log("Monitor Active...");
    setInterval(async () => {
        const user = await syncLocalData(); // Force fetch fresh data every minute
        if (!user) return;
        
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = new Date(now - offset).toISOString().slice(0, 16);
        
        console.log("Checking:", localISOTime);

        user.reminders?.forEach(r => { 
            if (r.date === localISOTime) sendNotification("Arkibo Reminder", r.name); 
        });
        user.schedules?.forEach(s => { 
            if (s.time === localISOTime) sendNotification("Study Time!", s.subj); 
        });
    }, 60000);
}

function sendNotification(title, body) {
    if (Notification.permission === "granted") {
        new Notification(title, { body, icon: "https://i.imgur.com/PjgVp6S.png" });
    }
}
