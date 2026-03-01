let currentAdmin = null;
let currentAdminData = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { user, userData } = await checkAuth('admin');
        currentAdmin = user;
        currentAdminData = userData;

        initializeDashboard();
    } catch (error) {
        initializeDashboard();
        loadPending();
    }
});

function initializeUserManagement() {
    const roleSelect = document.getElementById('newUserRole');
    const additionalFields = document.getElementById('additionalStudentFields');

    if (roleSelect) {
        roleSelect.addEventListener('change', (e) => {
            const isStudent = e.target.value === 'student';
            if (additionalFields) additionalFields.style.display = isStudent ? 'block' : 'none';

            const studentIdInput = document.getElementById('newUserStudentId');
            if (studentIdInput) studentIdInput.required = isStudent;
        });
    }

    const editRoleSelect = document.getElementById('editUserRole');
    const editStudentContainer = document.getElementById('editStudentFieldsContainers');
    if (editRoleSelect && editStudentContainer) {
        editRoleSelect.addEventListener('change', (e) => {
            editStudentContainer.style.display = e.target.value === 'student' ? 'block' : 'none';
        });
    }

    const addUserForm = document.getElementById('addUserForm');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createNewUser();
        });
    }

    const closeAddUserModal = document.getElementById('closeAddUserModal');
    const cancelAddUser = document.getElementById('cancelAddUser');
    const addUserModal = document.getElementById('addUserModal');

    const closeAddUser = () => {
        addUserModal?.classList.remove('active');
        addUserForm?.reset();
        if (additionalFields) additionalFields.style.display = 'none';
    };

    if (closeAddUserModal) closeAddUserModal.addEventListener('click', closeAddUser);
    if (cancelAddUser) cancelAddUser.addEventListener('click', closeAddUser);
}

function initializeDashboard() {
    updateAdminInfo();
    initializeNavigation();
    loadDashboardData();
    initializeEquipmentManagement();
    initializeUserManagement();
    initializeLogout();
    initializeRefresh();
    initializeExport();
    initializeSidebar();
    initializeProfileDropdown();
    initializeTheme();
}

function updateAdminInfo() {
    const email = currentAdmin.email || '';
    const adminEmailEl = document.getElementById('adminEmail');
    if (adminEmailEl) adminEmailEl.textContent = email;
    const topbarEmailEl = document.getElementById('topbarAdminEmail');
    if (topbarEmailEl) topbarEmailEl.textContent = email;
    const profileViewEmailEl = document.getElementById('profileViewEmail');
    if (profileViewEmailEl) profileViewEmailEl.textContent = email;
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const views = document.querySelectorAll('.view-container');
    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');

    const viewLabels = {
        dashboard: 'Dashboard',
        equipment: 'Manage Equipment',
        approvals: 'Pending Approvals',
        borrowed: 'Currently Borrowed',
        logs: 'Borrowing Logs',
        users: 'User Management'
    };

    function activateView(viewId) {
        navItems.forEach(nav => nav.classList.remove('active'));
        sidebarItems.forEach(si => si.classList.remove('active'));
        views.forEach(view => view.classList.remove('active'));

        const matchingNav = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (matchingNav) {
            matchingNav.classList.add('active');
            const parentLi = matchingNav.closest('.sidebar-item');
            if (parentLi) parentLi.classList.add('active');
        }

        const targetView = document.getElementById(`${viewId}View`);
        if (!targetView) return;
        targetView.classList.add('active');

        const label = viewLabels[viewId] || viewId;
        if (breadcrumbCurrent) breadcrumbCurrent.textContent = label;
        const mobileTitle = document.getElementById('topbarMobileTitle');
        if (mobileTitle) mobileTitle.textContent = label;

        if (viewId === 'dashboard') loadDashboardData();
        else if (viewId === 'equipment') loadAllEquipment();
        else if (viewId === 'approvals') loadPendingRequests();
        else if (viewId === 'borrowed') loadCurrentlyBorrowed();
        else if (viewId === 'logs') loadBorrowingLogs();
        else if (viewId === 'users') { loadUsers(); loadPending(); }

        try { localStorage.setItem('admin-active-view', viewId); } catch (e) { }
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            activateView(item.getAttribute('data-view'));
        });
    });


    const saved = (() => { try { return localStorage.getItem('admin-active-view'); } catch (e) { return null; } })();
    if (saved && document.getElementById(`${saved}View`)) {
        activateView(saved);
    } else {
        activateView('dashboard');
    }
}

function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const topbarToggle = document.getElementById('topbarToggle');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    function toggleSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('mobile-open');
            sidebarOverlay.classList.toggle('active');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    }

    if (topbarToggle) topbarToggle.addEventListener('click', toggleSidebar);
    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        }
    });
}

