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
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                reject('Not authenticated');
                return;
            }

            if (requiredRole) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    const userData = userDoc.data();

                    if (userData && userData.role === requiredRole) {
                        resolve({ user, userData });
                    } else {
                        const redirectUrl = userData.role === 'admin'
                            ? 'admin-dashboard.html'
                            : 'student-dashboard.html';
                        window.location.href = redirectUrl;
                        reject('Wrong role');
                    }
                } catch (error) {
                    console.error('Error checking role:', error);
                    window.location.href = 'index.html';
                    reject(error);
                }
            } else {
                resolve({ user });
            }
        });
    });
}