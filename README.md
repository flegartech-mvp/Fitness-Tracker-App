# FitQuest — Gamified Fitness Tracker (MVP)

React Native (Expo) + Firebase app where users log workouts, earn XP, and level up.

---

## Project Structure

```
fitness-app/
├── App.js                          # Root: wraps app in AuthProvider
├── app.json                        # Expo config
├── package.json
├── babel.config.js
└── src/
    ├── config/
    │   └── firebase.js             # Firebase init — PUT YOUR KEYS HERE
    ├── context/
    │   └── AuthContext.js          # Auth state + Firestore profile
    ├── navigation/
    │   └── AppNavigator.js         # Stack navigator (auth vs app stacks)
    ├── screens/
    │   ├── LoginScreen.js
    │   ├── RegisterScreen.js
    │   ├── HomeScreen.js           # XP card + workout history
    │   └── WorkoutScreen.js        # Log sets, earn XP
    └── utils/
        └── xpSystem.js             # XP calc, leveling formula, rank titles
```

---

## Setup Instructions

### 1. Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- Expo Go app on your phone (iOS or Android)

### 2. Install dependencies
```bash
cd "Fitness app"
npm install
```

### 3. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project (e.g. "FitQuest")
3. **Enable Authentication** → Sign-in method → Email/Password → Enable
4. **Enable Firestore** → Create database → Start in test mode
5. Go to Project Settings → General → Your apps → Add app → Web (</>)
6. Copy the config object

### 4. Add your Firebase config
Open `src/config/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: 'your-actual-api-key',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};
```

### 5. Add Firestore indexes
The workout query (`userId` + `createdAt` ordered) requires a composite index.
Firestore will print a link in the console the first time you load the Home screen —
just click it to auto-create the index.

### 6. Run the app
```bash
npx expo start
```
Scan the QR code with Expo Go.

---

## XP System

| Action | XP Earned |
|---|---|
| Log a set | `max(5, floor(weight × reps / 10))` |

**Leveling formula:** XP needed for next level = `100 × level^1.4`

| Level | Rank |
|---|---|
| 1–4 | Rookie |
| 5–9 | Athlete |
| 10–19 | Warrior |
| 20–34 | Champion |
| 35–49 | Legend |
| 50+ | God Mode |

---

## Firestore Data Model

```
users/{userId}
  email: string
  displayName: string
  totalXP: number        ← incremented atomically on each save
  createdAt: timestamp

workouts/{workoutId}
  userId: string
  name: string
  sets: [{ reps, weight, xpEarned }]
  totalXP: number
  createdAt: timestamp
```
