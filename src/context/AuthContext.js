import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // Firebase Auth user object
  const [profile, setProfile] = useState(null);   // Firestore users/{uid} doc
  const [loading, setLoading] = useState(true);

  // ── Subscribe to auth state ────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        await fetchProfile(firebaseUser.uid);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function fetchProfile(uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) setProfile(snap.data());
    } catch (err) {
      // Network or Firestore failure — auth state is still valid, but the
      // profile is unavailable. Screens fall back to profile ?? {} defaults.
      console.error('fetchProfile failed:', err);
    }
  }

  // ── Register: Auth user + Firestore profile ────────────────
  async function register(email, password, displayName) {
    const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);

    const profileData = {
      uid: newUser.uid,
      email,
      displayName,
      // Gamification fields
      totalXP: 0,
      level: 0,
      // Streak fields
      streak: 0,
      lastWorkoutDate: null,
      streakFreezes: 1,     // one free freeze to start — earned again at streak milestones
      // Stats for achievements
      totalWorkouts: 0,
      totalVolume: 0,   // cumulative kg lifted (weight × reps across all sets)
      totalPRs: 0,
      // Achievements: array of unlocked achievement IDs
      achievements: [],
      // Level rewards: array of level numbers (as strings) that have been claimed
      levelRewards: [],
      // Daily XP goal tracking
      dailyXP: 0,
      dailyXPDate: null,
      // Subscription (legacy Stripe path — set server-side only)
      isPro: false,
      subscriptionStatus: 'inactive',
      // Premium (PayPal path — set client-side after payment confirmation)
      premiumType: null,         // null | 'session_pack' | 'monthly' | 'yearly'
      premiumExpiry: null,       // ISO string for monthly/yearly, null for session pack
      premiumWorkoutsRemaining: 0, // countdown for session_pack type
      // Streak restore
      savedStreak: 0,            // streak value before last reset, for paid restore
      savedStreakExpiry: null,   // YYYY-MM-DD — restore offer expires this date
      streakRestoresUsed: 0,     // lifetime restore count for analytics
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'users', newUser.uid), profileData);
      setProfile(profileData);
    } catch (err) {
      // Firestore write failed after the Auth user was already created.
      // Delete the orphaned Auth user so the email can be reused and the
      // user isn't left in a permanently broken logged-in-but-no-profile state.
      await newUser.delete();
      throw err;
    }
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  // Call after any Firestore update to sync local state
  async function refreshProfile() {
    if (user) await fetchProfile(user.uid);
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, register, login, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
