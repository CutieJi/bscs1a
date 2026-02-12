// ==========================================
// ADMIN DASHBOARD FUNCTIONALITY
// ==========================================

let currentAdmin = null;
let currentAdminData = null;
let allFeedback = [];
let selectedFeedback = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    try {
        const { user, userData } = await checkAuth('admin');
        currentAdmin = user;
        currentAdminData = userData;

        initializeDashboard();
    } catch (error) {
        console.error('Authentication error:', error);
    }
});

function initializeDashboard() {
    // Update admin info
    updateAdminInfo();

    // Initialize navigation
    initializeNavigation();

    // Load dashboard data
    loadDashboardData();

    // Initialize logout
    initializeLogout();

    // Initialize refresh button
    initializeRefresh();

    // Initialize filters
    initializeFilters();

    // Initialize modal
    initializeModal();

    // Initialize user management
    initializeUserManagement();

    const editUserForm = document.getElementById("editUserForm");
    if (editUserForm) {
        editUserForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await saveUserEdit();
        });
    }

}

function updateAdminInfo() {
    const adminEmailEl = document.getElementById('adminEmail');
    if (adminEmailEl) adminEmailEl.textContent = currentAdmin.email || '';
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-container');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            const viewId = item.getAttribute('data-view');

            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update active view
            views.forEach(view => view.classList.remove('active'));
            const targetView = document.getElementById(`${viewId}View`);
            if (targetView) {
                targetView.classList.add('active');

                // Load appropriate data
                if (viewId === 'overview') {
                    loadDashboardData();
                } else if (viewId === 'feedback') {
                    loadAllFeedback();
                } else if (viewId === 'analytics') {
                    loadAnalytics();
                } else if (viewId === 'users') {
                    loadUsers();
                }
            }
        });
    });
}

async function loadDashboardData() {
    try {
        // Get all feedback
        const snapshot = await db.collection('feedback')
            .orderBy('createdAt', 'desc')
            .get();

        allFeedback = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Update stats
        updateStats();

        // Load recent feedback
        loadRecentFeedback();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Failed to load dashboard data', 'error');
    }
}

function updateStats() {
    const totalFeedback = allFeedback.length;
    const pendingFeedback = allFeedback.filter(f => f.status === 'pending').length;
    const reviewedFeedback = allFeedback.filter(f => f.status === 'reviewed').length;
    const resolvedFeedback = allFeedback.filter(f => f.status === 'resolved').length;

    // Update DOM
    const totalEl = document.getElementById('totalFeedback');
    const pendingEl = document.getElementById('pendingFeedback');
    const reviewedEl = document.getElementById('reviewedFeedback');
    const resolvedEl = document.getElementById('resolvedFeedback');
    const feedbackCountEl = document.getElementById('feedbackCount');

    if (totalEl) totalEl.textContent = totalFeedback;
    if (pendingEl) pendingEl.textContent = pendingFeedback;
    if (reviewedEl) reviewedEl.textContent = reviewedFeedback;
    if (resolvedEl) resolvedEl.textContent = resolvedFeedback;
    if (feedbackCountEl) feedbackCountEl.textContent = totalFeedback;
}

function loadRecentFeedback() {
    const recentFeedbackList = document.getElementById('recentFeedbackList');
    if (!recentFeedbackList) return;

    const recentFeedback = allFeedback.slice(0, 5);

    if (recentFeedback.length === 0) {
        recentFeedbackList.innerHTML = `
            <div class="empty-state">
                <h3>No feedback yet</h3>
                <p>Feedback submissions will appear here</p>
            </div>
        `;
    } else {
        recentFeedbackList.innerHTML = recentFeedback.map(feedback =>
            createFeedbackCard(feedback)
        ).join('');

        // Add click handlers
        addFeedbackClickHandlers();
    }
}

async function loadAllFeedback() {
    const allFeedbackList = document.getElementById('allFeedbackList');
    if (!allFeedbackList) return;

    // Get filter values
    const statusFilter = document.getElementById('adminStatusFilter')?.value || 'all';
    const categoryFilter = document.getElementById('adminCategoryFilter')?.value || 'all';
    const typeFilter = document.getElementById('adminTypeFilter')?.value || 'all';
    const searchQuery = document.getElementById('searchInput')?.value.toLowerCase() || '';

    // Filter feedback
    let filteredFeedback = [...allFeedback];

    if (statusFilter !== 'all') {
        filteredFeedback = filteredFeedback.filter(f => f.status === statusFilter);
    }

    if (categoryFilter !== 'all') {
        filteredFeedback = filteredFeedback.filter(f => f.category === categoryFilter);
    }

    if (typeFilter !== 'all') {
        filteredFeedback = filteredFeedback.filter(f => f.type === typeFilter);
    }

    if (searchQuery) {
        filteredFeedback = filteredFeedback.filter(f =>
            f.subject.toLowerCase().includes(searchQuery) ||
            f.message.toLowerCase().includes(searchQuery) ||
            f.studentName.toLowerCase().includes(searchQuery)
        );
    }

    // Display feedback
    if (filteredFeedback.length === 0) {
        allFeedbackList.innerHTML = `
            <div class="empty-state">
                <h3>No feedback found</h3>
                <p>Try adjusting your filters</p>
            </div>
        `;
    } else {
        allFeedbackList.innerHTML = filteredFeedback.map(feedback =>
            createFeedbackCard(feedback)
        ).join('');

        // Add click handlers
        addFeedbackClickHandlers();
    }
}

