import Redis from 'ioredis';
import { config } from '@/platform/config/index';
import { log } from '@/platform/logger';

let redisClient: Redis | null = null;
let isConnected = false;

/**
 * Initialize Redis client with graceful fallback
 */
function createRedisClient(): Redis | null {
    if (!config.redis.enabled) {
        log.info('Redis is disabled, using no-cache mode');
        return null;
    }

    try {
        const client = new Redis(config.redis.url, {
            password: config.redis.password,
            db: config.redis.db,
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                if (times > 3) return null;
                return Math.min(times * 100, 3000);
            },
            lazyConnect: true,
            enableReadyCheck: false,
        });

        client.on('connect', () => {
            isConnected = true;
            log.info('Redis client connected');
        });

        client.on('error', (err) => {
            // Don't log ECONNREFUSED during startup (expected if Redis not running)
            if (!err.message.includes('ECONNREFUSED')) {
                log.error('Redis connection error', err);
            }
            isConnected = false;
        });

        client.on('close', () => {
            isConnected = false;
            log.warn('Redis connection closed');
        });

        client.on('reconnecting', () => {
            log.info('Redis client reconnecting');
        });

        return client;
    } catch (err) {
        log.error('Failed to create Redis client', err);
        return null;
    }
}

/**
 * Get the Redis client singleton (lazy initialization)
 */
export function getRedisClient(): Redis | null {
    if (!redisClient && config.redis.enabled) {
        redisClient = createRedisClient();
    }
    return redisClient;
}

/**
 * Check if Redis is available and connected
 * Note: This is a synchronous check. For async health verification, use isRedisHealthy()
 */
export function isRedisAvailable(): boolean {
    const client = getRedisClient();
    return client !== null && isConnected;
}

/**
 * Async health check - performs PING to verify connection
 * Use this for health endpoints or critical path verification
 */
export async function isRedisHealthy(): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;
    try {
        const result = await client.ping();
        return result === 'PONG';
    } catch {
        return false;
    }
}

/**
 * Graceful shutdown
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        try {
            await redisClient.quit();
        } catch {
            // Ignore errors during shutdown
        }
        redisClient = null;
        isConnected = false;
    }
}

// Export for testing
export const _internal = {
    reset: () => {
        redisClient = null;
        isConnected = false;
    },
};