async function loadDashboardData() {
    try {
        const equipmentSnapshot = await db.collection('equipment').get();
        const equipment = equipmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(u => u.status === 'approved');

        const totalEquipment = equipment.length;
        const availableEquipment = equipment.filter(e => e.status === 'available').length;
        const borrowedEquipment = equipment.filter(e => e.status === 'borrowed').length;
        const totalUsers = users.length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayBorrowsSnapshot = await db.collection('borrowings')
            .where('borrowedAt', '>=', today)
            .get();

        const todayBorrows = todayBorrowsSnapshot.size;

        const allBorrowsSnapshot = await db.collection('borrowings').get();
        const totalHistoricalBorrows = allBorrowsSnapshot.size;

        document.getElementById('totalEquipment').textContent = totalEquipment;
        document.getElementById('availableEquipment').textContent = availableEquipment;
        document.getElementById('borrowedEquipment').textContent = borrowedEquipment;
        document.getElementById('todayBorrows').textContent = todayBorrows;
        document.getElementById('totalHistoricalBorrows').textContent = totalHistoricalBorrows;
        document.getElementById('borrowedBadge').textContent = borrowedEquipment;
        document.getElementById('totalUsers').textContent = totalUsers;

        await loadRecentActivities();

        await loadOverdueItems();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

async function loadRecentActivities() {
    const activitiesList = document.getElementById('recentActivities');
    if (!activitiesList) return;

    try {
        const snapshot = await db.collection('borrowings')
            .orderBy('borrowedAt', 'desc')
            .limit(5)
            .get();

        const activities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (activities.length === 0) {
            activitiesList.innerHTML = '<p style="color: var(--text-secondary);">No recent activities</p>';
        } else {
            activitiesList.innerHTML = activities.map(activity => `
                <div class="transaction-item">
                    <div class="transaction-icon">${activity.status === 'returned' ? '✅' : '📦'}</div>
                    <div class="transaction-details">
                        <div class="transaction-title">${activity.status === 'returned' ? 'Returned' : 'Borrowed'}: ${activity.equipmentName}</div>
                        <div class="transaction-meta">${activity.userName}</div>
                    </div>
                    <div class="transaction-time">${formatDate(activity.borrowedAt)}</div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

async function loadOverdueItems() {
    const overdueList = document.getElementById('overdueList');
    const sendAllRemindersBtn = document.getElementById('sendAllRemindersBtn');
    if (!overdueList) return;

    try {
        const now = new Date();

        const snapshot = await db.collection('borrowings')
            .where('status', 'in', ['borrowed', 'pending_extension'])
            .get();

        const overdue = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(item => {
                if (!item.expectedReturnTime || !item.borrowedAt) return false;

                const borrowedDate = item.borrowedAt.toDate();
                const [hh, mm] = String(item.expectedReturnTime).split(':').map(n => parseInt(n, 10));

                if (Number.isNaN(hh) || Number.isNaN(mm)) return false;

                const due = new Date(borrowedDate);
                due.setHours(hh, mm, 0, 0);

                return now > due;
            });

        if (sendAllRemindersBtn) {
            sendAllRemindersBtn.style.display = overdue.length > 0 ? 'inline-flex' : 'none';
            sendAllRemindersBtn.onclick = () => sendAllSMSReminders(overdue);
        }

        const sendAllEmailRemindersBtn = document.getElementById('sendAllEmailRemindersBtn');
        if (sendAllEmailRemindersBtn) {
            sendAllEmailRemindersBtn.style.display = overdue.length > 0 ? 'inline-flex' : 'none';
            sendAllEmailRemindersBtn.onclick = () => sendAllEmailReminders(overdue);
        }

        if (overdue.length === 0) {
            overdueList.innerHTML = `
                <div class="alert-item success">
                    <div class="alert-icon">✅</div>
                    <div class="alert-content">
                        <div class="alert-title">All Clear</div>
                        <div class="alert-message">No overdue items</div>
                    </div>
                </div>
            `;
        } else {
            overdueList.innerHTML = overdue.map(item => {
                const lastNotified = item.lastNotified ? formatDate(item.lastNotified) : 'Never';
                const typeLabel = item.notificationType ? ` (${item.notificationType.toUpperCase()})` : '';
                return `
                <div class="alert-item warning">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <div class="alert-title">${item.equipmentName}</div>
                        <div class="alert-message">
                            Borrowed by ${item.userName} - Due: ${item.expectedReturnTime || 'N/A'}<br>
                            <small style="opacity: 0.7; font-size: 0.7rem;">Notified: ${lastNotified}${typeLabel}</small>
                        </div>
                    </div>
                    <div class="alert-actions" style="margin-left: auto; display: flex; align-items: center; gap: 0.5rem;">
                        <button class="btn btn-icon" onclick="sendSMSOverdue('${item.userId}', '${item.equipmentName}', '${item.id}')" title="Send SMS Reminder">
                            💬
                        </button>
                        <button class="btn btn-icon" onclick="sendEmailOverdue('${item.userId}', '${item.equipmentName}', '${item.id}')" title="Send Email Reminder">
                            📧
                        </button>
                    </div>
                </div>
            `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading overdue items:', error);
        overdueList.innerHTML = `
            <div class="alert-item warning">
                <div class="alert-icon">⚠️</div>
                <div class="alert-content">
                    <div class="alert-title">Error</div>
                    <div class="alert-message">Failed to load overdue list</div>
                </div>
            </div>
        `;
    }
}

async function sendAllSMSReminders(overdueItems) {
    if (!overdueItems || overdueItems.length === 0) return;

    const count = overdueItems.length;
    if (!confirm(`This will initiate SMS reminders for ${count} users. You will need to click 'Send' in your SMS app for each one. Continue?`)) return;

    for (const item of overdueItems) {
        await sendSMSOverdue(item.userId, item.equipmentName, item.id);
        await new Promise(r => setTimeout(r, 800));
    }
}

async function sendAllEmailReminders(overdueItems) {
    if (!overdueItems || overdueItems.length === 0) return;

    const count = overdueItems.length;
    if (!confirm(`This will initiate Email reminders for ${count} users. Your mail app will open for each one. Continue?`)) return;

    for (const item of overdueItems) {
        await sendEmailOverdue(item.userId, item.equipmentName, item.id);
        await new Promise(r => setTimeout(r, 1000));
    }
}



async function loadPendingRequests() {
    const pendingGrid = document.getElementById('pendingRequestsGrid');
    const badge = document.getElementById('approvalsBadge');


    const dashPendingCount = document.getElementById('pendingRequestsCount');

    if (!pendingGrid) return;

    try {

        const [borrowSnapshot, returnSnapshot] = await Promise.all([
            db.collection('borrowings').where('status', '==', 'pending_borrow').get(),
            db.collection('borrowings').where('status', '==', 'pending_return').get()
        ]);

        const pendingBorrows = borrowSnapshot.docs.map(doc => ({ id: doc.id, type: 'borrow', ...doc.data() }));
        const pendingReturns = returnSnapshot.docs.map(doc => ({ id: doc.id, type: 'return', ...doc.data() }));

        const allPending = [...pendingBorrows, ...pendingReturns].sort((a, b) => {
            const timeA = a.borrowedAt ? a.borrowedAt.toDate() : new Date(0);
            const timeB = b.borrowedAt ? b.borrowedAt.toDate() : new Date(0);
            return timeB - timeA;
        });

        const count = allPending.length;

        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
        if (dashPendingCount) {
            dashPendingCount.textContent = count;
        }

        if (count === 0) {
            pendingGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="stat-icon" style="margin: 0 auto 1rem; width: 64px; height: 64px; background: rgba(16, 185, 129, 0.1); color: var(--success); display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>
                    <h3>All Caught Up!</h3>
                    <p style="color: var(--text-secondary);">There are no pending requests requiring your attention.</p>
                </div>
            `;
            return;
        }

        pendingGrid.innerHTML = allPending.map(req => {
            const isBorrow = req.type === 'borrow';
            const isReturn = req.type === 'return';
            const isExtension = req.type === 'extension';

            let actionColor = 'var(--primary)';
            let actionBg = 'rgba(60, 255, 154, 0.1)';
            let actionLabel = 'Borrow Request';
            let icon = '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>';

            if (isReturn) {
                actionColor = 'var(--warning)';
                actionBg = 'rgba(245, 158, 11, 0.1)';
                actionLabel = 'Return Request';
                icon = '<polyline points="9 10 4 15 9 20"></polyline><path d="M20 4v7a4 4 0 0 1-4 4H4"></path>';
            }

            return `
                <div class="equipment-card" style="border-top: 4px solid ${actionColor}">
                    <div class="card-header">
                        <div class="card-title-group">
                            <h3 class="card-title">${req.equipmentName}</h3>
                            <span class="card-subtitle">ID: ${req.equipmentCode}</span>
                        </div>
                        <div class="stat-icon" style="background: ${actionBg}; color: ${actionColor}; width: 32px; height: 32px;">
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                 ${icon}
                             </svg>
                        </div>
                    </div>
                    
                    <div class="card-details" style="margin: 1rem 0;">
                        <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-primary);">
                            ${actionLabel} by:
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                            <div class="topbar-user-avatar" style="width: 24px; height: 24px; font-size: 0.7rem; background: var(--bg-secondary); color: var(--text-primary);">
                                <span>${req.userName.charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                                <div style="font-size: 0.875rem; font-weight: 500;">${req.userName}</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">${req.studentId}</div>
                            </div>
                        </div>
                        
                        ${isBorrow ? `
                            <div class="detail-row"><span>Room:</span> <span>${req.room || 'N/A'}</span></div>
                            <div class="detail-row"><span>Purpose:</span> <span>${req.purpose || 'N/A'}</span></div>
                            <div class="detail-row"><span>Duration:</span> <span>Until ${req.expectedReturnTime}</span></div>
                        ` : isReturn ? `
                            <div class="detail-row"><span>Condition:</span> <span style="text-transform: capitalize;">${req.pendingReturnCondition || 'N/A'}</span></div>
                            <div class="detail-row"><span>Notes:</span> <span style="font-style: italic;">${req.pendingReturnNotes || 'None'}</span></div>
                        ` : `
                            <div class="detail-row"><span>Current Due:</span> <span>${req.expectedReturnTime}</span></div>
                            <div class="detail-row"><span>New Requested:</span> <span style="font-weight:700; color:#1e40af;">${req.requestedReturnTime}</span></div>
                            <div class="detail-row"><span>Reason:</span> <span>${req.extensionReason || 'N/A'}</span></div>
                        `}
                    </div>

                    <div class="card-actions" style="margin-top: auto; display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" style="flex: 1;" onclick="${isBorrow ? `approveBorrow('${req.id}', '${req.equipmentId}')` : `approveReturn('${req.id}', '${req.equipmentId}', '${req.pendingReturnCondition}')`}">Approve</button>
                        <button class="btn btn-secondary" style="flex: 1; border-color: var(--danger); color: var(--danger);" onclick="${isBorrow ? `rejectBorrow('${req.id}', '${req.equipmentId}')` : `rejectReturn('${req.id}', '${req.equipmentId}')`}">Reject</button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading pending requests:', error);
        pendingGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="alert-item warning">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <div class="alert-title">Error</div>
                        <div class="alert-message">Failed to load pending requests</div>
                    </div>
                </div>
            </div>
        `;
    }
}


async function approveBorrow(borrowingId, equipmentId) {
    if (!confirm('Approve this borrow request?')) return;
    try {
        const borrowDoc = await db.collection('borrowings').doc(borrowingId).get();
        const borrowData = borrowDoc.data();

        await db.collection('borrowings').doc(borrowingId).update({ status: 'borrowed' });
        await db.collection('equipment').doc(equipmentId).update({
            status: 'borrowed',
            borrowedBy: borrowData.userId || null,
            borrowedAt: borrowData.borrowedAt || firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Borrow request approved', 'success');
        loadPendingRequests();
        loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('Error approving request', 'error');
    }
}

async function rejectBorrow(borrowingId, equipmentId) {
    if (!confirm('Reject this borrow request?')) return;
    try {
        await db.collection('borrowings').doc(borrowingId).update({ status: 'rejected' });
        await db.collection('equipment').doc(equipmentId).update({
            status: 'available',
            borrowedBy: null,
            borrowedAt: null
        });
        showToast('Borrow request rejected', 'success');
        loadPendingRequests();
        loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('Error rejecting request', 'error');
    }
}

async function approveReturn(borrowingId, equipmentId, condition) {
    if (!confirm('Approve this return request?')) return;
    try {

        const doc = await db.collection('borrowings').doc(borrowingId).get();
        const data = doc.data();

        await db.collection('borrowings').doc(borrowingId).update({
            status: 'returned',
            returnedAt: firebase.firestore.FieldValue.serverTimestamp(),
            returnCondition: data.pendingReturnCondition || condition,
            returnNotes: data.pendingReturnNotes || ''
        });

        await db.collection('equipment').doc(equipmentId).update({
            status: (data.pendingReturnCondition || condition) === 'damaged' ? 'maintenance' : 'available',
            borrowedBy: null,
            borrowedAt: null
        });
        showToast('Return request approved', 'success');
        loadPendingRequests();
        loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('Error approving return', 'error');
    }
}

async function rejectReturn(borrowingId, equipmentId) {
    if (!confirm('Reject this return request? The item will remain marked as Borrowed.')) return;
    try {
        await db.collection('borrowings').doc(borrowingId).update({
            status: 'borrowed',
            pendingReturnCondition: firebase.firestore.FieldValue.delete(),
            pendingReturnNotes: firebase.firestore.FieldValue.delete()
        });
        await db.collection('equipment').doc(equipmentId).update({ status: 'borrowed' });
        showToast('Return request rejected', 'success');
        loadPendingRequests();
        loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('Error rejecting return', 'error');
    }
}

async function approveExtension(borrowingId) {
    if (!confirm('Approve this time extension request?')) return;
    try {
        const doc = await db.collection('borrowings').doc(borrowingId).get();
        const data = doc.data();

        const updateData = {
            status: 'borrowed',
            expectedReturnTime: data.requestedReturnTime,
            requestedReturnTime: firebase.firestore.FieldValue.delete(),
            extensionReason: firebase.firestore.FieldValue.delete(),
            hasExtension: true
        };

        if (!data.originalExpectedReturnTime) {
            updateData.originalExpectedReturnTime = data.expectedReturnTime;
        }

        await db.collection('borrowings').doc(borrowingId).update(updateData);

        showToast('Extension request approved', 'success');
        loadPendingRequests();
        loadCurrentlyBorrowed();
        loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('Error approving extension', 'error');
    }
}

async function rejectExtension(borrowingId) {
    if (!confirm('Reject this time extension request?')) return;
    try {
        await db.collection('borrowings').doc(borrowingId).update({
            status: 'borrowed',
            requestedReturnTime: firebase.firestore.FieldValue.delete(),
            extensionReason: firebase.firestore.FieldValue.delete()
        });

        showToast('Extension request rejected', 'success');
        loadPendingRequests();
        loadCurrentlyBorrowed();
        loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('Error rejecting extension', 'error');
    }
}

async function adminConfirmReturn(borrowingId, equipmentId) {
    const conditionSelect = document.getElementById(`returnCondition_${borrowingId}`);
    const condition = conditionSelect ? conditionSelect.value : 'good';

    if (!confirm(`Confirm return of this item? Condition: ${condition}`)) return;

    try {
        const doc = await db.collection('borrowings').doc(borrowingId).get();
        const data = doc.data();

        let wasOverdue = false;
        if (data.expectedReturnTime) {
            const now = new Date();
            const borrowedDate = data.borrowedAt ? data.borrowedAt.toDate() : new Date();
            const [hh, mm] = data.expectedReturnTime.split(':').map(Number);
            const due = new Date(borrowedDate);
            due.setHours(hh, mm, 0, 0);
            wasOverdue = now > due;
        }

        await db.collection('borrowings').doc(borrowingId).update({
            status: 'returned',
            returnedAt: firebase.firestore.FieldValue.serverTimestamp(),
            returnCondition: condition,
            returnNotes: '',
            wasOverdue: wasOverdue
        });

        await db.collection('equipment').doc(equipmentId).update({
            status: condition === 'damaged' ? 'maintenance' : 'available',
            borrowedBy: null,
            borrowedAt: null
        });

        showToast('Return confirmed successfully', 'success');
        loadCurrentlyBorrowed();
        loadDashboardData();
    } catch (err) {
        console.error(err);
        showToast('Error confirming return', 'error');
    }
}

function initializeEquipmentManagement() {
    const addEquipmentBtn = document.getElementById('addEquipmentBtn');
    const addEquipmentModal = document.getElementById('addEquipmentModal');
    const closeEquipmentModal = document.getElementById('closeEquipmentModal');
    const cancelEquipment = document.getElementById('cancelEquipment');
    const addEquipmentForm = document.getElementById('addEquipmentForm');

    if (addEquipmentBtn) {
        addEquipmentBtn.addEventListener('click', () => {
            addEquipmentModal.classList.add('active');
        });
    }

    if (closeEquipmentModal) {
        closeEquipmentModal.addEventListener('click', () => {
            addEquipmentModal.classList.remove('active');
            addEquipmentForm.reset();
        });
    }

    if (cancelEquipment) {
        cancelEquipment.addEventListener('click', () => {
            addEquipmentModal.classList.remove('active');
            addEquipmentForm.reset();
        });
    }

    if (addEquipmentModal) {
        addEquipmentModal.addEventListener('click', (e) => {
            if (e.target === addEquipmentModal) {
                addEquipmentModal.classList.remove('active');
                addEquipmentForm.reset();
            }
        });
    }

    if (addEquipmentForm) {
        addEquipmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addEquipment();
        });
    }
}

async function addEquipment() {
    const equipmentId = document.getElementById('equipmentId').value;
    const name = document.getElementById('equipmentName').value;
    const category = document.getElementById('equipmentCategory').value;
    const description = document.getElementById('equipmentDescription').value;

    const submitBtn = document.querySelector('#addEquipmentForm button[type="submit"]');
    const originalContent = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Adding...</span>';

        const existingSnapshot = await db.collection('equipment')
            .where('equipmentId', '==', equipmentId)
            .get();

        if (!existingSnapshot.empty) {
            showToast('Equipment ID already exists', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalContent;
            return;
        }

        await db.collection('equipment').add({
            equipmentId: equipmentId,
            name: name,
            category: category,
            description: description || '',
            status: 'available',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Equipment added successfully!', 'success');
        document.getElementById('addEquipmentModal').classList.remove('active');
        document.getElementById('addEquipmentForm').reset();

        loadAllEquipment();
        loadDashboardData();

    } catch (error) {
        console.error('Error adding equipment:', error);
        showToast('Failed to add equipment', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    }
}

async function loadAllEquipment() {
    const equipmentList = document.getElementById('equipmentList');
    if (!equipmentList) return;

    try {
        const snapshot = await db.collection('equipment')
            .orderBy('createdAt', 'desc')
            .get();

        const equipment = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (equipment.length === 0) {
            equipmentList.innerHTML = `
                <div class="empty-state">
                    <h3>No equipment found</h3>
                    <p>Start by adding new equipment</p>
                </div>
            `;
        } else {
            equipmentList.innerHTML = equipment.map(item => `
                <div class="equipment-list-item">
                    <div class="equipment-list-info">
                        <div class="equipment-list-name">${item.name}</div>
                        <div class="equipment-list-meta">
                            <span class="badge badge-category">${item.equipmentId}</span>
                            <span class="badge badge-type">${capitalize(item.category)}</span>
                            <span class="badge badge-status ${item.status}">${capitalize(item.status)}</span>
                        </div>
                    </div>
                    <div class="equipment-list-actions">
                    <button class="btn btn-icon" onclick="openEditEquipment('${item.id}','${item.equipmentId}','${item.name}','${item.category}','${item.description || ''}', '${item.status}')" title="Edit">
                    ✏️
                    </button>
                        <button class="btn btn-secondary btn-sm" onclick="generateQRCode('${item.id}', '${item.equipmentId}', '${item.name}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="9" y1="3" x2="9" y2="21"></line>
                                <line x1="15" y1="3" x2="15" y2="21"></line>
                            </svg>
                            QR Code
                        </button>
                        <button class="btn btn-icon danger" onclick="deleteEquipment('${item.id}', '${item.name}')" title="Delete">
                        🗑    
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
        equipmentList.innerHTML = `
            <div class="empty-state">
                <h3>Error loading equipment</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

async function deleteEquipment(equipmentId, equipmentName) {
    if (!confirm(`Are you sure you want to delete "${equipmentName}"?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const borrowingSnapshot = await db.collection('borrowings')
            .where('equipmentId', '==', equipmentId)
            .where('status', '==', 'borrowed')
            .get();

        if (!borrowingSnapshot.empty) {
            showToast('Cannot delete equipment that is currently borrowed', 'error');
            return;
        }

        await db.collection('equipment').doc(equipmentId).delete();
        showToast('Equipment deleted successfully', 'success');

        loadAllEquipment();
        loadDashboardData();
    } catch (error) {
        console.error('Error deleting equipment:', error);
        showToast('Failed to delete equipment', 'error');
    }
}

function generateQRCode(equipmentDocId, equipmentId, equipmentName) {
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = '';

    const baseUrl = window.location.origin;
    const deepLink = `${baseUrl}/student.html?borrow=${encodeURIComponent(equipmentId)}`;

    new QRCode(qrContainer, {
        text: deepLink,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('qrEquipmentId').textContent = equipmentId;
    document.getElementById('qrEquipmentName').textContent = equipmentName;

    document.getElementById('qrCodeModal').classList.add('active');

    setupQRActions(equipmentId);
}


function setupQRActions(equipmentId) {
    const downloadBtn = document.getElementById('downloadQrBtn');
    const printBtn = document.getElementById('printQrBtn');
    const closeQrModal = document.getElementById('closeQrModal');
    const qrModal = document.getElementById('qrCodeModal');

    downloadBtn.onclick = () => {
        const canvas = document.querySelector('#qrCodeContainer canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `QR-${equipmentId}.png`;
            link.href = canvas.toDataURL();
            link.click();
            showToast('QR Code downloaded', 'success');
        }
    };

    printBtn.onclick = () => {
        const canvas = document.querySelector('#qrCodeContainer canvas');
        if (canvas) {
            const printWindow = window.open('', '', 'width=600,height=600');
            printWindow.document.write(`
                <html>
                <head>
                    <title>QR Code - ${equipmentId}</title>
                    <style>
                        body { text-align: center; font-family: Arial, sans-serif; padding: 20px; }
                        img { max-width: 400px; margin: 20px 0; }
                        h2 { margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <h2>Equipment QR Code</h2>
                    <p><strong>ID:</strong> ${equipmentId}</p>
                    <img src="${canvas.toDataURL()}" />
                    <p><em>Scan this code to borrow or return equipment</em></p>
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 250);
        }
    };

    closeQrModal.onclick = () => {
        qrModal.classList.remove('active');
    };

    qrModal.onclick = (e) => {
        if (e.target === qrModal) {
            qrModal.classList.remove('active');
        }
    };
}

async function loadCurrentlyBorrowed() {
    const borrowedList = document.getElementById('borrowedList');
    if (!borrowedList) return;

    try {
        const now = new Date();

        const snapshot = await db.collection('borrowings')
            .where('status', 'in', ['borrowed', 'pending_extension'])
            .get();

        let borrowed = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const sortVal = document.getElementById('borrowedSort')?.value || 'borrowedAt_desc';
        const [field, direction] = sortVal.split('_');

        borrowed.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            if (valA?.toDate) valA = valA.toDate();
            if (valB?.toDate) valB = valB.toDate();

            if (valA == null) return 1;
            if (valB == null) return -1;

            if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }

            if (direction === 'asc') {
                return valA > valB ? 1 : -1;
            } else {
                return valA < valB ? 1 : -1;
            }
        });

        if (borrowed.length === 0) {
            borrowedList.innerHTML = `
                <div class="empty-state">
                    <h3>No borrowed equipment</h3>
                    <p>All equipment is available</p>
                </div>
            `;
        } else {
            borrowedList.innerHTML = borrowed.map(item => {
                const daysBorrowed = item.borrowedAt
                    ? Math.floor((new Date() - item.borrowedAt.toDate()) / (1000 * 60 * 60 * 24))
                    : 0;

                const isPendingExtend = item.status === 'pending_extension';
                let isOverdue = false;
                if (item.borrowedAt && item.expectedReturnTime) {
                    const borrowedDate = item.borrowedAt.toDate();
                    const [hh, mm] = String(item.expectedReturnTime).split(':').map(n => parseInt(n, 10));
                    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
                        const due = new Date(borrowedDate);
                        due.setHours(hh, mm, 0, 0);
                        isOverdue = now > due;
                    }
                }

                return `
                    <div class="borrowed-list-item" ${isPendingExtend ? 'style="border-left: 4px solid #1e40af; background: rgba(30, 64, 175, 0.02);"' : ''}>
                        <div class="borrowed-list-header">
                            <div>
                                <div class="borrowed-student">${item.userName}</div>
                                <div class="borrowed-list-details">
                                    📧 ${item.userEmail} • 🆔 ${item.studentId}
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; align-items: center;">
                                ${isPendingExtend
                        ? '<span class="badge badge-status" style="background: rgba(30, 64, 175, 0.1); color: #1e40af">EXTENSION REQUESTED</span>'
                        : ''}
                                ${isOverdue
                        ? '<span class="badge badge-status" style="background: rgba(239, 68, 68, 0.1); color: var(--danger)">OVERDUE</span>'
                        : ''
                    }
                            </div>
                        </div>

                        <div class="borrowed-list-details" style="margin-top: 1rem;">
                            <strong>Equipment:</strong> ${item.equipmentName}<br>
                            <strong>Borrowed:</strong> ${formatDate(item.borrowedAt)}<br>
                            <strong>Current Due:</strong> ${item.expectedReturnTime || 'N/A'}<br>
                            ${isPendingExtend ? `
                                <div style="margin-top: 0.75rem; padding: 0.75rem; background: rgba(30, 64, 175, 0.05); border-radius: var(--radius-md); border: 1px dashed #1e40af;">
                                    <strong style="color: #1e40af;">New Requested Time:</strong> <span style="font-weight:700; color: #1e40af;">${item.requestedReturnTime}</span><br>
                                    <strong style="color: #1e40af;">Reason:</strong> ${item.extensionReason || 'Not specified'}
                                    <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
                                        <button class="btn btn-primary btn-sm" style="flex:1;" onclick="approveExtension('${item.id}')">Approve Extension</button>
                                        <button class="btn btn-secondary btn-sm" style="flex:1; border-color: var(--danger); color: var(--danger);" onclick="rejectExtension('${item.id}')">Reject</button>
                                    </div>
                                </div>
                            ` : `
                                <strong>Room:</strong> ${item.room || 'N/A'}<br>
                                <strong>Purpose:</strong> ${item.purpose || 'N/A'}
                            `}
                        </div>

                        ${!isPendingExtend ? `
                            <div style="margin-top: 1rem; display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
                                ${item.userId ? `
                                    <button class="btn btn-icon" onclick="sendSMSOverdue('${item.userId}', '${item.equipmentName}', '${item.id}')" title="Send SMS Reminder">
                                        💬
                                    </button>
                                ` : ''}
                                <select id="returnCondition_${item.id}" style="flex: 1; min-width: 160px; padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md); background: var(--bg-secondary); color: var(--text-primary); font-family: var(--font-body); font-size: 0.875rem;">
                                    <option value="good">Good – No issues</option>
                                    <option value="minor">Minor Issues</option>
                                    <option value="damaged">Damaged – Needs repair</option>
                                </select>
                                <button class="btn btn-primary btn-sm" onclick="adminConfirmReturn('${item.id}', '${item.equipmentId}')">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    Confirm Return
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading borrowed items:', error);
        borrowedList.innerHTML = `
            <div class="empty-state">
                <h3>Error loading borrowed items</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

async function loadBorrowingLogs() {
    const logsList = document.getElementById('logsList');
    if (!logsList) return;

    try {
        const startDate = document.getElementById('startDate')?.value;
        const endDate = document.getElementById('endDate')?.value;
        const studentFilter = document.getElementById('studentFilter')?.value.toLowerCase() || '';
        const equipmentFilter = document.getElementById('equipmentFilter')?.value.toLowerCase() || '';

        const snapshot = await db.collection('borrowings')
            .orderBy('borrowedAt', 'desc')
            .limit(100)
            .get();

        let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (startDate) {
            const start = new Date(startDate);
            logs = logs.filter(log => log.borrowedAt?.toDate() >= start);
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59);
            logs = logs.filter(log => log.borrowedAt?.toDate() <= end);
        }

        if (studentFilter) {
            logs = logs.filter(log =>
                (log.userName || '').toLowerCase().includes(studentFilter) ||
                (log.userEmail || '').toLowerCase().includes(studentFilter)
            );
        }

        if (equipmentFilter) {
            logs = logs.filter(log =>
                (log.equipmentName || '').toLowerCase().includes(equipmentFilter) ||
                (log.equipmentCode || '').toLowerCase().includes(equipmentFilter)
            );
        }

        const sortValue = document.getElementById('logsSort')?.value || 'borrowedAt_desc';
        const [field, order] = sortValue.split('_');

        logs.sort((a, b) => {
            let valA = a[field];
            let valB = b[field];

            if (field === 'borrowedAt') {
                valA = valA?.toDate().getTime() || 0;
                valB = valB?.toDate().getTime() || 0;
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });

        if (logs.length === 0) {
            logsList.innerHTML = `
                <div class="empty-state">
                    <h3>No logs found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
        } else {
            logsList.innerHTML = logs.map(log => {
                const statusLabels = {
                    'pending_borrow': 'Pending Borrow',
                    'pending_return': 'Pending Return',
                    'borrowed': 'Borrowed',
                    'returned': 'Returned',
                    'rejected': 'Rejected'
                };
                const statusLabel = statusLabels[log.status] || capitalize(log.status);
                return `
                <div class="log-item">
                    <div class="log-item-header">
                        <span class="log-item-title">${log.equipmentName}</span>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            ${(log.status === 'borrowed' || log.status === 'pending_return') && log.userId ? `
                                <button class="btn btn-icon btn-sm" onclick="sendSMSOverdue('${log.userId}', '${log.equipmentName}', '${log.id}')" title="Send SMS Reminder">
                                    💬
                                </button>
                            ` : ''}
                            <span class="history-status ${log.status}">${statusLabel}</span>
                        </div>
                    </div>

                    <div class="log-item-info">
                        <div class="log-field">
                            <span class="log-label">Student:</span>
                            <span class="log-value">${log.userName}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Email:</span>
                            <span class="log-value">${log.userEmail}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Mobile:</span>
                            <span class="log-value">${log.userMobile || 'N/A'}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Student ID:</span>
                            <span class="log-value">${log.studentId || 'N/A'}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Borrowed:</span>
                            <span class="log-value">${formatDate(log.borrowedAt)}</span>
                        </div>

                        <div class="log-field">
                            <span class="log-label">Status History:</span>
                            <span class="log-value">
                                ${log.wasOverdue ? '<span class="badge" style="background:rgba(239,68,68,0.1); color:var(--danger); font-size:0.7rem; padding: 2px 6px;">WAS OVERDUE</span>' : ''}
                                ${log.hasExtension ? '<span class="badge" style="background:rgba(30,64,175,0.1); color:#1e40af; font-size:0.7rem; padding: 2px 6px;">EXTENDED</span>' : ''}
                                ${!log.wasOverdue && !log.hasExtension ? '<span style="color:var(--text-tertiary); font-size:0.8rem;">Regular</span>' : ''}
                            </span>
                        </div>

                        ${log.returnedAt ? `
                            <div class="log-field">
                                <span class="log-label">Returned:</span>
                                <span class="log-value">${formatDate(log.returnedAt)}</span>
                            </div>
                        ` : `
                            <div class="log-field">
                                <span class="log-label">Due Time:</span>
                                <span class="log-value">${log.expectedReturnTime || 'N/A'}</span>
                            </div>
                        `}

                        <div class="log-field">
                            <span class="log-label">Room:</span>
                            <span class="log-value">${log.room || 'N/A'}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Purpose:</span>
                            <span class="log-value">${log.purpose || 'N/A'}</span>
                        </div>

                        ${log.returnCondition ? `
                            <div class="log-field">
                                <span class="log-label">Return Condition:</span>
                                <span class="log-value">${capitalize(log.returnCondition)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        logsList.innerHTML = `
            <div class="empty-state">
                <h3>Error loading logs</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

function initializeExport() {
    const exportLogsBtn = document.getElementById('exportLogsBtn');
    const applyFilterBtn = document.getElementById('applyFilterBtn');

    if (applyFilterBtn) applyFilterBtn.addEventListener('click', loadBorrowingLogs);

    const fmtDate = (ts) => {
        if (!ts || !ts.toDate) return "";
        const d = ts.toDate();
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    const safe = (v) => (v ?? "").toString();

    const styles = {
        title: {
            font: { bold: true, sz: 16, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "0F172A" } },
            alignment: { horizontal: "left", vertical: "center" }
        },
        meta: {
            font: { sz: 11, color: { rgb: "334155" } },
            fill: { fgColor: { rgb: "F1F5F9" } },
            alignment: { horizontal: "left", vertical: "center" }
        },
        header: {
            font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "2563EB" } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "CBD5E1" } },
                bottom: { style: "thin", color: { rgb: "CBD5E1" } },
                left: { style: "thin", color: { rgb: "CBD5E1" } },
                right: { style: "thin", color: { rgb: "CBD5E1" } }
            }
        },
        cell: {
            font: { sz: 11, color: { rgb: "0F172A" } },
            alignment: { horizontal: "left", vertical: "top", wrapText: true },
            border: {
                top: { style: "thin", color: { rgb: "E2E8F0" } },
                bottom: { style: "thin", color: { rgb: "E2E8F0" } },
                left: { style: "thin", color: { rgb: "E2E8F0" } },
                right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
        },
        zebra: {
            fill: { fgColor: { rgb: "F8FAFC" } }
        },
        statusAvailable: { font: { color: { rgb: "065F46" }, bold: true } },
        statusBorrowed: { font: { color: { rgb: "92400E" }, bold: true } },
        statusMaintenance: { font: { color: { rgb: "991B1B" }, bold: true } }
    };

    function applyCellStyle(ws, r, c, styleObj) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "s", v: "" };
        ws[addr].s = { ...(ws[addr].s || {}), ...styleObj };
    }

    function setRowHeight(ws, r, h) {
        ws["!rows"] = ws["!rows"] || [];
        ws["!rows"][r] = ws["!rows"][r] || {};
        ws["!rows"][r].hpt = h;
    }

    if (exportLogsBtn) {
        exportLogsBtn.addEventListener("click", async () => {
            try {
                const snapshot = await db.collection("borrowings")
                    .orderBy("borrowedAt", "desc")
                    .get();

                const logs = snapshot.docs.map((doc) => doc.data());

                const now = new Date();
                const fileDate = now.toISOString().split("T")[0];

                const headers = [
                    "Equipment Name",
                    "Equipment ID",
                    "Student Name",
                    "Student Email",
                    "Mobile No.",
                    "Student ID",
                    "Borrowed At",
                    "Returned At",
                    "Original Due",
                    "Final Due",
                    "Room",
                    "Status",
                    "Was Overdue?",
                    "Extended?",
                    "Return Condition",
                    "Purpose"
                ];

                const rows = [];
                rows.push(["MISLend - COMPREHENSIVE BORROWING LOGS"]);
                rows.push([`Report Generated: ${now.toLocaleString()} | Total Records: ${logs.length}`]);
                rows.push([]);
                rows.push(headers);

                logs.forEach((log) => {
                    rows.push([
                        safe(log.equipmentName),
                        safe(log.equipmentCode || log.equipmentId),
                        safe(log.userName),
                        safe(log.userEmail),
                        safe(log.userMobile || "N/A"),
                        safe(log.studentId),
                        fmtDate(log.borrowedAt),
                        fmtDate(log.returnedAt),
                        safe(log.originalExpectedReturnTime || log.expectedReturnTime),
                        safe(log.expectedReturnTime),
                        safe(log.room),
                        safe(log.status).toUpperCase(),
                        log.wasOverdue ? "YES" : "NO",
                        log.hasExtension ? "YES" : "NO",
                        safe(log.returnCondition),
                        safe(log.purpose)
                    ]);
                });

                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(rows);

                ws["!cols"] = [
                    { wch: 30 },
                    { wch: 15 },
                    { wch: 22 },
                    { wch: 28 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 22 },
                    { wch: 22 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 15 },
                    { wch: 14 },
                    { wch: 12 },
                    { wch: 20 },
                    { wch: 35 }
                ];

                ws["!merges"] = ws["!merges"] || [];
                ws["!merges"].push({
                    s: { r: 0, c: 0 },
                    e: { r: 0, c: headers.length - 1 }
                });
                ws["!merges"].push({
                    s: { r: 1, c: 0 },
                    e: { r: 1, c: headers.length - 1 }
                });

                setRowHeight(ws, 0, 32);
                setRowHeight(ws, 1, 20);
                setRowHeight(ws, 3, 25);

                const styles = {
                    title: {
                        font: { bold: true, sz: 18, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: "1E293B" } },
                        alignment: { horizontal: "center", vertical: "center" }
                    },
                    meta: {
                        font: { sz: 10, color: { rgb: "64748B" }, italic: true },
                        fill: { fgColor: { rgb: "F8FAFC" } },
                        alignment: { horizontal: "center", vertical: "center" }
                    },
                    header: {
                        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: "3B82F6" } },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            bottom: { style: "medium", color: { rgb: "1D4ED8" } }
                        }
                    },
                    cell: {
                        font: { sz: 10 },
                        alignment: { vertical: "center", wrapText: true },
                        border: {
                            bottom: { style: "thin", color: { rgb: "E2E8F0" } }
                        }
                    },
                    overdue: { font: { color: { rgb: "EF4444" }, bold: true } },
                    extended: { font: { color: { rgb: "2563EB" }, bold: true } },
                    zebra: { fill: { fgColor: { rgb: "F1F5F9" } } }
                };

                for (let c = 0; c < headers.length; c++) {
                    applyCellStyle(ws, 0, c, styles.title);
                    applyCellStyle(ws, 1, c, styles.meta);
                    applyCellStyle(ws, 3, c, styles.header);
                }

                const startBodyRow = 4;
                const endBodyRow = rows.length - 1;

                for (let r = startBodyRow; r <= endBodyRow; r++) {
                    const isZebra = (r - startBodyRow) % 2 === 1;
                    for (let c = 0; c < headers.length; c++) {
                        applyCellStyle(ws, r, c, styles.cell);
                        if (isZebra) applyCellStyle(ws, r, c, styles.zebra);
                    }

                    const wasOverdue = rows[r][12] === "YES";
                    const hasExtension = rows[r][13] === "YES";

                    if (wasOverdue) applyCellStyle(ws, r, 12, styles.overdue);
                    if (hasExtension) applyCellStyle(ws, r, 13, styles.extended);
                }

                ws["!autofilter"] = {
                    ref: XLSX.utils.encode_range({
                        s: { r: 3, c: 0 },
                        e: { r: 3, c: headers.length - 1 }
                    })
                };

                ws["!sheetViews"] = [{
                    state: "frozen",
                    ySplit: 4,
                    activePane: "bottomLeft"
                }];

                XLSX.utils.book_append_sheet(wb, ws, "Borrowing History");

                XLSX.writeFile(wb, `MISLend-Logs-${fileDate}.xlsx`);
                showToast("Professional report generated successfully!", "success");
            } catch (error) {
                console.error("Error exporting logs:", error);
                showToast("Failed to export XLSX", "error");
            }
        });
    }
}

function initializeUserManagement() {
    const addUserBtn = document.getElementById('addUserBtn');
    const addUserModal = document.getElementById('addUserModal');
    const closeAddUserModal = document.getElementById('closeAddUserModal');
    const cancelAddUser = document.getElementById('cancelAddUser');
    const addUserForm = document.getElementById('addUserForm');
    const newUserRole = document.getElementById('newUserRole');
    const additionalFields = document.getElementById('additionalStudentFields');

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            addUserModal?.classList.add('active');
        });
    }

    if (newUserRole) {
        newUserRole.addEventListener('change', (e) => {
            const isStudent = e.target.value === 'student';
            if (additionalFields) additionalFields.style.display = isStudent ? 'block' : 'none';

            const studentIdInput = document.getElementById('newUserStudentId');
            if (studentIdInput) studentIdInput.required = isStudent;
        });
    }

    const closeAddUser = () => {
        addUserModal?.classList.remove('active');
        addUserForm?.reset();
        if (additionalFields) additionalFields.style.display = 'none';
    };

    if (closeAddUserModal) closeAddUserModal.addEventListener('click', closeAddUser);
    if (cancelAddUser) cancelAddUser.addEventListener('click', closeAddUser);
    if (addUserModal) {
        addUserModal.addEventListener('click', (e) => {
            if (e.target === addUserModal) closeAddUser();
        });
    }

    const editRoleSelect = document.getElementById('editUserRole');
    const editStudentContainer = document.getElementById('editStudentFieldsContainers');
    if (editRoleSelect && editStudentContainer) {
        editRoleSelect.addEventListener('change', (e) => {
            editStudentContainer.style.display = e.target.value === 'student' ? 'block' : 'none';
        });
    }

    if (addUserForm) {
        addUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createNewUser();
        });
    }
}

async function createNewUser() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const studentId = document.getElementById('newUserStudentId')?.value.trim();
    const mobile = document.getElementById('newUserMobile')?.value.trim();
    const gender = document.getElementById('newUserGender')?.value;
    const course = document.getElementById('newUserCourse')?.value.trim();
    const yearSection = document.getElementById('newUserYearSection')?.value.trim();

    const submitBtn = document.querySelector('#addUserForm button[type="submit"]');
    const originalBtnContent = submitBtn.innerHTML;

    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Creating...</span>';

        const secAuth = getSecondaryAuth();
        const userCredential = await secAuth.createUserWithEmailAndPassword(email, password);
        const newUser = userCredential.user;

        await newUser.updateProfile({ displayName: name });

        const userData = {
            name,
            email,
            role,
            status: role === "student" ? "approved" : "approved",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (role === 'student') {
            userData.studentId = studentId || "";
            userData.mobile = mobile || "";
            userData.gender = gender || "";
            userData.course = course || "";
            userData.yearSection = yearSection || "";
        }


        await db.collection('users').doc(newUser.uid).set(userData);

        await secAuth.signOut();

        showToast(`${capitalize(role)} account created successfully!`, 'success');

        document.getElementById('addUserModal').classList.remove('active');
        document.getElementById('addUserForm').reset();

        loadUsers();
        if (typeof loadPending === "function") loadPending();

    } catch (error) {
        console.error('Error creating user:', error);

        let errorMessage = 'Failed to create user. ';
        if (error.code === 'auth/email-already-in-use') errorMessage += 'This email is already registered.';
        else if (error.code === 'auth/invalid-email') errorMessage += 'Invalid email address.';
        else if (error.code === 'auth/weak-password') errorMessage += 'Password should be at least 6 characters.';
        else errorMessage += error.message;

        showToast(errorMessage, 'error');

    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnContent;
    }
}


async function loadUsers() {
    const usersGrid = document.getElementById('usersGrid');
    if (!usersGrid) return;

    try {
        const snapshot = await db.collection('users')
            .orderBy('createdAt', 'desc')
            .get();

        const users = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(user => user.status === 'approved');

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
                                <button class="btn btn-icon" onclick="openEditUser('${user.id}','${user.name}','${user.email}','${user.role}','${user.studentId || ''}','${user.mobile || ''}','${user.gender || ''}','${user.course || ''}','${user.yearSection || ''}')" title="Edit">
                                    ✏️
                                </button>
                                ${user.role === 'student' && user.mobile ? `
                                    <a class="btn btn-icon" href="sms:${user.mobile}?body=Hello ${user.name}, this is UCC MIS Office. Just a reminder regarding your equipment borrowing." title="Send Message">
                                        💬
                                    </a>
                                ` : ''}
                                <button class="btn btn-icon danger" onclick="deleteUser('${user.id}', '${user.email}')" title="Delete user">
                                    🗑
                                </button>
                            ` : '<span style="font-size: 0.75rem; color: var(--text-tertiary);">(You)</span>'}
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
    if (!confirm(`Are you sure you want to delete the user: ${userEmail}?\n\nIMPORTANT: Deleting here only removes their dashboard access. You MUST also manually delete this email (${userEmail}) from the Firebase Console > Authentication to fully remove the account.`)) {
        return;
    }

    try {
        await db.collection('users').doc(userId).delete();
        showToast('User removed from dashboard. Remember to delete their email in Auth Console!', 'success');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Failed to delete user. Please try again.', 'error');
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

function openEditEquipment(id, eid, name, cat, desc, status) {
    document.getElementById("editDocId").value = id;
    document.getElementById("editEquipmentId").value = eid;
    document.getElementById("editEquipmentName").value = name;
    document.getElementById("editEquipmentCategory").value = cat;
    document.getElementById("editEquipmentDescription").value = desc;
    document.getElementById("editEquipmentStatus").value = status || "available";

    document.getElementById("editEquipmentModal").classList.add("active");
}

function closeEditEquipment() {
    document.getElementById("editEquipmentModal").classList.remove("active");
}

document.getElementById("editEquipmentForm").addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("editDocId").value;
    const newStatus = document.getElementById("editEquipmentStatus").value;

    const updateData = {
        equipmentId: document.getElementById("editEquipmentId").value,
        name: document.getElementById("editEquipmentName").value,
        category: document.getElementById("editEquipmentCategory").value,
        description: document.getElementById("editEquipmentDescription").value,
        status: newStatus
    };

    if (newStatus === "available") {
        updateData.borrowedBy = null;
        updateData.borrowedAt = null;
    }

    if (newStatus === "maintenance") {
        updateData.borrowedBy = null;
        updateData.borrowedAt = null;
    }

    await db.collection("equipment").doc(id).update(updateData);

    showToast("Equipment updated", "success");
    closeEditEquipment();
    loadAllEquipment();
    loadDashboardData();
});

function openEditUser(id, name, email, role, studentId, mobile, gender, course, yearSection) {
    document.getElementById("editUserId").value = id;
    document.getElementById("editUserName").value = name;
    document.getElementById("editUserEmail").value = email;
    document.getElementById("editUserRole").value = role;
    document.getElementById("editUserStudentId").value = studentId || "";
    document.getElementById("editUserMobile").value = mobile || "";
    document.getElementById("editUserGender").value = gender || "";
    document.getElementById("editUserCourse").value = course || "";
    document.getElementById("editUserYearSection").value = yearSection || "";

    const studentContainer = document.getElementById("editStudentFieldsContainers");
    if (studentContainer) {
        studentContainer.style.display = role === 'student' ? 'block' : 'none';
    }

    document.getElementById("editUserModal").classList.add("active");
}

function closeEditUser() {
    document.getElementById("editUserModal").classList.remove("active");
}

document.getElementById("editUserForm").addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("editUserId").value;
    const role = document.getElementById("editUserRole").value;

    const updateData = {
        name: document.getElementById("editUserName").value,
        email: document.getElementById("editUserEmail").value,
        role: role,
        studentId: document.getElementById("editUserStudentId").value
    };

    if (role === 'student') {
        updateData.mobile = document.getElementById("editUserMobile").value;
        updateData.gender = document.getElementById("editUserGender").value;
        updateData.course = document.getElementById("editUserCourse").value;
        updateData.yearSection = document.getElementById("editUserYearSection").value;
    }

    await db.collection("users").doc(id).update(updateData);

    showToast("User updated", "success");
    document.getElementById("editUserModal").classList.remove("active");
    loadUsers();
});

async function loadPending() {
    const grid = document.getElementById("pendingGrid");
    const count = document.getElementById("pendingCount");

    if (!grid) return;

    const snap = await db.collection("users")
        .where("status", "==", "pending")
        .get();

    count.textContent = snap.size;

    if (snap.empty) {
        grid.innerHTML = `<p style="color:#777;">No pending accounts</p>`;
        return;
    }

    grid.innerHTML = snap.docs.map(doc => {
        const u = doc.data();

        return `
<div class="pending-card">

    <div class="pending-avatar">
        ${u.name ? u.name.charAt(0) : "U"}
    </div>

    <div class="pending-name">${u.name}</div>
    <div class="pending-email">${u.email}</div>
    <div class="pending-id">ID: ${u.studentId || "N/A"}</div>

    <div class="pending-actions">
        <button class="btn-approve" onclick="approveUser('${doc.id}')">Approve</button>
        <button class="btn-reject" onclick="rejectUser('${doc.id}')">Reject</button>
    </div>

</div>
`;
    }).join("");
}

async function approveUser(uid) {
    await db.collection("users").doc(uid).update({
        status: "approved"
    });
    showToast("User approved", "success");
    loadPending();
    loadUsers();
}

async function rejectUser(uid) {
    const userDoc = await db.collection("users").doc(uid).get();
    const email = userDoc.data()?.email || "this user";

    if (!confirm(`Reject and delete account for ${email}?\n\nREMINDER: You must also manually delete this email from the Firebase Console > Authentication.`)) return;

    await db.collection("users").doc(uid).delete();
    showToast("User rejected. Please clean up their account in Auth Console.", "error");
    loadPending();
    loadUsers();
}



function initializeProfileDropdown() {
    const profileDropdown = document.getElementById('profileDropdown');
    const profileTrigger = document.getElementById('profileTrigger');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const changePassBtn = document.getElementById('changePassBtn');

    if (!profileTrigger || !profileDropdown) return;

    profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileDropdown.classList.contains('open');
        profileDropdown.classList.toggle('open', !isOpen);
        profileTrigger.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target)) {
            profileDropdown.classList.remove('open');
            profileTrigger.setAttribute('aria-expanded', 'false');
        }
    });

    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            profileDropdown.classList.remove('open');
            document.getElementById('profileModal')?.classList.add('active');
        });
    }

    if (changePassBtn) {
        changePassBtn.addEventListener('click', () => {
            profileDropdown.classList.remove('open');
            document.getElementById('changePassModal')?.classList.add('active');
        });
    }

    const closeProfileModal = document.getElementById('closeProfileModal');
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => {
            document.getElementById('profileModal')?.classList.remove('active');
        });
    }

    const closeChangePassModal = document.getElementById('closeChangePassModal');
    const cancelChangePass = document.getElementById('cancelChangePass');
    const changePassModal = document.getElementById('changePassModal');

    const closeChangePw = () => {
        changePassModal?.classList.remove('active');
        document.getElementById('changePassForm')?.reset();
    };

    if (closeChangePassModal) closeChangePassModal.addEventListener('click', closeChangePw);
    if (cancelChangePass) cancelChangePass.addEventListener('click', closeChangePw);

    if (changePassModal) {
        changePassModal.addEventListener('click', (e) => {
            if (e.target === changePassModal) closeChangePw();
        });
    }

    const changePassForm = document.getElementById('changePassForm');
    if (changePassForm) {
        changePassForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (newPassword !== confirmPassword) {
                showToast('New passwords do not match', 'error');
                return;
            }

            const submitBtn = changePassForm.querySelector('button[type="submit"]');
            const originalContent = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span>Updating...</span>';

            try {
                const user = auth.currentUser;
                const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
                await user.reauthenticateWithCredential(credential);
                await user.updatePassword(newPassword);
                showToast('Password updated successfully!', 'success');
                closeChangePw();
            } catch (error) {
                console.error('Change password error:', error);
                if (error.code === 'auth/wrong-password') {
                    showToast('Current password is incorrect', 'error');
                } else {
                    showToast('Failed to update password: ' + (error.message || ''), 'error');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalContent;
            }
        });
    }
}

function initializeTheme() {
    const themeCheckbox = document.getElementById('themeCheckbox');
    const themeLabel = document.querySelector('.theme-label');
    const themeIcon = document.querySelector('.theme-icon');

    const applyTheme = (isDark) => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        if (themeLabel) themeLabel.textContent = isDark ? 'Dark Mode' : 'Light Mode';
        if (themeIcon) {
            themeIcon.innerHTML = isDark
                ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
                : '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
            themeIcon.setAttribute('fill', isDark ? 'currentColor' : 'none');
        }
        if (themeCheckbox) themeCheckbox.checked = isDark;
        try { localStorage.setItem('mislend-theme', isDark ? 'dark' : 'light'); } catch (e) { }
    };

    const saved = (() => { try { return localStorage.getItem('mislend-theme'); } catch (e) { return null; } })();
    applyTheme(saved === 'dark');

    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', () => applyTheme(themeCheckbox.checked));
    }
}

