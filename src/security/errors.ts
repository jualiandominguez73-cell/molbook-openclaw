/**
 * Security-related error types for Clawdbot
 */

/**
 * Base class for OTP verification errors
 */
export class OtpVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OtpVerificationError";
  }
}

/**
 * Error thrown when verification has expired
 */
export class VerificationExpiredError extends OtpVerificationError {
  constructor(message = "OTP verification has expired. Please re-verify your identity.") {
    super(message);
    this.name = "VerificationExpiredError";
  }
}

/**
 * Error thrown when verification is strictly required but user is not verified
 */
export class StrictModeViolationError extends OtpVerificationError {
  constructor(message = "Authentication required. Please complete OTP verification to continue.") {
    super(message);
    this.name = "StrictModeViolationError";
  }
}

/**
 * Error thrown when no valid OTP configuration is found
 */
export class OtpConfigurationError extends OtpVerificationError {
  constructor(
    message = "OTP verification is not properly configured. Please check your configuration.",
  ) {
    super(message);
    this.name = "OtpConfigurationError";
  }
}

/**
 * Error thrown when TOTP provider is unavailable
 */
export class OtpProviderError extends OtpVerificationError {
  constructor(
    message = "TOTP provider (1Password) is not available. Please ensure 1Password CLI is installed and accessible.",
  ) {
    super(message);
    this.name = "OtpProviderError";
  }
}

/**
 * Error thrown for invalid TOTP codes
 */
export class InvalidTotpError extends OtpVerificationError {
  constructor(
    message = "Invalid TOTP code provided. Please ensure you're using the current 6-digit code from your authenticator.",
  ) {
    super(message);
    this.name = "InvalidTotpError";
  }
}

/**
 * Error thrown for malformed challenge responses
 */
export class ChallengeResponseError extends OtpVerificationError {
  constructor(
    message = "Invalid challenge response format. Expected: '<challenge-id> <6-digit-code>'",
  ) {
    super(message);
    this.name = "ChallengeResponseError";
  }
}
