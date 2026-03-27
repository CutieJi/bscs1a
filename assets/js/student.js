let currentUser = null;
let currentUserData = null;
let html5QrCode = null;
let selectedEquipmentForBorrow = null;
let selectedBorrowingForReturn = null;
let selectedBorrowingForExtend = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { user, userData } = await checkAuth('student');
        currentUser = user;
        currentUserData = userData;

        initializeDashboard();

        handleBorrowDeepLink();
    } catch (error) {
        console.error('Authentication error:', error);
    }
});

async function handleBorrowDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const equipmentCode = params.get("borrow");
    if (!equipmentCode) return;

    try {
        const browseNav = document.querySelector('.nav-item[data-view="browse"]');
        if (browseNav) browseNav.click();

        const snap = await db.collection("equipment")
            .where("equipmentId", "==", equipmentCode)
            .limit(1)
            .get();

        if (snap.empty) {
            showToast(`Equipment not found: ${equipmentCode}`, "error");
            return;
        }

        const doc = snap.docs[0];
        const equipment = { id: doc.id, ...doc.data() };

        if (equipment.status !== "available") {
            showToast("This equipment is not available right now.", "error");
            return;
        }

        await openBorrowModal(equipment.id);

        window.history.replaceState({}, document.title, window.location.pathname);

    } catch (err) {
        console.error("Deep link borrow error:", err);
        showToast("Failed to open borrow form.", "error");
    }
}


function initializeDashboard() {
    updateUserInfo();
    initializeNavigation();
    loadEquipment();
    loadBorrowedItems();
    setupQRScanner();
    initializeModals();
    initializeFilters();
    initializeSidebar();
    initializeProfileDropdown();
    initializeTheme();
    initializeHistoryExport();
}


