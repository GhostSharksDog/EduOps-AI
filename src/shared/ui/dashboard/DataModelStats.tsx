import React from 'react';
import {Card, Col, Flex, Progress, Row, theme, Typography} from 'antd';
import {ApiOutlined, DatabaseOutlined, RiseOutlined, TableOutlined,} from '@ant-design/icons';

const {Text} = Typography;

interface DataModelStatsProps {
    className?: string;
}

const DataModelStats: React.FC<DataModelStatsProps> = ({className}) => {
    const { token } = theme.useToken();
    
    return (
        <Card
            title="数据模型统计"
            className={className}
            styles={{
                body: {
                    padding: '16px',
                },
            }}
        >
            <Row gutter={[16, 16]}>
                <Col xs={12} sm={6}>
                    <Flex vertical align="center" gap={4}>
                        <DatabaseOutlined style={{fontSize: 24, color: token.colorPrimary}}/>
                        <Text type="secondary" style={{fontSize: 12}}>
                            数据模型
                        </Text>
                        <Text strong style={{fontSize: 20}}>18</Text>
                    </Flex>
                </Col>
                <Col xs={12} sm={6}>
                    <Flex vertical align="center" gap={4}>
                        <TableOutlined style={{fontSize: 24, color: '#52c41a'}}/>
                        <Text type="secondary" style={{fontSize: 12}}>
                            数据表
                        </Text>
                        <Text strong style={{fontSize: 20}}>156</Text>
                    </Flex>
                </Col>
                <Col xs={12} sm={6}>
                    <Flex vertical align="center" gap={4}>
                        <ApiOutlined style={{fontSize: 24, color: '#faad14'}}/>
                        <Text type="secondary" style={{fontSize: 12}}>
                            API接口
                        </Text>
                        <Text strong style={{fontSize: 20}}>42</Text>
                    </Flex>
                </Col>
                <Col xs={12} sm={6}>
                    <Flex vertical align="center" gap={4}>
                        <RiseOutlined style={{fontSize: 24, color: '#eb2f96'}}/>
                        <Text type="secondary" style={{fontSize: 12}}>
                            使用率
                        </Text>
                        <Text strong style={{fontSize: 20}}>87%</Text>
                    </Flex>
                </Col>
            </Row>
            <Flex vertical gap={8} style={{marginTop: 16}}>
                <Flex justify="space-between" align="center">
                    <Text type="secondary" style={{fontSize: 12}}>
                        数据完整度
                    </Text>
                    <Text strong style={{fontSize: 12}}>92%</Text>
                </Flex>
                <Progress percent={92} size="small" showInfo={false} strokeColor="#52c41a"/>
            </Flex>
            <Flex vertical gap={8} style={{marginTop: 8}}>
                <Flex justify="space-between" align="center">
                    <Text type="secondary" style={{fontSize: 12}}>
                        标签覆盖率
                    </Text>
                    <Text strong style={{fontSize: 12}}>78%</Text>
                </Flex>
                <Progress percent={78} size="small" showInfo={false} strokeColor={token.colorPrimary}/>
            </Flex>
        </Card>
    );
};

export default DataModelStats;
