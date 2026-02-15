let currentUser = null;
let currentUserData = null;
let html5QrCode = null;
let selectedEquipmentForBorrow = null;
let selectedBorrowingForReturn = null;

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
    loadEquipment();
    loadBorrowedItems();
    setupQRScanner();
    initializeModals();
    initializeLogout();
    initializeFilters();
    initializeMobileMenu();
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

                if (viewId === 'browse') {
                    loadEquipment();
                } else if (viewId === 'myborrowed') {
                    loadBorrowedItems();
                } else if (viewId === 'history') {
                    loadHistory();
                } else if (viewId === 'scan') {
                    startQRScanner();
                }
            }
        });
    });
}

async function loadEquipment() {
    const equipmentGrid = document.getElementById('equipmentGrid');
    if (!equipmentGrid) return;

    try {
        const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
        const statusFilter = document.getElementById('statusFilter')?.value || 'available';
        const searchQuery = document.getElementById('searchEquipment')?.value.toLowerCase() || '';

        let query = db.collection('equipment');

        if (statusFilter === 'available') {
            query = query.where('status', '==', 'available');
        }

        const snapshot = await query.get();

        let equipment = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (categoryFilter !== 'all') {
            equipment = equipment.filter(e => e.category === categoryFilter);
        }

        if (searchQuery) {
            equipment = equipment.filter(e =>
                e.name.toLowerCase().includes(searchQuery) ||
                e.equipmentId.toLowerCase().includes(searchQuery)
            );
        }

        if (equipment.length === 0) {
            equipmentGrid.innerHTML = `
                <div class="empty-state">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <h3>No equipment found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
        } else {
            equipmentGrid.innerHTML = equipment.map(item => `
                <div class="equipment-card">
                    <div class="equipment-header">
                        <span class="equipment-id">${item.equipmentId}</span>
                        <span class="equipment-status ${item.status}">${capitalize(item.status)}</span>
                    </div>
                    <div class="equipment-name">${item.name}</div>
                    <div class="equipment-category">${capitalize(item.category)}</div>
                    ${item.description ? `<p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 0.5rem;">${item.description}</p>` : ''}
                    <div class="equipment-actions">
                        ${item.status === 'available' ? `
                            <button class="btn btn-primary btn-sm" onclick="openBorrowModal('${item.id}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Borrow
                            </button>
                        ` : `
                            <button class="btn btn-secondary btn-sm" disabled>Not Available</button>
                        `}
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading equipment:', error);
        equipmentGrid.innerHTML = `
            <div class="empty-state">
                <h3>Error loading equipment</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

function initializeFilters() {
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchEquipment');

    if (categoryFilter) {
        categoryFilter.addEventListener('change', loadEquipment);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', loadEquipment);
    }

    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadEquipment, 300);
        });
    }
}

function setupQRScanner() {
    const manualSubmitBtn = document.getElementById('manualSubmitBtn');
    if (manualSubmitBtn) {
        manualSubmitBtn.addEventListener('click', () => {
            const equipmentId = document.getElementById('manualEquipmentId').value.trim();
            if (equipmentId) {
                processQRCode(equipmentId);
            } else {
                showToast('Please enter an equipment ID', 'error');
            }
        });
    }
}

// ✅ KEEP ONLY ONE copy (you had 3 duplicates)
function extractEquipmentId(decodedText) {
    if (!decodedText) return "";

    let text = String(decodedText).trim();

    try {
        if (text.startsWith("http")) {
            const url = new URL(text);
            const fromQuery = url.searchParams.get("id") || url.searchParams.get("equipmentId");
            if (fromQuery) return fromQuery.trim();
            const last = url.pathname.split("/").pop();
            if (last) return last.trim();
        }
    } catch (e) { }

    text = text.split("|")[0].trim();
    text = text.split("\n")[0].trim();

    return text;
}

async function processQRCode(decodedText) {
    try {
        const equipmentId = extractEquipmentId(decodedText);

        if (!equipmentId) {
            showToast("Invalid QR code content", "error");
            return;
        }

        const equipmentSnapshot = await db.collection("equipment")
            .where("equipmentId", "==", equipmentId)
            .limit(1)
            .get();

        if (equipmentSnapshot.empty) {
            showToast(`Equipment not found: ${equipmentId}`, "error");
            return;
        }

        const equipmentDoc = equipmentSnapshot.docs[0];
        const equipment = { id: equipmentDoc.id, ...equipmentDoc.data() };

        if (equipment.status === "available") {
            openBorrowModal(equipment.id);
        } else if (equipment.status === "borrowed") {
            const borrowingSnapshot = await db.collection("borrowings")
                .where("equipmentId", "==", equipment.id)
                .where("userId", "==", currentUser.uid)
                .where("status", "==", "borrowed")
                .limit(1)
                .get();

            if (!borrowingSnapshot.empty) {
                openReturnModal(borrowingSnapshot.docs[0].id);
            } else {
                showToast("This equipment is currently borrowed by someone else", "error");
            }
        } else {
            showToast("This equipment is under maintenance", "error");
        }
    } catch (error) {
        console.error("Error processing QR code:", error);
        showToast("Error processing QR code", "error");
    }
}

async function openBorrowModal(equipmentId) {
    try {
        const equipmentDoc = await db.collection('equipment').doc(equipmentId).get();
        const equipment = { id: equipmentDoc.id, ...equipmentDoc.data() };

        selectedEquipmentForBorrow = equipment;

        const borrowDetail = document.getElementById('borrowDetail');
        borrowDetail.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <strong>Equipment:</strong> ${equipment.name}<br>
                <strong>ID:</strong> ${equipment.equipmentId}<br>
            </div>
        `;

        // ✅ TIME (not date)
        const returnTimeInput = document.getElementById('returnTime');
        if (returnTimeInput) {
            const now = new Date();
            now.setSeconds(0, 0);
            now.setHours(now.getHours() + 1);

            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            returnTimeInput.value = `${hh}:${mm}`;
        }

        document.getElementById('borrowModal').classList.add('active');
    } catch (error) {
        console.error('Error opening borrow modal:', error);
        showToast('Error loading equipment details', 'error');
    }
}

function initializeModals() {
    const borrowModal = document.getElementById('borrowModal');
    const closeBorrowModal = document.getElementById('closeBorrowModal');
    const cancelBorrow = document.getElementById('cancelBorrow');
    const confirmBorrow = document.getElementById('confirmBorrow');

    if (closeBorrowModal) {
        closeBorrowModal.addEventListener('click', () => {
            borrowModal.classList.remove('active');
        });
    }

    if (cancelBorrow) {
        cancelBorrow.addEventListener('click', () => {
            borrowModal.classList.remove('active');
        });
    }

    if (confirmBorrow) {
        confirmBorrow.addEventListener('click', async () => {
            await borrowEquipment();
        });
    }

    const returnModal = document.getElementById('returnModal');
    const closeReturnModal = document.getElementById('closeReturnModal');
    const cancelReturn = document.getElementById('cancelReturn');
    const confirmReturn = document.getElementById('confirmReturn');

    if (closeReturnModal) {
        closeReturnModal.addEventListener('click', () => {
            returnModal.classList.remove('active');
        });
    }

    if (cancelReturn) {
        cancelReturn.addEventListener('click', () => {
            returnModal.classList.remove('active');
        });
    }

    if (confirmReturn) {
        confirmReturn.addEventListener('click', async () => {
            await returnEquipment();
        });
    }

    if (borrowModal) {
        borrowModal.addEventListener('click', (e) => {
            if (e.target === borrowModal) {
                borrowModal.classList.remove('active');
            }
        });
    }

    if (returnModal) {
        returnModal.addEventListener('click', (e) => {
            if (e.target === returnModal) {
                returnModal.classList.remove('active');
            }
        });
    }
}

async function borrowEquipment() {
    const returnTime = document.getElementById('returnTime').value;
    const purpose = document.getElementById('purpose').value;
    const room = document.getElementById('room').value.trim();

    if (!room) {
        showToast('Please enter the room', 'error');
        return;
    }

    if (!returnTime) {
        showToast('Please select a return time', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirmBorrow');
    const originalContent = confirmBtn.innerHTML;

    try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span>Processing...</span>';

        await db.collection('borrowings').add({
            equipmentId: selectedEquipmentForBorrow.id,
            equipmentCode: selectedEquipmentForBorrow.equipmentId,
            equipmentName: selectedEquipmentForBorrow.name,
            equipmentCategory: selectedEquipmentForBorrow.category,

            room: room,

            userId: currentUser.uid,
            userName: currentUserData.name,
            userEmail: currentUser.email,
            studentId: currentUserData.studentId,
            borrowedAt: firebase.firestore.FieldValue.serverTimestamp(),

            // ✅ TIME ONLY
            expectedReturnTime: returnTime,

            purpose: purpose || 'Not specified',
            status: 'borrowed'
        });

        await db.collection('equipment').doc(selectedEquipmentForBorrow.id).update({
            status: 'borrowed',
            borrowedBy: currentUser.uid,
            borrowedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Equipment borrowed successfully!', 'success');
        document.getElementById('borrowModal').classList.remove('active');

        document.getElementById('room').value = '';
        document.getElementById('returnTime').value = '';

        loadEquipment();
        loadBorrowedItems();

    } catch (error) {
        console.error('Error borrowing equipment:', error);
        showToast('Failed to borrow equipment', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalContent;
    }
}

async function loadBorrowedItems() {
    const borrowedItemsGrid = document.getElementById('borrowedItemsGrid');
    const borrowedCountBadge = document.getElementById('borrowedCount');

    if (!borrowedItemsGrid) return;

    try {
        const snapshot = await db.collection('borrowings')
            .where('userId', '==', currentUser.uid)
            .where('status', '==', 'borrowed')
            .get();

        const borrowedItems = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (borrowedCountBadge) {
            borrowedCountBadge.textContent = borrowedItems.length;
        }

        if (borrowedItems.length === 0) {
            borrowedItemsGrid.innerHTML = `
                <div class="empty-state">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                    </svg>
                    <h3>No borrowed items</h3>
                    <p>You haven't borrowed any equipment yet</p>
                </div>
            `;
        } else {
            borrowedItemsGrid.innerHTML = borrowedItems.map(item => {
                return `
                    <div class="borrowed-item-card">
                        <div class="borrowed-item-header">
                            <div class="borrowed-item-info">
                                <div class="borrowed-item-name">${item.equipmentName}</div>
                                <div class="borrowed-item-id">ID: ${item.equipmentCode || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="borrowed-item-meta">
                            <span>📅 Borrowed: ${formatDate(item.borrowedAt)}</span>
                            <span class="due-date">
                                ⏰ Due Time: ${item.expectedReturnTime || 'N/A'}
                            </span>
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;">
                            <strong>Room:</strong> ${item.room || 'N/A'}
                            <strong>Purpose:</strong> ${item.purpose}
                        </div>
                        <div class="borrowed-item-actions">
                            <button class="btn btn-primary" onclick="openReturnModal('${item.id}')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                Return Equipment
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading borrowed items:', error);
        borrowedItemsGrid.innerHTML = `
            <div class="empty-state">
                <h3>Error loading borrowed items</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

async function openReturnModal(borrowingId) {
    try {
        const borrowingDoc = await db.collection('borrowings').doc(borrowingId).get();
        const borrowing = { id: borrowingDoc.id, ...borrowingDoc.data() };

        selectedBorrowingForReturn = borrowing;

        const returnDetail = document.getElementById('returnDetail');
        returnDetail.innerHTML = `
            <div style="margin-bottom: 1rem;">
                <strong>Equipment:</strong> ${borrowing.equipmentName}<br>
                <strong>Borrowed:</strong> ${formatDate(borrowing.borrowedAt)}<br>
                <strong>Room:</strong> ${borrowing.room || 'N/A'}<br>
                <strong>Expected Return Time:</strong> ${borrowing.expectedReturnTime || 'N/A'}
            </div>
        `;

        document.getElementById('returnModal').classList.add('active');
    } catch (error) {
        console.error('Error opening return modal:', error);
        showToast('Error loading borrowing details', 'error');
    }
}

async function returnEquipment() {
    const condition = document.getElementById('condition').value;
    const notes = document.getElementById('notes').value;

    if (!condition) {
        showToast('Please select equipment condition', 'error');
        return;
    }

    const confirmBtn = document.getElementById('confirmReturn');
    const originalContent = confirmBtn.innerHTML;

    try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span>Processing...</span>';

        await db.collection('borrowings').doc(selectedBorrowingForReturn.id).update({
            returnedAt: firebase.firestore.FieldValue.serverTimestamp(),
            returnCondition: condition,
            returnNotes: notes || '',
            status: 'returned'
        });

        await db.collection('equipment').doc(selectedBorrowingForReturn.equipmentId).update({
            status: condition === 'damaged' ? 'maintenance' : 'available',
            borrowedBy: null,
            borrowedAt: null
        });

        showToast('Equipment returned successfully!', 'success');
        document.getElementById('returnModal').classList.remove('active');

        document.getElementById('condition').value = '';
        document.getElementById('notes').value = '';

        loadBorrowedItems();
        loadHistory();

    } catch (error) {
        console.error('Error returning equipment:', error);
        showToast('Failed to return equipment', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalContent;
    }
}

async function loadHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    try {
        const snapshot = await db.collection('borrowings')
            .where('userId', '==', currentUser.uid)
            .limit(50)
            .get();

        let history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        history.sort((a, b) => {
            const aTime = a.borrowedAt?.seconds || 0;
            const bTime = b.borrowedAt?.seconds || 0;
            return bTime - aTime;
        });

        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <h3>No history yet</h3>
                    <p>Your borrowing history will appear here</p>
                </div>
            `;
        } else {
            historyList.innerHTML = history.map(item => `
                <div class="history-item">
                    <div class="history-item-header">
                        <div class="history-item-title">${item.equipmentName}</div>
                        <span class="history-status ${item.status}">${capitalize(item.status)}</span>
                    </div>
                    <div class="history-item-details">
                        <span>📅 Borrowed: ${formatDate(item.borrowedAt)}</span>
                        ${item.expectedReturnTime ? `<span>⏰ Due Time: ${item.expectedReturnTime}</span>` : ''}
                        ${item.returnedAt ? `<span>✅ Returned: ${formatDate(item.returnedAt)}</span>` : ''}
                        ${item.returnCondition ? `<span>🔧 Condition: ${capitalize(item.returnCondition)}</span>` : ''}
                        ${item.room ? `<span>🏫 Room: ${item.room}</span>` : ''}
                        <span>📝 Purpose: ${item.purpose}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading history:', error);
        historyList.innerHTML = `
            <div class="empty-state">
                <h3>Error loading history</h3>
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
                if (html5QrCode) {
                    try {
                        await html5QrCode.stop();
                    } catch (e) { }
                }

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

function openProfileModal() {
    document.getElementById("profileModal").classList.add("active");

    document.getElementById("profileName").value = currentUserData.name || "";
    document.getElementById("profileEmail").value = currentUser.email || "";
    document.getElementById("profileStudentId").value = currentUserData.studentId || "";
}

function closeProfileModal() {
    document.getElementById("profileModal").classList.remove("active");
}

async function saveProfile() {
    const name = profileName.value;
    const email = profileEmail.value;
    const studentId = profileStudentId.value;

    await db.collection("users").doc(currentUser.uid).update({
        name, email, studentId
    });

    if (email !== currentUser.email) {
        await currentUser.updateEmail(email);
    }

    showToast("Profile updated", "success");
    closeProfileModal();
}

function openPasswordModal() {
    document.getElementById("passwordModal").classList.add("active");
}

function closePasswordModal() {
    document.getElementById("passwordModal").classList.remove("active");
}

async function changePassword() {
    const pass = document.getElementById("newPassword").value;

    await currentUser.updatePassword(pass);

    showToast("Password updated", "success");
    closePasswordModal();
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

async function startQRScanner() {
    const readerEl = document.getElementById("qr-reader");
    if (!readerEl) return;

    if (location.protocol !== "https:" && location.hostname !== "localhost") {
        showToast("Camera needs HTTPS. Please open using https link.", "error");
        return;
    }

    try {
        if (html5QrCode) {
            try { await html5QrCode.stop(); } catch (e) { }
        } else {
            html5QrCode = new Html5Qrcode("qr-reader");
        }

        await html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
                try { await html5QrCode.stop(); } catch (e) { }
                await processQRCode(decodedText);
            }
        );

    } catch (err) {
        console.error("QR start error:", err);
        showToast("Camera blocked. Check browser permission settings.", "error");
    }
}

window.openBorrowModal = openBorrowModal;
window.openReturnModal = openReturnModal;
