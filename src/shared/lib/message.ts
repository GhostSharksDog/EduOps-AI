/**
 * Global Message Utility (Legacy)
 *
 * This module is kept for backward compatibility.
 * Please migrate to the new message service:
 * - React components: import { useGlobalMessage } from '@/shared/lib/message-service';
 * - Stores/non-React: import { globalMessage } from '@/shared/lib/message-service';
 *
 * The new implementation uses App.useApp() which is the recommended approach
 * for React 18 concurrent mode.
 */

// Re-export the new message service for backward compatibility
export { useGlobalMessage, globalMessage } from '@/shared/lib/message-service';
