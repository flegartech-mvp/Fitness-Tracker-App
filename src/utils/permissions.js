// ─────────────────────────────────────────────────────────────
// Feature gating — single source of truth for premium checks.
// Import these instead of inspecting profile fields directly
// so subscription logic never scatters across screens.
//
// "Premium" covers:
//   - Legacy Stripe subscribers  (profile.isPro === true)
//   - PayPal session packs       (premiumType === 'session_pack' && remaining > 0)
//   - PayPal monthly / yearly    (premiumType set && premiumExpiry > now)
// ─────────────────────────────────────────────────────────────
import { isActivePremium } from './xpSystem';

/** Advanced analytics (charts, volume trends) — premium only. */
export function canViewAdvancedStats(profile) {
  return isActivePremium(profile);
}

/** Avatar evolution — premium only. */
export function canEvolveAvatar(profile) {
  return isActivePremium(profile);
}
