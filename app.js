const firebaseConfig = {
    apiKey: "AIzaSyCAAQE7Diw6GmQZ23d2QeCteQoC2uJaoFA",
    authDomain: "websy-2645b.firebaseapp.com",
    projectId: "websy-2645b",
    storageBucket: "websy-2645b.firebasestorage.app",
    messagingSenderId: "680503154304",
    appId: "1:680503154304:web:31df553e4fbc5168553865"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => console.log("Persistence: LOCAL"))
    .catch(err => console.error("Persistence error:", err));

window.addEventListener('load', () => {
    const loader = document.getElementById('pageLoader');
    const content = document.getElementById('pageContent');

    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }

    if (content) {
        content.classList.add('visible');
    }
});


function getSecondaryAuth() {
    try {
        return firebase.app("Secondary").auth();
    } catch (e) {
        const secondary = firebase.initializeApp(firebaseConfig, "Secondary");
        return secondary.auth();
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function getUserInitials(name) {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return parts[0][0] + parts[parts.length - 1][0];
    }
    return name.substring(0, 2);
}

function checkAuth(requiredRole = null) {
    return new Promise((resolve, reject) => {
        const unsub = auth.onAuthStateChanged(async (user) => {
            unsub();

            if (!user) {
                window.location.href = "index.html";
                reject("Not authenticated");
                return;
            }

            if (!requiredRole) {
                resolve({ user });
                return;
            }

            try {
                const userDoc = await db.collection("users").doc(user.uid).get();
                const userData = userDoc.data();

                if (userData?.role === requiredRole) {
                    resolve({ user, userData });
                } else {
                    window.location.href = userData?.role === "admin" ? "admin.html" : "student.html";
                    reject("Wrong role");
                }
            } catch (err) {
                console.error("Role check error:", err);
                window.location.href = "index.html";
                reject(err);
            }
        });
    });
}

// document.addEventListener("contextmenu", (e) => e.preventDefault());

// document.addEventListener("keydown", (e) => {
//     const k = e.key.toLowerCase();

//     if (e.ctrlKey && (k === "u" || k === "s" || k === "p")) {
//         e.preventDefault();
//         return false;
//     }

//     if (e.ctrlKey && e.shiftKey && (k === "i" || k === "j" || k === "c")) {
//         e.preventDefault();
//         return false;
//     }

//     if (e.key === "F12") {
//         e.preventDefault();
//         return false;
//     }
// });

// (function () {
//     let threshold = 160;

//     setInterval(() => {
//         const widthDiff = window.outerWidth - window.innerWidth;
//         const heightDiff = window.outerHeight - window.innerHeight;

//         if (widthDiff > threshold || heightDiff > threshold) {
//             document.body.innerHTML = "";
//             window.location.href = "index.html";
//         }
//     }, 800);
// })();