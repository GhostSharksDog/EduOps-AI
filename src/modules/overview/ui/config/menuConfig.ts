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
    'workbench': '/dashboard/workbench',
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
/** The personal workbench has no large secondary-navigation group. */
export function getNavigationSection(selected: string | undefined): string[] {
    return selected && Object.hasOwn(navigationSections, selected)
        ? navigationSections[selected as keyof typeof navigationSections] : [];
}
export const getSelectedKey = (pathname: string | undefined): string[] => {
    const route = getRouteKey(pathname);
    const group = Object.entries(navigationSections).find(([, keys]) => route && keys.includes(route));
    if (group) return [group[0]];
    return route && (route === 'workbench' || workbenchCatalog.some(item => item.group !== 'common' && item.key === route)) ? ['workbench'] : [];
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
export type WorkbenchRole = 'admin' | 'operator' | 'viewer';
export type WorkbenchGroupKey = 'data' | 'knowledge' | 'system' | 'advanced';
export interface WorkbenchGroup {
    key: WorkbenchGroupKey;
    title: string;
    description: string;
    defaultCollapsed: boolean;
}
export interface WorkbenchEntry {
    key: string;
    title: string;
    description: string;
    path: string;
    group: WorkbenchGroupKey | 'common';
    icon: React.ReactNode;
    roles: readonly WorkbenchRole[];
    devOnly?: boolean;
}

export const workbenchGroups: readonly WorkbenchGroup[] = [
    {key:'data',title:'数据准备',description:'连接、组织和导入业务数据',defaultCollapsed:false},
    {key:'knowledge',title:'知识与研究',description:'维护业务材料和开展研究评价',defaultCollapsed:false},
    {key:'system',title:'系统管理',description:'维护账号、系统运行及操作记录',defaultCollapsed:false},
    {key:'advanced',title:'高级配置',description:'管理通用标签、人群及底层计算配置',defaultCollapsed:true},
];
const allRoles: readonly WorkbenchRole[] = ['admin','operator','viewer'];
const administrators: readonly WorkbenchRole[] = ['admin'];
const operators: readonly WorkbenchRole[] = ['admin','operator'];
const entry = (definition: Omit<WorkbenchEntry,'path'>): WorkbenchEntry => ({...definition,path:menuKeyToPath[definition.key]});

/** Client visibility is navigational; APIs retain their own permission checks. */
export const workbenchCatalog: readonly WorkbenchEntry[] = [
    entry({key:'agent',title:'智能分析',description:'提问、查看分析结果和准备业务操作',group:'common',icon:React.createElement(FundOutlined),roles:allRoles}),
    entry({key:'tags-risk',title:'运营标签',description:'设置规则、预览名单并确认发布',group:'common',icon:React.createElement(TagOutlined),roles:allRoles}),
    entry({key:'segments-risk',title:'已保存人群',description:'查看已确认的名单、画像和成员',group:'common',icon:React.createElement(UsergroupAddOutlined),roles:allRoles}),
    entry({key:'data-sources',title:'数据源管理',description:'配置和查看业务数据库连接',group:'data',icon:React.createElement(DatabaseOutlined),roles:allRoles}),
    entry({key:'data-models',title:'数据模型管理',description:'组织业务表结构和字段关系',group:'data',icon:React.createElement(DatabaseOutlined),roles:allRoles}),
    entry({key:'data-import',title:'数据导入',description:'导入教育数据并查看质量报告',group:'data',icon:React.createElement(UploadOutlined),roles:allRoles}),
    entry({key:'knowledge',title:'业务知识',description:'录入、审核和检索业务材料',group:'knowledge',icon:React.createElement(DatabaseOutlined),roles:allRoles}),
    entry({key:'evaluation',title:'研究评价',description:'比较生成方案并记录人工评阅',group:'knowledge',icon:React.createElement(PieChartOutlined),roles:allRoles}),
    entry({key:'audit-logs',title:'审计日志',description:'查看业务操作与权限使用记录',group:'system',icon:React.createElement(HistoryOutlined),roles:administrators}),
    entry({key:'permissions',title:'账号与角色',description:'查看本公司的本地账号和角色',group:'system',icon:React.createElement(LockOutlined),roles:administrators}),
    entry({key:'db-browser',title:'数据库浏览器',description:'开发环境中检查数据库结构和记录',group:'system',icon:React.createElement(DatabaseOutlined),roles:administrators,devOnly:true}),
    entry({key:'settings',title:'系统设置',description:'维护本公司的系统配置',group:'system',icon:React.createElement(SettingOutlined),roles:administrators}),
    entry({key:'diagnostics',title:'运行诊断',description:'检查数据库、模型和运行状态',group:'system',icon:React.createElement(MonitorOutlined),roles:operators}),
    entry({key:'recycle-bin',title:'回收站',description:'查看和恢复可恢复的已删除记录',group:'system',icon:React.createElement(DeleteOutlined),roles:administrators}),
    entry({key:'tags-list',title:'标签列表',description:'查看和维护通用标签定义',group:'advanced',icon:React.createElement(TagOutlined),roles:allRoles}),
    entry({key:'tags-categories',title:'分类管理',description:'组织标签分类及层级',group:'advanced',icon:React.createElement(AppstoreOutlined),roles:allRoles}),
    entry({key:'tags-bitmap',title:'Bitmap 管理',description:'管理标签位图计算和存储',group:'advanced',icon:React.createElement(DatabaseOutlined),roles:administrators}),
    entry({key:'tags-target-tables',title:'目标表管理',description:'维护标签计算使用的目标表',group:'advanced',icon:React.createElement(DatabaseOutlined),roles:allRoles}),
    entry({key:'tags-monitor',title:'MV 监控',description:'查看物化视图的运行情况',group:'advanced',icon:React.createElement(MonitorOutlined),roles:allRoles}),
    entry({key:'segments-list',title:'人群列表',description:'查看和维护通用人群配置',group:'advanced',icon:React.createElement(UsergroupAddOutlined),roles:allRoles}),
];
export const workbenchQuickKeys: readonly string[] = ['agent','tags-risk','segments-risk','knowledge','data-import','evaluation'];
const visible = (item: WorkbenchEntry, role: string | undefined, development: boolean): boolean =>
    item.roles.some(allowed => allowed === role) && (!item.devOnly || development);

export function getWorkbenchEntries(role: string | undefined, development: boolean): WorkbenchEntry[] {
    return workbenchCatalog.filter(item => item.group !== 'common' && visible(item,role,development));
}
export function getWorkbenchQuickEntries(role: string | undefined, development: boolean): WorkbenchEntry[] {
    return workbenchQuickKeys.flatMap(key => {
        const item = workbenchCatalog.find(candidate => candidate.key === key);
        return item && visible(item,role,development) ? [item] : [];
    });
}
