import React from 'react';
import {Card, Col, Row, Statistic} from 'antd';
import {StatCard as StatCardType} from '@/modules/overview/ui/state/dashboardStore';

interface StatCardsProps {
    statCards: StatCardType[];
}

const StatCards: React.FC<StatCardsProps> = ({statCards}) => {
    return (
        <Row gutter={[16, 16]}>
            {statCards.map((card, index) => (
                <Col key={index} xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title={card.title}
                            value={card.value}
                            precision={0}
                            prefix={card.icon}
                            suffix={card.change > 0 ? <span className="changeText">+{card.change}%</span> : ''}
                            styles={{
                                content: {
                                    fontSize: '24px',
                                    fontWeight: 'bold',
                                },
                            }}
                        />
                    </Card>
                </Col>
            ))}
        </Row>
    );
};

export default StatCards;
