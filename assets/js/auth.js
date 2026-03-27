let isRegistering = false;
let isLoggingIn = false;

/**
 * Show an inline alert inside the form (above the email field).
 * @param {string} alertId   - 'loginAlert' or 'registerAlert'
 * @param {string} message   - The message to display
 * @param {'error'|'success'|'warning'} type
 */
function showFormAlert(alertId, message, type = 'error') {
    const el = document.getElementById(alertId);
    if (!el) return;

    const icons = {
        error:   '&#10005;',
        success: '&#10003;',
        warning: '&#9888;'
    };

    el.innerHTML = `<span style="margin-right:7px;">${icons[type] || ''}</span>${message}`;
    el.className = `form-alert alert-${type}`;

    // Auto-clear success after 4s
    if (type === 'success') {
        setTimeout(() => clearFormAlert(alertId), 4000);
    }
}

function clearFormAlert(alertId) {
    const el = document.getElementById(alertId);
    if (el) {
        el.className = 'form-alert d-none';
        el.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (!user) return;
        if (isRegistering || isLoggingIn) return;

        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            const userData = userDoc.data();

            if (!userData) {
                await auth.signOut();
                return;
            }

            if (userData.role === "student" && userData.status === "pending") {
                await auth.signOut();
                showFormAlert('loginAlert', "Your account is pending admin approval.", "warning");
                return;
            }

            if (userData.role === "admin") window.location.href = "admin.html";
            else if (userData.role === "student" && userData.status === "approved") {
                window.location.href = "student.html";
            }

        } catch (err) {
            console.error("Index redirect error:", err);
        }
    });

    // ── LOGIN ────────────────────────────────────────────────────────────────
    const unifiedLoginForm = document.getElementById('unifiedLoginForm');

    if (unifiedLoginForm) {
        unifiedLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormAlert('loginAlert');

            const loginInput = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const submitBtn = unifiedLoginForm.querySelector('button[type="submit"]');

            try {
                isLoggingIn = true;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Signing in...</span>';

                let email = loginInput;

                if (!loginInput.includes('@')) {
                    try {
                        const userSnap = await db.collection('users')
                            .where('studentId', '==', loginInput)
                            .limit(1)
                            .get();

                        if (userSnap.empty) {
                            throw new Error('No user found with this Student ID.');
                        }
                        email = userSnap.docs[0].data().email;
                    } catch (err) {
                        console.error("Student ID lookup error:", err);
                        if (err.code === 'permission-denied') {
                            showFormAlert('loginAlert', "Student ID login is disabled. Please use your email.", "error");
                        } else {
                            showFormAlert('loginAlert', err.message, "error");
                        }
                        isLoggingIn = false;
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = "<span>Sign In</span>";
                        return;
                    }
                }

                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();

                if (!userData) {
                    await auth.signOut();
                    throw new Error('User data not found. Please contact administrator.');
                }

                if (userData.role === "student" && userData.status !== "approved") {
                    await auth.signOut();
                    showFormAlert('loginAlert', "Your account is waiting for admin approval.", "warning");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = "<span>Sign In</span>";
                    isLoggingIn = false;
                    return;
                }

                showFormAlert('loginAlert', 'Login successful! Redirecting...', 'success');

                setTimeout(() => {
                    if (userData.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else if (userData.role === 'student') {
                        window.location.href = 'student.html';
                    }
                }, 1500);

            } catch (error) {
                isLoggingIn = false;
                console.error('Login error:', error);
                showFormAlert('loginAlert', getErrorMessage(error), 'error');

                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Sign In</span>`;
            }
        });
    }

    // ── REGISTER ─────────────────────────────────────────────────────────────
    const registerForm = document.getElementById('unifiedRegisterForm');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormAlert('registerAlert');

            const firstName     = document.getElementById('registerFirstName').value.trim();
            const middleInitial = document.getElementById('registerMiddleInitial').value.trim();
            const lastName      = document.getElementById('registerLastName').value.trim();
            const email         = document.getElementById('registerEmail').value.trim();
            const password      = document.getElementById('registerPassword').value;
            const studentId     = document.getElementById('registerStudentId').value.trim();
            const mobile        = document.getElementById('registerMobile').value.trim();
            const course        = document.getElementById('registerCourse').value.trim();
            const yearLevel     = document.getElementById('registerYearLevel').value;
            const section       = document.getElementById('registerSection').value;
            const submitBtn     = registerForm.querySelector('button[type="submit"]');

            // Compose full name and yearSection
            const name        = middleInitial
                ? `${firstName} ${middleInitial}. ${lastName}`
                : `${firstName} ${lastName}`;
            const yearSection = `${yearLevel}-${section}`;

            // Basic client-side validation
            if (password.length < 6) {
                showFormAlert('registerAlert', 'Password must be at least 6 characters.', 'error');
                return;
            }

            try {
                isRegistering = true;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Creating Account...</span>';

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                await user.updateProfile({ displayName: name });

                await db.collection('users').doc(user.uid).set({
                    name,
                    firstName,
                    middleInitial,
                    lastName,
                    email,
                    studentId,
                    mobile,
                    course,
                    yearLevel,
                    section,
                    yearSection,
                    role: 'student',
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await auth.signOut();
                isRegistering = false;

                registerForm.reset();
                showFormAlert('registerAlert', 'Account created! Wait for admin approval before logging in.', 'success');

                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Create Account</span>';

            } catch (error) {
                isRegistering = false;
                console.error('Registration error:', error);
                showFormAlert('registerAlert', getErrorMessage(error), 'error');

                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Create Account</span>';
            }
        });
    }
});

function getErrorMessage(error) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email':        'Invalid email address.',
        'auth/weak-password':        'Password must be at least 6 characters.',
        'auth/user-not-found':       'Invalid email/Student ID or password.',
        'auth/wrong-password':       'Invalid email/Student ID or password.',
        'auth/invalid-credential':   'Invalid email/Student ID or password.',
        'auth/too-many-requests':    'Too many failed attempts. Please try again later.'
    };

    return errorMessages[error.code] || error.message;
}