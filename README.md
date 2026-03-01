# 🛰️ MISLend: Smart Equipment Management System

**MISLend** is a professional, high-performance web application designed for the **UCC MIS Department** to streamline the borrowing and returning of technical equipment. Built with a focus on ease of use, security, and administrative control, it leverages Firebase for real-time data and authentication.

---

## 📖 Table of Contents
- [✨ Key Features](#-key-features)
- [🛠️ Technology Stack](#-technology-stack)
- [🚀 Quick Setup Guide](#-quick-setup-guide)
- [🏗️ Database Architecture](#-database-architecture)
- [🔐 Security & Access Control](#-security--access-control)
- [👤 User Roles & Workflows](#-user-roles--workflows)
- [🧹 Maintenance & Clean-up](#-maintenance--clean-up)

---

## ✨ Key Features
- **Student Account Approval**: Robust registration flow where new students are "Pending" until verified by an admin.
- **QR Code Integration**: Scan equipment for instant borrowing and returning (requires HTTPS).
- **Dashboard Analytics**: Real-time stats on available equipment, active borrows, and overdue items.
- **Automated Logging**: Full transaction history with return condition tracking (Good/Damaged).
- **Modern Responsive UI**: Premium dark/light mode support with a sleek "Glassmorphism" aesthetic.

---

## 🛠️ Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+), Modern CSS3 (Grid/Flexbox/Animations), HTML5.
- **Backend**: Firebase Firestore (NoSQL Database).
- **Authentication**: Firebase Auth (Email/Password).
- **Deployment**: Optimized for Static Hosting (Netlify, Vercel, or Firebase Hosting).

---

## 🚀 Quick Setup Guide

### 1. Firebase Project Creation
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project (e.g., `mislend-app`).
3. Enable **Authentication**:
   - Go to `Authentication > Sign-in method`.
   - Enable **Email/Password**.
4. Create a **Firestore Database**:
   - Go to `Cloud Firestore > Create database`.
   - Start in **Test Mode** (update rules before production).

### 2. Connect Your App
1. Register a **Web App** in your Firebase project.
2. Copy the `firebaseConfig` object.
3. Open `app.js` and paste your config into the `firebaseConfig` constant.

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    // ... rest of your config
};
```

### 3. Initialize Admin Account
1. Open the app and register a new account.
2. Go to your **Firestore Console > users collection**.
3. Locate your user document (via UID) and manually set:
   - `role`: `"admin"`
   - `status`: `"approved"`

---

## 🏗️ Database Architecture

### `users` (Collection)
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Full name of the user |
| `email` | String | Registered email address |
| `role` | String | `"student"` or `"admin"` |
| `status` | String | `"pending"` or `"approved"` |
| `studentId`| String | (Optional) School ID number |

### `equipment` (Collection)
| Field | Type | Description |
| :--- | :--- | :--- |
| `equipmentId`| String | Unique Hardware ID (e.g., PROJ-001) |
| `name` | String | Display name of the item |
| `status` | String | `"available"`, `"borrowed"`, or `"maintenance"` |

---

## 🔐 Security & Access Control

### Account Approval Flow
- Newly registered students are created with `status: "pending"`.
- They are **automatically logged out** and cannot access the dashboard until an Admin clicks **Approve** in the Admin Panel.
- The "All Users" list only displays approved members to keep the management view clean.

---

## 🧹 Maintenance & Clean-up

### Deleting Users
> [!IMPORTANT]
> **Manual Authentication Cleanup**: Due to Firebase security protocols, deleting a user from the Admin Dashboard removes their data from Firestore, but **not** their email from the Authentication list.
> 
> **Admin Workflow**:
> 1. Delete/Reject the user in the **MISLend Admin Panel**.
> 2. Log in to the **Firebase Console > Authentication**.
> 3. Delete the matching email address to fully remove the account.

---

## 📡 Deployment Notes
- **HTTPS is required** for the QR scanner to access the camera on mobile devices.
- For local testing, use `localhost` or a VS Code Live Server.

---

*This project is maintained for the UCC MIS Office.*