function createFeedbackCard(feedback) {
    return `
        <div class="feedback-item" data-id="${feedback.id}">
            <div class="feedback-header">
                <div class="feedback-meta">
                    <div class="feedback-subject">${feedback.subject}</div>
                    <div class="feedback-info">
                        <span>${feedback.isAnonymous ? '🎭 Anonymous' : '👤 ' + feedback.studentName}</span>
                        <span>📅 ${getTimeAgo(feedback.createdAt)}</span>
                        <span>🆔 ${feedback.studentId || 'N/A'}</span>
                    </div>
                </div>
                <div class="feedback-badges">
                    <span class="badge badge-category">${capitalize(feedback.category)}</span>
                    <span class="badge badge-type">${capitalize(feedback.type)}</span>
                    <span class="badge badge-status ${feedback.status}">${capitalize(feedback.status)}</span>
                    <span class="badge badge-priority" style="background: ${getPriorityColor(feedback.priority)}20; color: ${getPriorityColor(feedback.priority)}">
                        ${getPriorityLabel(feedback.priority)}
                    </span>
                </div>
            </div>
            <div class="feedback-message">${truncateText(feedback.message, 200)}</div>
            <div class="feedback-footer">
                <span>ID: ${feedback.id.substring(0, 8)}</span>
                <span>📧 ${feedback.studentEmail}</span>
            </div>
        </div>
    `;
}

function addFeedbackClickHandlers() {
    const feedbackItems = document.querySelectorAll('.feedback-item');
    feedbackItems.forEach(item => {
        item.addEventListener('click', () => {
            const feedbackId = item.getAttribute('data-id');
            const feedback = allFeedback.find(f => f.id === feedbackId);
            if (feedback) {
                showFeedbackDetail(feedback);
            }
        });
    });
}

function showFeedbackDetail(feedback) {
    selectedFeedback = feedback;
    const modal = document.getElementById('feedbackModal');
    const detailContainer = document.getElementById('feedbackDetail');

    if (!modal || !detailContainer) return;

    detailContainer.innerHTML = `
        <div class="detail-row">
            <div class="detail-label">Subject</div>
            <div class="detail-value">${feedback.subject}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Category</div>
            <div class="detail-value">
                <span class="badge badge-category">${capitalize(feedback.category)}</span>
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Type</div>
            <div class="detail-value">
                <span class="badge badge-type">${capitalize(feedback.type)}</span>
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Priority</div>
            <div class="detail-value">
                <span class="badge badge-priority" style="background: ${getPriorityColor(feedback.priority)}20; color: ${getPriorityColor(feedback.priority)}">
                    ${getPriorityLabel(feedback.priority)}
                </span>
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Status</div>
            <div class="detail-value">
                <span class="badge badge-status ${feedback.status}">${capitalize(feedback.status)}</span>
            </div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Student</div>
            <div class="detail-value">${feedback.isAnonymous ? 'Anonymous' : feedback.studentName}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Email</div>
            <div class="detail-value">${feedback.studentEmail}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Student ID</div>
            <div class="detail-value">${feedback.studentId || 'N/A'}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Submitted</div>
            <div class="detail-value">${formatDate(feedback.createdAt)}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Message</div>
            <div class="detail-value" style="white-space: pre-wrap; line-height: 1.6;">${feedback.message}</div>
        </div>
    `;

    modal.classList.add('active');
}

function initializeModal() {
    const modal = document.getElementById('feedbackModal');
    const closeBtn = document.getElementById('closeFeedbackModal');
    const statusButtons = document.querySelectorAll('.status-actions button');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    statusButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const newStatus = btn.getAttribute('data-status');
            await updateFeedbackStatus(newStatus);
        });
    });
}

