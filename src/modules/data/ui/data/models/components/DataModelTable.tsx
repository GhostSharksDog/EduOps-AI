import React, {useState} from 'react';
import type {TableProps} from 'antd';
import {Button, Switch, Table, theme} from 'antd';
import {DeleteOutlined, EditOutlined, EyeOutlined} from '@ant-design/icons';
import type {DataModelVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import {DataModelStatus} from '@/modules/data/ui/data/models/constants/index';
import DataModelDetail from '@/modules/data/ui/data/models/components/DataModelDetail';
import DataModelConfirmModal from '@/modules/data/ui/data/models/components/DataModelConfirmModal';
import type {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {getTablePagination} from '@/shared/ui/dashboard/pagination/index';

interface DataModelTableProps {
    data: DataModelVO[];
    loading: boolean;
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number, pageSize: number) => void;
    onEdit: (model: DataModelVO) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: string) => void;
}

const DataModelTable: React.FC<DataModelTableProps> = ({
                                                           data,
                                                           loading,
                                                           total,
                                                           page,
                                                           pageSize,
                                                           onPageChange,
                                                           onEdit,
                                                           onDelete,
                                                           onStatusChange
                                                       }) => {
    const {token} = theme.useToken();
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedModel, setSelectedModel] = useState<DataModelVO | null>(null);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [confirmType, setConfirmType] = useState<'status' | 'delete'>('status');
    const [confirmData, setConfirmData] = useState<{
        id: string;
        status?: boolean;
        record?: DataModelVO;
    }>({id: ''});


    const handleViewDetail = (model: DataModelVO) => {
        setSelectedModel(model);
        setDetailVisible(true);
    };

    const handleStatusChange = (record: DataModelVO, checked: boolean) => {
        setConfirmType('status');
        setConfirmData({
            id: record.id,
            status: checked,
            record
        });
        setConfirmVisible(true);
    };

    const handleDelete = (id: string) => {
        setConfirmType('delete');
        setConfirmData({id});
        setConfirmVisible(true);
    };

    const handleConfirmOk = () => {
        if (confirmType === 'status' && confirmData.record) {
            const newStatus = confirmData.status ? DataModelStatus.ACTIVE : DataModelStatus.INACTIVE;
            onStatusChange(confirmData.id, newStatus);
        } else if (confirmType === 'delete') {
            onDelete(confirmData.id);
        }
        setConfirmVisible(false);
    };

    const handleConfirmCancel = () => {
        setConfirmVisible(false);
    };

    const formatDateTime = (dateTime: string) => {
        if (!dateTime) return '-';
        return new Date(dateTime).toLocaleString('zh-CN');
    };

    const columns: TableProps<DataModelVO>['columns'] = [
        {
            title: '模型名称',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
            width: 200,
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            width: 250,
            render: (text) => text || '-'
        },
        {
            title: '数据源',
            dataIndex: 'datasource',
            key: 'datasource',
            width: 150,
            render: (datasource: DataSourceVO) => datasource.name || '-'
        },
        {
            title: '表名',
            dataIndex: 'tableName',
            key: 'tableName',
            width: 150,
            render: (text) => text || '-'
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (_, record) => (
                <Switch
                    checked={record.status === DataModelStatus.ACTIVE}
                    onChange={(checked) => handleStatusChange(record, checked)}
                />
            ),
        },
        {
            title: '列数',
            key: 'columnCount',
            width: 80,
            render: (_, record) => record.columns?.length || 0,
        },
        {
            title: '创建时间',
            dataIndex: 'createTime',
            key: 'createTime',
            width: 160,
            render: formatDateTime
        },
        {
            title: '更新时间',
            dataIndex: 'updateTime',
            key: 'updateTime',
            width: 160,
            render: formatDateTime
        },
        {
            title: '操作',
            key: 'action',
            width: 160,
            fixed: 'right',
            render: (_, record) => (
                <>
                    <Button
                        type="link"
                        icon={<EyeOutlined/>}
                        onClick={() => handleViewDetail(record)}
                        style={{marginRight: token.marginXS}}
                    />
                    <Button
                        type="link"
                        icon={<EditOutlined/>}
                        onClick={() => onEdit(record)}
                        style={{marginRight: token.marginXS}}
                    />
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined/>}
                        onClick={() => handleDelete(record.id)}
                    />
                </>
            ),
        },
    ];

    return (
        <>
            <Table
                columns={columns}
                dataSource={data}
                rowKey="id"
                loading={loading}
                pagination={getTablePagination({
                    current: page,
                    pageSize,
                    total,
                    onChange: onPageChange,
                })}
                style={{marginTop: token.padding}}
                scroll={{x: 1400}}
            />
            <DataModelDetail
                visible={detailVisible}
                dataModel={selectedModel}
                onClose={() => setDetailVisible(false)}
            />
            <DataModelConfirmModal
                visible={confirmVisible}
                confirmType={confirmType}
                confirmData={confirmData}
                onOk={handleConfirmOk}
                onCancel={handleConfirmCancel}
            />
        </>
    );
};

export default DataModelTable;
