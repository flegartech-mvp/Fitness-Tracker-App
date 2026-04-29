// ─────────────────────────────────────────────────────────────────────────────
// FitQuest Cloud Functions
//
// Stripe integration has been removed. Payments are now handled via PayPal.me
// links (paypal.me/TiniFlegar). Because PayPal.me has no server-side webhook
// capability, premium activation is trust-based and written directly from the
// client SDK. The Firestore rules block the legacy Stripe fields (isPro,
// subscriptionStatus, stripeCustomerId) from client writes, while allowing
// the new premium fields (premiumType, premiumExpiry, etc.).
//
// If you later migrate to PayPal's REST Subscriptions API, add a webhook
// handler here in the same pattern as the old stripeWebhook function and
// route all premium field writes through it.
// ─────────────────────────────────────────────────────────────────────────────

const admin = require('firebase-admin');

admin.initializeApp();
