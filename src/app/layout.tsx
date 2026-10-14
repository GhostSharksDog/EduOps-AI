import type {Metadata} from "next";
import "./globals.css";
import {AntdRegistry} from '@ant-design/nextjs-registry';
import {App} from 'antd';
import ThemeProvider from "@/shared/ui/ThemeProvider";
import {MessageServiceProvider} from "@/shared/lib/message-service";
import React from "react";
export const metadata: Metadata = {
    title: "教培运营分析辅助系统",
    description: "基于业务数据与AI智能体的教培机构运营分析辅助系统",
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="zh">
        <body>
        <AntdRegistry>
            <ThemeProvider>
                <App>
                    <MessageServiceProvider>
                        {children}
                    </MessageServiceProvider>
                </App>
            </ThemeProvider>
        </AntdRegistry>
        </body>
        </html>
    );
}
