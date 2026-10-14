'use client';

import React, {useState} from 'react';
import {App, Button, Dropdown, Space, Switch, Table, theme, Tooltip} from 'antd';
import {ApiOutlined, DeleteOutlined, EditOutlined, EyeOutlined, MoreOutlined} from '@ant-design/icons';
import {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {DataSourceStatus, DataSourceType, DataSourceTypeLabels} from '@/shared/enums/index';
import DataSourceDetailDrawer from '@/modules/data/ui/data/sources/components/DataSourceDetailDrawer';
import {MESSAGES} from '@/shared/messages/index';
import {useTestDataSourceConnection} from '@/modules/data/ui/data/sources/hooks/useDataSources';
import {getTablePagination} from '@/shared/ui/dashboard/pagination/index';


interface DataSourceTableProps {
    data: DataSourceVO[];
    total: number;
    loading: boolean;
    page: number;
    pageSize: number;
    onEdit: (record: DataSourceVO) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: DataSourceStatus) => void;
    onPageChange: (page: number, pageSize: number) => void;
    onPageSizeChange: (pageSize: number) => void;
    /** 批量选择：选中的行 keys，传入此属性启用批量选择 */
    selectedRowKeys?: string[];
    /** 批量选择：选择变化回调 */
    onSelectionChange?: (selectedRowKeys: string[], selectedRows: DataSourceVO[]) => void;
    /** 批量选择：自定义 checkbox 属性 */
    getCheckboxProps?: (record: DataSourceVO) => { disabled?: boolean };
}

const DataSourceTable: React.FC<DataSourceTableProps> = ({
                                                             data,
                                                             total,
                                                             loading,
                                                             page,
                                                             pageSize,
                                                             onEdit,
                                                             onDelete,
                                                             onStatusChange,
                                                             onPageChange,
                                                             onPageSizeChange: _onPageSizeChange,
                                                             selectedRowKeys,
                                                             onSelectionChange,
                                                             getCheckboxProps
                                                         }) => {
    const {token} = theme.useToken();
    const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
    const [currentDataSource, setCurrentDataSource] = useState<DataSourceVO | null>(null);
    const [testingId, setTestingId] = useState<string | null>(null);
    const {message, modal} = App.useApp();

    const testConnectionMutation = useTestDataSourceConnection();

    const getTypeLabel = (type: DataSourceType) => {
        return DataSourceTypeLabels[type] || type;
    };

    const handleViewDetail = (record: DataSourceVO) => {
        setCurrentDataSource(record);
        setDetailDrawerVisible(true);
    };

    const handleTestConnection = async (record: DataSourceVO) => {
        setTestingId(record.id);

        try {
            const result = await testConnectionMutation.mutateAsync({dataSourceId: record.id});

            if (result.success) {
                message.success(MESSAGES.DATA_SOURCE.CONNECTION_SUCCESS);
            } else {
                message.error(`${MESSAGES.DATA_SOURCE.CONNECTION_FAILED}: ${result.message ||
                    (result.details && 'error' in result.details ? String(result.details.error) : '未知错误')}`);
            }
        } catch (error) {
            message.error(`${MESSAGES.DATA_SOURCE.TEST_FAILED}: ${error instanceof Error ? error.message : MESSAGES.API.NETWORK_ERROR}`);
        } finally {
            setTestingId(null);
        }
    };

    const columns = [
        {
            title: '数据源名称',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: '数据源类型',
            dataIndex: 'type',
            key: 'type',
            render: (type: DataSourceType) => getTypeLabel(type),
        },
        {
            title: '主机地址',
            dataIndex: 'host',
            key: 'host',
            ellipsis: true,
        },
        {
            title: '端口',
            dataIndex: 'port',
            key: 'port',
            width: 80,
        },
        {
            title: '数据库名称',
            dataIndex: 'databaseName',
            key: 'databaseName',
            ellipsis: true,
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (_: DataSourceStatus, record: DataSourceVO) => (
                <Switch
                    checked={record.status === DataSourceStatus.ACTIVE}
                    onChange={(checked) => {
                        modal.confirm({
                             title: checked ? MESSAGES.DATA_SOURCE.STATUS_ENABLE_CONFIRM_TITLE : MESSAGES.DATA_SOURCE.STATUS_DISABLE_CONFIRM_TITLE,
                             content: MESSAGES.DATA_SOURCE.STATUS_CONFIRM_CONTENT,
                             okText: MESSAGES.COMMON.OK,
                             cancelText: MESSAGES.COMMON.CANCEL,
                            onOk: () => {
                                onStatusChange(
                                    record.id,
                                    checked ? DataSourceStatus.ACTIVE : DataSourceStatus.DISABLED
                                );
                            },
                        });
                    }}
                />
            ),
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            ellipsis: true,
        },
        {
            title: '更新时间',
            dataIndex: 'updateTime',
            key: 'updateTime',
            ellipsis: true,
        },
        {
            title: '操作',
            key: 'action',
            width: 220,
            fixed: 'right' as const,
            render: (_: DataSourceStatus, record: DataSourceVO) => {
                const moreMenuItems = [
                    {
                        key: 'edit',
                        label: '编辑',
                        icon: <EditOutlined/>,
                        onClick: () => onEdit(record),
                    },
                    {
                        key: 'delete',
                        label: '删除',
                        icon: <DeleteOutlined/>,
                        danger: true,
                        onClick: () => onDelete(record.id),
                    },
                ];

                return (
                    <Space size={4}>
                        <Tooltip title="查看详情">
                            <Button
                                type="text"
                                icon={<EyeOutlined/>}
                                onClick={() => handleViewDetail(record)}
                                style={{color: token.colorPrimary}}
                            />
                        </Tooltip>
                        <Tooltip title={testingId === record.id ? '测试中...' : '测试连通性'}>
                            <Button
                                type="text"
                                icon={<ApiOutlined style={{color: testingId === record.id ? undefined : '#52c41a'}}/>}
                                loading={testingId === record.id}
                                onClick={() => handleTestConnection(record)}
                                style={{color: testingId === record.id ? undefined : '#52c41a'}}
                            />
                        </Tooltip>
                        <Dropdown menu={{items: moreMenuItems}} trigger={['click']}>
                            <Button
                                type="text"
                                icon={<MoreOutlined/>}
                            />
                        </Dropdown>
                    </Space>
                );
            },
        },
    ];

    return (
        <>
            <Table
                columns={columns}
                dataSource={data.map(item => ({...item, key: item.id}))}
                loading={loading}
                pagination={getTablePagination({
                    current: page,
                    pageSize,
                    total,
                    onChange: onPageChange,
                })}
                scroll={{x: 'max-content'}}
                style={{marginTop: token.marginSM}}
                rowSelection={selectedRowKeys !== undefined ? {
                    selectedRowKeys,
                    onChange: (keys, rows) => onSelectionChange?.(keys as string[], rows as DataSourceVO[]),
                    getCheckboxProps: getCheckboxProps ? (record) => getCheckboxProps(record as DataSourceVO) : undefined,
                } : undefined}
            />

            <DataSourceDetailDrawer
                visible={detailDrawerVisible}
                dataSource={currentDataSource}
                onClose={() => setDetailDrawerVisible(false)}
            />
        </>
    );
};

export default DataSourceTable;
