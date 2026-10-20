'use client';

let identity = 'anonymous';
let generation = 0;
const requests = new Set<AbortController>();
let installed = false;

export function clientIdentityKey() {return identity;}
export function clientSessionStamp() {return generation;}
export function assertClientSession(stamp: number) {
    if (stamp !== generation) throw new DOMException('登录身份已变化，请重新打开页面。', 'AbortError');
}
export function registerClientRequest(signal?: AbortSignal | null) {
    const controller = new AbortController(), stamp = generation;
    const cancel = () => controller.abort(signal?.reason);
    if (signal?.aborted) cancel(); else signal?.addEventListener('abort', cancel, {once: true});
    requests.add(controller);
    return {controller, stamp, release: () => {requests.delete(controller); signal?.removeEventListener('abort', cancel);}};
}

/** 同一浏览器中的身份边界，取消旧请求并通知缓存清理。 */
export function changeClientIdentity(key: string, force = false) {
    if (!force && identity === key) return;
    identity = key; generation++;
    for (const controller of requests) controller.abort(new DOMException('登录身份已变化', 'AbortError'));
    requests.clear();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('education-identity-change'));
}

/** 覆盖已有页面使用的原生请求；拒绝旧身份的迟到结果。 */
export function installClientRequestBoundary() {
    if (installed || typeof window === 'undefined') return;
    installed = true;
    const original = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
        if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/') || ['/api/auth/login', '/api/auth/companies'].includes(url.pathname)) return original(input, init);
        const request = registerClientRequest(init?.signal ?? (input instanceof Request ? input.signal : undefined));
        try {
            const response = await original(input, {...init, signal: request.controller.signal});
            assertClientSession(request.stamp);
            return new Proxy(response, {get(target, property) {
                if (['json', 'text', 'blob', 'arrayBuffer', 'formData'].includes(String(property))) return async () => {
                    const read = Reflect.get(target, property) as () => Promise<unknown>;
                    const value = await read.call(target); assertClientSession(request.stamp); return value;
                };
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            }});
        } finally {request.release();}
    };
}
