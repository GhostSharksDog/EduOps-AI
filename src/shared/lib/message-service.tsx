'use client'

import React, { createContext, useContext, useEffect } from 'react';
import { message, App } from 'antd';
import type { MessageArgsProps } from 'antd';

// Type for the message API returned by App.useApp()
interface AppMessageApi {
    success: (content: React.ReactNode, duration?: number, onClose?: () => void) => void;
    error: (content: React.ReactNode, duration?: number, onClose?: () => void) => void;
    warning: (content: React.ReactNode, duration?: number, onClose?: () => void) => void;
    info: (content: React.ReactNode, duration?: number, onClose?: () => void) => void;
    loading: (content: React.ReactNode, duration?: number, onClose?: () => void) => void;
    open: (args: MessageArgsProps) => void;
}

// Context for storing message API
const MessageApiContext = createContext<AppMessageApi | null>(null);

export const useMessageApi = () => {
    const context = useContext(MessageApiContext);
    if (!context) {
        // Fallback to Ant Design's static methods if context not available
        return {
            success: (content: React.ReactNode, duration?: number) => message.success(content, duration),
            error: (content: React.ReactNode, duration?: number) => message.error(content, duration),
            warning: (content: React.ReactNode, duration?: number) => message.warning(content, duration),
            info: (content: React.ReactNode, duration?: number) => message.info(content, duration),
            loading: (content: React.ReactNode, duration?: number) => message.loading(content, duration),
            open: (args: MessageArgsProps) => message.open(args),
        };
    }
    return context;
};

// Global singleton for use in stores and non-React code
let globalMessageApi: AppMessageApi | null = null;

export const setGlobalMessageApi = (api: AppMessageApi) => {
    globalMessageApi = api;
};

export const getGlobalMessageApi = () => {
    return globalMessageApi || {
        success: (content: React.ReactNode, duration?: number) => message.success(content, duration),
        error: (content: React.ReactNode, duration?: number) => message.error(content, duration),
        warning: (content: React.ReactNode, duration?: number) => message.warning(content, duration),
        info: (content: React.ReactNode, duration?: number) => message.info(content, duration),
        loading: (content: React.ReactNode, duration?: number) => message.loading(content, duration),
        open: (args: MessageArgsProps) => message.open(args),
    };
};

// Provider component - place this inside <App> component in layout.tsx
// Then App.useApp() will work correctly
export const MessageServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { message: messageApi } = App.useApp();
    
    useEffect(() => {
        setGlobalMessageApi(messageApi);
    }, [messageApi]);
    
    return (
        <MessageApiContext.Provider value={messageApi}>
            {children}
        </MessageApiContext.Provider>
    );
};

// Convenience hook for components - RECOMMENDED for React components
export const useGlobalMessage = () => {
    const api = useMessageApi();
    
    const success = (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        api.success(content, duration, onClose);
    };
    
    const error = (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        api.error(content, duration, onClose);
    };
    
    const warning = (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        api.warning(content, duration, onClose);
    };
    
    const info = (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        api.info(content, duration, onClose);
    };
    
    const loading = (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        api.loading(content, duration, onClose);
    };
    
    return { message: api, success, error, warning, info, loading };
};

// Backward compatibility - use this in stores and non-React code
export const globalMessage = {
    success: (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        getGlobalMessageApi().success(content, duration, onClose);
    },
    error: (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        getGlobalMessageApi().error(content, duration, onClose);
    },
    warning: (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        getGlobalMessageApi().warning(content, duration, onClose);
    },
    info: (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        getGlobalMessageApi().info(content, duration, onClose);
    },
    loading: (content: React.ReactNode, duration?: number, onClose?: () => void) => {
        getGlobalMessageApi().loading(content, duration, onClose);
    },
};

