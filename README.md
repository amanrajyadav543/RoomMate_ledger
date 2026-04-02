# Roommate Ledger

A full-stack application for roommates to track shared expenses. Features a Node.js/Express REST API backend and a Flutter mobile frontend.

---

## Project Structure

```
roommate-ledger/
├── backend/          # Node.js + Express API
└── flutter_app/      # Flutter mobile app
```

---

## Backend Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Cloudinary account
- Firebase project with Cloud Messaging enabled
- Gmail (or any SMTP) account for email

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Long random secret string |
| `CLOUDINARY_CLOUD_NAME` | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `EMAIL_HOST` | SMTP host (e.g., smtp.gmail.com) |
| `EMAIL_PORT` | SMTP port (587 for TLS) |
| `EMAIL_USER` | SMTP username (your email) |
| `EMAIL_PASS` | SMTP password (Gmail app password) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON |
| `FRONTEND_URL` | Frontend URL for password reset links |

### 3. Firebase setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create or open your project
3. Go to **Project Settings → Service Accounts**
4. Click **Generate new private key**
5. Save the downloaded JSON as `backend/firebase-service-account.json`

### 4. Run in development

```bash
npm run dev
```

### 5. Run with Docker

```bash
# Copy and configure .env first
docker-compose up --build
```

### API Base URL
`http://localhost:3000`

---

## Flutter App Setup

### Prerequisites
- Flutter SDK 3.x+
- Android Studio / Xcode
- Firebase project (same one used for backend)

### 1. Install Flutter dependencies

```bash
cd flutter_app
flutter pub get
```

### 2. Firebase configuration

**Android:**
1. In Firebase Console → Project Settings → Your apps → Add Android app
2. Register with your app's package name (default: `com.example.roommate_ledger`)
3. Download `google-services.json`
4. Place it in `flutter_app/android/app/google-services.json`

**iOS:**
1. In Firebase Console → Your apps → Add iOS app
2. Register with your bundle ID
3. Download `GoogleService-Info.plist`
4. Open Xcode and add it to the `Runner` target

### 3. Update backend URL

Open `flutter_app/lib/config/app_constants.dart` and set `baseUrl`:

```dart
// Android emulator
static const String baseUrl = 'http://10.0.2.2:3000';

// iOS simulator
static const String baseUrl = 'http://localhost:3000';

// Physical device (use your machine's local IP)
static const String baseUrl = 'http://192.168.x.x:3000';

// Production
static const String baseUrl = 'https://your-api-domain.com';
```

### 4. Android permissions

In `flutter_app/android/app/src/main/AndroidManifest.xml`, ensure these permissions exist:

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
```

### 5. Run the app

```bash
flutter run
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | Yes | Logout (clears FCM token) |
| POST | `/api/auth/forgot-password` | No | Send password reset email |
| PUT | `/api/auth/change-password` | Yes | Change password |
| POST | `/api/auth/update-fcm-token` | Yes | Update FCM push token |

### Partner / Groups

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/partner/my-code` | Yes | Get your 6-char partner code |
| POST | `/api/partner/join` | Yes | Join group using `{ partnerCode }` |
| GET | `/api/partner/members` | Yes | Get all group members |

### Items

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/items` | Yes | Add item (multipart: name, price, image, month?) |
| GET | `/api/items/group` | Yes | Get group items (`?month=YYYY-MM`) |
| GET | `/api/items/user/:userId` | Yes | Get specific user's items |
| PUT | `/api/items/:id` | Yes | Update own item |
| DELETE | `/api/items/:id` | Yes | Delete own item |
| GET | `/api/items/summary` | Yes | Monthly summary (`?month=YYYY-MM`) |

---

## App Features

- **Authentication**: Register, login, logout, forgot password, change password
- **Partner System**: Each user gets a unique 6-character code; share it to connect with a roommate
- **Expense Tracking**: Add items with name, price, optional photo, and month
- **Monthly View**: Browse current and previous month expenses
- **Per-Member Tabs**: See each roommate's expenses in separate tabs
- **Summary**: See total spend, per-person share, and who owes what
- **Push Notifications**: Get notified when your roommate adds or updates an item
- **Image Upload**: Attach receipt photos via camera or gallery

---

## Tech Stack

### Backend
- Node.js + Express
- MongoDB Atlas (Mongoose)
- JWT authentication
- bcryptjs password hashing
- Cloudinary image storage
- Firebase Admin SDK (FCM push notifications)
- Nodemailer (email)
- Docker

### Flutter
- Flutter + Dart
- Provider state management
- SharedPreferences (local token storage)
- Firebase Cloud Messaging
- http package (REST API calls)
- image_picker (camera/gallery)
- cached_network_image
- flutter_local_notifications
