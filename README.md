---

# CSFeedback System

A lightweight, responsive web application designed for students to provide academic feedback. This system leverages native web technologies and **Firebase** as a Backend-as-a-Service (BaaS) to ensure secure authentication and real-time data handling.

## 1. System Overview

The **CSFeedback System** enables students to securely log in and submit evaluations regarding courses, instructors, or campus facilities. It features a dedicated student interface for submissions and an administrative logic flow for feedback management.

### Tech Stack

* **Frontend:** HTML5, CSS3 (Glassmorphism UI), JavaScript (ES6+ Native)
* **Backend:** Firebase Authentication (Email/Password)
* **Database:** Firebase Firestore (NoSQL)
* **Hosting:** Compatible with Firebase Hosting or GitHub Pages

---

## 2. Architecture & Data Flow

The application follows a client-server model communicating via the Firebase SDK:

1. **Authentication:** Users provide credentials; Firebase Auth validates them and returns a JSON Web Token (JWT).
2. **Submission:** Authenticated users submit a form. Native JavaScript pushes this payload to Firestore.
3. **Security:** Server-side Firebase Security Rules ensure only authorized users can write or read data.

---

## 3. Project Structure

```text
CSFeedback-System/
├── index.html       # Single Entry Point (Login/Student/Admin Views)
├── style.css        # Custom Responsive UI Styling
├── app.js           # Core Logic (Auth, Firestore, & UI Toggling)
├── assets/          # Logos and static icons
└── README.md        # Project Documentation

```

---

## 4. Implementation Details

### Database Schema (Firestore)

Feedbacks are stored in the `feedbacks` collection. Each document follows this structure:

| Field | Type | Description |
| --- | --- | --- |
| `studentEmail` | String | Extracted from `auth.currentUser` |
| `subject` | String | Category (e.g., Curriculum, Facilities) |
| `rating` | Integer | Scale of 1-5 |
| `comments` | String | Detailed student feedback |
| `timestamp` | Timestamp | Server-generated submission time |

### Core Logic Snippet

```javascript
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

async function submitFeedback(data) {
  try {
    const docRef = await addDoc(collection(db, "feedbacks"), {
      ...data,
      submittedAt: serverTimestamp()
    });
    alert("Feedback submitted successfully!");
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

```

---

## 5. Security Rules

To prevent unauthorized access or data tampering, apply these rules in the Firebase Console:

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /feedbacks/{document=**} {
      // Allow authenticated students to submit feedback
      allow create: if request.auth != null;
      
      // Restrict read access to admin accounts only
      allow read: if request.auth.token.email == 'admin@cs.com';
    }
  }
}

```

---

## 6. How to Run

1. **Firebase Setup:** Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2. **Enable Services:** * Navigate to **Authentication** and enable the `Email/Password` provider.
* Navigate to **Firestore Database** and create a database in "Test Mode".


3. **Configuration:** * Copy your Firebase SDK configuration object.
* Paste it into the `firebaseConfig` constant within `app.js`.


4. **Launch:** * Open `index.html` using a local server (e.g., VS Code **Live Server**) to handle ES Modules and avoid CORS issues.

---
