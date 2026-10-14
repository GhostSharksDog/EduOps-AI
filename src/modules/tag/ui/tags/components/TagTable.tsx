import React from 'react';
import {Badge, Button, Dropdown, Popover, Space, Table, Tag as AntTag, theme, Typography} from 'antd';
import {
    ApiOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    HistoryOutlined,
    MinusCircleOutlined,
    MoreOutlined,
    PlayCircleOutlined,
    SearchOutlined,
    StopOutlined,
    ToolOutlined
} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';

import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import type {TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {getTablePagination} from '@/shared/ui/dashboard/pagination/index';
import {globalMessage} from '@/shared/lib/message-service';
import {useAuthStore} from '@/modules/identity/client';
import styles from './TagTable.module.css';

const {Text, Paragraph} = Typography;

interface TagTableProps {
    data: TagVO[];
    loading: boolean;
    page: number;
    pageSize: number;
    onEdit: (record: TagVO) => void;
    onDelete: (id: string) => void;
    onStatusAction: (action: 'activate' | 'deactivate' | 'resume' | 'deprecate', record: TagVO) => void;
    onOpenVersionDrawer: (record: TagVO) => void;
    onValueQuery?: (record: TagVO) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (page: number, pageSize: number) => void;
    /** 批量选择：选中的行 keys，传入此属性启用批量选择 */
    selectedRowKeys?: string[];
    /** 批量选择：选择变化回调 */
    onSelectionChange?: (selectedRowKeys: string[], selectedRows: TagVO[]) => void;
    /** 批量选择：自定义 checkbox 属性 */
    getCheckboxProps?: (record: TagVO) => { disabled?: boolean; name?: string };
}

const getStatusConfig = (status: TagStatus) => {
    const configMap = {
        [TagStatus.ACTIVE]: {color: 'success', text: '已激活'},
        [TagStatus.INACTIVE]: {color: 'warning', text: '已停用'},
        [TagStatus.DRAFT]: {color: 'default', text: '草稿'},
        [TagStatus.DEPRECATED]: {color: 'error', text: '已废弃'},
    };
    return configMap[status] || {color: 'default', text: '未知'};
};


interface TagTableProps {
    data: TagVO[];
    loading: boolean;
    page: number;
    pageSize: number;
    onEdit: (record: TagVO) => void;
    onEditRule: (record: TagVO) => void;
    onDelete: (id: string) => void;
    onStatusAction: (action: 'activate' | 'deactivate' | 'resume' | 'deprecate', record: TagVO) => void;
    onOpenVersionDrawer: (record: TagVO) => void;
    onValueQuery?: (record: TagVO) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (page: number, pageSize: number) => void;
    /** 批量选择：选中的行 keys，传入此属性启用批量选择 */
    selectedRowKeys?: string[];
    /** 批量选择：选择变化回调 */
    onSelectionChange?: (selectedRowKeys: string[], selectedRows: TagVO[]) => void;
    /** 批量选择：自定义 checkbox 属性 */
    getCheckboxProps?: (record: TagVO) => { disabled?: boolean; name?: string };
}

const TagTable: React.FC<TagTableProps> = ({
                                               data,
                                               loading,
                                               page,
                                               pageSize,
                                               onEdit,
                                               onEditRule,
                                               onDelete,
                                               onStatusAction,
                                               onOpenVersionDrawer,
                                               onValueQuery,
                                               onPageChange,
                                               onPageSizeChange,
                                               selectedRowKeys,
                                               onSelectionChange,
                                               getCheckboxProps,
                                           }) => {
    const {token} = theme.useToken();
    const tenantId = useAuthStore(s => s.user?.ownedBy);
    const columns: ColumnsType<TagVO> = [
        {
            title: '标签名称',
            dataIndex: 'name',
            key: 'name',
            render: (text) => (
                <Space orientation="vertical" size={0}>
                    <Text className={styles.tagName}>{text}</Text>
                </Space>
            ),
        },
        {
            title: '值类型',
            dataIndex: 'dataType',
            key: 'dataType',
            render: (type: TagValueType) => <AntTag>{type}</AntTag>,
        },
        {
            title: '更新周期',
            dataIndex: 'updateCycle',
            key: 'updateCycle',
            render: (cycle: UpdateCycle) => <AntTag>{cycle===UpdateCycle.SNAPSHOT?'已确认快照':cycle}</AntTag>,
        },
        {
            title: '是否公开',
            dataIndex: 'isPublic',
            key: 'isPublic',
            render: (isPublic: boolean, record) => (
                <Space size={4}>
                    <AntTag color={isPublic ? 'green' : 'red'}>
                        {isPublic ? '是' : '否'}
                    </AntTag>
                    {isPublic && (
                        <Popover
                            title="公开 API"
                            trigger="click"
                            placement="left"
                            content={
                                <div style={{width: 440}}>
                                    <Paragraph type="secondary" style={{marginBottom: 8, fontSize: 12}}>
                                        外部系统可通过以下接口直接查询标签值，无需登录认证
                                    </Paragraph>
                                    <div style={{background: token.colorFillQuaternary, padding: 12, borderRadius: token.borderRadiusLG, marginBottom: 8}}>
                                        <Text strong style={{fontSize: 13}}>按 ID 查询</Text>
                                        <Paragraph code style={{fontSize: 12, margin: '4px 0 0'}}>
                                            {`GET /api/public/tags/values?tagId=${record.id}&entityIds=<实体ID>`}
                                        </Paragraph>
                                    </div>
                                    <div style={{background: token.colorFillQuaternary, padding: 12, borderRadius: token.borderRadiusLG, marginBottom: 8}}>
                                        <Text strong style={{fontSize: 13}}>按名称查询</Text>
                                        <Paragraph code style={{fontSize: 12, margin: '4px 0 0'}}>
                                            {`GET /api/public/tags/values?tagName=${record.name}&entityIds=<实体ID>`}
                                        </Paragraph>
                                    </div>
                                    {tenantId && (
                                        <div style={{background: token.colorWarningBg, padding: 8, borderRadius: token.borderRadiusSM, marginBottom: 8}}>
                                            <Text type="warning" style={{fontSize: 12}}>
                                                请求头需携带：<Text code style={{fontSize: 12}}>x-tenant-id: {tenantId}</Text>
                                            </Text>
                                        </div>
                                    )}
                                    <Button
                                        size="small"
                                        icon={<CopyOutlined/>}
                                        onClick={() => {
                                            const url = `/api/public/tags/values?tagId=${record.id}&entityIds=<实体ID>`;
                                            navigator.clipboard.writeText(url).then(() => {
                                                globalMessage.success('已复制 API 路径');
                                            });
                                        }}
                                    >
                                        复制 API 路径
                                    </Button>
                                </div>
                            }
                        >
                            <ApiOutlined style={{color: token.colorPrimary, cursor: 'pointer'}}/>
                        </Popover>
                    )}
                </Space>
            ),
        },
        {
            title: '分类',
            dataIndex: 'category',
            key: 'category',
            render: (category: { name?: string } | null) => (
                <AntTag color={category ? 'blue' : 'default'}>
                    {category?.name || '-'}
                </AntTag>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: TagStatus) => {
                const {color, text} = getStatusConfig(status);
                return <Badge className={styles.statusBadge} status={color as 'success' | 'warning' | 'default' | 'error'} text={text}/>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            render: (text) => text ? new Date(text).toLocaleString() : '-',
            width: 180,
        },
        {
            title: '操作',
            key: 'action',
            width: 180,
            fixed: 'right',
            render: (_, record) => (record.feature as {engine?:string})?.engine==='education-attendance-v1'?<Button href={'/dashboard/tags/risk?proposalId='+(record.feature as {proposalId:string}).proposalId}>查看规则与人群</Button>:(
                <Space size="small">
                    <Button
                        type="text"
                        icon={<HistoryOutlined/>}
                        size="small"
                        className={styles.actionButton}
                        onClick={() => onOpenVersionDrawer(record)}
                        title="版本管理"
                    />
                    <Button
                        type="text"
                        icon={<EditOutlined/>}
                        size="small"
                        className={styles.actionButton}
                        onClick={() => onEdit(record)}
                        title="编辑基本信息"
                    />
                    <Button
                        type="text"
                        icon={<ToolOutlined/>}
                        size="small"
                        className={styles.actionButton}
                        onClick={() => onEditRule(record)}
                        title="编辑规则"
                    />
                    <Dropdown
                        menu={{
                            items: [
                                {
                                    key: 'activate',
                                    label: '激活',
                                    icon: <CheckCircleOutlined/>,
                                    disabled: record.status === TagStatus.ACTIVE,
                                    onClick: () => onStatusAction('activate', record),
                                },
                                {
                                    key: 'deactivate',
                                    label: '停用',
                                    icon: <StopOutlined/>,
                                    disabled: record.status !== TagStatus.ACTIVE,
                                    onClick: () => onStatusAction('deactivate', record),
                                },
                                {
                                    key: 'resume',
                                    label: '恢复',
                                    icon: <PlayCircleOutlined/>,
                                    disabled: record.status !== TagStatus.INACTIVE,
                                    onClick: () => onStatusAction('resume', record),
                                },
                                {
                                    key: 'deprecate',
                                    label: '废弃',
                                    icon: <MinusCircleOutlined/>,
                                    disabled: record.status === TagStatus.DEPRECATED || record.status === TagStatus.DRAFT,
                                    onClick: () => onStatusAction('deprecate', record),
                                },
                                {
                                    key: 'valueQuery',
                                    label: '查询值',
                                    icon: <SearchOutlined/>,
                                    disabled: record.status !== TagStatus.ACTIVE,
                                    onClick: () => onValueQuery?.(record),
                                },
                                {
                                    type: 'divider',
                                },
                                {
                                    key: 'delete',
                                    label: '删除',
                                    icon: <DeleteOutlined/>,
                                    danger: true,
                                    disabled: record.status !== TagStatus.DRAFT && record.status !== TagStatus.INACTIVE && record.status !== TagStatus.DEPRECATED,
                                    onClick: () => onDelete(record.id),
                                },
                            ],
                        }}
                    >
                        <Button
                            type="text"
                            icon={<MoreOutlined/>}
                            size="small"
                            className={styles.actionButton}
                            title="更多操作"
                        />
                    </Dropdown>
                </Space>
            ),
        },
    ];

    return (
        <div className={styles.tableContainer}>
            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                scroll={{x: 1000}}
                rowSelection={selectedRowKeys !== undefined ? {
                    selectedRowKeys,
                    onChange: (keys, rows) => {
                        onSelectionChange?.(keys as string[], rows as TagVO[]);
                    },
                    getCheckboxProps,
                } : undefined}
                pagination={getTablePagination({
                    current: page,
                    pageSize,
                    total: data.length,
                    onChange: onPageSizeChange,
                })}
            />
        </div>
    );
};

export default TagTable;
