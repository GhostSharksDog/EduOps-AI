'use client';

import React, {useState} from 'react';
import {Button, Popconfirm, Space, Table, Tag, Tooltip, theme} from 'antd';
import {
    CheckCircleOutlined,
    DeleteOutlined,
    ExclamationCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    ReloadOutlined,
} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import type {MvStatusReport, MvStatus} from '@/modules/tag/ui/tags/monitor/hooks/useTagMonitor';
import {useDeleteMvs, useRebuildMv} from '@/modules/tag/ui/tags/monitor/hooks/useTagMonitor';
import {getTablePagination} from '@/shared/ui/dashboard/pagination/index';
import {globalMessage} from '@/shared/lib/message';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const getStatusConfig = (status: MvStatus) => {
    const configs = {
        healthy: {
            color: 'success' as const,
            icon: <CheckCircleOutlined />,
            text: '正常',
        },
        warning: {
            color: 'warning' as const,
            icon: <ExclamationCircleOutlined />,
            text: '警告',
        },
        error: {
            color: 'error' as const,
            icon: <CloseCircleOutlined />,
            text: '错误',
        },
    };
    return configs[status];
};

const formatRelativeTime = (time: string | null | undefined) => {
    if (!time) return '-';
    return dayjs(time).fromNow();
};

interface MvStatusTableProps {
    data: MvStatusReport[];
    loading: boolean;
}

const MvStatusTable: React.FC<MvStatusTableProps> = ({data, loading}) => {
    const {token} = theme.useToken();
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const deleteMvsMutation = useDeleteMvs();
    const rebuildMvMutation = useRebuildMv();

    const handleRebuild = async (tagId: string, tagName: string) => {
        try {
            const result = await rebuildMvMutation.mutateAsync(tagId);
            if (result.success) {
                globalMessage.success(`${tagName} MV 重建成功`);
            }
        } catch (error) {
            globalMessage.error(error instanceof Error ? error.message : '重建失败');
        }
    };

    const handleBatchDelete = async () => {
        const selectedMvNames = selectedRowKeys.map(key => {
            const record = data.find(r => r.tagId === key);
            return record?.mvName;
        }).filter(Boolean) as string[];

        try {
            const result = await deleteMvsMutation.mutateAsync(selectedMvNames);
            globalMessage.success(result.message);
            setSelectedRowKeys([]);
        } catch (error) {
            globalMessage.error(error instanceof Error ? error.message : '删除失败');
        }
    };

    const columns: ColumnsType<MvStatusReport> = [
        {
            title: '标签名称',
            dataIndex: 'tagName',
            key: 'tagName',
            width: 150,
        },
        {
            title: 'MV 名称',
            dataIndex: 'mvName',
            key: 'mvName',
            width: 200,
            render: (name: string) => <code style={{fontSize: 12}}>{name}</code>,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status: MvStatus) => {
                const config = getStatusConfig(status);
                return (
                    <Tag color={config.color} icon={config.icon}>
                        {config.text}
                    </Tag>
                );
            },
        },
        {
            title: '状态描述',
            dataIndex: 'statusDescription',
            key: 'statusDescription',
            width: 120,
        },
        {
            title: '上次刷新',
            dataIndex: 'lastRefreshTime',
            key: 'lastRefreshTime',
            width: 120,
            render: (time: string) => (
                <Tooltip title={dayjs(time).format('YYYY-MM-DD HH:mm:ss')}>
                    <span>
                        <ClockCircleOutlined style={{marginRight: 4, color: token.colorTextSecondary}} />
                        {formatRelativeTime(time)}
                    </span>
                </Tooltip>
            ),
        },
        {
            title: '错误信息',
            dataIndex: 'lastException',
            key: 'lastException',
            ellipsis: true,
            render: (error: string | null) => {
                if (!error) return <span style={{color: token.colorTextDisabled}}>-</span>;
                return (
                    <Tooltip title={error}>
                        <span style={{color: token.colorError}}>{error}</span>
                    </Tooltip>
                );
            },
        },
        {
            title: '操作',
            key: 'action',
            width: 80,
            render: (_: unknown, record: MvStatusReport) => (
                <Tooltip title="根据当前版本重建 MV">
                    <Button
                        type="link"
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={rebuildMvMutation.isPending}
                        onClick={() => handleRebuild(record.tagId, record.tagName)}
                    >
                        重建
                    </Button>
                </Tooltip>
            ),
        },
    ];

    return (
        <Space orientation="vertical" style={{width: '100%'}} size="middle">
            {selectedRowKeys.length > 0 && (
                <Space>
                    <span style={{color: token.colorTextSecondary}}>
                        已选择 {selectedRowKeys.length} 项
                    </span>
                    <Popconfirm
                        title="确认删除"
                        description={`确定要删除选中的 ${selectedRowKeys.length} 个物化视图吗？此操作不可撤销。`}
                        onConfirm={handleBatchDelete}
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{danger: true}}
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            loading={deleteMvsMutation.isPending}
                            size="small"
                        >
                            批量删除
                        </Button>
                    </Popconfirm>
                    <Button
                        size="small"
                        onClick={() => setSelectedRowKeys([])}
                    >
                        取消选择
                    </Button>
                </Space>
            )}
            <Table
                dataSource={data}
                columns={columns}
                rowKey="tagId"
                pagination={getTablePagination()}
                size="small"
                loading={loading}
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys,
                }}
            />
        </Space>
    );
};

export default MvStatusTable;
