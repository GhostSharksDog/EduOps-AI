'use client';

import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {ConfigProvider} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {StyleProvider} from '@ant-design/cssinjs';
import {darkTheme, lightTheme} from '@/shared/theme/theme.config';
import {editorialVariables} from '@/shared/theme/palette';

export interface ThemeContextType {isDarkMode: boolean; toggleTheme: () => void;}
export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}
export default function ThemeProvider({children}: {children: React.ReactNode}) {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [preferenceLoaded, setPreferenceLoaded] = useState(false);
    useEffect(() => {
        try {setIsDarkMode(localStorage.getItem('education-theme') === 'dark');} catch {}
        setPreferenceLoaded(true);
    }, []);
    useEffect(() => {
        document.body.dataset.theme = isDarkMode ? 'dark' : 'light';
        document.documentElement.style.colorScheme = isDarkMode ? 'dark' : 'light';
        for (const [name, value] of Object.entries(editorialVariables(isDarkMode))) document.body.style.setProperty(name, value);
        if (preferenceLoaded) {
            try {localStorage.setItem('education-theme', isDarkMode ? 'dark' : 'light');} catch {}
        }
    }, [isDarkMode, preferenceLoaded]);
    const toggleTheme = useCallback(() => setIsDarkMode(previous => !previous), []);
    return <StyleProvider hashPriority="low"><ConfigProvider theme={isDarkMode ? darkTheme : lightTheme} locale={zhCN}>
        <ThemeContext.Provider value={{isDarkMode, toggleTheme}}>{children}</ThemeContext.Provider>
    </ConfigProvider></StyleProvider>;
}
