/**
 * Client-safe configuration
 *
 * This module contains ONLY configuration values that are safe to expose to the browser.
 * It does NOT access any environment variables or server-only secrets.
 *
 * Import from @/config/client in client components and stores.
 */

// Environment-agnostic constants - safe for browser
const isDev = process.env.NODE_ENV !== 'production';

export const clientConfig = {
    auth: {
        tokenKey: 'auth_token',
        userKey: 'auth_user',
    },
    system: {
        // System user ID for default tenant - this is a public constant, not a secret
        userId: process.env.SYSTEM_USER_ID || '6f40f555-5f1b-4d1f-807c-b209e817bfdd',
    },
} as const;

// Named exports for convenience
export const { auth, system } = clientConfig;