async function updateFeedbackStatus(newStatus) {
    if (!selectedFeedback) return;

    try {
        await db.collection('feedback').doc(selectedFeedback.id).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`Feedback marked as ${newStatus}`, 'success');

        // Update local data
        selectedFeedback.status = newStatus;
        const feedbackIndex = allFeedback.findIndex(f => f.id === selectedFeedback.id);
        if (feedbackIndex !== -1) {
            allFeedback[feedbackIndex].status = newStatus;
        }

        // Refresh views
        updateStats();
        loadRecentFeedback();
        loadAllFeedback();

        // Close modal
        document.getElementById('feedbackModal').classList.remove('active');
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Failed to update status', 'error');
    }
}

async function loadAnalytics() {
    const categoryChart = document.getElementById('categoryChart');
    const typeChart = document.getElementById('typeChart');
    const priorityBars = document.getElementById('priorityBars');

    // Category breakdown
    const categoryData = {};
    allFeedback.forEach(f => {
        categoryData[f.category] = (categoryData[f.category] || 0) + 1;
    });

    if (categoryChart) {
        categoryChart.innerHTML = Object.entries(categoryData).map(([category, count]) => {
            const percentage = (count / allFeedback.length * 100).toFixed(1);
            return `
                <div class="chart-item">
                    <div class="chart-label">${capitalize(category)}</div>
                    <div class="chart-bar">
                        <div class="chart-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="chart-value">${count}</div>
                </div>
            `;
        }).join('');
    }

    // Type breakdown
    const typeData = {};
    allFeedback.forEach(f => {
        typeData[f.type] = (typeData[f.type] || 0) + 1;
    });

    if (typeChart) {
        typeChart.innerHTML = Object.entries(typeData).map(([type, count]) => {
            const percentage = (count / allFeedback.length * 100).toFixed(1);
            return `
                <div class="chart-item">
                    <div class="chart-label">${capitalize(type)}</div>
                    <div class="chart-bar">
                        <div class="chart-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="chart-value">${count}</div>
                </div>
            `;
        }).join('');
    }

    // Priority distribution
    const priorityData = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allFeedback.forEach(f => {
        priorityData[f.priority] = (priorityData[f.priority] || 0) + 1;
    });

    if (priorityBars) {
        priorityBars.innerHTML = Object.entries(priorityData).map(([priority, count]) => {
            const percentage = allFeedback.length > 0 ? (count / allFeedback.length * 100).toFixed(1) : 0;
            return `
                <div class="chart-item">
                    <div class="chart-label">${getPriorityLabel(parseInt(priority))}</div>
                    <div class="chart-bar">
                        <div class="chart-fill" style="width: ${percentage}%; background: ${getPriorityColor(parseInt(priority))}"></div>
                    </div>
                    <div class="chart-value">${count}</div>
                </div>
            `;
        }).join('');
    }
}

function initializeFilters() {
    const statusFilter = document.getElementById('adminStatusFilter');
    const categoryFilter = document.getElementById('adminCategoryFilter');
    const typeFilter = document.getElementById('adminTypeFilter');
    const searchInput = document.getElementById('searchInput');

    if (statusFilter) {
        statusFilter.addEventListener('change', loadAllFeedback);
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', loadAllFeedback);
    }

    if (typeFilter) {
        typeFilter.addEventListener('change', loadAllFeedback);
    }

    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadAllFeedback, 300);
        });
    }
}

function initializeRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            refreshBtn.disabled = true;
            await loadDashboardData();
            showToast('Dashboard refreshed', 'success');
            setTimeout(() => {
                refreshBtn.disabled = false;
            }, 1000);
        });
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

// ==========================================
// USER MANAGEMENT FUNCTIONS
// ==========================================

function initializeUserManagement() {
    const addUserBtn = document.getElementById('addUserBtn');
    const addUserModal = document.getElementById('addUserModal');
    const closeAddUserModal = document.getElementById('closeAddUserModal');
    const cancelAddUser = document.getElementById('cancelAddUser');
    const addUserForm = document.getElementById('addUserForm');
    const newUserRole = document.getElementById('newUserRole');
    const studentIdGroup = document.getElementById('studentIdGroup');

    // Open add user modal
    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            addUserModal.classList.add('active');
        });
    }

    // Close modal handlers
    if (closeAddUserModal) {
        closeAddUserModal.addEventListener('click', () => {
            addUserModal.classList.remove('active');
            addUserForm.reset();
        });
    }

    if (cancelAddUser) {
        cancelAddUser.addEventListener('click', () => {
            addUserModal.classList.remove('active');
            addUserForm.reset();
        });
    }

    if (addUserModal) {
        addUserModal.addEventListener('click', (e) => {
            if (e.target === addUserModal) {
                addUserModal.classList.remove('active');
                addUserForm.reset();
            }
        });
    }

    // Toggle student ID field based on role
    if (newUserRole && studentIdGroup) {
        newUserRole.addEventListener('change', () => {
            if (newUserRole.value === 'admin') {
                studentIdGroup.classList.add('hidden');
                document.getElementById('newUserStudentId').required = false;
            } else {
                studentIdGroup.classList.remove('hidden');
                document.getElementById('newUserStudentId').required = true;
            }
        });
    }

    // Submit form
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createNewUser();
        });
    }
}