function updateUserInfo() {
    const name = currentUserData.name || 'Student';
    const email = currentUser.email || '';
    const initials = getUserInitials(name);
    const photoURL = currentUserData.photoURL || null;

    const ids = ['userInitial', 'topbarInitial', 'menuInitial'];
    const containers = ['sidebarAvatarContainer', 'topbarAvatarContainer', 'menuAvatarContainer'];

    containers.forEach((containerId, index) => {
        const container = document.getElementById(containerId);
        const initialEl = document.getElementById(ids[index]);
        if (!container) return;

        if (photoURL) {
            container.innerHTML = `<img src="${photoURL}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            container.innerHTML = `<span id="${ids[index]}" style="border-radius: 50%;">${initials}</span>`;
        }
    });

    const nameEls = ['userName', 'topbarUserName', 'menuUserName'];
    nameEls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = name;
    });

    const emailEls = ['userEmail', 'menuUserEmail'];
    emailEls.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = email;
    });
}

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const views = document.querySelectorAll('.view-container');
    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    const topbarMobileTitle = document.getElementById('topbarMobileTitle');

    const viewLabels = {
        browse: 'Browse Equipment',
        scan: 'Scan QR Code',
        myborrowed: 'My Borrowed Items',
        history: 'Borrowing History',
        settings: 'Settings'
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
        if (topbarMobileTitle) topbarMobileTitle.textContent = label;

        if (viewId === 'browse') loadEquipment();
        else if (viewId === 'myborrowed') loadBorrowedItems();
        else if (viewId === 'history') loadHistory();
        else if (viewId === 'scan') startQRScanner();

        try { localStorage.setItem('student-active-view', viewId); } catch (e) { }

        if (window.innerWidth <= 768) {
            document.getElementById('sidebar')?.classList.remove('mobile-open');
            document.getElementById('sidebarOverlay')?.classList.remove('active');
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            activateView(item.getAttribute('data-view'));
        });
    });

    const saved = (() => { try { return localStorage.getItem('student-active-view'); } catch (e) { return null; } })();
    if (saved && document.getElementById(`${saved}View`)) {
        activateView(saved);
    } else {
        activateView('browse');
    }
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

function extractEquipmentId(decodedText) {
    if (!decodedText) return "";

    let text = String(decodedText).trim();

    try {
        if (text.startsWith("http")) {
            const url = new URL(text);
            const fromQuery = url.searchParams.get("id") ||
                url.searchParams.get("equipmentId") ||
                url.searchParams.get("borrow");
            if (fromQuery) return fromQuery.trim();

            const last = url.pathname.split("/").pop();
            if (last && !last.endsWith(".html")) return last.trim();
        }
    } catch (e) { }

    text = text.split("|")[0].trim();
    text = text.split("\n")[0].trim();

    return text;
}

async function processQRCode(decodedText) {
    showToast('🔍 Looking up equipment…', 'info');

    try {
        const equipmentId = extractEquipmentId(decodedText);

        if (!equipmentId) {
            showToast('Invalid QR code content', 'error');
            setTimeout(() => startQRScanner(), 1500);
            return;
        }

        const equipmentSnapshot = await db.collection('equipment')
            .where('equipmentId', '==', equipmentId)
            .limit(1)
            .get();

        if (equipmentSnapshot.empty) {
            showToast(`Equipment not found: ${equipmentId}`, 'error');
            setTimeout(() => startQRScanner(), 2000);
            return;
        }

        const equipmentDoc = equipmentSnapshot.docs[0];
        const equipment = { id: equipmentDoc.id, ...equipmentDoc.data() };

        if (equipment.status === 'available') {
            const browseNav = document.querySelector('.nav-item[data-view="browse"]');
            if (browseNav) browseNav.click();
            await openBorrowModal(equipment.id);

        } else if (equipment.status === 'borrowed') {
            const borrowingSnapshot = await db.collection('borrowings')
                .where('equipmentId', '==', equipment.id)
                .where('userId', '==', currentUser.uid)
                .where('status', '==', 'borrowed')
                .limit(1)
                .get();

            if (!borrowingSnapshot.empty) {
                const borrowedNav = document.querySelector('.nav-item[data-view="myborrowed"]');
                if (borrowedNav) borrowedNav.click();
                await openReturnModal(borrowingSnapshot.docs[0].id);
            } else {
                showToast('This equipment is currently borrowed by someone else', 'error');
                setTimeout(() => startQRScanner(), 2000);
            }
        } else {
            showToast('This equipment is currently unavailable', 'error');
            setTimeout(() => startQRScanner(), 2000);
        }
    } catch (error) {
        console.error('Error processing QR code:', error);
        showToast('Error reading QR code. Please try again.', 'error');
        setTimeout(() => startQRScanner(), 2000);
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

    const extendModal = document.getElementById('extendModal');
    const closeExtendModal = document.getElementById('closeExtendModal');
    const cancelExtend = document.getElementById('cancelExtend');
    const confirmExtend = document.getElementById('confirmExtend');

    if (closeExtendModal) closeExtendModal.onclick = () => extendModal.classList.remove('active');
    if (cancelExtend) cancelExtend.onclick = () => extendModal.classList.remove('active');
    if (confirmExtend) confirmExtend.onclick = () => requestExtension();

    if (extendModal) {
        extendModal.onclick = (e) => {
            if (e.target === extendModal) extendModal.classList.remove('active');
        }
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

    const now = new Date();
    const [hh, mm] = returnTime.split(':').map(Number);
    const target = new Date();
    target.setHours(hh, mm, 0, 0);

    if (target < now) {
        target.setDate(target.getDate() + 1);
    }

    const diffHours = (target - now) / (1000 * 60 * 60);
    if (diffHours > 3.01) {
        showToast('Maximum borrowing time is 3 hours', 'error');
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
            userMobile: currentUserData.mobile || 'N/A',
            studentId: currentUserData.studentId,
            userPhotoURL: currentUserData.photoURL || null,
            borrowedAt: firebase.firestore.FieldValue.serverTimestamp(),
            expectedReturnTime: returnTime,

            purpose: purpose || 'Not specified',
            status: 'pending_borrow'
        });

        showToast('Borrow request submitted! Awaiting admin approval.', 'success');
        document.getElementById('borrowModal').classList.remove('active');

        document.getElementById('room').value = '';
        document.getElementById('returnTime').value = '';

        loadEquipment();
        loadBorrowedItems();

    } catch (error) {
        console.error('Error borrowing equipment:', error);
        showToast('Failed to submit borrow request', 'error');
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
        const [borrowedSnap, pendingBorrowSnap, pendingExtendSnap] = await Promise.all([
            db.collection('borrowings').where('userId', '==', currentUser.uid).where('status', '==', 'borrowed').get(),
            db.collection('borrowings').where('userId', '==', currentUser.uid).where('status', '==', 'pending_borrow').get(),
            db.collection('borrowings').where('userId', '==', currentUser.uid).where('status', '==', 'pending_extension').get()
        ]);

        const borrowedItems = [
            ...borrowedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            ...pendingBorrowSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
            ...pendingExtendSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        ].sort((a, b) => {
            const aTime = a.borrowedAt?.seconds || 0;
            const bTime = b.borrowedAt?.seconds || 0;
            return bTime - aTime;
        });

        if (borrowedCountBadge) {
            borrowedCountBadge.textContent = borrowedItems.filter(i => i.status === 'borrowed').length;
        }

        if (borrowedItems.length === 0) {
            borrowedItemsGrid.innerHTML = `
                <div class="empty-state">
                    <h3>No borrowed items</h3>
                    <p>You haven't borrowed any equipment yet</p>
                </div>
            `;
        } else {
            borrowedItemsGrid.innerHTML = borrowedItems.map(item => {
                const isPendingBorrow = item.status === 'pending_borrow';
                const isPendingReturn = item.status === 'pending_return';
                const isPendingExtend = item.status === 'pending_extension';
                const isBorrowed = item.status === 'borrowed';

                let statusBadge = '';
                if (isPendingBorrow) {
                    statusBadge = `<span class="badge badge-status" style="background: rgba(245,158,11,0.1); color: var(--warning); font-size:0.75rem;">Pending Approval</span>`;
                } else if (isPendingExtend) {
                    statusBadge = `<span class="badge badge-status" style="background: rgba(30,64,175,0.1); color: #1e40af; font-size:0.75rem;">Extension Pending</span>`;
                } else if (isBorrowed) {
                    statusBadge = `<span class="badge badge-status" style="background: rgba(16,185,129,0.1); color: var(--success); font-size:0.75rem;">Approved</span>`;
                }

                let actions = '';
                if (isBorrowed) {
                    actions = `
                        <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="openExtendModal('${item.id}')">
                            Extend Time
                        </button>
                    `;
                } else if (isPendingBorrow) {
                    actions = `
                        <button class="btn btn-secondary btn-sm" style="flex:1; border-color: var(--danger); color: var(--danger);" onclick="cancelBorrowRequest('${item.id}')">
                            Cancel Request
                        </button>
                    `;
                } else if (isPendingExtend) {
                    actions = `
                        <button class="btn btn-secondary btn-sm" style="flex:1; border-color: var(--danger); color: var(--danger);" onclick="cancelExtensionRequest('${item.id}')">
                            Cancel Extension
                        </button>
                    `;
                } else {
                    actions = `<div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; padding: 0.5rem; background: var(--bg-secondary); border-radius: var(--radius-md); width:100%;">
                        📋 Action is confirmed by the admin
                    </div>`;
                }

                return `
                    <div class="borrowed-item-card">
                        <div class="borrowed-item-header">
                            <div class="borrowed-item-info">
                                <div class="borrowed-item-name">${item.equipmentName}</div>
                                <div class="borrowed-item-id">ID: ${item.equipmentCode || 'N/A'}</div>
                            </div>
                            ${statusBadge}
                        </div>
                        <div class="borrowed-item-meta">
                            <span><i class="fa-solid fa-calendar"></i> Borrowed: ${formatDate(item.borrowedAt)}</span>
                            |
                            <span class="due-date">
                                <i class="fa-solid fa-clock"></i> Due Time: ${item.expectedReturnTime || 'N/A'}
                            </span>
                        </div>
                        <div style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1rem;">
                            <strong>Room:</strong> ${item.room || 'N/A'}
                            &nbsp; <strong>Purpose:</strong> ${item.purpose}
                        </div>
                        <div class="borrowed-item-actions" style="display:flex; gap:0.5rem;">
                            ${actions}
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
            status: 'pending_return',
            pendingReturnCondition: condition,
            pendingReturnNotes: notes || ''
        });

        showToast('Return request submitted! Awaiting admin approval.', 'success');
        document.getElementById('returnModal').classList.remove('active');

        document.getElementById('condition').value = '';
        document.getElementById('notes').value = '';

        loadBorrowedItems();
        loadHistory();

    } catch (error) {
        console.error('Error submitting return request:', error);
        showToast('Failed to submit return request', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalContent;
    }
}

async function loadHistory() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    try {
        const startDate = document.getElementById('historyStartDate')?.value;
        const endDate = document.getElementById('historyEndDate')?.value;
        const equipmentFilter = document.getElementById('historyEquipmentFilter')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('historyStatusFilter')?.value || 'all';
        const sortValue = document.getElementById('historySort')?.value || 'borrowedAt_desc';

        const snapshot = await db.collection('borrowings')
            .where('userId', '==', currentUser.uid)
            .limit(100)
            .get();

        let history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (startDate) {
            const start = new Date(startDate);
            history = history.filter(h => h.borrowedAt?.toDate() >= start);
        }

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59);
            history = history.filter(h => h.borrowedAt?.toDate() <= end);
        }

        if (equipmentFilter) {
            history = history.filter(h =>
                (h.equipmentName || '').toLowerCase().includes(equipmentFilter) ||
                (h.equipmentCode || '').toLowerCase().includes(equipmentFilter)
            );
        }

        if (statusFilter !== 'all') {
            history = history.filter(h => h.status === statusFilter);
        }

        const [field, order] = sortValue.split('_');
        history.sort((a, b) => {
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

        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <h3>No history found</h3>
                    <p>Try adjusting your filters or borrow some equipment</p>
                </div>
            `;
        } else {
            const statusLabels = {
                'pending_borrow': 'Pending Approval',
                'pending_return': 'Return Pending',
                'pending_extension': 'Extension Pending',
                'borrowed': 'Borrowed',
                'returned': 'Returned',
                'rejected': 'Rejected'
            };

            historyList.innerHTML = history.map(item => {
                const statusLabel = statusLabels[item.status] || capitalize(item.status);
                return `
                <div class="log-item">
                    <div class="log-item-header">
                        <span class="log-item-title">${item.equipmentName}</span>
                        <span class="history-status ${item.status}">${statusLabel}</span>
                    </div>

                    <div class="log-item-info">
                        <div class="log-field">
                            <span class="log-label">Equipment ID:</span>
                            <span class="log-value">${item.equipmentCode || 'N/A'}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Borrowed:</span>
                            <span class="log-value">${formatDate(item.borrowedAt)}</span>
                        </div>

                        ${item.returnedAt ? `
                            <div class="log-field">
                                <span class="log-label">Returned:</span>
                                <span class="log-value">${formatDate(item.returnedAt)}</span>
                            </div>
                        ` : `
                            <div class="log-field">
                                <span class="log-label">Due Time:</span>
                                <span class="log-value">${item.expectedReturnTime || 'N/A'}</span>
                            </div>
                        `}

                        <div class="log-field">
                            <span class="log-label">Room:</span>
                            <span class="log-value">${item.room || 'N/A'}</span>
                        </div>
                        <div class="log-field">
                            <span class="log-label">Purpose:</span>
                            <span class="log-value">${item.purpose || 'N/A'}</span>
                        </div>

                        ${item.returnCondition ? `
                            <div class="log-field">
                                <span class="log-label">Return Condition:</span>
                                <span class="log-value">${capitalize(item.returnCondition)}</span>
                            </div>
                        ` : ''}

                        <div class="log-field">
                            <span class="log-label">Status History:</span>
                            <span class="log-value">
                                ${item.wasOverdue ? '<span class="badge" style="background:rgba(239,68,68,0.1); color:var(--danger); font-size:0.7rem; padding: 2px 6px;">WAS OVERDUE</span>' : ''}
                                ${item.hasExtension ? '<span class="badge" style="background:rgba(30,64,175,0.1); color:#1e40af; font-size:0.7rem; padding: 2px 6px;">EXTENDED</span>' : ''}
                                ${!item.wasOverdue && !item.hasExtension ? '<span style="color:var(--text-tertiary); font-size:0.8rem;">Regular</span>' : ''}
                            </span>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
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

function initializeHistoryExport() {
    const exportBtn = document.getElementById('exportHistoryBtn');
    if (!exportBtn) return;

    exportBtn.addEventListener('click', async () => {
        try {
            const snapshot = await db.collection('borrowings')
                .where('userId', '==', currentUser.uid)
                .orderBy('borrowedAt', 'desc')
                .get();

            const rows = [['Equipment', 'Equipment ID', 'Status', 'Borrowed At', 'Due Time', 'Returned At', 'Return Condition', 'Room', 'Purpose', 'Was Overdue', 'Had Extension']];

            const fmtDate = (ts) => {
                if (!ts || !ts.toDate) return '';
                const d = ts.toDate();
                const pad = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };

            snapshot.docs.forEach(doc => {
                const d = doc.data();
                rows.push([
                    d.equipmentName || '',
                    d.equipmentCode || '',
                    d.status || '',
                    fmtDate(d.borrowedAt),
                    d.expectedReturnTime || '',
                    fmtDate(d.returnedAt),
                    d.returnCondition || '',
                    d.room || '',
                    d.purpose || '',
                    d.wasOverdue ? 'Yes' : 'No',
                    d.hasExtension ? 'Yes' : 'No'
                ]);
            });

            const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `my-borrowing-history-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('History exported successfully!', 'success');
        } catch (err) {
            console.error('Export error:', err);
            showToast('Failed to export history', 'error');
        }
    });
}



function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const topbarToggle = document.getElementById('topbarToggle');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');

    const openSidebar = () => {
        sidebar?.classList.remove('collapsed');
        sidebar?.classList.add('mobile-open');
        sidebarOverlay?.classList.add('active');
    };

    const closeSidebar = () => {
        sidebar?.classList.remove('mobile-open');
        sidebarOverlay?.classList.remove('active');
    };

    const toggleDesktop = () => {
        sidebar?.classList.toggle('collapsed');
    };

    if (topbarToggle) {
        topbarToggle.addEventListener('click', () => {
            if (window.innerWidth <= 768) openSidebar();
            else toggleDesktop();
        });
    }

    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', closeSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) closeSidebar();
    });
}

function initializeProfileDropdown() {
    const profileDropdown = document.getElementById('profileDropdown');
    const profileTrigger = document.getElementById('profileTrigger');
    const viewProfileBtn = document.getElementById('viewProfileBtn');
    const changePassBtn = document.getElementById('changePassBtn');
    const settingsChangePassBtn = document.getElementById('settingsChangePassBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!profileTrigger || !profileDropdown) return;

    profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = profileDropdown.classList.contains('open');
        profileDropdown.classList.toggle('open', !isOpen);
    });

    document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target)) {
            profileDropdown.classList.remove('open');
        }
    });

    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', () => {
            profileDropdown.classList.remove('open');
            openProfileModal();
        });
    }

    const openChangePw = () => {
        profileDropdown.classList.remove('open');
        openPasswordModal();
    };

    if (changePassBtn) changePassBtn.addEventListener('click', openChangePw);
    if (settingsChangePassBtn) settingsChangePassBtn.addEventListener('click', openChangePw);

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!await showConfirm({
                title: 'Logout',
                message: 'Are you sure you want to logout of your account?',
                confirmText: 'Logout',
                type: 'danger'
            })) return;

            profileDropdown.classList.remove('open');
            try {
                if (html5QrCode) { try { await html5QrCode.stop(); } catch (e) { } }
                await auth.signOut();
                showToast('Logged out successfully', 'success');
                setTimeout(() => { window.location.href = 'index.html'; }, 1000);
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Failed to logout. Please try again.', 'error');
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
        if (themeCheckbox) themeCheckbox.checked = isDark;
        try { localStorage.setItem('mislend-theme', isDark ? 'dark' : 'light'); } catch (e) { }
    };

    const saved = (() => { try { return localStorage.getItem('mislend-theme'); } catch (e) { return null; } })();
    applyTheme(saved === 'dark');

    if (themeCheckbox) {
        themeCheckbox.addEventListener('change', () => applyTheme(themeCheckbox.checked));
    }
}

function openProfileModal() {
    document.getElementById("profileModal").classList.add("active");

    document.getElementById("profileFirstName").value = currentUserData.firstName || (!currentUserData.lastName ? currentUserData.name : "");
    document.getElementById("profileMiddleInitial").value = currentUserData.middleInitial || "";
    document.getElementById("profileLastName").value = currentUserData.lastName || "";
    document.getElementById("profileEmail").value = currentUser.email || "";
    document.getElementById("profileStudentId").value = currentUserData.studentId || "";
    document.getElementById("profileMobile").value = currentUserData.mobile || "";
    document.getElementById("profileGender").value = currentUserData.gender || "";
    document.getElementById("profileCourse").value = currentUserData.course || "";
    document.getElementById("profileYearLevel").value = currentUserData.yearLevel || "";
    document.getElementById("profileSection").value = currentUserData.section || "";

    // Reset file input
    const photoInput = document.getElementById("profilePhotoInput");
    if (photoInput) photoInput.value = "";

    // Set initial preview
    const previewContainer = document.getElementById("profileEditAvatarContainer");
    if (previewContainer) {
        if (currentUserData.photoURL) {
            previewContainer.innerHTML = `<img src="${currentUserData.photoURL}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else {
            const initials = getUserInitials(currentUserData.name || "S");
            previewContainer.innerHTML = `<span id="profileEditInitial">${initials}</span>`;
        }
    }
}

function closeProfileModal() {
    document.getElementById("profileModal").classList.remove("active");
}

async function saveProfile() {
    console.log("saveProfile button clicked");
    alert("Saving profile..."); // Highly visible debug

    if (!currentUser) {
        showToast("Error: Current user not identified. Please refresh.", "error");
        return;
    }

    const firstName = document.getElementById("profileFirstName")?.value.trim();
    const middleInitial = document.getElementById("profileMiddleInitial")?.value.trim() || "";
    const lastName = document.getElementById("profileLastName")?.value.trim();
    
    const mInitial = middleInitial ? `${middleInitial}. ` : '';
    const name = `${firstName} ${mInitial}${lastName}`;

    const email = document.getElementById("profileEmail")?.value;
    const studentId = document.getElementById("profileStudentId")?.value;
    const mobile = document.getElementById("profileMobile")?.value;
    const gender = document.getElementById("profileGender")?.value;
    const course = document.getElementById("profileCourse")?.value;
    
    const yearLevel = document.getElementById("profileYearLevel")?.value;
    const section = document.getElementById("profileSection")?.value;
    const yearSection = (yearLevel && section) ? `${yearLevel}-${section}` : '';
    const photoInput = document.getElementById("profilePhotoInput");

    const saveBtn = document.querySelector("#profileModal .btn-primary") || document.querySelector("button[onclick='saveProfile()']");
    
    if (!saveBtn) {
        console.error("Save button not found!");
        return;
    }

    const originalContent = saveBtn.innerHTML;

    try {
        console.log(">>> [STEP 1] Starting saveProfile...");
        saveBtn.disabled = true;
        saveBtn.innerHTML = "<span>Saving...</span>";

        const updateData = {
            name, firstName, middleInitial, lastName, email, studentId, mobile, gender, course, yearSection, yearLevel, section
        };

        // Handle photo upload if a new file is selected
        if (photoInput && photoInput.files && photoInput.files[0]) {
            console.log(">>> [STEP 2] Photo selected, resizing to Base64...");
            const file = photoInput.files[0];
            
            try {
                // Resize and convert to Base64 string directly
                const base64Data = await resizeImage(file, 200, 200);
                console.log(">>> [STEP 5] Image resized successfully (Base64)");
                updateData.photoURL = base64Data;
            } catch (resizeErr) {
                console.error("Resize error:", resizeErr);
                throw new Error("Failed to process image. Please try a different photo.");
            }
        }

        console.log(">>> [STEP 8] Updating Firestore document...");
        const dbPromise = db.collection("users").doc(currentUser.uid).update(updateData);
        const dbTimeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Database update timed out (15s)")), 15000)
        );
        
        await Promise.race([dbPromise, dbTimeout]);
        console.log(">>> [STEP 9] Firestore update successful.");

        // Update local data
        currentUserData = { ...currentUserData, ...updateData };

        if (email !== currentUser.email) {
            console.log(">>> [STEP 10] Updating Auth email...");
            await currentUser.updateEmail(email);
        }

        updateUserInfo();
        showToast("Profile updated", "success");
        closeProfileModal();
    } catch (err) {
        console.error("!!! [ERROR] Save profile failed:", err);
        showToast("Failed to update profile: " + err.message, "error");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalContent;
    }
}

function previewProfilePhoto(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Validate size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            showToast("Image too large. Max 2MB allowed.", "error");
            input.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const previewContainer = document.getElementById("profileEditAvatarContainer");
            if (previewContainer) {
                previewContainer.innerHTML = `<img src="${e.target.result}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
        };
        reader.readAsDataURL(file);
    }
}

function openPasswordModal() {
    document.getElementById("passwordModal").classList.add("active");
}

function closePasswordModal() {
    document.getElementById("passwordModal").classList.remove("active");
}

async function changePassword() {
    const currentPass = document.getElementById("currentPasswordStudent").value;
    const newPass = document.getElementById("newPassword").value;
    const confirmPass = document.getElementById("confirmPasswordStudent").value;

    if (!currentPass || !newPass || !confirmPass) {
        showToast("Please fill in all password fields", "error");
        return;
    }

    if (newPass.length < 8) {
        showToast("New password must be at least 8 characters", "error");
        return;
    }

    if (newPass !== confirmPass) {
        showToast("New passwords do not match", "error");
        return;
    }

    const changePassBtn = document.querySelector("#passwordModal .btn-primary");
    const originalContent = changePassBtn.innerHTML;

    try {
        changePassBtn.disabled = true;
        changePassBtn.innerHTML = "<span>Updating...</span>";

        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPass);
        await currentUser.reauthenticateWithCredential(credential);

        await currentUser.updatePassword(newPass);

        showToast("Password updated successfully!", "success");
        closePasswordModal();

        document.getElementById("currentPasswordStudent").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPasswordStudent").value = "";

    } catch (err) {
        console.error("Change password error:", err);
        if (err.code === "auth/wrong-password") {
            showToast("Current password is incorrect", "error");
        } else if (err.code === "auth/requires-recent-login") {
            showToast("Session expired. Please log out and log in again.", "error");
        } else {
            showToast(err.message || "Failed to update password", "error");
        }
    } finally {
        changePassBtn.disabled = false;
        changePassBtn.innerHTML = originalContent;
    }
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

async function openExtendModal(borrowingId) {
    try {
        const doc = await db.collection("borrowings").doc(borrowingId).get();
        if (!doc.exists) return;
        const data = { id: doc.id, ...doc.data() };
        selectedBorrowingForExtend = data;

        const extendDetail = document.getElementById("extendDetail");
        extendDetail.innerHTML = `
            <div style="padding: 1rem; background: var(--bg-secondary); border-radius: var(--radius-md);">
                <div style="font-weight: 600; margin-bottom: 0.5rem;">${data.equipmentName}</div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">Current Due: ${data.expectedReturnTime}</div>
            </div>
        `;

        const newReturnTimeInput = document.getElementById("newReturnTime");
        if (newReturnTimeInput) {
            const date = new Date();
            date.setHours(date.getHours() + 1);
            date.setSeconds(0, 0);

            const hh = String(date.getHours()).padStart(2, "0");
            const mm = String(date.getMinutes()).padStart(2, "0");
            newReturnTimeInput.value = `${hh}:${mm}`;
        }

        document.getElementById("extendModal").classList.add("active");
    } catch (err) {
        console.error(err);
        showToast("Error opening extension modal", "error");
    }
}

async function requestExtension() {
    const newTime = document.getElementById("newReturnTime").value;
    const reason = document.getElementById("extendReason").value;

    if (!newTime) {
        showToast("Please select a new return time", "error");
        return;
    }

    const now = new Date();
    const [hh, mm] = newTime.split(':').map(Number);
    const target = new Date();
    target.setHours(hh, mm, 0, 0);

    if (target < now) {
        target.setDate(target.getDate() + 1);
    }

    const diffHours = (target - now) / (1000 * 60 * 60);
    if (diffHours > 3.01) {
        showToast('Maximum time limit is 3 hours from now', 'error');
        return;
    }

    const confirmBtn = document.getElementById("confirmExtend");
    const originalContent = confirmBtn.innerHTML;

    try {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = "<span>Sending...</span>";

        await db.collection("borrowings").doc(selectedBorrowingForExtend.id).update({
            status: "pending_extension",
            requestedReturnTime: newTime,
            extensionReason: reason || "Not specified",
        });

        showToast("Extension request sent! Awaiting admin approval.", "success");
        document.getElementById("extendModal").classList.remove("active");
        document.getElementById("extendReason").value = "";
        loadBorrowedItems();
    } catch (err) {
        console.error(err);
        showToast("Failed to send extension request", "error");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalContent;
    }
}

async function cancelBorrowRequest(borrowingId) {
    if (!await showConfirm({
        title: 'Cancel Request',
        message: 'Are you sure you want to cancel this borrow request?',
        confirmText: 'Cancel Request',
        type: 'danger'
    })) return;
    try {
        console.log("Cancelling Request ID:", borrowingId);
        await db.collection("borrowings").doc(borrowingId).delete();
        showToast("Borrow request cancelled", "success");
        loadBorrowedItems();
    } catch (err) {
        console.error("Cancellation Error Detailed:", err);
        showToast("Error: " + (err.message || "Unknown error"), "error");
    }
}

async function cancelExtensionRequest(borrowingId) {
    if (!await showConfirm({
        title: 'Cancel Extension',
        message: 'Are you sure you want to cancel this extension request?',
        confirmText: 'Cancel Extension',
        type: 'danger'
    })) return;
    try {
        await db.collection("borrowings").doc(borrowingId).update({
            status: "borrowed",
            requestedReturnTime: firebase.firestore.FieldValue.delete(),
            extensionReason: firebase.firestore.FieldValue.delete(),
        });
        showToast("Extension request cancelled", "success");
        loadBorrowedItems();
    } catch (err) {
        console.error(err);
        showToast("Error cancelling extension", "error");
    }
}

async function previewProfilePhoto(input) {
    if (input.files && input.files[0]) {
        const container = document.getElementById('profileEditAvatarContainer');
        if (container) {
            try {
                const reader = new FileReader();
                reader.onload = (e) => {
                    container.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                }
                reader.readAsDataURL(input.files[0]);
            } catch (err) {
                console.error("Preview error:", err);
            }
        }
    }
}

window.openBorrowModal = openBorrowModal;
window.openReturnModal = openReturnModal;
window.openExtendModal = openExtendModal;
window.cancelBorrowRequest = cancelBorrowRequest;
window.cancelExtensionRequest = cancelExtensionRequest;
window.openPasswordModal = openPasswordModal;
window.closePasswordModal = closePasswordModal;
window.changePassword = changePassword;
window.previewProfilePhoto = previewProfilePhoto;
window.saveProfile = saveProfile;
window.openProfileModal = openProfileModal;
window.closeProfileModal = closeProfileModal;