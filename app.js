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

function getTimeAgo(timestamp) {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + ' years ago';
    if (interval === 1) return '1 year ago';

    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + ' months ago';
    if (interval === 1) return '1 month ago';

    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + ' days ago';
    if (interval === 1) return '1 day ago';

    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + ' hours ago';
    if (interval === 1) return '1 hour ago';

    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + ' minutes ago';
    if (interval === 1) return '1 minute ago';

    return 'Just now';
}

function getPriorityLabel(priority) {
    const labels = {
        1: 'Very Low',
        2: 'Low',
        3: 'Medium',
        4: 'High',
        5: 'Very High'
    };
    return labels[priority] || 'Medium';
}

function getPriorityColor(priority) {
    const colors = {
        1: '#10b981',
        2: '#3b82f6',
        3: '#f59e0b',
        4: '#ef4444',
        5: '#dc2626'
    };
    return colors[priority] || '#f59e0b';
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

function truncateText(text, maxLength = 150) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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
                            ? 'admin.html'
                            : 'student.html';
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        auth,
        db,
        showToast,
        formatDate,
        getTimeAgo,
        getPriorityLabel,
        getPriorityColor,
        capitalize,
        getUserInitials,
        truncateText,
        checkAuth
    };
}