'use client';

import React, {useMemo} from 'react';
import {Drawer, Descriptions, Tag, Typography, Button, Space, theme, Table} from 'antd';
import type {TargetTableVO} from '@/shared/schemas/response/target-table/index';
import {useTargetTableManagementStore} from '@/modules/tag/ui/state/targetTableManagementStore';
import {deserializeDDLResult} from '@/platform/ddl/index';
import type {DDLGenerateResult} from '@/platform/ddl/index';
import type {DimensionColumn} from '@/modules/tag/domain/value-objects/DimensionColumn';

const {Text} = Typography;

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

interface TargetTableDetailDrawerProps {
    selectedTable: TargetTableVO | null;
}

const TargetTableDetailDrawer: React.FC<TargetTableDetailDrawerProps> = ({selectedTable}) => {
    const {drawerVisible, closeDrawer} = useTargetTableManagementStore();
    const {token} = theme.useToken();

    const ddlResult: DDLGenerateResult | null = useMemo(() => {
        if (!selectedTable?.createTableSql) return null;
        return deserializeDDLResult(selectedTable.createTableSql);
    }, [selectedTable]);

    const parsedDimensionColumns: DimensionColumn[] = useMemo(() => {
        if (!selectedTable?.dimensionColumns) return [];
        try {
            return JSON.parse(selectedTable.dimensionColumns);
        } catch {
            return [];
        }
    }, [selectedTable?.dimensionColumns]);

    const parsedAggregateConfig = useMemo(() => {
        if (!selectedTable?.aggregateConfig) return null;
        try {
            return JSON.parse(selectedTable.aggregateConfig);
        } catch {
            return null;
        }
    }, [selectedTable?.aggregateConfig]);

    return (
        <Drawer
            title="目标表详情"
            placement="right"
            styles={{ wrapper: { width: 600 } }}
            open={drawerVisible}
            onClose={closeDrawer}
            footer={
                <Space>
                    <Button onClick={closeDrawer}>关闭</Button>
                </Space>
            }
        >
            {selectedTable && (
                <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="表名">
                        <Text code>{selectedTable.tableName}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="实体类型">
                        {selectedTable.entityType}
                    </Descriptions.Item>
                    <Descriptions.Item label="状态">
                        <Tag color={statusColors[selectedTable.status]}>
                            {statusLabels[selectedTable.status] || selectedTable.status}
                        </Tag>
                    </Descriptions.Item>
                    {selectedTable.errorMessage && (
                        <Descriptions.Item label="错误信息">
                            <Text type="danger">{selectedTable.errorMessage}</Text>
                        </Descriptions.Item>
                    )}
                    <Descriptions.Item label="表类型">
                        {selectedTable.tableType === 'PHYSICAL_TABLE' ? '物理表'
                            : selectedTable.tableType === 'VIEW' ? '视图'
                            : selectedTable.tableType === 'INTERMEDIATE' ? '中间表'
                            : '-'}
                    </Descriptions.Item>
                    {parsedDimensionColumns.length > 0 && (
                        <Descriptions.Item label="维度列">
                            <Table
                                size="small"
                                pagination={false}
                                dataSource={parsedDimensionColumns.map((col, i) => ({...col, key: i}))}
                                columns={[
                                    {title: '列名', dataIndex: 'name', key: 'name'},
                                    {title: '类型', dataIndex: 'type', key: 'type'},
                                    {title: '默认值', dataIndex: 'defaultExpression', key: 'defaultExpression', render: (v: string | undefined) => v ?? '-'},
                                    {title: '注释', dataIndex: 'comment', key: 'comment', render: (v: string | undefined) => v ?? '-'},
                                ]}
                            />
                        </Descriptions.Item>
                    )}
                    {parsedAggregateConfig && (
                        <Descriptions.Item label="聚合函数">
                            <Tag color="blue">{parsedAggregateConfig.functionName}</Tag>
                            <div style={{fontSize: 12, color: 'rgba(0,0,0,0.45)', marginTop: 4}}>
                                State: {parsedAggregateConfig.stateCombinator} / Merge: {parsedAggregateConfig.mergeCombinator}
                            </div>
                            <div style={{fontSize: 12, color: 'rgba(0,0,0,0.45)'}}>
                                列类型: {parsedAggregateConfig.columnType}
                            </div>
                        </Descriptions.Item>
                    )}
                    <Descriptions.Item label="关联标签ID">
                        {selectedTable.tagId || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="关联版本ID">
                        {selectedTable.tagVersionId || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="行数">
                        {selectedTable.rowCount?.toLocaleString() || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="激活时间">
                        {selectedTable.activatedAt
                            ? new Date(selectedTable.activatedAt).toLocaleString()
                            : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="停用时间">
                        {selectedTable.deactivatedAt
                            ? new Date(selectedTable.deactivatedAt).toLocaleString()
                            : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="最后刷新时间">
                        {selectedTable.lastRefreshTime
                            ? new Date(selectedTable.lastRefreshTime).toLocaleString()
                            : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                        {new Date(selectedTable.createTime).toLocaleString()}
                    </Descriptions.Item>
                    <Descriptions.Item label="更新时间">
                        {selectedTable.updateTime
                            ? new Date(selectedTable.updateTime).toLocaleString()
                            : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="建表SQL">
                        {ddlResult ? (
                            <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                                <pre style={{
                                    margin: 0, padding: 8,
                                    background: token.colorFillAlter, borderRadius: 4,
                                    fontSize: 12, overflow: 'auto', maxHeight: 300,
                                }}>
                                    {ddlResult.sql}
                                </pre>
                                <Descriptions column={2} size="small" bordered>
                                    <Descriptions.Item label="生成方式">{ddlResult.generatedBy}</Descriptions.Item>
                                    <Descriptions.Item label="标签值类型">{ddlResult.tagValueType ?? '-'}</Descriptions.Item>
                                </Descriptions>
                                {ddlResult.columns?.length > 0 && (
                                    <Table
                                        size="small"
                                        pagination={false}
                                        dataSource={ddlResult.columns.map((col, i) => ({...col, key: i}))}
                                        columns={[
                                            {title: '列名', dataIndex: 'name', key: 'name'},
                                            {title: '类型', dataIndex: 'type', key: 'type'},
                                            {title: '默认值', dataIndex: 'defaultExpression', key: 'defaultExpression', render: v => v ?? '-'},
                                            {title: '注释', dataIndex: 'comment', key: 'comment', render: v => v ?? '-'},
                                        ]}
                                    />
                                )}
                            </div>
                        ) : (
                            <pre style={{
                                margin: 0, padding: 8,
                                background: token.colorFillAlter, borderRadius: 4,
                                fontSize: 12, overflow: 'auto', maxHeight: 300,
                            }}>
                                {selectedTable.createTableSql}
                            </pre>
                        )}
                    </Descriptions.Item>
                </Descriptions>
            )}
        </Drawer>
    );
};

export default TargetTableDetailDrawer;
