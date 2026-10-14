export interface CacheService {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttlSeconds: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    delPattern(pattern: string): Promise<boolean>;
    exists(key: string): Promise<boolean>;
    isHealthy(): Promise<boolean>;
}
