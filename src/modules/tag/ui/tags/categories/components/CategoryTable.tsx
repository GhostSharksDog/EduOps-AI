'use client';

import React, {useState, useMemo, useCallback, useEffect, useRef} from 'react';
import type {TableProps} from 'antd';
import {
    Empty,
    Spin,
    Dropdown,
    Badge,
    Tag,
    Table,
    theme,
} from 'antd';
import {
    DeleteOutlined,
    EditOutlined,
    PlusOutlined,
    MoreOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    LoadingOutlined,
} from '@ant-design/icons';
import type {TagCategoryVO, TagCategoryListVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';
import {ApiClient} from '@/shared/lib/api-client';
import {StandalonePagination} from '@/shared/ui/dashboard/pagination/index';

interface CategoryTableProps {
    data: TagCategoryVO[];
    loading: boolean;
    pagination: {
        current: number;
        pageSize: number;
        total: number;
    };
    onAddSubCategory: (id: string) => void;
    onEdit: (record: TagCategoryVO) => void;
    onDelete: (id: string) => void;
    onPageChange: (page: number, pageSize: number) => void;
    filterComponent?: React.ReactNode;
    actionButtons?: React.ReactNode;
    selectedRowKeys?: string[];
    onSelectionChange?: (selectedRowKeys: string[], selectedRows: TagCategoryVO[]) => void;
    refreshKey?: number | string;
    onViewTags?: (categoryId: string, categoryName: string) => void;
    getCheckboxProps?: (record: TagCategoryVO) => { disabled?: boolean; name?: string };
}

interface CategoryRow extends TagCategoryVO {
    key: string;
    childrenLoaded?: boolean;
    childrenLoading?: boolean;
}

const CategoryTable: React.FC<CategoryTableProps> = ({
    data,
    loading,
    pagination,
    onAddSubCategory,
    onEdit,
    onDelete,
    onPageChange,
    filterComponent,
    actionButtons,
    selectedRowKeys,
    onSelectionChange,
    refreshKey,
    onViewTags,
}) => {
    const {token} = theme.useToken();
    const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
    const [localData, setLocalData] = useState<Record<string, TagCategoryVO[]>>({});
    const [loadingParentId, setLoadingParentId] = useState<string | null>(null);
    const expandedRowKeysRef = useRef<string[]>([]);

    useEffect(() => {
        if (refreshKey !== undefined && expandedRowKeysRef.current.length > 0) {
            const fetchExpandedChildren = async () => {
                const newLocalData: Record<string, TagCategoryVO[]> = {};
                for (const parentId of expandedRowKeysRef.current) {
                    try {
                        const response = await ApiClient.get<TagCategoryListVO>('/tag-categories', {
                            parentId,
                            page: 1,
                            pageSize: 100,
                        });
                        newLocalData[parentId] = response.items || [];
                    } catch (error) {
                        console.error(`Failed to refresh children for ${parentId}:`, error);
                    }
                }
                setLocalData(prev => ({...prev, ...newLocalData}));
            };
            fetchExpandedChildren();
        } else if (refreshKey !== undefined) {
            setLocalData({});
        }
    }, [refreshKey]);

    const formatDateTime = (dateTime: string | undefined | null): string => {
        if (!dateTime) return '-';
        return new Date(dateTime).toLocaleString('zh-CN');
    };

    const handleExpand = useCallback(async (expanded: boolean, record: CategoryRow) => {
        if (expanded) {
            setExpandedRowKeys(prev => {
                const newKeys = [...prev, record.id];
                expandedRowKeysRef.current = newKeys;
                return newKeys;
            });
            
            if ((record.childrenCount ?? 0) > 0 && !localData[record.id] && !record.children?.length) {
                setLoadingParentId(record.id);
                try {
                    const response = await ApiClient.get<TagCategoryListVO>('/tag-categories', {
                        parentId: record.id,
                        page: 1,
                        pageSize: 100,
                    });
                    setLocalData(prev => ({
                        ...prev,
                        [record.id]: response.items || [],
                    }));
                } catch (error) {
                    console.error('Failed to load children:', error);
                } finally {
                    setLoadingParentId(null);
                }
            }
        } else {
            setExpandedRowKeys(prev => {
                const newKeys = prev.filter(key => key !== record.id);
                expandedRowKeysRef.current = newKeys;
                return newKeys;
            });
        }
    }, [localData]);

    const COLUMN_WIDTHS = {
        name: 200,
        description: 180,
        entityType: 100,
        orderIndex: 70,
        tagCount: 80,
        childrenCount: 80,
        createTime: 150,
        updateTime: 150,
        actions: 120,
    };

    const TOTAL_WIDTH = Object.values(COLUMN_WIDTHS).reduce((sum, w) => sum + w, 0);

    const columns: TableProps<CategoryRow>['columns'] = [
        {
            title: '分类名称',
            dataIndex: 'name',
            key: 'name',
            width: COLUMN_WIDTHS.name,
            render: (name: string, record: CategoryRow) => {
                const hasChildren = (record.childrenCount ?? 0) > 0 || localData[record.id]?.length;
                const expanded = expandedRowKeys.includes(record.id);
                const isLoading = loadingParentId === record.id;

                return (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginXS,
                    }}>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 20,
                                height: 20,
                                borderRadius: token.borderRadiusSM,
                                cursor: hasChildren && !isLoading ? 'pointer' : 'default',
                                backgroundColor: hasChildren ? `${token.colorInfoBg}` : 'transparent',
                                color: hasChildren ? token.colorInfo : token.colorTextTertiary,
                                transition: 'all 0.2s',
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (hasChildren && !isLoading) {
                                    handleExpand(!expanded, record);
                                }
                            }}
                            title={hasChildren ? (expanded ? '收起子分类' : '展开子分类') : undefined}
                        >
                            {isLoading ? (
                                <LoadingOutlined style={{fontSize: 12}} spin />
                            ) : hasChildren ? (
                                expanded ? (
                                    <FolderOpenOutlined style={{fontSize: 12}} />
                                ) : (
                                    <FolderOutlined style={{fontSize: 12}} />
                                )
                            ) : (
                                <span style={{fontSize: 10}}>•</span>
                            )}
                        </span>
                        <span
                            style={{
                                color: record.isDeleted ? token.colorTextDisabled : token.colorText,
                                fontWeight: 500,
                                lineHeight: '20px',
                            }}
                        >
                            {name}
                        </span>
                        {record.isDeleted && (
                            <Tag color="red" style={{marginLeft: token.marginXS, fontSize: '10px'}}>
                                已删除
                            </Tag>
                        )}
                    </div>
                );
            },
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            width: COLUMN_WIDTHS.description,
            ellipsis: true,
            render: (description: string | undefined) => (
                <span style={{
                    color: token.colorTextSecondary,
                    fontSize: '13px',
                }}>
                    {description || '-'}
                </span>
            ),
        },
        {
            title: '实体类型',
            key: 'entityType',
            width: COLUMN_WIDTHS.entityType,
            align: 'center' as const,
            render: (_: unknown, record: CategoryRow) => {
                const entityTypeCode = (record.feature as Record<string, unknown> | undefined)?.entityTypeCode as string | undefined;
                if (!entityTypeCode) {
                    return <span style={{color: token.colorTextDisabled, fontSize: '12px'}}>-</span>;
                }
                return (
                    <Tag color="blue" style={{margin: 0, fontSize: '12px'}}>
                        {entityTypeCode}
                    </Tag>
                );
            },
        },
        {
            title: '排序',
            dataIndex: 'orderIndex',
            key: 'orderIndex',
            width: COLUMN_WIDTHS.orderIndex,
            align: 'center' as const,
            render: (index: number) => (
                <span style={{
                    fontSize: '12px',
                    color: token.colorTextSecondary,
                    fontFamily: 'monospace',
                }}>
                    {index}
                </span>
            ),
        },
        {
            title: '标签数',
            dataIndex: 'tagCount',
            key: 'tagCount',
            width: COLUMN_WIDTHS.tagCount,
            align: 'center' as const,
            render: (count: number, record: CategoryRow) => {
                if (count === 0) {
                    return <Tag color="default" style={{margin: 0, fontSize: '12px'}}>0</Tag>;
                }
                return (
                    <Tag
                        color="blue"
                        style={{
                            margin: 0,
                            fontSize: '12px',
                            cursor: onViewTags ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                        }}
                        onClick={() => onViewTags?.(record.id, record.name)}
                        onMouseEnter={(e) => {
                            if (onViewTags) {
                                e.currentTarget.style.opacity = '0.8';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        {count}
                    </Tag>
                );
            },
        },
        {
            title: '子分类',
            key: 'childrenCount',
            width: COLUMN_WIDTHS.childrenCount,
            align: 'center' as const,
            render: (_: unknown, record: CategoryRow) => {
                const count = record.childrenCount || localData[record.id]?.length || 0;
                if (count === 0) {
                    return <span style={{color: token.colorTextDisabled, fontSize: '12px'}}>-</span>;
                }
                return (
                    <Badge
                        count={count}
                        style={{
                            backgroundColor: token.colorInfoBg,
                            color: token.colorInfo,
                            fontSize: '10px',
                        }}
                        showZero
                    />
                );
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            width: COLUMN_WIDTHS.createTime,
            render: (time: string) => (
                <span style={{
                    fontSize: '12px',
                    color: token.colorTextSecondary,
                }}>
                    {formatDateTime(time)}
                </span>
            ),
        },
        {
            title: '更新时间',
            dataIndex: 'updateTime',
            key: 'updateTime',
            width: COLUMN_WIDTHS.updateTime,
            render: (time: string | undefined) => (
                <span style={{
                    fontSize: '12px',
                    color: token.colorTextSecondary,
                }}>
                    {formatDateTime(time)}
                </span>
            ),
        },
        {
            title: '操作',
            key: 'actions',
            width: COLUMN_WIDTHS.actions,
            fixed: 'right' as const,
            render: (_: unknown, record: CategoryRow) => {
                const isChild = record.childrenCount === 0;

                const items = [
                    ...(isChild ? [] : [{
                        key: 'add',
                        label: (
                            <span style={{display: 'flex', alignItems: 'center', gap: token.marginXS}}>
                                <PlusOutlined style={{color: token.colorInfo}} />
                                添加子分类
                            </span>
                        ),
                        onClick: () => onAddSubCategory(record.id),
                        disabled: record.isDeleted,
                    }] as Array<{key: string; label: React.ReactNode; onClick: () => void; disabled?: boolean} | {type: 'divider'}>),
                    {
                        key: 'edit',
                        label: (
                            <span style={{display: 'flex', alignItems: 'center', gap: token.marginXS}}>
                                <EditOutlined style={{color: token.colorPrimary}} />
                                {isChild ? '查看详情' : '编辑分类'}
                            </span>
                        ),
                        onClick: () => onEdit(record),
                        disabled: record.isDeleted,
                    },
                    {type: 'divider' as const},
                    {
                        key: 'delete',
                        label: (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: token.marginXS,
                                color: token.colorError,
                            }}>
                                <DeleteOutlined />
                                {record.isDeleted ? '彻底删除' : '删除分类'}
                            </span>
                        ),
                        onClick: () => onDelete(record.id),
                        danger: true,
                    },
                ];

                return (
                    <Dropdown menu={{items}} trigger={['click']} placement="bottomRight">
                        <button
                            style={{
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: '4px 8px',
                                borderRadius: token.borderRadiusSM,
                                color: token.colorTextSecondary,
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = token.colorBgLayout;
                                e.currentTarget.style.color = token.colorText;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = token.colorTextSecondary;
                            }}
                        >
                            <MoreOutlined />
                        </button>
                    </Dropdown>
                );
            },
        },
    ];

    const getRowClassName = (record: CategoryRow) => {
        return record.isDeleted ? 'category-row-deleted' : 'category-row';
    };

    const treeData: CategoryRow[] = useMemo(() => {
        return data.map(node => ({
            ...node,
            key: node.id,
            children: localData[node.id] || undefined,
            childrenLoaded: !!localData[node.id],
        }));
    }, [data, localData]);

    const handleTableExpand = async (expanded: boolean, record: CategoryRow) => {
        if (expanded && !localData[record.id] && (record.childrenCount ?? 0) > 0) {
            setLoadingParentId(record.id);
        }
        handleExpand(expanded, record);
    };

    return (
        <div
            style={{
                borderRadius: token.borderRadiusLG,
                border: `1px solid ${token.colorBorder}`,
                boxShadow: token.boxShadowSecondary,
                overflow: 'hidden',
            }}
        >
            <style>{`
                .category-row:hover {
                    background-color: ${token.colorBgElevated} !important;
                }
                .category-row-deleted {
                    background-color: ${token.colorBgLayout} !important;
                    opacity: 0.7;
                }
                .category-row-deleted:hover {
                    background-color: ${token.colorBgContainer} !important;
                    opacity: 1;
                }
                .ant-table-row-expand-icon {
                    flex-shrink: 0;
                }
            `}</style>

            <div
                style={{
                    background: token.colorBgContainer,
                    padding: `${token.paddingMD}px ${token.paddingLG}px`,
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: token.marginSM,
                }}>
                    <FolderOpenOutlined style={{color: token.colorInfo, fontSize: '18px'}} />
                    <span style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: token.colorTextHeading,
                    }}>
                        标签分类
                    </span>
                </div>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: token.marginMD,
                }}>
                    {filterComponent}
                    {actionButtons}
                    <span style={{
                        fontSize: '12px',
                        color: token.colorTextSecondary,
                    }}>
                        共 <strong style={{color: token.colorText}}>{pagination.total}</strong> 个分类
                    </span>
                </div>
            </div>

            <div style={{background: token.colorBgContainer}}>
                {loading ? (
                    <div style={{
                        padding: '64px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Spin
                            size="large"
                            indicator={
                                <LoadingOutlined
                                    style={{
                                        fontSize: 48,
                                        color: token.colorInfo,
                                        marginBottom: 16,
                                    }}
                                    spin
                                />
                            }
                        />
                        <span style={{color: token.colorTextSecondary, fontSize: 14}}>
                            加载分类数据中...
                        </span>
                    </div>
                ) : data.length === 0 ? (
                    <div style={{
                        padding: '80px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            backgroundColor: token.colorBgLayout,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: token.paddingLG,
                        }}>
                            <FolderOutlined style={{fontSize: '32px', color: token.colorTextQuaternary}} />
                        </div>
                        <Empty
                            description={
                                <span style={{color: token.colorTextSecondary}}>
                                    暂无标签分类
                                </span>
                            }
                        >
                            <button
                                onClick={() => onAddSubCategory('')}
                                style={{
                                    marginTop: token.marginMD,
                                    padding: '10px 20px',
                                    background: `linear-gradient(135deg, ${token.colorInfo} 0%, ${token.colorInfoHover} 100%)`,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: token.borderRadiusLG,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: token.marginSM,
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    boxShadow: token.boxShadow,
                                    transition: 'transform 0.2s ease',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <PlusOutlined />
                                创建第一个分类
                            </button>
                        </Empty>
                    </div>
                ) : (
                    <>
                        <Table
                            columns={columns}
                            dataSource={treeData}
                            rowKey="id"
                            size="small"
                            expandable={{
                                expandedRowKeys,
                                onExpand: handleTableExpand,
                                expandIcon: () => null,
                            }}
                            rowClassName={getRowClassName}
                            pagination={false}
                            scroll={{x: TOTAL_WIDTH}}
                            showHeader={true}
                            bordered={false}
                            rowSelection={selectedRowKeys !== undefined ? {
                                selectedRowKeys,
                                onChange: (keys, rows) => {
                                    onSelectionChange?.(keys as string[], rows as TagCategoryVO[]);
                                },
                                getCheckboxProps: (record: CategoryRow) => ({
                                    disabled: (record.childrenCount ?? 0) > 0,
                                    name: record.name,
                                }),
                            } : undefined}
                        />
                        <StandalonePagination
                            current={pagination.current}
                            pageSize={pagination.pageSize}
                            total={pagination.total}
                            onChange={onPageChange}
                            style={{borderTop: 'none'}}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default CategoryTable;
