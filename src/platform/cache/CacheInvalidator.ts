/**
 * Cache Invalidation Strategies
 * 
 * Provides reliable cache invalidation patterns for high-concurrency scenarios.
 */

import { getCacheService } from '@/platform/cache/index';
import { log } from '@/platform/logger';

/**
 * Delayed double deletion strategy
 * 
 * Pattern:
 * 1. Delete cache BEFORE database write (prevent dirty read)
 * 2. Write to database
 * 3. Wait for delay (let concurrent reads complete)
 * 4. Delete cache AGAIN (clean up any stale cache written during step 2)
 * 
 * @param keys Cache keys to invalidate
 * @param delayMs Delay before second deletion (default: 500ms)
 */
export async function delayedDoubleDelete(
    keys: string[],
    delayMs: number = 500
): Promise<{ afterDbWrite: () => Promise<void> }> {
    const cache = getCacheService();
    
    // First deletion - before any database operation
    await Promise.all(keys.map(key => 
        safeDelete(key, 'first-deletion')
    ));
    
    // Return a function to call after database operation
    // This allows the caller to control timing
    return {
        afterDbWrite: async () => {
            await sleep(delayMs);
            
            await Promise.all(keys.map(key => 
                safeDelete(key, 'second-deletion')
            ));
        }
    };
}

/**
 * Safe delete with retry on failure
 * 
 * @param key Cache key to delete
 * @param context Context for logging
 * @param maxRetries Maximum retry attempts
 */
export async function safeDelete(
    key: string,
    context: string = 'unknown',
    maxRetries: number = 3
): Promise<boolean> {
    const cache = getCacheService();
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await cache.del(key);
            if (attempt > 1) {
                log.info(`Cache delete succeeded on attempt ${attempt}`, { key, context });
            }
            return true;
        } catch (err) {
            lastError = err as Error;
            log.error(`Cache delete failed (attempt ${attempt}/${maxRetries})`, { 
                key, 
                context, 
                error: lastError.message 
            });
            
            if (attempt < maxRetries) {
                // Exponential backoff: 100ms, 200ms, 400ms
                await sleep(100 * Math.pow(2, attempt - 1));
            }
        }
    }
    
    // All retries failed - log critical error but don't throw
    // The system should continue working even if cache is unavailable
    log.error('Cache delete failed after all retries - data may be inconsistent', {
        key,
        context,
        error: lastError?.message,
        recommendation: 'Consider manual cache invalidation or wait for TTL expiry'
    });
    
    return false;
}

/**
 * Batch invalidation with pattern
 * Uses SCAN for production safety (not KEYS)
 * 
 * @param pattern Key pattern to match
 * @param batchSize Number of keys to delete per batch
 */
export async function invalidatePattern(
    pattern: string,
    batchSize: number = 100
): Promise<number> {
    const cache = getCacheService();
    
    // NullCacheService has no-op delPattern
    await cache.delPattern(pattern);
    
    log.debug(`Pattern invalidation completed`, { pattern });
    return 0; // Return count not available in abstraction
}

/**
 * Utility: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Cache-Aside with Write-Through invalidation helper
 * 
 * Usage:
 * ```typescript
 * async updateCategory(id: string, data: UpdateCategoryInput) {
 *     const keys = [getCategoryCacheKey(id), getCategoryListCacheKey(parentId)];
 *     
 *     // 1. First deletion
 *     await Promise.all(keys.map(k => safeDelete(k, 'pre-update')));
 *     
 *     // 2. Update database
 *     await this.tagRepository.updateCategory(existing);
 *     
 *     // 3. Delayed second deletion
 *     setTimeout(() => {
 *         Promise.all(keys.map(k => safeDelete(k, 'post-update')));
 *     }, 500);
 *     
 *     return existing;
 * }
 * ```
 */
export class CacheInvalidator {
    private static instance: CacheInvalidator;
    private pendingInvalidations: Map<string, NodeJS.Timeout> = new Map();
    
    static getInstance(): CacheInvalidator {
        if (!CacheInvalidator.instance) {
            CacheInvalidator.instance = new CacheInvalidator();
        }
        return CacheInvalidator.instance;
    }
    
    /**
     * Schedule delayed invalidation
     * Cancels any previous pending invalidation for the same key
     */
    scheduleDelayedInvalidation(key: string, delayMs: number = 500): void {
        // Cancel previous pending invalidation
        const existing = this.pendingInvalidations.get(key);
        if (existing) {
            clearTimeout(existing);
        }
        
        // Schedule new invalidation
        const timeout = setTimeout(async () => {
            await safeDelete(key, 'delayed-invalidation');
            this.pendingInvalidations.delete(key);
        }, delayMs);
        
        this.pendingInvalidations.set(key, timeout);
    }
    
    /**
     * Cancel all pending invalidations (for cleanup)
     */
    cancelAll(): void {
        for (const timeout of this.pendingInvalidations.values()) {
            clearTimeout(timeout);
        }
        this.pendingInvalidations.clear();
    }
}
