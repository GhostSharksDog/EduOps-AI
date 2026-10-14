'use client';

import React from 'react';
import {Table, Tag, Progress, Button, Space, Popconfirm, theme, Dropdown} from 'antd';
import {EyeOutlined, StopOutlined, PlayCircleOutlined, MoreOutlined, DeleteOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import type {BitmapTableVO} from '@/shared/schemas/response/bitmap-table/index';
import {MESSAGES} from '@/shared/messages/index';

interface BitmapTableProps {
    tables: BitmapTableVO[];
    loading: boolean;
    onViewDetail: (table: BitmapTableVO) => void;
    onToggleStatus: (table: BitmapTableVO) => void;
    onEntityTypeClick: (entityTypeId: string) => void;
    onDelete: (table: BitmapTableVO) => void;
}

const BitmapTable: React.FC<BitmapTableProps> = ({
    tables,
    loading,
    onViewDetail,
    onToggleStatus,
    onEntityTypeClick,
    onDelete,
}) => {
    const {token} = theme.useToken();

    const getUsageColor = (percentage: number): string => {
        if (percentage < 50) return token.colorSuccess;
        if (percentage < 80) return token.colorWarning;
        return token.colorError;
    };

    const getUsedBitsColor = (used: number, total: number): string => {
        const percentage = (used / total) * 100;
        if (percentage < 50) return token.colorSuccess;
        if (percentage < 80) return token.colorWarning;
        return token.colorError;
    };

    const columns: ColumnsType<BitmapTableVO> = [
        {
            title: '表名',
            dataIndex: 'name',
            key: 'name',
            render: (name: string | undefined, record) => {
                const displayName = name || record.tableName;
                return (
                    <a onClick={() => onViewDetail(record)} style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
                        {displayName}
                    </a>
                );
            },
        },
        {
            title: '实体类型',
            dataIndex: 'entityType',
            key: 'entityType',
            width: 120,
            render: (entityType: string, record) => (
                <Tag
                    style={{cursor: 'pointer'}}
                    onClick={() => onEntityTypeClick(record.entityTypeId)}
                >
                    {entityType}
                </Tag>
            ),
        },
        {
            title: '总位数',
            dataIndex: 'totalBits',
            key: 'totalBits',
            width: 80,
            align: 'center',
        },
        {
            title: '已用',
            dataIndex: 'usedBits',
            key: 'usedBits',
            width: 80,
            align: 'center',
            render: (usedBits: number[], record) => {
                const used = usedBits.length;
                return (
                    <span style={{color: getUsedBitsColor(used, record.totalBits)}}>
                        {used}
                    </span>
                );
            },
        },
        {
            title: '使用率',
            key: 'usage',
            width: 180,
            render: (_, record) => {
                const used = record.usedBits.length;
                const percentage = Math.round((used / record.totalBits) * 100);
                return (
                    <Progress
                        percent={percentage}
                        size="small"
                        strokeColor={getUsageColor(percentage)}
                        format={(percent) => `${percent}%`}
                    />
                );
            },
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            align: 'center',
            render: (status: string) => (
                <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
                    {status === 'ACTIVE' ? '活跃' : '停用'}
                </Tag>
            ),
        },
        {
            title: '操作',
            key: 'action',
            width: 100,
            align: 'center',
            render: (_, record) => {
                const isActive = record.status === 'ACTIVE';
                const isInactive = record.status === 'INACTIVE';
                const canDelete = isInactive;
                
                return (
                    <Dropdown
                        trigger={['click']}
                        menu={{
                            items: [
                                {
                                    key: 'view',
                                    label: '详情',
                                    icon: <EyeOutlined />,
                                    onClick: () => onViewDetail(record),
                                },
                                {
                                    key: 'toggle',
                                    label: isActive ? '停用' : '激活',
                                    icon: isActive ? <StopOutlined /> : <PlayCircleOutlined />,
                                    danger: isActive,
                                    onClick: () => onToggleStatus(record),
                                },
                                { type: 'divider' },
                                {
                                    key: 'delete',
                                    label: '删除',
                                    icon: <DeleteOutlined />,
                                    danger: true,
                                    disabled: !canDelete,
                                    onClick: () => onDelete(record),
                                }
                            ]
                        }}
                    >
                        <Button type="text" size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                );
            },
        },
    ];

    return (
        <Table<BitmapTableVO>
            columns={columns}
            dataSource={tables}
            rowKey="id"
            loading={loading}
            pagination={{
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 张表`,
                defaultPageSize: 20,
            }}
            size="middle"
            scroll={{ x: 'max-content' }}
        />
    );
};

export default BitmapTable;
