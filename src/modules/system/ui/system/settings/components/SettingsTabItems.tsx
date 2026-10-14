'use client';

import React from 'react';
import {Tabs} from 'antd';
import {BgColorsOutlined, SecurityScanOutlined} from '@ant-design/icons';
import AppearanceSettings, {type AppearanceSettingsValues} from '@/modules/system/ui/system/settings/components/AppearanceSettings';
import SecuritySettings, {type SecuritySettingsValues} from '@/modules/system/ui/system/settings/components/SecuritySettings';

interface SettingsTabItemsProps {
    activeTab: string;
    setActiveTab: (key: string) => void;
    appearanceSettings: AppearanceSettingsValues;
    securitySettings: SecuritySettingsValues;
    onAppearanceChange: (values: AppearanceSettingsValues) => void;
    onSecurityChange: (values: SecuritySettingsValues) => void;
}

export default function SettingsTabItems({
    activeTab,
    setActiveTab,
    appearanceSettings,
    securitySettings,
    onAppearanceChange,
    onSecurityChange,
}: SettingsTabItemsProps) {
    const tabItems = [
        {
            key: 'appearance',
            label: '外观设置',
            icon: React.createElement(BgColorsOutlined),
            children: (
                <AppearanceSettings
                    value={appearanceSettings}
                    onChange={onAppearanceChange}
                />
            ),
        },
        {
            key: 'security',
            label: '安全设置',
            icon: React.createElement(SecurityScanOutlined),
            children: (
                <SecuritySettings
                    value={securitySettings}
                    onChange={onSecurityChange}
                />
            ),
        },
    ];

    return (
        <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{marginBottom: 16}}
        />
    );
}

export type {AppearanceSettingsValues, SecuritySettingsValues};
