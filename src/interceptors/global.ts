import { createInterceptorRegistry, type InterceptorRegistry } from "./registry.js";

let globalRegistry: InterceptorRegistry | null = null;

/**
 * Initialize the global interceptor registry.
 * Creates the registry if not already initialized. Idempotent.
 */
export function initializeGlobalInterceptors(): InterceptorRegistry {
  if (!globalRegistry) {
    globalRegistry = createInterceptorRegistry();
  }
  return globalRegistry;
}

/**
 * Get the global interceptor registry.
 * Returns null if not yet initialized.
 */
export function getGlobalInterceptorRegistry(): InterceptorRegistry | null {
  return globalRegistry;
}

/**
 * Reset the global interceptor registry (for tests).
 */
export function resetGlobalInterceptors(): void {
  globalRegistry = null;
}
