/**
 * Security configuration types
 */

export interface SecurityConfig {
  otpVerification?: {
    enabled?: boolean;
    secret?: string;
    accountName?: string;
    issuer?: string;
    intervalHours?: number;
    strictMode?: boolean;
    gracePeriodMinutes?: number;
    channels?: {
      slack?: boolean;
      discord?: boolean;
      telegram?: boolean;
      whatsapp?: boolean;
    };
    settings?: {
      vaultPath?: string;
      itemReference?: string;
      verifyBeforeCommands?: string[];
      timeWindow?: number;
      validWindow?: number;
    };
  };
}
