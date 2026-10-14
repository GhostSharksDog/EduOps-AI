'use client';

import React, {useMemo} from 'react';
import {Card, Col, Row, Statistic, theme} from 'antd';
import {CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined, DatabaseOutlined} from '@ant-design/icons';
import type {MvStatusReport} from '@/modules/tag/ui/tags/monitor/hooks/useTagMonitor';

interface StatusSummaryProps {
    statusData: MvStatusReport[];
}

const StatusSummary: React.FC<StatusSummaryProps> = ({statusData}) => {
    const {token} = theme.useToken();
    
    const summary = useMemo(() => ({
        total: statusData.length,
        healthy: statusData.filter(r => r.status === 'healthy').length,
        warning: statusData.filter(r => r.status === 'warning').length,
        error: statusData.filter(r => r.status === 'error').length,
    }), [statusData]);

    return (
        <Row gutter={16} style={{marginBottom: 24}}>
            <Col span={6}>
                <Card>
                    <Statistic
                        title="正常"
                        value={summary.healthy}
                        prefix={<CheckCircleOutlined style={{color: token.colorSuccess}} />}
                        styles={{ content: { color: token.colorSuccess } }}
                    />
                </Card>
            </Col>
            <Col span={6}>
                <Card>
                    <Statistic
                        title="警告"
                        value={summary.warning}
                        prefix={<ExclamationCircleOutlined style={{color: token.colorWarning}} />}
                        styles={{ content: { color: token.colorWarning } }}
                    />
                </Card>
            </Col>
            <Col span={6}>
                <Card>
                    <Statistic
                        title="错误"
                        value={summary.error}
                        prefix={<CloseCircleOutlined style={{color: token.colorError}} />}
                        styles={{ content: { color: token.colorError } }}
                    />
                </Card>
            </Col>
            <Col span={6}>
                <Card>
                    <Statistic
                        title="总数"
                        value={summary.total}
                        prefix={<DatabaseOutlined style={{color: token.colorPrimary}} />}
                    />
                </Card>
            </Col>
        </Row>
    );
};

export default StatusSummary;
