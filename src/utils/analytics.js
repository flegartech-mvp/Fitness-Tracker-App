import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Lightweight event logging for launch analytics.
 * Writes are fire-and-forget so UX never blocks on telemetry.
 */
export async function logAnalyticsEvent(userId, eventName, params = {}) {
  if (!userId || !eventName) return;

  try {
    // expireAt enables Firestore TTL auto-deletion after 90 days.
    // Enable in the Firestore console: collection group analyticsEvents, field expireAt.
    const expireAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    await addDoc(collection(db, 'users', userId, 'analyticsEvents'), {
      eventName,
      params,
      createdAt: serverTimestamp(),
      expireAt,
    });
  } catch (err) {
    console.error('logAnalyticsEvent:', err);
  }
}
