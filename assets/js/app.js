const firebaseConfig = {
    apiKey: "AIzaSyCAAQE7Diw6GmQZ23d2QeCteQoC2uJaoFA",
    authDomain: "websy-2645b.firebaseapp.com",
    projectId: "websy-2645b",
    storageBucket: "websy-2645b.firebasestorage.app",
    messagingSenderId: "680503154304",
    appId: "1:680503154304:web:31df553e4fbc5168553865"
};

firebase.initializeApp(firebaseConfig);

var auth, db;
try {
    auth = firebase.auth();
    db = firebase.firestore();
} catch (e) {
    console.error("Critical Firebase Init Error:", e);
}
var storage = null; // We are keeping this for compatibility, but it won't be used for photo uploads anymore.

/**
 * Resize image and return as Base64 Data URL
 * @param {File} file - The file from input
 * @param {number} maxWidth - Max width (default 200)
 * @param {number} maxHeight - Max height (default 200)
 * @returns {Promise<string>}
 */
function resizeImage(file, maxWidth = 200, maxHeight = 200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8)); // 0.8 quality to save space
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

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
    console.log(`[TOAST] ${type.toUpperCase()}: ${message}`);
    const toast = document.getElementById('toast');
    if (!toast) return;

    const icon = type === 'success' ? '' : '';
    toast.innerHTML = `${icon} <span>${message}</span>`;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Reusable confirmation modal
 * @param {Object} options - { title, message, confirmText, cancelText, type }
 * @returns {Promise<boolean>}
 */
function showConfirm(options = {}) {
    const {
        title = 'Are you sure?',
        message = 'Do you want to proceed with this action?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        type = 'danger' // 'primary', 'danger', 'success'
    } = options;

    return new Promise((resolve) => {
        let modal = document.getElementById('confirmModal');

        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <div class="modal-header" style="justify-content: center; margin-bottom: 20px;">
                        <h2 id="confirmTitle" style="font-size: 1.3rem;"></h2>
                    </div>
                    <p id="confirmMessage" style="color: var(--text-secondary); margin-bottom: 24px; line-height: 1.5;"></p>
                    <div class="modal-actions" style="justify-content: center; gap: 12px;">
                        <button id="confirmCancel" class="btn btn-secondary" style="flex: 1;"></button>
                        <button id="confirmBtn" class="btn" style="flex: 1;"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        const titleEl = modal.querySelector('#confirmTitle');
        const messageEl = modal.querySelector('#confirmMessage');
        const cancelBtn = modal.querySelector('#confirmCancel');
        const confirmBtn = modal.querySelector('#confirmBtn');

        titleEl.textContent = title;
        messageEl.textContent = message;
        cancelBtn.textContent = cancelText;
        confirmBtn.textContent = confirmText;

        // Set button color based on type
        confirmBtn.className = `btn btn-${type}`;

        const cleanup = (result) => {
            modal.classList.remove('active');
            // Remove listeners to prevent memory leaks/double triggers
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            modal.onclick = null;
            resolve(result);
        };

        confirmBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
        modal.onclick = (e) => {
            if (e.target === modal) cleanup(false);
        };

        // Trigger active class
        setTimeout(() => modal.classList.add('active'), 10);
    });
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('en-US', options).replace(',', '');
}

/**
 * Converts "HH:mm" (24h) to "hh:mm AM/PM" (12h)
 * @param {string} timeStr - Time string in 24h format
 * @returns {string}
 */
function formatTimeTo12h(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return timeStr || 'N/A';

    const [hh, mm] = timeStr.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    const mPad = String(mm).padStart(2, '0');

    return `${h12}:${mPad} ${ampm}`;
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
                window.location.href = "login.html";
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
                    let targetUrl = 'student.html';
                    if (userData?.role === 'admin') targetUrl = 'admin.html';
                    else if (userData?.role === 'professor') targetUrl = 'professor.html';

                    // Transfer any query parameters (like ?borrow=ID) to the correct dashboard
                    if (window.location.search && targetUrl !== 'admin.html') {
                        targetUrl += window.location.search;
                    }

                    window.location.href = targetUrl;
                    reject("Wrong role");
                }
            } catch (err) {
                console.error("Role check error:", err);
                window.location.href = "login.html";
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