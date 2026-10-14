import React from 'react';
import {Button, Card, Flex, Space, Typography} from 'antd';
import {BarChartOutlined} from '@ant-design/icons';

const {Text} = Typography;

interface TagUsageTrendProps {
    className?: string;
}

const TagUsageTrend: React.FC<TagUsageTrendProps> = ({className}) => {
    return (
        <Card
            title="标签使用趋势"
            extra={
                <Space>
                    <Button size="small">日</Button>
                    <Button type="primary" size="small">周</Button>
                    <Button size="small">月</Button>
                </Space>
            }
            className={className}
            styles={{
                body: {
                    padding: '20px',
                },
            }}
        >
            <Flex vertical align="center" justify="center" className="h-[300px]">
                <BarChartOutlined style={{fontSize: '64px'}}/>
                <Text className="mt-4">图表区域</Text>
            </Flex>
        </Card>
    );
};

export default TagUsageTrend;
