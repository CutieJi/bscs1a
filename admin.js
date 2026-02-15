let currentAdmin = null;
let currentAdminData = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { user, userData } = await checkAuth('admin');
        currentAdmin = user;
        currentAdminData = userData;

        initializeDashboard();
        loadPending();
    } catch (error) {
        console.error('Authentication error:', error);
    }
});

function initializeDashboard() {
    updateAdminInfo();
    initializeNavigation();
    loadDashboardData();
    initializeEquipmentManagement();
    initializeUserManagement();
    initializeLogout();
    initializeRefresh();
    initializeExport();
    initializeMobileMenu()
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

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(view => view.classList.remove('active'));
            const targetView = document.getElementById(`${viewId}View`);
            if (targetView) {
                targetView.classList.add('active');

                if (viewId === 'dashboard') {
                    loadDashboardData();
                } else if (viewId === 'equipment') {
                    loadAllEquipment();
                } else if (viewId === 'borrowed') {
                    loadCurrentlyBorrowed();
                } else if (viewId === 'logs') {
                    loadBorrowingLogs();
                } else if (viewId === 'users') {
                    loadUsers();
                }
            }
        });
    });
}

async function loadDashboardData() {
    try {
        const equipmentSnapshot = await db.collection('equipment').get();
        const equipment = equipmentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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

        document.getElementById('totalEquipment').textContent = totalEquipment;
        document.getElementById('availableEquipment').textContent = availableEquipment;
        document.getElementById('borrowedEquipment').textContent = borrowedEquipment;
        document.getElementById('todayBorrows').textContent = todayBorrows;
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
    if (!overdueList) return;

    try {
        const now = new Date();

        const snapshot = await db.collection('borrowings')
            .where('status', '==', 'borrowed')
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
            overdueList.innerHTML = overdue.map(item => `
                <div class="alert-item warning">
                    <div class="alert-icon">⚠️</div>
                    <div class="alert-content">
                        <div class="alert-title">${item.equipmentName}</div>
                        <div class="alert-message">
                            Borrowed by ${item.userName} - Due Time: ${item.expectedReturnTime || 'N/A'}
                        </div>
                    </div>
                </div>
            `).join('');
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
                    <button class="btn btn-icon" onclick="openEditEquipment('${item.id}','${item.equipmentId}','${item.name}','${item.category}','${item.description || ''}')"title="Edit">
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

    new QRCode(qrContainer, {
        text: equipmentId,
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
            .where('status', '==', 'borrowed')
            .get();

        const borrowed = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
                    <div class="borrowed-list-item">
                        <div class="borrowed-list-header">
                            <div>
                                <div class="borrowed-student">${item.userName}</div>
                                <div class="borrowed-list-details">
                                    📧 ${item.userEmail} • 🆔 ${item.studentId}
                                </div>
                            </div>
                            ${isOverdue
                                ? '<span class="badge badge-status" style="background: rgba(239, 68, 68, 0.1); color: var(--danger)">OVERDUE</span>'
                                : ''
                            }
                        </div>

                        <div class="borrowed-list-details" style="margin-top: 1rem;">
                            <strong>Equipment:</strong> ${item.equipmentName}<br>
                            <strong>Borrowed:</strong> ${formatDate(item.borrowedAt)} (${daysBorrowed} days ago)<br>
                            <strong>Due Time:</strong> ${item.expectedReturnTime || 'N/A'}<br>
                            <strong>Room:</strong> ${item.room || 'N/A'}<br>
                            <strong>Purpose:</strong> ${item.purpose || 'N/A'}
                        </div>
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

        if (logs.length === 0) {
            logsList.innerHTML = `
                <div class="empty-state">
                    <h3>No logs found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
        } else {
            logsList.innerHTML = logs.map(log => `
                <div class="log-item">
                    <div class="log-item-header">
                        <span class="log-item-title">${log.equipmentName}</span>
                        <span class="history-status ${log.status}">${capitalize(log.status)}</span>
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
                            <span class="log-label">Student ID:</span>
                            <span class="log-value">${log.studentId || 'N/A'}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Borrowed:</span>
                            <span class="log-value">${formatDate(log.borrowedAt)}</span>
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
            `).join('');
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

    if (exportLogsBtn) {
        exportLogsBtn.addEventListener('click', async () => {
            try {
                const snapshot = await db.collection('borrowings')
                    .orderBy('borrowedAt', 'desc')
                    .get();

                const logs = snapshot.docs.map(doc => doc.data());

                let csv = 'Equipment Name,Equipment Code,Student Name,Student Email,Student ID,Borrowed At,Returned At,Due Time,Room,Status,Purpose,Return Condition\n';

                logs.forEach(log => {
                    const borrowedAt = log.borrowedAt ? log.borrowedAt.toDate().toLocaleString() : 'N/A';
                    const returnedAt = log.returnedAt ? log.returnedAt.toDate().toLocaleString() : 'N/A';

                    csv += `"${log.equipmentName || ''}",`;
                    csv += `"${log.equipmentCode || log.equipmentId || 'N/A'}",`;
                    csv += `"${log.userName || ''}",`;
                    csv += `"${log.userEmail || ''}",`;
                    csv += `"${log.studentId || 'N/A'}",`;
                    csv += `"${borrowedAt}",`;
                    csv += `"${returnedAt}",`;
                    csv += `"${log.expectedReturnTime || 'N/A'}",`;
                    csv += `"${log.room || 'N/A'}",`;
                    csv += `"${log.status || ''}",`;
                    csv += `"${(log.purpose || '').replace(/"/g, '""')}",`;
                    csv += `"${log.returnCondition || 'N/A'}"\n`;
                });

                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);

                const a = document.createElement('a');
                a.href = url;
                a.download = `borrowing-logs-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();

                window.URL.revokeObjectURL(url);
                showToast('Logs exported successfully', 'success');
            } catch (error) {
                console.error('Error exporting logs:', error);
                showToast('Failed to export logs', 'error');
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
    const studentIdGroup = document.getElementById('studentIdGroup');

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            addUserModal.classList.add('active');
        });
    }

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

        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: name });

        const userData = {
            name: name,
            email: email,
            role: role,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (role === 'student' && studentId) {
            userData.studentId = studentId;
        }

        await db.collection('users').doc(user.uid).set(userData);

        showToast(`${capitalize(role)} account created successfully!`, 'success');

        await auth.signOut();
        await auth.signInWithEmailAndPassword(currentAdmin.email, '__admin_session__');

        document.getElementById('addUserModal').classList.remove('active');
        document.getElementById('addUserForm').reset();

        loadUsers();

    } catch (error) {
        console.error('Error creating user:', error);
        let errorMessage = 'Failed to create user. ';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage += 'This email is already registered.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage += 'Invalid email address.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage += 'Password should be at least 6 characters.';
        } else {
            errorMessage += error.message;
        }
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

        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

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
                                <button class="btn btn-icon" onclick="openEditUser('${user.id}','${user.name}','${user.email}','${user.role}','${user.studentId || ''}')">
                                    ✏️
                                </button>
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
    if (!confirm(`Are you sure you want to delete the user: ${userEmail}?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        await db.collection('users').doc(userId).delete();
        showToast('User removed from database', 'success');
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

function openEditUser(id, name, email, role, studentId) {
    document.getElementById("editUserId").value = id;
    document.getElementById("editUserName").value = name;
    document.getElementById("editUserEmail").value = email;
    document.getElementById("editUserRole").value = role;
    document.getElementById("editUserStudentId").value = studentId;

    document.getElementById("editUserModal").classList.add("active");
}

function closeEditUser() {
    document.getElementById("editUserModal").classList.remove("active");
}

document.getElementById("editUserForm").addEventListener("submit", async e => {
    e.preventDefault();

    const id = document.getElementById("editUserId").value;

    await db.collection("users").doc(id).update({
        name: document.getElementById("editUserName").value,
        email: document.getElementById("editUserEmail").value,
        role: document.getElementById("editUserRole").value,
        studentId: document.getElementById("editUserStudentId").value
    });

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
    if (!confirm("Delete account?")) return;

    await db.collection("users").doc(uid).delete();
    showToast("User rejected", "error");
    loadPending();
    loadUsers();
}

function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (!mobileMenuToggle || !sidebar || !sidebarOverlay) return;

    const openMenu = () => {
        sidebar.classList.add('mobile-open');
        sidebarOverlay.classList.add('active');
        mobileMenuToggle.classList.add('is-open');
        document.body.classList.add('sidebar-open');
    };

    const closeMenu = () => {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('active');
        mobileMenuToggle.classList.remove('is-open');
        document.body.classList.remove('sidebar-open');
    };

    mobileMenuToggle.addEventListener('click', () => {
        const isOpen = sidebar.classList.contains('mobile-open');
        isOpen ? closeMenu() : openMenu();
    });

    sidebarOverlay.addEventListener('click', closeMenu);

    document.querySelectorAll('.sidebar .nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeMenu();
        });
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeMenu();
    });
}

window.generateQRCode = generateQRCode;
window.deleteEquipment = deleteEquipment;
window.deleteUser = deleteUser;