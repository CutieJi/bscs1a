let html5QrCode = null;

function generateQRCode(equipmentId, elementId) {
    const qrCodeElement = document.getElementById(elementId);
    if (!qrCodeElement) {
        console.error('QR code element not found:', elementId);
        return;
    }

    qrCodeElement.innerHTML = '';

    const qr = qrcode(0, 'M');
    qr.addData(equipmentId);
    qr.make();

    qrCodeElement.innerHTML = qr.createImgTag(4, 8);

    return qr.createDataURL(4, 8);
}

function startQRScanner(videoElementId, onScanSuccess, onScanError) {
    const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
    };

    html5QrCode = new Html5Qrcode(videoElementId);

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanError
    ).catch(err => {
        console.error('Failed to start QR scanner:', err);
        if (onScanError) {
            onScanError(err);
        }
    });
}

function stopQRScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(err => {
            console.error('Failed to stop QR scanner:', err);
        });
    }
}

async function processEquipmentScan(equipmentId, action = 'borrow') {
    try {
        const equipmentDoc = await db.collection('equipment').doc(equipmentId).get();

        if (!equipmentDoc.exists) {
            throw new Error('Equipment not found');
        }

        const equipment = equipmentDoc.data();

        if (action === 'borrow' && equipment.status !== 'available') {
            throw new Error('Equipment is not available');
        }

        return {
            success: true,
            equipment: {
                id: equipmentId,
                ...equipment
            }
        };
    } catch (error) {
        console.error('Error processing scan:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function createBorrowTransaction(equipmentId, userId, userName, studentId) {
    try {
        const equipmentDoc = await db.collection('equipment').doc(equipmentId).get();

        if (!equipmentDoc.exists) {
            throw new Error('Equipment not found');
        }

        const equipment = equipmentDoc.data();

        if (equipment.status !== 'available') {
            throw new Error('Equipment is currently not available');
        }

        const now = new Date();
        const expectedReturn = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

        const transactionId = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Date.now()}`;

        const transaction = {
            equipmentId: equipmentId,
            equipmentName: equipment.name,
            equipmentType: equipment.type,
            studentId: studentId,
            studentName: userName,
            borrowDate: firebase.firestore.Timestamp.fromDate(now),
            expectedReturnDate: firebase.firestore.Timestamp.fromDate(expectedReturn),
            actualReturnDate: null,
            status: 'borrowed',
            borrowedBy: userId,
            returnedBy: null,
            notes: ''
        };

        await db.collection('transactions').doc(transactionId).add(transaction);

        await db.collection('equipment').doc(equipmentId).update({
            status: 'borrowed',
            currentBorrower: userId,
            lastBorrowDate: firebase.firestore.Timestamp.fromDate(now)
        });

        return {
            success: true,
            transactionId: transactionId,
            transaction: transaction
        };
    } catch (error) {
        console.error('Error creating borrow transaction:', error);
        throw error;
    }
}

async function createReturnTransaction(equipmentId, userId) {
    try {
        const activeTransactions = await db.collection('transactions')
            .where('equipmentId', '==', equipmentId)
            .where('status', '==', 'borrowed')
            .get();

        if (activeTransactions.empty) {
            throw new Error('No active borrow transaction found for this equipment');
        }

        const transactionDoc = activeTransactions.docs[0];
        const transactionId = transactionDoc.id;
        const now = new Date();

        await db.collection('transactions').doc(transactionId).update({
            actualReturnDate: firebase.firestore.Timestamp.fromDate(now),
            status: 'returned',
            returnedBy: userId
        });

        await db.collection('equipment').doc(equipmentId).update({
            status: 'available',
            currentBorrower: null,
            lastReturnDate: firebase.firestore.Timestamp.fromDate(now)
        });

        return {
            success: true,
            transactionId: transactionId
        };
    } catch (error) {
        console.error('Error creating return transaction:', error);
        throw error;
    }
}

function getEquipmentIcon(type) {
    const icons = {
        'projector': '📽️',
        'power_cord': '🔌',
        'extension': '🔌',
        'hdmi': '📺',
        'tv': '📺',
        'remote': '🎮'
    };
    return icons[type] || '📦';
}

function getStatusColor(status) {
    const colors = {
        'available': '#10b981',
        'borrowed': '#f59e0b',
        'maintenance': '#ef4444',
        'returned': '#3b82f6',
        'overdue': '#dc2626'
    };
    return colors[status] || '#6b7280';
}

function isOverdue(expectedReturnDate) {
    if (!expectedReturnDate) return false;
    const returnDate = expectedReturnDate.toDate ? expectedReturnDate.toDate() : new Date(expectedReturnDate);
    return new Date() > returnDate;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateQRCode,
        startQRScanner,
        stopQRScanner,
        processEquipmentScan,
        createBorrowTransaction,
        createReturnTransaction,
        getEquipmentIcon,
        getStatusColor,
        isOverdue
    };
}