'use client';

import React from 'react';
import {Breadcrumb, BreadcrumbProps, Button, Flex, Space, theme, Typography,} from 'antd';
import {
    AppstoreOutlined,
    BarChartOutlined,
    ClearOutlined,
    DatabaseOutlined,
    DeleteOutlined,
    DownloadOutlined,
    FileTextOutlined,
    FolderOutlined,
    HistoryOutlined,
    HomeOutlined,
    PlusOutlined,
    ReloadOutlined,
    SaveOutlined,
    SettingOutlined,
    TagOutlined,
    TeamOutlined,
    UndoOutlined,
    UploadOutlined,
} from '@ant-design/icons';
import styles from './PageHeader.module.css';

const {Title, Paragraph} = Typography;

interface ActionButton {
    key: string;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    loading?: boolean;
    danger?: boolean;
    type?: 'primary' | 'default' | 'dashed' | 'link' | 'text';
}

interface PageHeaderProps {
    title?: string;
    description?: string;
    breadcrumbItems?: BreadcrumbProps['items'];
    icon?: React.ReactNode;
    iconComponent?: React.ComponentType<{ style?: React.CSSProperties }>;
    actions?: ActionButton[];
    showDefaultCreate?: boolean;
    createButtonText?: string;
    onCreate?: () => void;
    showBatchActions?: boolean;
    selectedCount?: number;
    onBatchRestore?: () => void;
    onBatchPermanentDelete?: () => void;
    useErrorTheme?: boolean;
    loading?: boolean;
    onReset?: () => void;
    onSave?: () => void;
    onDownloadTemplate?: () => void;
    isSettingsPage?: boolean;
    titleLevel?: 1 | 2 | 3 | 4 | 5;
    iconSize?: number;
    customActions?: React.ReactNode;
    filterComponent?: React.ReactNode;
}

const getDefaultBreadcrumbItems = (title: string): BreadcrumbProps['items'] => {
    const items: BreadcrumbProps['items'] = [
        {
            title: (
                <span className={styles.breadcrumbItem}>
                    <HomeOutlined/>
                    首页
                </span>
            ),
        },
    ];

    const categoryMap: Record<string, { title: React.ReactNode }> = {
        '审计日志': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <SettingOutlined/>
                    系统管理
                </span>
            ),
        },
        '回收站': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <SettingOutlined/>
                    系统管理
                </span>
            ),
        },
        '系统设置': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <SettingOutlined/>
                    系统管理
                </span>
            ),
        },
        '标签管理': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    标签管理
                </span>
            ),
        },
        '标签列表': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    标签管理
                </span>
            ),
        },
        '标签分类': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    标签管理
                </span>
            ),
        },
        '标签分类管理': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    标签管理
                </span>
            ),
        },
        '用户分群': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    用户分群
                </span>
            ),
        },
        '分群列表': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    用户分群
                </span>
            ),
        },
        '数据模型管理': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    数据模型管理
                </span>
            ),
        },
        '数据模型列表': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    数据模型管理
                </span>
            ),
        },
        '数据源管理': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    数据源管理
                </span>
            ),
        },
        '数据源列表': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    数据源管理
                </span>
            ),
        },
        '批量导入': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    数据管理
                </span>
            ),
        },
        '全景画像': {
            title: (
                <span className={styles.breadcrumbItem}>
                    <FolderOutlined/>
                    数据管理
                </span>
            ),
        },
    };

    const categoryItem = categoryMap[title];
    if (categoryItem) {
        items.push(categoryItem);
    }

    const iconMap: Record<string, React.ReactNode> = {
        '审计日志': <HistoryOutlined/>,
        '回收站': <DeleteOutlined/>,
        '系统设置': <SettingOutlined/>,
        '标签列表': <TagOutlined/>,
        '标签分类管理': <AppstoreOutlined/>,
        '用户分群': <TeamOutlined/>,
        '数据模型管理': <DatabaseOutlined/>,
        '数据源管理': <DatabaseOutlined/>,
        '批量导入': <UploadOutlined/>,
        '全景画像': <FileTextOutlined/>,
        '分群分析': <BarChartOutlined/>,
    };

    items.push({
        title: (
            <span className={styles.breadcrumbItem}>
                {iconMap[title] || null}
                {title}
            </span>
        ),
    });

    return items;
};

