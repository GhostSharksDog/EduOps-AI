'use client';

import {useSettings} from '@/modules/system/client';

/**
 * 预加载设置到 settingsStore
 * 放在 ReactQueryProvider 内部使用
 */
export function SettingsPreloader() {
    useSettings();
    return null;
}
