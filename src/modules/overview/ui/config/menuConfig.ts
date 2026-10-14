import React from 'react';
import {
    AppstoreOutlined,
    DashboardOutlined,
    DatabaseOutlined,
    DeleteOutlined,
    FundOutlined,
    HistoryOutlined,
    LockOutlined,
    MonitorOutlined,
    PieChartOutlined,
    SettingOutlined,
    TagOutlined,
    UploadOutlined,
    UsergroupAddOutlined
} from '@ant-design/icons';
import type {MenuProps} from 'antd';

/**
 * 菜单键到路径的映射
 */
export const menuKeyToPath: Record<string, string> = {
    'dashboard': '/dashboard',
    'agent': '/dashboard/agent',
    'decisions':'/dashboard/decisions',
    'evaluation':'/dashboard/evaluation',
    'channels':'/dashboard/channels',
    'help':'/dashboard/help',
    'knowledge': '/dashboard/knowledge',
    'analytics': '/dashboard/analytics',
    'alerts': '/dashboard/alerts',
    'reports': '/dashboard/reports',
    'tags-list': '/dashboard/tags',
    'tags-risk': '/dashboard/tags/risk',
    'tags-categories': '/dashboard/tags/categories',
    'tags-bitmap': '/dashboard/tags/bitmap',
    'tags-target-tables': '/dashboard/tags/target-tables',
    'tags-monitor': '/dashboard/tags/monitor',
    'segments-list': '/dashboard/segments',
    'segments-risk': '/dashboard/segments/risk',
    'data-import': '/dashboard/data/import',
    'data-portrait': '/dashboard/data/portrait',
    'data-sources': '/dashboard/data/sources',
    'data-models': '/dashboard/data/models',
    'audit-logs': '/dashboard/system/audit-logs',
    'permissions': '/dashboard/system/permissions',
    'db-browser': '/dashboard/system/db-browser',
    'settings': '/dashboard/system/settings',
    'diagnostics':'/dashboard/system/diagnostics',
    'recycle-bin': '/dashboard/system/recycle-bin',
};

/**
 * 根据当前路径获取选中的菜单键
 */
export const getRouteKey = (pathname: string | undefined): string | undefined => {
    if (!pathname) return undefined;
    const matched = Object.entries(menuKeyToPath)
        .sort((a, b) => b[1].length - a[1].length)
        .find(([, url]) => pathname === url || (url !== '/dashboard' && pathname.startsWith(url + '/')));
    return matched?.[0];
};

export const navigationSections = {
    dashboard: ['dashboard', 'analytics', 'channels'],
    agent: ['agent'],
    'segments-risk': ['segments-risk', 'tags-risk', 'data-portrait'],
    decisions: ['decisions', 'alerts', 'reports'],
};
export const getSelectedKey = (pathname: string | undefined): string[] => {
    const route = getRouteKey(pathname);
    const group = Object.entries(navigationSections).find(([, keys]) => route && keys.includes(route));
    return group ? [group[0]] : [];
};

/**
 * 侧边栏菜单项配置
 */
export const menuItems: MenuProps['items'] = [
    {key: 'dashboard', label: '运营总览', icon: React.createElement(DashboardOutlined)},
    {key: 'agent', label: '智能分析', icon: React.createElement(FundOutlined)},
    {key: 'segments-risk', label: '标签与人群', icon: React.createElement(UsergroupAddOutlined)},
    {key:'decisions',label:'行动中心',icon:React.createElement(FundOutlined)},
];

export const pageNavigationLabels: Record<string, string> = {
    dashboard: '总览', analytics: '全部指标', channels: '渠道分析',
    'segments-risk': '已保存人群', 'tags-risk': '标签规则', 'data-portrait': '画像',
    decisions: '决策任务', alerts: '预警', reports: '报告',
};
export const workbenchItems: MenuProps['items'] = [
    {
        key: 'data-group',
        type: 'group', label: '数据与知识',
        children: [
            {key: 'data-sources', label: '数据源管理', icon: React.createElement(DatabaseOutlined)},
            {key: 'data-models', label: '数据模型管理', icon: React.createElement(DatabaseOutlined)},
            {key: 'data-import', label: '批量导入', icon: React.createElement(UploadOutlined)},
            {key: 'knowledge', label: '业务知识', icon: React.createElement(DatabaseOutlined)},
        ],
    },
    {key:'evaluation',label:'研究评价',icon:React.createElement(PieChartOutlined)},
    {key:'advanced-group',type:'group',label:'高级配置',children:[
            {key: 'tags-list', label: '标签列表', icon: React.createElement(TagOutlined)},
            {key: 'tags-categories', label: '分类管理', icon: React.createElement(AppstoreOutlined)},
            {key: 'tags-bitmap', label: 'Bitmap 管理', icon: React.createElement(DatabaseOutlined)},
            {key: 'tags-target-tables', label: '目标表管理', icon: React.createElement(DatabaseOutlined)},
            {key: 'tags-monitor', label: 'MV 监控', icon: React.createElement(MonitorOutlined)},
            {key: 'segments-list', label: '人群列表', icon: React.createElement(UsergroupAddOutlined)},
    ]},
    {
        key: 'system-group',
        type: 'group', label: '系统管理',
        children: [
            {key: 'audit-logs', label: '审计日志', icon: React.createElement(HistoryOutlined)},
            {key: 'permissions', label: '账号与角色', icon: React.createElement(LockOutlined)},
            {key: 'db-browser', label: '数据库浏览器', icon: React.createElement(DatabaseOutlined)},
            {key: 'settings', label: '系统设置', icon: React.createElement(SettingOutlined)},
            {key:'diagnostics',label:'运行诊断',icon:React.createElement(MonitorOutlined)},
            {key: 'recycle-bin', label: '回收站', icon: React.createElement(DeleteOutlined)},
        ],
    },
];
