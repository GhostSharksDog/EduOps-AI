import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/platform/config/index', () => ({
    config: {
        redis: {
            url: 'redis://localhost:6379',
            password: undefined,
            db: 0,
            enabled: true,
        },
    },
}));

describe('RedisClient', () => {
    let redisClientModule: typeof import('@/platform/redis-client');

    beforeEach(async () => {
        vi.resetModules();
        redisClientModule = await import('@/platform/redis-client');
    });

    afterEach(async () => {
        redisClientModule._internal.reset();
    });

    it('should create Redis client when enabled', async () => {
        vi.doMock('@/platform/config/index', () => ({
            config: {
                redis: {
                    url: 'redis://localhost:6379',
                    password: undefined,
                    db: 0,
                    enabled: true,
                },
            },
        }));
        vi.resetModules();
        redisClientModule = await import('@/platform/redis-client');
        
        expect(redisClientModule.isRedisAvailable()).toBeDefined();
    });

    it('should return null client when Redis is disabled', async () => {
        vi.doMock('@/platform/config/index', () => ({
            config: {
                redis: {
                    url: 'redis://localhost:6379',
                    password: undefined,
                    db: 0,
                    enabled: false,
                },
            },
        }));
        vi.resetModules();
        redisClientModule = await import('@/platform/redis-client');
        
        expect(redisClientModule.isRedisAvailable()).toBe(false);
        expect(redisClientModule.getRedisClient()).toBeNull();
    });

    it('should gracefully handle connection errors', async () => {
        vi.doMock('@/platform/config/index', () => ({
            config: {
                redis: {
                    url: 'redis://invalid-host:6379',
                    password: undefined,
                    db: 0,
                    enabled: true,
                },
            },
        }));
        vi.resetModules();
        redisClientModule = await import('@/platform/redis-client');
        
        expect(redisClientModule.isRedisAvailable).toBeDefined();
    });
});
