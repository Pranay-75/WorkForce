/**
 * WorkForce - Frontend Input Validation Utilities
 * 
 * Provides centralized, deterministic validation logic for Authentication & Workspace
 * onboarding flows (Login, Registration, Password Reset).
 */

import { isValidSlug } from './slug';

// RFC 5322 compliant simplified email regex for client-side format checks
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates an email address.
 * Returns an error string or null if valid.
 */
export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email address is required.';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Please enter a valid email address (e.g. name@company.com).';
  }
  return null;
}

/**
 * Validates login password.
 * Returns an error string or null if valid.
 */
export function validateLoginPassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

/**
 * Validates full name for user profile.
 * Returns an error string or null if valid.
 */
export function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Full name is required.';
  }
  if (trimmed.length < 2) {
    return 'Full name must be at least 2 characters.';
  }
  if (trimmed.length > 100) {
    return 'Full name cannot exceed 100 characters.';
  }
  // Disallow strings made entirely of numbers or symbols
  if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) {
    return 'Full name must contain letters.';
  }
  return null;
}

/**
 * Validates organization name.
 * Returns an error string or null if valid.
 */
export function validateOrgName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Organization name is required.';
  }
  if (trimmed.length < 2) {
    return 'Organization name must be at least 2 characters.';
  }
  if (trimmed.length > 100) {
    return 'Organization name cannot exceed 100 characters.';
  }
  return null;
}

/**
 * Validates workspace slug.
 * Returns an error string or null if valid.
 */
export function validateWorkspaceSlug(slug: string): string | null {
  if (!slug) {
    return 'Organization slug is required.';
  }
  if (slug.length < 2) {
    return 'Organization slug must be at least 2 characters.';
  }
  if (slug.length > 50) {
    return 'Organization slug cannot exceed 50 characters.';
  }
  if (!isValidSlug(slug)) {
    return 'Slug must contain only lowercase letters, numbers, and single hyphens.';
  }
  return null;
}

export interface PasswordStrength {
  score: number; // 0 to 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  hasLength: boolean;
  hasMixedCase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

/**
 * Evaluates password strength and criteria breakdown.
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  const hasLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (hasMixedCase) score += 1;
  if (hasNumber || hasSpecial) score += 1;

  // Cap at 4
  score = Math.min(score, 4);

  let label: PasswordStrength['label'] = 'Weak';
  let color = 'bg-rose-500';

  if (score <= 1) {
    label = 'Weak';
    color = 'bg-rose-500';
  } else if (score === 2) {
    label = 'Fair';
    color = 'bg-amber-500';
  } else if (score === 3) {
    label = 'Good';
    color = 'bg-cyan-500';
  } else {
    label = 'Strong';
    color = 'bg-emerald-500';
  }

  return {
    score,
    label,
    color,
    hasLength,
    hasMixedCase,
    hasNumber,
    hasSpecial,
  };
}

/**
 * Validates registration password.
 * Returns an error string or null if valid.
 */
export function validateRegisterPassword(password: string): string | null {
  if (!password) {
    return 'Password is required.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

/**
 * Validates confirm password against the primary password.
 * Returns an error string or null if valid.
 */
export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (!confirmPassword) {
    return 'Please confirm your password.';
  }
  if (password !== confirmPassword) {
    return 'Passwords do not match.';
  }
  return null;
}