async function sendSMSOverdue(userId, equipmentName, borrowingId) {
    try {
        showToast("Initiating SMS reminder...", "info");
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (userData && userData.mobile) {
            const message = `Hello ${userData.name}, this is UCC MIS Office. Reminder: your borrowed equipment (${equipmentName}) is now overdue. Please return it as soon as possible. Thank you!`;

            const smsUrl = `sms:${userData.mobile}?body=${encodeURIComponent(message)}`;

            try {
                window.location.href = smsUrl;
            } catch (e) {
                console.error("Location redirect failed, trying window.open", e);
                window.open(smsUrl, '_blank');
            }

            if (borrowingId) {
                await db.collection('borrowings').doc(borrowingId).update({
                    lastNotified: firebase.firestore.FieldValue.serverTimestamp(),
                    notificationType: 'sms'
                });
                console.log(`Updated lastNotified (SMS) for borrowing ${borrowingId}`);
                setTimeout(() => loadDashboardData(), 1500);
            }
        } else {
            showToast("User has no mobile number registered.", "warning");
        }
    } catch (error) {
        console.error("Error sending SMS:", error);
        showToast("Failed to initiate SMS: " + error.message, "error");
    }
}

async function sendEmailOverdue(userId, equipmentName, borrowingId) {
    try {
        showToast("Initiating Email reminder...", "info");
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        if (userData && userData.email) {
            const subject = encodeURIComponent(`Overdue Equipment Reminder: ${equipmentName}`);
            const body = encodeURIComponent(`Hello ${userData.name},\n\nOur records show that the equipment (${equipmentName}) you borrowed from the UCC MIS Office is now overdue.\n\nPlease return it to the office as soon as possible to avoid any further issues.\n\nThank you,\nUCC MIS Office`);

            const mailtoUrl = `mailto:${userData.email}?subject=${subject}&body=${body}`;

            try {
                window.location.href = mailtoUrl;
            } catch (e) {
                window.open(mailtoUrl, '_blank');
            }

            if (borrowingId) {
                await db.collection('borrowings').doc(borrowingId).update({
                    lastNotified: firebase.firestore.FieldValue.serverTimestamp(),
                    notificationType: 'email'
                });
                console.log(`Updated lastNotified (Email) for borrowing ${borrowingId}`);
                setTimeout(() => loadDashboardData(), 1500);
            }
        } else {
            showToast("User has no email registered.", "warning");
        }
    } catch (error) {
        console.error("Error sending Email:", error);
        showToast("Failed to initiate Email: " + error.message, "error");
    }
}

window.generateQRCode = generateQRCode;
window.deleteEquipment = deleteEquipment;
window.deleteUser = deleteUser;
window.sendSMSOverdue = sendSMSOverdue;
window.sendEmailOverdue = sendEmailOverdue;
window.approveBorrow = approveBorrow;
window.rejectBorrow = rejectBorrow;
window.approveReturn = approveReturn;
window.rejectReturn = rejectReturn;
window.approveExtension = approveExtension;
window.rejectExtension = rejectExtension;
window.adminConfirmReturn = adminConfirmReturn;