/**
 * User preferences captured during onboarding. Anonymous-first: stored in
 * localStorage. When Save & Sync ships, this maps to the user_preferences
 * table keyed by device_id.
 */

export interface UserPreferences {
  /** 5-digit US ZIP. */
  zip: string;
  /** Chains slugs the user wants included in comparisons. */
  selectedChainSlugs: string[];
  /** Local epoch ms when the user completed onboarding. Absence ⇒ redirect to /onboarding. */
  onboardedAt: number;
}
