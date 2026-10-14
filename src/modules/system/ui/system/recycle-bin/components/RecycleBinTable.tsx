import React from 'react';
import {Button, Space, Table, Tag, Tooltip, Typography} from 'antd';
import {DeleteOutlined, RollbackOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import type {RecycleBinItemVO} from '@/modules/system/contracts/schemas/response/recycle-bin/index';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';
import {getTablePagination} from '@/shared/ui/dashboard/pagination/index';

const {Text} = Typography;

interface RecycleBinTableProps {
    data: RecycleBinItemVO[];
    loading: boolean;
    page: number;
    pageSize: number;
    total: number;
    selectedRowKeys?: React.Key[];
    onRestore: (record: RecycleBinItemVO) => Promise<void>;
    onPermanentDelete: (record: RecycleBinItemVO) => Promise<void>;
    onPageChange: (page: number, pageSize: number) => void;
    onSelectionChange?: (keys: React.Key[], rows: RecycleBinItemVO[]) => void;
    actionButtons?: React.ReactNode;
}

const getTypeLabel = (type: RecycleBinItemType): { label: string; color: string } => {
    const typeMap: Record<RecycleBinItemType, { label: string; color: string }> = {
        [RecycleBinItemType.TAG]: {label: '标签', color: 'blue'},
        [RecycleBinItemType.TAG_CATEGORY]: {label: '标签分类', color: 'cyan'},
        [RecycleBinItemType.SEGMENT]: {label: '分群', color: 'purple'},
        [RecycleBinItemType.DATA_SOURCE]: {label: '数据源', color: 'red'},
        [RecycleBinItemType.DATA_MODEL]: {label: '数据模型', color: 'lime'},
        [RecycleBinItemType.TARGET_TABLE]: {label: '目标表', color: 'orange'},
        [RecycleBinItemType.MODEL_COLUMN]: {label: '模型列', color: 'magenta'},
        [RecycleBinItemType.BITMAP_TABLE]: {label: 'Bitmap表', color: 'geekblue'},
    };
    return typeMap[type] || {label: type, color: 'default'};
};

const RecycleBinTable: React.FC<RecycleBinTableProps> = ({
                                                              data,
                                                              loading,
                                                              page,
                                                              pageSize,
                                                              total,
                                                              selectedRowKeys,
                                                              onRestore,
                                                              onPermanentDelete,
                                                              onPageChange,
                                                              onSelectionChange,
                                                          }) => {
    const columns: ColumnsType<RecycleBinItemVO> = [
        {
            title: '数据类型',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (type: RecycleBinItemType) => {
                const {label, color} = getTypeLabel(type);
                return <Tag color={color}>{label}</Tag>;
            },
        },
        {
            title: '名称',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space orientation="vertical" size={0}>
                    <Text strong>{text}</Text>
                    {record.originalData?.code ?
                        <Text type="secondary">{String(record.originalData.code)}</Text> : null}
                </Space>
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (text) => text || '-',
        },
        {
            title: '删除时间',
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            width: 180,
            sorter: (a, b) => new Date(a.deletedAt).getTime() - new Date(b.deletedAt).getTime(),
            render: (text) => text ? new Date(text).toLocaleString() : '-',
        },
        {
            title: '删除人',
            dataIndex: 'deletedBy',
            key: 'deletedBy',
            width: 120,
            render: (text) => text || '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="恢复">
                        <Button
                            type="text"
                            icon={<RollbackOutlined/>}
                            size="small"
                            aria-label="恢复"
                            onClick={() => onRestore(record)}
                        />
                    </Tooltip>
                    <Tooltip title="永久删除">
                        <Button
                            type="text"
                            icon={<DeleteOutlined/>}
                            size="small"
                            danger
                            aria-label="永久删除"
                            onClick={() => onPermanentDelete(record)}
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            rowSelection={{
                selectedRowKeys,
                onChange: (keys, rows) => {
                    onSelectionChange?.(keys, rows);
                },
            }}
            pagination={getTablePagination({
                current: page,
                pageSize,
                total,
                onChange: onPageChange,
            })}
            scroll={{x: 1200}}
        />
    );
};

export default RecycleBinTable;
