import React from 'react';
import {Card, Col, Flex, Row, theme, Typography} from 'antd';
import {BarChartOutlined, LineChartOutlined, PieChartOutlined} from '@ant-design/icons';


const {Text} = Typography;

const ChartsSection: React.FC = () => {
    const {token} = theme.useToken();

    return (
        <>
            <Row gutter={[token.marginXL, token.marginXL]} style={{marginBottom: token.marginXL}}>
                <Col span={8}>
                    <Card title="标签类型分布" variant="borderless" styles={{body: {height: '100%'}}}>
                        <Flex style={{
                            height: '300px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            background: token.colorFillContent,
                            borderRadius: token.borderRadius
                        }} vertical align="center" justify="center">
                            <PieChartOutlined
                                style={{fontSize: '64px', color: '#d9d9d9', marginBottom: token.marginLG}}/>
                            <Text style={{color: token.colorTextSecondary}}>饼图区域：简单标签vs 计算标签</Text>
                        </Flex>
                    </Card>
                </Col>
                <Col span={16}>
                    <Card title="标签调用趋势 (30天)" variant="borderless" styles={{body: {height: '100%'}}}>
                        <Flex style={{
                            height: '300px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            background: token.colorFillContent,
                            borderRadius: token.borderRadius
                        }} vertical align="center" justify="center">
                            <LineChartOutlined
                                style={{fontSize: '64px', color: '#d9d9d9', marginBottom: token.marginLG}}/>
                            <Text style={{color: token.colorTextSecondary}}>折线图区域：每日API调用量趋势</Text>
                        </Flex>
                    </Card>
                </Col>
            </Row>
            <Row gutter={[token.marginXL, token.marginXL]}>
                <Col span={12}>
                    <Card title="计算标签耗时排行" variant="borderless">
                        <Flex style={{
                            height: '300px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            background: token.colorFillContent,
                            borderRadius: token.borderRadius
                        }} vertical align="center" justify="center">
                            <BarChartOutlined
                                style={{fontSize: '64px', color: '#d9d9d9', marginBottom: token.marginLG}}/>
                            <Text style={{color: token.colorTextSecondary}}>柱状图区域：计算耗时 (ms)</Text>
                        </Flex>
                    </Card>
                </Col>
            </Row>
        </>
    );
};

export default ChartsSection;
