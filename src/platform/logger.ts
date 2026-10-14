import pino from 'pino';
import { getRequestContext } from '@/platform/request-context';

const isServer = typeof window === 'undefined';
const isProduction = process.env.NODE_ENV === 'production';
const isEdgeRuntime = typeof process === 'object' && (process.env.NEXT_RUNTIME === 'edge');

// Proxy logger that handles both client and server
const clientLogger: Logger = {
    info: (message: string, ...args: unknown[]) => {
        console.log(`[INFO] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => {
        console.error(`[ERROR] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]) => {
        console.warn(`[WARN] ${message}`, ...args);
    },
    debug: (message: string, ...args: unknown[]) => {
        if (!isProduction) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    },
};

// Server-side pino logger instance
let serverLogger: pino.Logger | null = null;

// Initialize server logger - only runs on server
function getServerLogger(): pino.Logger {
    if (!isServer) {
        throw new Error('服务器日志记录器只能在服务器端使用');
    }

    if (serverLogger) {
        return serverLogger;
    }

    const baseOptions: pino.LoggerOptions = {
        level: process.env.LOG_LEVEL || 'info',
        mixin() {
            const ctx = getRequestContext();
            if (!ctx) return {};
            return {
                requestId: ctx.requestId,
                userId: ctx.userId,
                path: ctx.path,
                method: ctx.method,
            };
        },
    };

    // In production, use JSON format
    // In development, use pretty printing with colors
    if (isProduction) {
        serverLogger = pino(baseOptions);
    } else {
        serverLogger = pino({
            ...baseOptions,
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                },
            },
        });
    }

    return serverLogger;
}

// Proxy logger that handles both client and server
type LoggerMethod = 'info' | 'error' | 'warn' | 'debug';

interface Logger {
    info(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}

// Create server logger methods that include file path
function createServerLogMethod(method: LoggerMethod): (message: string, ...args: unknown[]) => void {
    return (message: string, ...args: unknown[]) => {
        const serverLoggerInstance = getServerLogger();
        const mergedObj: Record<string, unknown> = {};
        let msg = message;
        
        for (const arg of args) {
            if (typeof arg === 'object' && arg !== null) {
                Object.assign(mergedObj, arg);
            } else if (arg !== undefined) {
                msg += ` ${String(arg)}`;
            }
        }
        
        if (Object.keys(mergedObj).length > 0) {
            (serverLoggerInstance[method] as (obj: unknown, msg: string) => void)(mergedObj, msg);
        } else {
            (serverLoggerInstance[method] as (msg: string) => void)(msg);
        }
    };
}

const serverLoggerMethods: Record<LoggerMethod, (message: string, ...args: unknown[]) => void> = {
    info: createServerLogMethod('info'),
    error: createServerLogMethod('error'),
    warn: createServerLogMethod('warn'),
    debug: createServerLogMethod('debug'),
};

const loggerProxy = new Proxy(clientLogger, {
    get(target, prop: LoggerMethod) {
        if (isServer && !isEdgeRuntime && (prop === 'info' || prop === 'error' || prop === 'warn' || prop === 'debug')) {
            return serverLoggerMethods[prop];
        }
        return target[prop];
    },
}) as Logger;

export const log = loggerProxy;
