import React from 'react';
import {Col, Flex, Row, Space, theme} from 'antd';
import TagUsageTrend from '@/shared/ui/dashboard/TagUsageTrend';
import TagCategoryDistribution from '@/shared/ui/dashboard/TagCategoryDistribution';
import RecentTagsTable from '@/modules/overview/ui/components/RecentTagsTable';
import RecentSegmentsTable from '@/modules/overview/ui/components/RecentSegmentsTable';
import RecentActivities from '@/modules/overview/ui/components/RecentActivities';
import DataModelStats from '@/shared/ui/dashboard/DataModelStats';
import DataSourceOverview from '@/shared/ui/dashboard/DataSourceOverview';
import SystemStatus from '@/modules/overview/ui/components/SystemStatus';

const DashboardMainContent: React.FC = () => {
    const {token} = theme.useToken();

    return (
        <Flex vertical gap={token.marginLG}>
            <Row gutter={[token.marginLG, token.marginLG]}>
                <Col xs={24} lg={16}>
                    <Space orientation="vertical" size={token.marginLG} style={{width: '100%'}}>
                        <TagUsageTrend/>
                        <Row gutter={[token.marginLG, token.marginLG]}>
                            <Col xs={24} md={12}>
                                <TagCategoryDistribution/>
                            </Col>
                            <Col xs={24} md={12}>
                                <DataSourceOverview/>
                            </Col>
                        </Row>
                    </Space>
                </Col>

                <Col xs={24} lg={8}>
                    <Space orientation="vertical" size={token.marginLG} style={{width: '100%'}}>
                        <RecentTagsTable />
                        <RecentSegmentsTable segments={[]}/>
                        <RecentActivities/>
                    </Space>
                </Col>
            </Row>

            <Row gutter={[token.marginLG, token.marginLG]}>
                <Col xs={24} lg={12}>
                    <DataModelStats/>
                </Col>
                <Col xs={24} lg={12}>
                    <SystemStatus/>
                </Col>
            </Row>
        </Flex>
    );
};

export default DashboardMainContent;
