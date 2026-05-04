# FitQuest - Gamified Fitness Tracker

React Native (Expo) + Firebase app where users log workouts, earn XP, build streaks, and unlock achievements.

## Current Production Posture

This repo has been hardened from prototype mode:

- Workout saves go through the `saveWorkout` Cloud Function. The client no longer writes XP, streaks, achievements, workouts, or weekly challenges directly.
- Firestore rules allow users to read their own profile/workouts/challenge and append analytics events only.
- Premium purchases are not self-activated from the client. PayPal requests are logged for admin verification through `requestPremiumVerification`.
- Pure XP, streak, achievement, and challenge logic has Jest coverage.

Native in-app purchase handling or verified PayPal/Stripe webhooks are still required before shipping paid digital benefits to real app-store users.

## Project Structure

```text
App.js
app.json
firestore.rules
firestore.indexes.json
functions/
  index.js                 Cloud Functions for trusted writes
src/
  config/firebase.js       Firebase app/auth/firestore/functions setup
  context/                 Auth and theme providers
  navigation/              Authenticated and unauthenticated stacks
  screens/                 Login, register, home, workout, achievements, upgrade
  utils/                   Pure XP, challenge, achievement, permissions logic
__tests__/                 Jest coverage for pure game logic
```

## Setup

1. Install dependencies:

```bash
npm install
cd functions
npm install
cd ..
```

2. Create a Firebase project and enable:

- Authentication: Email/Password
- Firestore
- Cloud Functions

3. Configure environment variables:

```bash
copy .env.example .env
```

Fill in the values from Firebase Console -> Project Settings -> Your apps -> SDK setup.

4. Deploy backend security pieces:

```bash
firebase deploy --only firestore:rules,firestore:indexes,functions
```

5. Run the app:

```bash
npx expo start
```

## Validation

```bash
npm test
cd functions
npm run check
```

## Data Model

```text
users/{userId}
  uid
  email
  displayName
  totalXP
  level
  streak
  lastWorkoutDate
  streakFreezes
  totalWorkouts
  totalVolume
  totalPRs
  achievements
  levelRewards
  dailyXP
  dailyXPDate
  premium fields
  createdAt

users/{userId}/workouts/{workoutId}
  date
  exercises: [{ name, sets: [{ reps, weight }] }]
  totalXP

users/{userId}/weeklyChallenge/current
  type
  title
  goal
  progress
  completed
  weekKey

users/{userId}/analyticsEvents/{eventId}
  eventName
  params
  createdAt
  expireAt
```

## Launch Notes

- Replace manual PayPal verification with app-store-compliant IAP, RevenueCat, Stripe, or PayPal webhooks before selling digital benefits at scale.
- Add Firebase Emulator integration tests for callable functions and Firestore rules.
- Add real support/contact, privacy policy, terms, refund/cancellation copy, and release build config before production launch.
