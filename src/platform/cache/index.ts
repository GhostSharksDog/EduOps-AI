import type { CacheService } from '@/platform/cache/CacheService';
import { NullCacheService } from '@/platform/cache/NullCacheService';
import { RedisCacheService } from '@/platform/cache/RedisCacheService';
import { getRedisClient, isRedisAvailable } from '@/platform/redis-client';

export type { CacheService } from '@/platform/cache/CacheService';

let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
    if (!cacheService) {
        const client = getRedisClient();
        if (client && isRedisAvailable()) {
            cacheService = new RedisCacheService(client);
        } else {
            cacheService = new NullCacheService();
        }
    }
    return cacheService;
}

export function resetCacheService(): void {
    cacheService = null;
}

