import type { CacheService } from '@/platform/cache/CacheService';

export class NullCacheService implements CacheService {
    async isHealthy(): Promise<boolean> {
        return false;
    }

    async get<T>(): Promise<T | null> {
        return null;
    }

    async set(): Promise<boolean> {
        return true;
    }

    async del(): Promise<boolean> {
        return true;
    }

    async delPattern(): Promise<boolean> {
        return true;
    }

    async exists(): Promise<boolean> {
        return false;
    }
}
