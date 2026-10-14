import type Redis from 'ioredis';
import type { CacheService } from '@/platform/cache/CacheService';
import { log } from '@/platform/logger';

export class RedisCacheService implements CacheService {
    constructor(private readonly client: Redis) {}

    async isHealthy(): Promise<boolean> {
        try {
            const result = await this.client.ping();
            return result === 'PONG';
        } catch {
            return false;
        }
    }

    async get<T>(key: string): Promise<T | null> {
        try {
            const data = await this.client.get(key);
            if (!data) return null;
            return JSON.parse(data) as T;
        } catch (err) {
            log.error('Failed to get from cache', err);
            return null;
        }
    }

    async set(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
        try {
            const data = JSON.stringify(value);
            await this.client.setex(key, ttlSeconds, data);
            return true;
        } catch (err) {
            log.error('Failed to set cache', err);
            return false;
        }
    }

    async del(key: string): Promise<boolean> {
        try {
            await this.client.del(key);
            return true;
        } catch (err) {
            log.error('Failed to delete from cache', err);
            return false;
        }
    }

    async delPattern(pattern: string): Promise<boolean> {
        try {
            let cursor = '0';
            let totalDeleted = 0;
            
            do {
                const [nextCursor, keys] = await this.client.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    100
                );
                
                if (keys.length > 0) {
                    await this.client.del(...keys);
                    totalDeleted += keys.length;
                }
                
                cursor = nextCursor;
            } while (cursor !== '0');
            
            if (totalDeleted > 0) {
                log.debug(`Deleted ${totalDeleted} keys matching pattern: ${pattern}`);
            }
            return true;
        } catch (err) {
            log.error('Failed to delete pattern from cache', err);
            return false;
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (err) {
            log.error('Failed to check cache existence', err);
            return false;
        }
    }
}
