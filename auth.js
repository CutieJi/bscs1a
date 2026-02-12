// ==========================================
// AUTHENTICATION HANDLERS
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // User is logged in, redirect to appropriate dashboard
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                
                if (userData && userData.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'student.html';
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        }
    });

    // Unified Login Form
    const unifiedLoginForm = document.getElementById('unifiedLoginForm');
    if (unifiedLoginForm) {
        unifiedLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const submitBtn = unifiedLoginForm.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Signing in...</span>';
                
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Get user role from Firestore
                const userDoc = await db.collection('users').doc(user.uid).get();
                const userData = userDoc.data();
                
                if (!userData) {
                    await auth.signOut();
                    throw new Error('User data not found. Please contact administrator.');
                }
                
                // Redirect based on role
                showToast('Login successful! Redirecting...', 'success');
                setTimeout(() => {
                    if (userData.role === 'admin') {
                        window.location.href = 'admin.html';
                    } else if (userData.role === 'student') {
                        window.location.href = 'student.html';
                    } else {
                        showToast('Invalid user role. Please contact administrator.', 'error');
                        auth.signOut();
                    }
                }, 1000);
            } catch (error) {
                console.error('Login error:', error);
                showToast(getErrorMessage(error), 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = `
                    <span>Sign In</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14m-7-7l7 7-7 7"/>
                    </svg>
                `;
            }
        });
    }

    // Registration Modal
    const registerModal = document.getElementById('registerModal');
    const studentRegisterLink = document.getElementById('studentRegisterLink');
    const closeModal = document.getElementById('closeModal');
    
    if (studentRegisterLink && registerModal) {
        studentRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.classList.add('active');
        });
    }
    
    if (closeModal && registerModal) {
        closeModal.addEventListener('click', () => {
            registerModal.classList.remove('active');
        });
        
        registerModal.addEventListener('click', (e) => {
            if (e.target === registerModal) {
                registerModal.classList.remove('active');
            }
        });
    }

    // Registration Form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const studentId = document.getElementById('registerStudentId').value;
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Creating Account...</span>';
                
                // Create user account
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Update display name
                await user.updateProfile({
                    displayName: name
                });
                
                // Create user document in Firestore
                await db.collection('users').doc(user.uid).set({
                    name: name,
                    email: email,
                    studentId: studentId,
                    role: 'student',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                showToast('Account created successfully! Redirecting...', 'success');
                registerModal.classList.remove('active');
                
                setTimeout(() => {
                    window.location.href = 'student.html';
                }, 1000);
            } catch (error) {
                console.error('Registration error:', error);
                showToast(getErrorMessage(error), 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Create Account</span>';
            }
        });
    }
});

// Helper function to get user-friendly error messages
function getErrorMessage(error) {
    const errorMessages = {
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/operation-not-allowed': 'Operation not allowed.',
        'auth/weak-password': 'Password should be at least 6 characters.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/user-not-found': 'Invalid email or password.',
        'auth/wrong-password': 'Invalid email or password.',
        'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/network-request-failed': 'Network error. Please check your connection.'
    };
    
    return errorMessages[error.code] || error.message || 'An error occurred. Please try again.';
}