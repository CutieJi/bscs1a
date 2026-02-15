# Table of Contents
- [Requirements](#1-requirements)
- [Firebase Setup (Step-by-step)](#2-firebase-setup-step-by-step)
- [Firestore Collections (Data Structure)](#3-firestore-collections-data-structure)
- [Create Admin Account (Important)](#4-create-admin-account-important)
- [Security Rules (Basic idea)](#5-security-rules-basic-idea)
- [How to Use (Student)](#6-how-to-use-student)
- [How to Use (Admin)](#7-how-to-use-admin)
- [QR Scanner Notes](#8-qr-scanner-notes)
- [Common Issues](#9-common-issues)
- [Common Accounts](#10-common-accounts)
- [Notes](#11-notes)

---

# EquipLend (Equipment Borrowing System) - README

A student project for borrowing/returning school equipment using Firebase + QR scanning.

---

## 1) Requirements
- Browser (Chrome/Edge recommended)
- Firebase Project
- Firebase Auth enabled (Email/Password)
- Firestore Database created
- Hosting (optional but recommended) for QR scanning camera access:
  - Use HTTPS (Firebase Hosting / Netlify / Vercel) or localhost

---

## 2) Firebase Setup (Step-by-step)
1. Go to Firebase Console
2. Create a project (example: EquipLend)
3. Enable Authentication:
   - Auth > Sign-in method > enable Email/Password
4. Create Firestore Database:
   - Firestore > Create database (test mode first, then apply rules)
5. Copy your Firebase config:
   - Project settings > General > Web app config
6. Paste config to your `app.js` (firebase initialization)

---

## 3) Firestore Collections (Data Structure)

### equipment (collection)
Each document example:
- equipmentId: "PROJ-001"
- name: "Projector Epson EB-X41"
- category: "projector"
- description: "Optional"
- status: "available" | "borrowed" | "maintenance"
- borrowedBy: userId/null
- borrowedAt: timestamp/null
- createdAt: timestamp

### users (collection)
Each document uses auth uid:
- name
- email
- role: "student" | "admin"
- studentId (optional)
- status: "pending" | "approved"
- createdAt: timestamp

### borrowings (collection)
Each document:
- equipmentId (doc id of equipment)
- equipmentCode (equipmentId string)
- equipmentName
- equipmentCategory
- userId
- userName
- userEmail
- studentId
- room
- purpose
- borrowedAt (timestamp)
- expectedReturn (timestamp) OR expectedReturnTime (string) depending on your system
- returnedAt (timestamp optional)
- returnCondition: "good" | "damaged"
- returnNotes
- status: "borrowed" | "returned"

---

## 4) Create Admin Account (Important)
Option A (Simple):
1. Register an account using the app
2. In Firestore > users > find your UID
3. Set role = "admin"
4. Set status = "approved"

Option B (Better):
Use a dedicated admin creation screen (your project already has Add User in admin).

---

## 5) Security Rules (Basic idea)
- Students can read their own user doc and their borrowings
- Admin can read/update/delete all equipment, users, borrowings

⚠️ Make sure your rules match your final features.

---

---

## 6) How to Use the Website (Step-by-step)

### A) Student Side (Borrower)
1. Open the website (example: `index.html`)
2. Click **Login** and sign in using your student account.
3. If your account is new, you may see **Pending** status:
   - Wait for admin approval (Admin → User Management → Pending Approvals → Approve)
4. After approved, go to **Browse Equipment**
5. Use filters (Category / Status / Search)
6. Click **Borrow** on an available equipment
7. Fill up the form:
   - **Room** (required)
   - **Return Time** (required)
   - Purpose (optional)
8. Click **Confirm Borrow**
9. To return:
   - Go to **My Borrowed**
   - Click **Return Equipment**
   - Select condition:
     - **Good** → equipment goes back to `available`
     - **Damaged / Not Good** → equipment goes to `maintenance`
   - Add notes if needed
10. Optional (QR):
   - Go to **Scan**
   - Allow camera permission (must be HTTPS or localhost)
   - Scan equipment QR to borrow/return faster
   - If camera blocked, use manual equipment ID input

---

### B) Admin Side (Manager)
1. Login using admin account
2. Dashboard shows:
   - Total equipment, available, borrowed, today borrows, total users
   - Recent activities + overdue list
3. **Manage Equipment**
   - Add new equipment (must have unique Equipment ID)
   - Edit equipment details
   - Generate QR code
   - Delete equipment (only if NOT currently borrowed)
4. **Item Condition / Status**
   - Admin can set equipment status to:
     - `available` (ready to borrow)
     - `maintenance` (not good / under repair)
     - `borrowed` (optional manual override)
   - If item returned but “not good”, admin can edit it later and set back to `available` after repair.
5. **User Management**
   - Approve/reject pending accounts
   - Add users (student/admin)
   - Edit user info
   - Delete user (Firestore only unless using Admin SDK for Auth delete)
6. **Borrowing Logs**
   - Filter by date/student/equipment
   - Export to CSV

---

## 7) Common / Demo Accounts (For Testing)

> These are sample accounts you can create in Firebase Auth for demo/testing.
> Replace the emails/passwords based on your actual setup.

### Admin Demo Account
- Email: `admin@equiplend.test`
- Password: `Admin123!`
- Firestore users doc:
  - role = `admin`
  - status = `approved`

### Student Demo Account (Approved)
- Email: `student1@equiplend.test`
- Password: `Student123!`
- Firestore users doc:
  - role = `student`
  - status = `approved`
  - studentId = `2024001`

### Student Demo Account (Pending)
- Email: `pending@equiplend.test`
- Password: `Student123!`
- Firestore users doc:
  - role = `student`
  - status = `pending`
  - studentId = `2024999`

✅ Admin must approve pending accounts:
Admin → User Management → Pending Approvals → Approve

---

## 8) Notes (Important)
- Camera scan works only on **HTTPS** (or localhost).
- If a user is deleted from Firestore, it may NOT automatically delete the account from Firebase Authentication unless you use Firebase Admin SDK.
- Do NOT use real passwords in public repositories. Use demo/test accounts only.