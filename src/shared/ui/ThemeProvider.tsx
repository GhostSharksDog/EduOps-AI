'use client';

import React, {createContext, useContext, useEffect, useState} from "react";
import {ConfigProvider, theme} from "antd";
import zhCN from 'antd/locale/zh_CN';
import {StyleProvider} from '@ant-design/cssinjs';
import {darkTheme, lightTheme} from '@/shared/theme/theme.config';

export interface ThemeContextType {
    isDarkMode: boolean;
    toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

const GlobalThemeHandler = () => {
    const {token} = theme.useToken();

    useEffect(() => {
        document.body.style.backgroundColor = token.colorBgBase;
        document.body.style.color = token.colorText;
        document.body.setAttribute('data-theme', token.colorBgBase === '#141414' ? 'dark' : 'light');

        let style = document.getElementById('number-input-spinner-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'number-input-spinner-style';
            document.head.appendChild(style);
        }

        const isDark = token.colorBgBase === '#141414';
        const spinnerFilter = isDark ? 'invert(1) brightness(1.2)' : 'invert(0)';
        const spinnerBgHover = token.colorPrimaryBgHover;

        style.textContent = `
            input[type="number"]::-webkit-outer-spin-button,
            input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: auto;
                -moz-appearance: auto;
                width: 16px;
                height: 24px;
                margin: 0;
                filter: ${spinnerFilter};
                background: transparent;
                cursor: pointer;
            }
            input[type="number"]::-webkit-outer-spin-button:hover,
            input[type="number"]::-webkit-inner-spin-button:hover {
                background: ${spinnerBgHover};
            }

            input[type="number"]::-moz-inner-spin-button,
            input[type="number"]::-moz-outer-spin-button {
                width: 16px;
                height: 24px;
                margin: 0;
                filter: ${spinnerFilter};
                background: transparent;
                cursor: pointer;
            }
            input[type="number"]::-moz-inner-spin-button:hover,
            input[type="number"]::-moz-outer-spin-button:hover {
                background: ${spinnerBgHover};
            }
        `;
    }, [token]);

    return null;
};

export default function ThemeProvider({children}: { children: React.ReactNode }) {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [preferenceLoaded,setPreferenceLoaded]=useState(false);
    useEffect(()=>{try{setIsDarkMode(localStorage.getItem('education-theme')==='dark');}catch{}setPreferenceLoaded(true);},[]);
    useEffect(()=>{if(preferenceLoaded){try{localStorage.setItem('education-theme',isDarkMode?'dark':'light');}catch{}}},[isDarkMode,preferenceLoaded]);

    const toggleTheme = () => {
        setIsDarkMode((prev) => !prev);
    };

    const getThemeConfig = () => {
        if (isDarkMode) {
            return {
                ...darkTheme,
                algorithm: [theme.darkAlgorithm],
            };
        }
        return {
            ...lightTheme,
            token:{...lightTheme.token,colorPrimary:'#3478f6',colorBgLayout:'#f3f6fb',colorText:'#15243b',colorTextSecondary:'#64748b',borderRadius:10,borderRadiusLG:14,fontSize:15,controlHeight:36},
            algorithm: [theme.defaultAlgorithm],
        };
    };

    return (
        <StyleProvider hashPriority="high">
            <ConfigProvider theme={getThemeConfig()} locale={zhCN}>
                <GlobalThemeHandler/>
                <ThemeContext.Provider value={{isDarkMode, toggleTheme}}>
                    {children}
                </ThemeContext.Provider>
            </ConfigProvider>
        </StyleProvider>
    );
}
