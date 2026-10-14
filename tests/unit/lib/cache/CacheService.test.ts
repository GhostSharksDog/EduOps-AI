import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/platform/redis-client', () => ({
    getRedisClient: vi.fn(() => null),
    isRedisAvailable: vi.fn(() => false),
    isRedisHealthy: vi.fn(() => Promise.resolve(false)),
    closeRedis: vi.fn(() => Promise.resolve()),
    _internal: {
        reset: vi.fn(),
    },
}));

describe('CacheService', () => {
    describe('NullCacheService', () => {
        beforeEach(async () => {
            vi.resetModules();
            delete process.env.REDIS_URL;
        });

        afterEach(async () => {
            const { resetCacheService } = await import('@/platform/cache/index');
            resetCacheService();
        });

        it('should always return null for get', async () => {
            const { getCacheService } = await import('@/platform/cache/index');
            const cache = getCacheService();
            
            const result = await cache.get('any-key');
            expect(result).toBeNull();
        });

        it('should return true for set', async () => {
            const { getCacheService } = await import('@/platform/cache/index');
            const cache = getCacheService();
            
            await expect(cache.set('key', 'value', 60)).resolves.toBe(true);
        });

        it('should return true for del', async () => {
            const { getCacheService } = await import('@/platform/cache/index');
            const cache = getCacheService();
            
            await expect(cache.del('key')).resolves.toBe(true);
        });

        it('should return true for delPattern', async () => {
            const { getCacheService } = await import('@/platform/cache/index');
            const cache = getCacheService();
            
            await expect(cache.delPattern('pattern:*')).resolves.toBe(true);
        });

        it('should return false for exists', async () => {
            const { getCacheService } = await import('@/platform/cache/index');
            const cache = getCacheService();
            
            const result = await cache.exists('any-key');
            expect(result).toBe(false);
        });
    });
});
