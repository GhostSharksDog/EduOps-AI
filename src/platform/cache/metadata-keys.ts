export function getEnumCacheKey(code: string): string {
    return `metadata:enum:${code}`;
}

export function getEnumValuesCacheKey(code: string): string {
    return `metadata:enum:${code}:values`;
}

export function getEnumPattern(): string {
    return 'metadata:enum:*';
}
