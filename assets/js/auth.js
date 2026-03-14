let isRegistering = false;
let isLoggingIn = false;

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
                showToast("Your account is pending admin approval.", "error");
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

    const unifiedLoginForm = document.getElementById('unifiedLoginForm');

    if (unifiedLoginForm) {
        unifiedLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

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
                            showToast("Student ID login is disabled. Please update Firestore Rules or use Email.", "error");
                        } else {
                            showToast(err.message, "error");
                        }
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
                    showToast("Account waiting for admin approval.", "error");
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = "<span>Sign In</span>";
                    return;
                }

                showToast('Login successful! Redirecting...', 'success');

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
                showToast(getErrorMessage(error), 'error');

                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <span>Sign In</span>
                `;
            }
        });
    }

    const registerForm = document.getElementById('unifiedRegisterForm');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('registerName').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const studentId = document.getElementById('registerStudentId').value.trim();
            const mobile = document.getElementById('registerMobile').value.trim();
            const gender = document.getElementById('registerGender').value;
            const course = document.getElementById('registerCourse').value.trim();
            const yearSection = document.getElementById('registerYearSection').value.trim();
            const submitBtn = registerForm.querySelector('button[type="submit"]');

            try {
                isRegistering = true;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Creating Account...</span>';

                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                await user.updateProfile({
                    displayName: name
                });

                await db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    studentId: studentId,
                    mobile: mobile,
                    gender: gender,
                    course: course,
                    yearSection: yearSection,
                    role: 'student',
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                await auth.signOut();
                isRegistering = false;

                registerForm.reset();
                
                // Switch back to login tab after success
                if (typeof switchTab === 'function') {
                    switchTab('login');
                }

                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Create Account</span>';

                showToast("Account created. Wait for admin approval.", "success");

            } catch (error) {
                isRegistering = false;
                console.error('Registration error:', error);
                showToast(getErrorMessage(error), 'error');

                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Create Account</span>';
            }
        });
    }
});

function getErrorMessage(error) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/user-not-found': 'Invalid Email/Student ID or password.',
        'auth/wrong-password': 'Invalid Email/Student ID or password.'
    };

    return errorMessages[error.code] || error.message;
}