export default function PageHeader({
                                       title,
                                       description,
                                       breadcrumbItems,
                                       icon,
                                       iconComponent,
                                       actions,
                                       showDefaultCreate = false,
                                       createButtonText = '新建',
                                       onCreate,
                                       showBatchActions = false,
                                       selectedCount = 0,
                                       onBatchRestore,
                                       onBatchPermanentDelete,
                                       useErrorTheme = false,
                                       loading = false,
                                       onReset,
                                       onSave,
                                       onDownloadTemplate,
                                       isSettingsPage = false,
                                       titleLevel = 2,
                                       iconSize = 18,
                                       customActions,
                                       filterComponent,
                                   }: PageHeaderProps) {
    const {token} = theme.useToken();

    const headerStyle: React.CSSProperties = {
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        padding: `${token.paddingLG}px`,
        border: `1px solid ${token.colorBorder}`,
        marginBottom: token.paddingLG,
        minHeight: 96,
        width: '100%',
    };

    const iconContainerStyle: React.CSSProperties = {
        width: '40px',
        height: '40px',
        borderRadius: token.borderRadiusLG,
        background: useErrorTheme
            ? `linear-gradient(135deg, ${token.colorError} 0%, ${token.colorErrorHover || '#ff4d4f'} 100%)`
            : `linear-gradient(135deg, ${token.colorInfo} 0%, ${token.colorInfoHover} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: token.boxShadow,
        marginRight: token.marginSM,
    };

    const buttonStyle: React.CSSProperties = {
        height: '44px',
        paddingInline: '24px',
        fontSize: '15px',
        fontWeight: 500,
        borderRadius: token.borderRadiusLG,
    };

    const primaryButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        background: useErrorTheme
            ? `linear-gradient(135deg, ${token.colorError} 0%, ${token.colorErrorHover || '#ff4d4f'} 100%)`
            : `linear-gradient(135deg, ${token.colorInfo} 0%, ${token.colorInfoHover} 100%)`,
        border: 'none',
        boxShadow: token.boxShadow,
    };

    const IconComponent = iconComponent;

    const renderIcon = () => {
        if (icon) return icon;
        if (IconComponent) {
            return <IconComponent style={{color: token.colorWhite, fontSize: iconSize}}/>;
        }
        return null;
    };

    const renderActions = () => {
        if (customActions) {
            return customActions;
        }

        if (actions && actions.length > 0) {
            return (
                <Space>
                    {actions.map(action => (
                        <Button
                            key={action.key}
                            type={action.type}
                            danger={action.danger}
                            icon={action.icon}
                            onClick={action.onClick}
                            loading={action.loading}
                            style={action.type === 'primary' ? primaryButtonStyle : buttonStyle}
                        >
                            {action.label}
                        </Button>
                    ))}
                </Space>
            );
        }

        if (showBatchActions && selectedCount > 0) {
            return (
                <Space>
                    <Button
                        icon={<UndoOutlined/>}
                        onClick={onBatchRestore}
                        style={buttonStyle}
                    >
                        批量恢复 ({selectedCount})
                    </Button>
                    <Button
                        danger
                        icon={<ClearOutlined/>}
                        onClick={onBatchPermanentDelete}
                        style={buttonStyle}
                    >
                        批量永久删除 ({selectedCount})
                    </Button>
                </Space>
            );
        }

        if (isSettingsPage) {
            return (
                <Space>
                    {onReset && <Button icon={<ReloadOutlined/>} onClick={onReset} style={buttonStyle}>
                        重置
                    </Button>}
                    <Button
                        type="primary"
                        icon={<SaveOutlined/>}
                        onClick={onSave}
                        loading={loading}
                        style={primaryButtonStyle}
                    >
                        保存设置
                    </Button>
                </Space>
            );
        }

        if (onDownloadTemplate) {
            return (
                <Button
                    type="primary"
                    size="large"
                    icon={<DownloadOutlined/>}
                    onClick={onDownloadTemplate}
                    style={primaryButtonStyle}
                >
                    下载模板
                </Button>
            );
        }

        if (showDefaultCreate && onCreate) {
            return (
                <Button
                    type="primary"
                    size="large"
                    icon={<PlusOutlined/>}
                    onClick={onCreate}
                    style={primaryButtonStyle}
                >
                    {createButtonText}
                </Button>
            );
        }

        return null;
    };

    const items = breadcrumbItems || getDefaultBreadcrumbItems(title || '');

    return (
        <div>
            {!isSettingsPage && (
                <Breadcrumb
                    items={items}
                    style={{marginBottom: token.marginMD}}
                />
            )}
            <Flex vertical justify="space-between" style={headerStyle}>
                <Flex vertical gap={token.marginSM}>
                    <Flex align="center" wrap="wrap" style={{marginBottom: token.marginXS}}>
                        <Title
                            level={titleLevel}
                            style={{
                                margin: 0,
                                color: token.colorTextHeading,
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            {(icon || iconComponent) && (
                                <span style={iconContainerStyle}>
                                    {renderIcon()}
                                </span>
                            )}
                            {title}
                        </Title>
                    </Flex>
                    {description && (
                        <Paragraph
                            type="secondary"
                            style={{margin: 0, color: token.colorTextSecondary, maxWidth: '100%'}}
                        >
                            {description}
                        </Paragraph>
                    )}
                </Flex>
                <Flex justify="space-between" align="center" style={{marginTop: token.marginLG}}>
                    {filterComponent || <div />}
                    {renderActions()}
                </Flex>
            </Flex>
        </div>
    );
}

export function CreatePageHeader({
                                     title,
                                     description,
                                     breadcrumbItems,
                                     icon,
                                     iconComponent,
                                     onCreate,
                                     createButtonText,
                                     useErrorTheme,
                                 }: Omit<PageHeaderProps, 'showDefaultCreate' | 'onCreate'> & {
    onCreate: () => void;
    createButtonText?: string;
}) {
    return (
        <PageHeader
            title={title}
            description={description}
            breadcrumbItems={breadcrumbItems}
            icon={icon}
            iconComponent={iconComponent}
            showDefaultCreate
            onCreate={onCreate}
            createButtonText={createButtonText}
            useErrorTheme={useErrorTheme}
        />
    );
}

export function SettingsPageHeader({
                                       title,
                                       description,
                                       loading,
                                       onReset,
                                       onSave,
                                       useErrorTheme,
                                   }: Omit<PageHeaderProps, 'isSettingsPage'>) {
    return (
        <PageHeader
            title={title}
            description={description}
            isSettingsPage
            loading={loading}
            onReset={onReset}
            onSave={onSave}
            useErrorTheme={useErrorTheme}
        />
    );
}

export function RecycleBinPageHeader({
                                         title,
                                         description,
                                         selectedCount,
                                         onBatchRestore,
                                         onBatchPermanentDelete,
                                         icon,
                                     }: Omit<PageHeaderProps, 'showBatchActions' | 'useErrorTheme'> & {
    selectedCount: number;
    onBatchRestore: () => void;
    onBatchPermanentDelete: () => void;
}) {
    return (
        <PageHeader
            title={title}
            description={description}
            showBatchActions
            selectedCount={selectedCount}
            onBatchRestore={onBatchRestore}
            onBatchPermanentDelete={onBatchPermanentDelete}
            useErrorTheme
            icon={icon}
        />
    );
}

export function ImportPageHeader({
                                     title,
                                     description,
                                     breadcrumbItems,
                                     icon,
                                     onDownloadTemplate,
                                     useErrorTheme,
                                 }: Omit<PageHeaderProps, 'onDownloadTemplate'> & {
    onDownloadTemplate?: () => void;
}) {
    return (
        <PageHeader
            title={title}
            description={description}
            breadcrumbItems={breadcrumbItems}
            icon={icon}
            onDownloadTemplate={onDownloadTemplate}
            useErrorTheme={useErrorTheme}
        />
    );
}

export function StaticPageHeader({
                                     title,
                                     description,
                                     breadcrumbItems,
                                     icon,
                                     useErrorTheme,
                                 }: Omit<PageHeaderProps, 'actions' | 'showDefaultCreate'>) {
    return (
        <PageHeader
            title={title}
            description={description}
            breadcrumbItems={breadcrumbItems}
            icon={icon}
            useErrorTheme={useErrorTheme}
        />
    );
}
