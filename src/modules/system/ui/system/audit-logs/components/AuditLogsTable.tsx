'use client';

import React from 'react';
import {Table, Tag, Space, theme, Typography, Popover, Button} from 'antd';
import {CopyOutlined} from '@ant-design/icons';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {MESSAGES} from '@/shared/messages/index';
import type {ColumnsType} from 'antd/es/table';
import dayjs from 'dayjs';
import type {AuditLogVO} from '@/shared/schemas/response/audit-log/index';

const {Text} = Typography;

interface AuditLogsTableProps {
    data: AuditLogVO[];
    loading: boolean;
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number, pageSize: number) => void;
}

const ACTION_COLORS: Record<string, string> = {
    CREATE: 'green',
    UPDATE: 'blue',
    DELETE: 'red',
    ACTIVATE: 'cyan',
    DEACTIVATE: 'orange',
    RESTORE: 'lime',
    BATCH_DELETE: 'magenta',
    BATCH_RESTORE: 'gold',
    REORDER: 'purple',
    MOVE: 'geekblue',
    SET_VERSION: 'processing',
    TEST_CONNECTION: 'warning',
    LOGIN: 'success',
    LOGOUT: 'default',
};

const ACTION_LABELS: Record<string, string> = {
    CREATE: '创建',
    UPDATE: '更新',
    DELETE: '删除',
    ACTIVATE: '激活',
    DEACTIVATE: '停用',
    RESTORE: '恢复',
    BATCH_DELETE: '批量删除',
    BATCH_RESTORE: '批量恢复',
    REORDER: '排序',
    MOVE: '移动',
    SET_VERSION: '设置版本',
    TEST_CONNECTION: '测试连接',
    LOGIN: '登录',
    LOGOUT: '登出',
};

const ENTITY_LABELS: Record<string, string> = {
    Tag: '标签',
    TagCategory: '标签分类',
    TagVersion: '标签版本',
    Segment: '人群',
    SegmentCondition: '人群条件',
    DataSource: '数据源',
    DataModel: '数据模型',
    RecycleBin: '回收站',
    Enum: '枚举',
    EnumValue: '枚举值',
    BitmapTable: '位图表',
    Session: '会话',
};

interface BatchIdPopoverProps {
    ids: string[];
    count: number;
}

const BatchIdPopover: React.FC<BatchIdPopoverProps> = ({ids, count}) => {
    const {token} = theme.useToken();
    const {success, error} = useGlobalMessage();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(ids.join('\n'));
            success(MESSAGES.COMMON.COPY_SUCCESS);
        } catch {
            error(MESSAGES.COMMON.COPY_FAILED);
        }
    };

    const content = (
        <div
            className="batch-id-popover-scroll"
            style={{
                ['--scrollbar-bg' as string]: token.colorBorderSecondary,
                ['--scrollbar-hover' as string]: token.colorTextSecondary,
                width: 340,
                maxHeight: 300,
                overflow: 'auto',
            }}
        >
            <div style={{marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <Text type="secondary" style={{fontSize: 12}}>共 {count} 条记录</Text>
                <Button size="small" icon={<CopyOutlined />} onClick={handleCopy}>
                    复制全部
                </Button>
            </div>
            <div style={{fontFamily: 'monospace', fontSize: 12}}>
                {ids.map((id, index) => (
                    <div key={id} style={{padding: '4px 0', borderBottom: index < ids.length - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none'}}>
                        {id}
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <Popover content={content} title="批量操作ID列表" trigger="click" placement="right">
            <a style={{fontSize: 12, color: token.colorPrimary, cursor: 'pointer'}}>
                批量操作 ({count}条)
            </a>
        </Popover>
    );
};

const AuditLogsTable: React.FC<AuditLogsTableProps> = ({
    data,
    loading,
    total,
    page,
    pageSize,
    onPageChange,
}) => {
    const {token} = theme.useToken();

    const columns: ColumnsType<AuditLogVO> = [
        {
            title: '时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (text: string) => (
                <Text style={{fontSize: 13, color: token.colorTextSecondary}}>
                    {dayjs(text).format('YYYY-MM-DD HH:mm:ss')}
                </Text>
            ),
        },
        {
            title: '操作类型',
            dataIndex: 'action',
            key: 'action',
            width: 120,
            render: (action: string) => (
                <Tag color={ACTION_COLORS[action] || 'default'} style={{margin: 0}}>
                    {ACTION_LABELS[action] || action}
                </Tag>
            ),
        },
        {
            title: '实体类型',
            dataIndex: 'entity',
            key: 'entity',
            width: 120,
            render: (entity: string) => (
                <Text style={{fontSize: 13}}>{ENTITY_LABELS[entity] || entity}</Text>
            ),
        },
        {
            title: '实体ID',
            dataIndex: 'entityId',
            key: 'entityId',
            width: 280,
            ellipsis: true,
            render: (text: string | null, record: AuditLogVO) => {
                if (record.action.startsWith('BATCH_') && record.metadata) {
                    const ids = record.metadata.ids as string[] | undefined;
                    const count = (record.metadata.count as number) || (ids?.length) || 0;
                    if (ids && ids.length > 0) {
                        return <BatchIdPopover ids={ids} count={count} />;
                    }
                }
                return (
                    <Text style={{fontSize: 12, fontFamily: 'monospace', color: token.colorTextSecondary}}>
                        {text || '-'}
                    </Text>
                );
            },
        },
        {
            title: '操作人',
            key: 'actor',
            width: 200,
            render: (_, record) => (
                <Space orientation="vertical" size={0}>
                    <Text strong style={{fontSize: 13}}>{record.actorUsername}</Text>
                    <Text style={{fontSize: 12, color: token.colorTextSecondary}}>
                        {record.actorRealName || record.actorEmail}
                    </Text>
                </Space>
            ),
        },
        {
            title: '角色',
            dataIndex: 'actorRole',
            key: 'actorRole',
            width: 100,
            align: 'center' as const,
            render: (role: string | null) => (
                <Text style={{fontSize: 12, color: token.colorTextSecondary}}>
                    {role || '-'}
                </Text>
            ),
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => (
                    <span style={{color: token.colorTextSecondary, fontSize: 13}}>
                        共 <Text strong style={{color: token.colorText}}>{total}</Text> 条记录
                    </span>
                ),
                onChange: onPageChange,
            }}
            scroll={{x: 1000}}
        />
    );
};

export default AuditLogsTable;
