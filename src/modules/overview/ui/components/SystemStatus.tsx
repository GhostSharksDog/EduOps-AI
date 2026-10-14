import React from 'react';
import {Badge, Card, Col, Flex, Row, Typography} from 'antd';

const {Text} = Typography;

interface SystemStatusProps {
    className?: string;
}

const SystemStatus: React.FC<SystemStatusProps> = ({className}) => {
    return (
        <Card
            title="系统状态"
            className={className}
            styles={{
                body: {
                    padding: '20px',
                },
            }}
        >
            <Row gutter={[32, 16]}>
                <Col xs={24} sm={12} md={8}>
                    <Flex justify="space-between" align="center">
                        <Text>标签服务</Text>
                        <Badge status="success" text="正常"/>
                    </Flex>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Flex justify="space-between" align="center">
                        <Text>分群计算引擎</Text>
                        <Badge status="processing" text="运行中"/>
                    </Flex>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Flex justify="space-between" align="center">
                        <Text>数据同步</Text>
                        <Badge status="success" text="正常"/>
                    </Flex>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Flex justify="space-between" align="center">
                        <Text>API服务</Text>
                        <Badge status="success" text="正常"/>
                    </Flex>
                </Col>
                <Col xs={24} sm={12} md={8}>
                    <Flex justify="space-between" align="center">
                        <Text>存储容量</Text>
                        <Badge status="warning" text="78%"/>
                    </Flex>
                </Col>
            </Row>
        </Card>
    );
};

export default SystemStatus;
