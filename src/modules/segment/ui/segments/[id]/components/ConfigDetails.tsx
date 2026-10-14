import React from 'react';
import {Card, Descriptions} from 'antd';


interface ConfigDetailsProps {
    segmentInfo: Record<string, unknown> | null;
}

const ConfigDetails: React.FC<ConfigDetailsProps> = ({segmentInfo}) => {
    const getDisplayValue = (value: unknown): React.ReactNode => {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'string' || typeof value === 'number') return value;
        return String(value);
    };

    return (
        <Card variant="borderless">
            <Descriptions title="基本信息" bordered column={2}>
                <Descriptions.Item label="分群ID">{getDisplayValue(segmentInfo?.id)}</Descriptions.Item>
                <Descriptions.Item label="分群编码">{getDisplayValue(segmentInfo?.code)}</Descriptions.Item>
                <Descriptions.Item label="创建人">{getDisplayValue(segmentInfo?.creator)}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{getDisplayValue(segmentInfo?.createdAt)}</Descriptions.Item>
                <Descriptions.Item label="计算调度">{getDisplayValue(segmentInfo?.schedule)}</Descriptions.Item>
                <Descriptions.Item label="最近更新">{getDisplayValue(segmentInfo?.updatedAt)}</Descriptions.Item>
                <Descriptions.Item label="规则描述" span={2}>
                    {getDisplayValue(segmentInfo?.description)}
                </Descriptions.Item>
            </Descriptions>
        </Card>
    );
};

export default ConfigDetails;
