'use client';

import React from 'react';
import {Card, Typography, Skeleton, Descriptions, Empty} from 'antd';
import type {DDLGenerateResult} from '@/platform/ddl/index';

const {Text} = Typography;

interface DDLPreviewProps {
    ddlResult: DDLGenerateResult | null;
    isLoading?: boolean;
}

const DDLPreview: React.FC<DDLPreviewProps> = ({ddlResult, isLoading}) => {
    if (isLoading) {
        return (
            <Card>
                <Skeleton active paragraph={{rows: 8}} />
            </Card>
        );
    }

    if (!ddlResult) {
        return (
            <Card>
                <Empty description="请选择标签后生成 DDL 预览" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
        );
    }

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <Card
                title="SQL DDL"
                size="small"
                extra={
                    <Text
                        copyable={{text: ddlResult.sql, tooltips: ['复制 SQL', '已复制']}}
                        style={{fontSize: 12}}
                    >
                        复制
                    </Text>
                }
            >
                <pre
                    style={{
                        background: '#1e1e1e',
                        color: '#d4d4d4',
                        padding: 16,
                        borderRadius: 6,
                        overflow: 'auto',
                        fontSize: 13,
                        lineHeight: 1.6,
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                    }}
                >
                    {ddlResult.sql}
                </pre>
            </Card>

            <Card title="元数据" size="small">
                <Descriptions column={1} size="small" bordered>
                    <Descriptions.Item label="生成方式">
                        {ddlResult.generatedBy}
                    </Descriptions.Item>
                    <Descriptions.Item label="标签值类型">
                        {ddlResult.tagValueType}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            <Card title="列定义" size="small">
                <Descriptions column={1} size="small" bordered>
                    {ddlResult.columns.map((col) => (
                        <Descriptions.Item
                            key={col.name}
                            label={
                                <Text strong style={{fontFamily: 'monospace'}}>
                                    {col.name}
                                </Text>
                            }
                        >
                            <div style={{display: 'flex', flexDirection: 'column', gap: 2}}>
                                <Text code style={{fontSize: 12}}>
                                    {col.type}
                                </Text>
                                {col.defaultExpression && (
                                    <Text type="secondary" style={{fontSize: 12}}>
                                        DEFAULT {col.defaultExpression}
                                    </Text>
                                )}
                                {col.comment && (
                                    <Text type="secondary" style={{fontSize: 12}}>
                                        {col.comment}
                                    </Text>
                                )}
                            </div>
                        </Descriptions.Item>
                    ))}
                </Descriptions>
            </Card>
        </div>
    );
};

export default DDLPreview;
