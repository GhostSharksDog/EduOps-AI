'use client';

import React from 'react';
import {Card} from 'antd';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {MESSAGES} from '@/shared/messages/index';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import {SettingOutlined} from '@ant-design/icons';

import {useSettingsStore} from '@/modules/system/ui/state/settingsStore';
import {useSettings, useSaveSettings, type SystemSettings} from '@/modules/system/ui/system/settings/hooks/useSettings';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import SettingsTabItems, {type AppearanceSettingsValues} from '@/modules/system/ui/system/settings/components/SettingsTabItems';
import {log} from '@/platform/logger';

const defaultSettings: SystemSettings = {
    sessionTimeout: 30,
    pageSize: 20,
    language: 'zh-CN',
    theme: 'light',
};

const SettingsPage: React.FC = () => {
    const {success, error} = useGlobalMessage();
    const {activeTab, setActiveTab} = useSettingsStore();
    const {data: settingsResponse, isLoading: loading} = useSettings();
    const saveSettingsMutation = useSaveSettings();

    const [settings, setSettings] = React.useState<SystemSettings>(
        settingsResponse ?? defaultSettings
    );

    React.useEffect(() => {
        if (settingsResponse) {
            setSettings(settingsResponse);
        }
    }, [settingsResponse]);

    const handleSave = async () => {
        try {
            if (activeTab === 'appearance') {
                await saveSettingsMutation.mutateAsync({
                    pageSize: settings.pageSize,
                    language: settings.language,
                    theme: settings.theme,
                });
                success(MESSAGES.SETTINGS.APPEARANCE_SAVED);
            } else if (activeTab === 'security') {
                await saveSettingsMutation.mutateAsync({
                    sessionTimeout: settings.sessionTimeout,
                });
                success(MESSAGES.SETTINGS.SECURITY_SAVED);
            }
        } catch (err) {
            log.error('Failed to save settings', err);
            error(MESSAGES.SETTINGS.SAVE_FAILED);
        }
    };

    const appearanceSettings: AppearanceSettingsValues = {
        language: settings.language,
        theme: settings.theme,
        pageSize: settings.pageSize,
    };

    const securitySettings = {
        sessionTimeout: settings.sessionTimeout,
    };

    return (
        <PageContainer>
            <PageHeader
                title="系统设置"
                description="配置系统外观和安全策略"
                iconComponent={SettingOutlined}
                isSettingsPage
                loading={loading}
                onSave={handleSave}
            />
            <Card variant="borderless">
                <SettingsTabItems
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    appearanceSettings={appearanceSettings}
                    securitySettings={securitySettings}
                    onAppearanceChange={(vals) => setSettings(s => ({...s, ...vals}))}
                    onSecurityChange={(vals) => setSettings(s => ({...s, ...vals}))}
                />
            </Card>
        </PageContainer>
    );
};

export default SettingsPage;
