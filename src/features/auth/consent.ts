/**
 * Central consent version. Bump this whenever the privacy policy or
 * terms of service content in PrivacyConsentModal changes. On next
 * login, every user whose stored consentVersion is lower than this
 * will be re-prompted to agree.
 */
export const CURRENT_CONSENT_VERSION = 2;
