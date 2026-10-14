import React from 'react';
import {Button, Flex, Progress, Space, Table, Tag, theme, Typography} from 'antd';
import {CheckCircleOutlined, CloseCircleOutlined, FileTextOutlined, HistoryOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import type {ImportTask} from '@/modules/data/ui/state/dataImportStore';
import {getTablePagination} from '@/shared/ui/dashboard/pagination/index';
import TableCard from '@/shared/ui/dashboard/TableCard/index';

const {Text} = Typography;

interface ImportHistoryProps {
    importTasks: ImportTask[];
    onViewDetails: (record: ImportTask) => void;
}

const ImportHistory: React.FC<ImportHistoryProps> = ({
                                                         importTasks,
                                                         onViewDetails,
                                                     }) => {
    const {token} = theme.useToken();

    const taskColumns: ColumnsType<ImportTask> = [
        {
            title: '文件名',
            dataIndex: 'fileName',
            key: 'fileName',
            render: (text) => (
                <Space>
                    <FileTextOutlined/>
                    <Text>{text}</Text>
                </Space>
            ),
        },
        {
            title: '数据类型',
            dataIndex: 'dataType',
            key: 'dataType',
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: 'pending' | 'processing' | 'success' | 'error') => {
                const statusConfig = {
                    pending: {color: 'default', text: '等待中', icon: <FileTextOutlined/>},
                    processing: {color: 'processing', text: '处理中', icon: <FileTextOutlined/>},
                    success: {color: 'success', text: '成功', icon: <CheckCircleOutlined/>},
                    error: {color: 'error', text: '失败', icon: <CloseCircleOutlined/>},
                };
                const config = statusConfig[status];
                return <Tag icon={config.icon} color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: '进度',
            dataIndex: 'progress',
            key: 'progress',
            render: (progress, record) => (
                <Flex vertical gap={token.marginXXS} style={{width: 150}}>
                    <Progress percent={progress} size="small"
                              status={record.status === 'error' ? 'exception' : undefined}/>
                    <Text type="secondary" style={{fontSize: token.fontSize}}>
                        {record.successCount.toLocaleString()} / {record.errorCount.toLocaleString()}
                    </Text>
                </Flex>
            ),
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (text) => new Date(text).toLocaleString(),
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Button type="link" onClick={() => onViewDetails(record)}>
                    查看详情
                </Button>
            ),
        },
    ];

    return (
        <div style={{marginTop: token.marginLG}}>
            <TableCard
                title="导入历史"
                icon={<HistoryOutlined />}
                total={importTasks.length}
                table={
                    <Table
                        columns={taskColumns}
                        dataSource={importTasks}
                        rowKey="id"
                        pagination={getTablePagination()}
                    />
                }
            />
        </div>
    );
};

export default ImportHistory;
