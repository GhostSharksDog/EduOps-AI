'use client';

import React from 'react';
import {Table, Tag, Button, Space, Popconfirm, Tooltip} from 'antd';
import {EyeOutlined, ThunderboltOutlined, CheckCircleOutlined, PauseCircleOutlined, DeleteOutlined, SyncOutlined, CloudServerOutlined, QuestionCircleOutlined, ToolOutlined} from '@ant-design/icons';
import type {TargetTableVO} from '@/shared/schemas/response/target-table/index';

interface TargetTableListProps {
    tables: TargetTableVO[];
    loading: boolean;
    onViewDetail: (table: TargetTableVO) => void;
    onCreateTable: (table: TargetTableVO) => void;
    onActivate: (table: TargetTableVO) => void;
    onDeactivate: (table: TargetTableVO) => void;
    onDelete: (table: TargetTableVO) => void;
    onEntityTypeClick: (entityTypeId: string) => void;
    onSyncStatus: (table: TargetTableVO) => void;
    onRebuild: (table: TargetTableVO) => void;
    syncingId?: string;
}

const statusColors: Record<string, string> = {
    DRAFT: 'blue',
    CREATE_FAILED: 'red',
    CREATED: 'default',
    ACTIVE: 'green',
    INACTIVE: 'orange',
};

const statusLabels: Record<string, string> = {
    DRAFT: '草稿',
    CREATE_FAILED: '建表失败',
    CREATED: '已建表',
    ACTIVE: '已激活',
    INACTIVE: '已停用',
};

const TargetTableList: React.FC<TargetTableListProps> = ({
    tables,
    loading,
    onViewDetail,
    onCreateTable,
    onActivate,
    onDeactivate,
    onDelete,
    onEntityTypeClick,
    onSyncStatus,
    onRebuild,
    syncingId,
}) => {
    const columns = [
        {
            title: '表名',
            dataIndex: 'tableName',
            key: 'tableName',
            width: 280,
            render: (text: string) => (
                <span style={{fontFamily: 'monospace', fontSize: 13}}>{text}</span>
            ),
        },
        {
            title: '实体类型',
            dataIndex: 'entityType',
            key: 'entityType',
            width: 120,
            render: (text: string, record: TargetTableVO) => (
                <a onClick={() => onEntityTypeClick(record.entityTypeId)}>{text}</a>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: string) => (
                <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
            ),
        },
        {
            title: 'CH表',
            dataIndex: 'chExists',
            key: 'chExists',
            width: 80,
            render: (chExists: boolean | null | undefined, record: TargetTableVO) => {
                if (record.status === 'DRAFT') return <span style={{color: '#aaa'}}>-</span>;
                if (chExists === null || chExists === undefined) {
                    return <Tooltip title="未检查"><Tag icon={<QuestionCircleOutlined />} color="default">未知</Tag></Tooltip>;
                }
                if (chExists) {
                    return <Tooltip title="ClickHouse 中表存在"><Tag icon={<CloudServerOutlined />} color="success">存在</Tag></Tooltip>;
                }
                return <Tooltip title="ClickHouse 中表不存在"><Tag icon={<CloudServerOutlined />} color="error">丢失</Tag></Tooltip>;
            },
        },
        {
            title: '表类型',
            dataIndex: 'tableType',
            key: 'tableType',
            width: 100,
            render: (type: string | null) => {
                if (type === 'PHYSICAL_TABLE') return '物理表';
                if (type === 'VIEW') return '视图';
                if (type === 'INTERMEDIATE') return '中间表';
                return '-';
            },
        },
        {
            title: '关联标签',
            dataIndex: 'tagId',
            key: 'tagId',
            width: 100,
            render: (tagId: string | null) => tagId ? '已关联' : '-',
        },
        {
            title: '行数',
            dataIndex: 'rowCount',
            key: 'rowCount',
            width: 100,
            render: (count: number | null) => count?.toLocaleString() || '-',
        },
        {
            title: '最后刷新',
            dataIndex: 'lastRefreshTime',
            key: 'lastRefreshTime',
            width: 160,
            render: (time: string | null) => time ? new Date(time).toLocaleString() : '-',
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            width: 160,
            render: (time: string) => new Date(time).toLocaleString(),
        },
        {
            title: '操作',
            key: 'actions',
            width: 200,
            render: (_: unknown, record: TargetTableVO) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => onViewDetail(record)}
                    >
                        详情
                    </Button>
                    {(record.status === 'DRAFT' || record.status === 'CREATE_FAILED') && (
                        <Button
                            type="link"
                            size="small"
                            icon={<ThunderboltOutlined />}
                            onClick={() => onCreateTable(record)}
                        >
                            建表
                        </Button>
                    )}
                    {(record.status === 'CREATED' || record.status === 'INACTIVE') && (
                        <Button
                            type="link"
                            size="small"
                            icon={<CheckCircleOutlined />}
                            onClick={() => onActivate(record)}
                        >
                            激活
                        </Button>
                    )}
                    {record.status === 'ACTIVE' && (
                        <Button
                            type="link"
                            size="small"
                            icon={<PauseCircleOutlined />}
                            onClick={() => onDeactivate(record)}
                        >
                            停用
                        </Button>
                    )}
                    {record.status === 'INACTIVE' && record.chExists === false && (
                        <Popconfirm
                            title="确定要重建此目标表吗？"
                            description="将在 ClickHouse 中重新执行建表 SQL"
                            onConfirm={() => onRebuild(record)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                type="link"
                                size="small"
                                icon={<ToolOutlined />}
                                style={{color: '#fa8c16'}}
                            >
                                重建
                            </Button>
                        </Popconfirm>
                    )}
                    {record.status !== 'DRAFT' && (
                        <Button
                            type="link"
                            size="small"
                            icon={<SyncOutlined spin={syncingId === record.id} />}
                            onClick={() => onSyncStatus(record)}
                            disabled={syncingId === record.id}
                        >
                            同步
                        </Button>
                    )}
                    {record.status !== 'ACTIVE' && (
                        <Popconfirm
                            title="确定要删除此目标表吗？"
                            description="删除后将同时删除 ClickHouse 中的表"
                            onConfirm={() => onDelete(record)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                            >
                                删除
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={tables}
            rowKey="id"
            loading={loading}
            pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
            }}
            size="small"
        />
    );
};

export default TargetTableList;
