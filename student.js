let currentUser = null;
let currentUserData = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { user, userData } = await checkAuth('student');
        currentUser = user;
        currentUserData = userData;

        initializeDashboard();
    } catch (error) {
        console.error('Authentication error:', error);
    }
});

function initializeDashboard() {
    updateUserInfo();
    initializeNavigation();
    initializeFeedbackForm();
    loadSubmissions();
    initializeLogout();
    initializeAccountPage();
}

function updateUserInfo() {
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const userInitialEl = document.getElementById('userInitial');

    if (userNameEl) userNameEl.textContent = currentUserData.name || 'Student';
    if (userEmailEl) userEmailEl.textContent = currentUser.email || '';

    if (userInitialEl && currentUserData.name) {
        userInitialEl.textContent = getUserInitials(currentUserData.name);
    }
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-container');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            const viewId = item.getAttribute('data-view');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(view => view.classList.remove('active'));
            const targetView = document.getElementById(`${viewId}View`);
            if (targetView) {
                targetView.classList.add('active');

                const pageTitle = document.getElementById('pageTitle');
                const pageSubtitle = document.getElementById('pageSubtitle');

                if (viewId === 'submit') {
                    if (pageTitle) pageTitle.textContent = 'Submit Feedback';
                    if (pageSubtitle) pageSubtitle.textContent = 'Share your thoughts and help us improve';
                } else if (viewId === 'history') {
                    if (pageTitle) pageTitle.textContent = 'My Submissions';
                    if (pageSubtitle) pageSubtitle.textContent = 'Track your feedback submissions';
                    loadSubmissions();
                } else if (viewId === 'account') {
                    if (pageTitle) pageTitle.textContent = 'Manage Account';
                    if (pageSubtitle) pageSubtitle.textContent = 'Update your profile and password';
                }
            }
        });
    });
}

function initializeFeedbackForm() {
    const feedbackForm = document.getElementById('feedbackForm');
    const clearFormBtn = document.getElementById('clearForm');
    const feedbackMessage = document.getElementById('feedbackMessage');
    const charCount = document.getElementById('charCount');

    if (feedbackMessage && charCount) {
        feedbackMessage.addEventListener('input', () => {
            const count = feedbackMessage.value.length;
            charCount.textContent = count;

            if (count > 1000) {
                charCount.style.color = 'var(--danger)';
                feedbackMessage.value = feedbackMessage.value.substring(0, 1000);
            } else {
                charCount.style.color = 'var(--text-tertiary)';
            }
        });
    }

    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', () => {
            feedbackForm.reset();
            if (charCount) charCount.textContent = '0';
        });
    }

    if (feedbackForm) {
        feedbackForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = feedbackForm.querySelector('button[type="submit"]');
            const originalBtnContent = submitBtn.innerHTML;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Submitting...</span>';

                const formData = {
                    category: document.getElementById('feedbackCategory').value,
                    subject: document.getElementById('feedbackSubject').value,
                    type: document.querySelector('input[name="feedbackType"]:checked').value,
                    priority: parseInt(document.getElementById('feedbackPriority').value),
                    message: document.getElementById('feedbackMessage').value,
                    isAnonymous: document.getElementById('anonymousCheckbox').checked,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    userId: currentUser.uid,
                    studentName: currentUserData.name,
                    studentEmail: currentUser.email,
                    studentId: currentUserData.studentId
                };

                await db.collection('feedback').add(formData);

                showToast('Feedback submitted successfully!', 'success');
                feedbackForm.reset();
                if (charCount) charCount.textContent = '0';

                loadSubmissions();
            } catch (error) {
                console.error('Error submitting feedback:', error);
                showToast('Failed to submit feedback. Please try again.', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnContent;
            }
        });
    }
}

async function loadSubmissions() {
    const submissionsGrid = document.getElementById('submissionsGrid');
    if (!submissionsGrid) return;

    try {
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';

        let query = db.collection('feedback')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc');

        const snapshot = await query.get();

        let submissions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (statusFilter !== 'all') {
            submissions = submissions.filter(s => s.status === statusFilter);
        }

        if (categoryFilter !== 'all') {
            submissions = submissions.filter(s => s.category === categoryFilter);
        }

        if (submissions.length === 0) {
            submissionsGrid.innerHTML = `
                <div class="empty-state">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M9 11l3 3L22 4"></path>
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <h3>No submissions found</h3>
                    <p>Try adjusting your filters or submit new feedback</p>
                </div>
            `;
        } else {
            submissionsGrid.innerHTML = submissions.map(submission => `
                <div class="feedback-item">
                    <div class="feedback-header">
                        <div class="feedback-meta">
                            <div class="feedback-subject">${submission.subject}</div>
                            <div class="feedback-info">
                                <span>📅 ${getTimeAgo(submission.createdAt)}</span>
                            </div>
                        </div>
                        <div class="feedback-badges">
                            <span class="badge badge-category">${capitalize(submission.category)}</span>
                            <span class="badge badge-type">${capitalize(submission.type)}</span>
                            <span class="badge badge-status ${submission.status}">${capitalize(submission.status)}</span>
                            <span class="badge badge-priority" style="background: ${getPriorityColor(submission.priority)}20; color: ${getPriorityColor(submission.priority)}">
                                ${getPriorityLabel(submission.priority)}
                            </span>
                        </div>
                    </div>
                    <div class="feedback-message">${truncateText(submission.message)}</div>
                    <div class="feedback-footer">
                        <span>${submission.isAnonymous ? '🎭 Anonymous' : '👤 ' + submission.studentName}</span>
                        <span>ID: ${submission.id.substring(0, 8)}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading submissions:', error);
        submissionsGrid.innerHTML = `
            <div class="empty-state">
                <h3>Error loading submissions</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

function initializeLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                showToast('Logged out successfully', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Failed to logout. Please try again.', 'error');
            }
        });
    }
}

function initializeAccountPage() {

    const profileForm = document.getElementById('updateProfileForm');
    const passwordForm = document.getElementById('changePasswordForm');

    if (currentUserData) {
        document.getElementById('editName').value = currentUserData.name || "";
        document.getElementById('editStudentId').value = currentUserData.studentId || "";
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('editName').value;
            const studentId = document.getElementById('editStudentId').value;

            try {
                await db.collection('users').doc(currentUser.uid).update({
                    name: name,
                    studentId: studentId
                });

                await currentUser.updateProfile({ displayName: name });

                showToast("Profile updated!", "success");
            } catch (err) {
                console.error(err);
                showToast("Failed to update profile", "error");
            }
        });
    }

    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const newPass = document.getElementById('newPassword').value;

            try {
                await currentUser.updatePassword(newPass);
                showToast("Password changed!", "success");
                passwordForm.reset();
            } catch (err) {
                showToast("Please re-login before changing password", "error");
            }
        });
    }
}

const statusFilter = document.getElementById('statusFilter');
const categoryFilter = document.getElementById('categoryFilter');

if (statusFilter) {
    statusFilter.addEventListener('change', loadSubmissions);
}

if (categoryFilter) {
    categoryFilter.addEventListener('change', loadSubmissions);
}