async function createNewUser() {
    const name = document.getElementById('newUserName').value;
    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const studentId = document.getElementById('newUserStudentId').value;

    const submitBtn = document.querySelector('#addUserForm button[type="submit"]');
    const originalBtnContent = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating...</span>';

        // 🔵 create SECONDARY firebase app
        const secondaryApp = firebase.initializeApp(firebase.app().options, "Secondary");
        const secondaryAuth = secondaryApp.auth();

        // 🔵 create user WITHOUT logging out admin
        const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
        const newUser = userCredential.user;

        // save to firestore
        const userData = {
            name: name,
            email: email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (role === 'student' && studentId) {
            userData.studentId = studentId;
        }

        await db.collection('users').doc(newUser.uid).set(userData);

        showToast(`${role} created successfully!`, 'success');

        // 🔴 sign out secondary instance only
        await secondaryAuth.signOut();
        await secondaryApp.delete();

        // close modal
        document.getElementById('addUserModal').classList.remove('active');
        document.getElementById('addUserForm').reset();

        loadUsers();

    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
    }
}


async function loadUsers() {
    const usersGrid = document.getElementById('usersGrid');
    if (!usersGrid) return;

    try {
        // Get all users from Firestore
        const snapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .get();

        const users = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (users.length === 0) {
            usersGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No users found</h3>
                    <p>Start by adding a new user</p>
                </div>
            `;
        } else {
            usersGrid.innerHTML = users.map(user => `
                <div class="user-card">
                    <div class="user-card-avatar ${user.role === 'admin' ? 'admin-role' : ''}">
                        ${getUserInitials(user.name)}
                    </div>
                    <div class="user-card-info">
                        <div class="user-card-name">${user.name}</div>
                        <div class="user-card-email">${user.email}</div>
                        <div class="user-card-meta">
                            <span class="user-role-badge ${user.role}">${capitalize(user.role)}</span>
                            ${user.studentId ? `<span class="badge badge-category">ID: ${user.studentId}</span>` : ''}
                        </div>
                        <div class="user-card-actions">
                        ${user.id !== currentAdmin.uid ? `
                            <button class="btn btn-icon" onclick="openEditUser('${user.id}','${user.name}','${user.studentId || ''}','${user.email}')">
                                ✏️
                            </button>
                            <button class="btn btn-icon" onclick="resetUserPassword('${user.email}')">
                                🔑
                            </button>
                            <button class="btn btn-icon danger" onclick="deleteUser('${user.id}','${user.email}')">
                                🗑
                            </button>
                        ` : '<span style="font-size:0.75rem;color:#888">(You)</span>'}
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        usersGrid.innerHTML = `
            <div class="empty-state">
                <h3>Error loading users</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

async function deleteUser(userId, userEmail) {
    if (!confirm(`Are you sure you want to delete the user: ${userEmail}?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        // Delete user document from Firestore
        await db.collection('users').doc(userId).delete();

        // Note: Deleting from Firebase Auth requires Admin SDK (server-side)
        // For now, we'll just delete from Firestore
        // In production, you should implement a Cloud Function to delete from Auth

        showToast('User removed from database', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user. Please try again.', 'error');
    }
}

let editingUserId = null;

function openEditUser(id, name, studentId, email) {
    editingUserId = id;

    document.getElementById('editUserName').value = name || "";
    document.getElementById('editUserStudentId').value = studentId || "";

    document.getElementById('editUserModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editUserModal').classList.remove('active');
}

async function saveUserEdit() {
    if (!editingUserId) {
        showToast("No user selected to edit.", "error");
        return;
    }

    const name = document.getElementById('editUserName').value.trim();
    const studentId = document.getElementById('editUserStudentId').value.trim();

    if (!name) {
        showToast("Name is required.", "error");
        return;
    }

    const saveBtn = document.querySelector("#editUserForm .btn.btn-primary")
        || document.querySelector("#editUserModal .btn.btn-primary");
    const oldText = saveBtn ? saveBtn.innerHTML : "";

    try {
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = "Saving...";
        }

        await db.collection('users').doc(editingUserId).update({
            name,
            studentId: studentId || firebase.firestore.FieldValue.delete()
        });

        showToast("User updated", "success");

        closeEditModal();
        await loadUsers();

    } catch (err) {
        console.error("SAVE ERROR:", err);
        showToast(err.message || "Update failed", "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = oldText;
        }
    }
}


function resetUserPassword(email) {
    auth.sendPasswordResetEmail(email);
    showToast("Password reset email sent", "success");
}