import React from 'react';
import {Card, Col, Progress, Row, Statistic, theme} from 'antd';
import {
    CheckCircleOutlined,
    FallOutlined,
    LineChartOutlined,
    RiseOutlined,
    TagOutlined,
    WarningOutlined
} from '@ant-design/icons';


const MetricsCards: React.FC = () => {
    const {token} = theme.useToken();

    return (
        <Row gutter={[token.marginXL, token.marginXL]} style={{marginBottom: token.marginXL}}>
            <Col span={6}>
                <Card variant="borderless">
                    <Statistic
                        title="标签总调用量"
                        value={1258900}
                        prefix={<LineChartOutlined/>}
                        styles={{content: {color: token.colorPrimary}}}
                        suffix={<span style={{fontSize: token.fontSizeSM, color: token.colorSuccess}}><RiseOutlined/> +12%</span>}
                    />
                    <div style={{
                        marginTop: token.marginSM,
                        fontSize: token.fontSizeSM,
                        color: token.colorTextSecondary
                    }}>较上周增长12.5%
                    </div>
                </Card>
            </Col>
            <Col span={6}>
                <Card variant="borderless">
                    <Statistic
                        title="活跃标签覆盖率"
                        value={85.2}
                        precision={1}
                        suffix="%"
                        prefix={<CheckCircleOutlined/>}
                        styles={{content: {color: token.colorSuccess}}}
                    />
                    <Progress percent={85.2} showInfo={false} strokeColor={token.colorSuccess} size="small"
                              style={{margin: `${token.marginSM} 0`}}/>
                </Card>
            </Col>
            <Col span={6}>
                <Card variant="borderless">
                    <Statistic
                        title="数据异常率"
                        value={0.8}
                        precision={2}
                        prefix={<WarningOutlined/>}
                        styles={{content: {color: token.colorWarning}}}
                        suffix={<span style={{fontSize: token.fontSizeSM, color: token.colorSuccess}}><FallOutlined/> -0.2%</span>}
                    />
                    <div style={{
                        marginTop: token.marginSM,
                        fontSize: token.fontSizeSM,
                        color: token.colorTextSecondary
                    }}>较上周下降0.2%
                    </div>
                </Card>
            </Col>
            <Col span={6}>
                <Card variant="borderless">
                    <Statistic
                        title="新增标签数"
                        value={12}
                        prefix={<TagOutlined/>}
                        styles={{content: {color: token.colorPrimary}}}
                    />
                    <div style={{
                        marginTop: token.marginSM,
                        fontSize: token.fontSizeSM,
                        color: token.colorTextSecondary
                    }}>本周新增
                    </div>
                </Card>
            </Col>
        </Row>
    );
};

export default MetricsCards;
