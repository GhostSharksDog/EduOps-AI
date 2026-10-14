'use client';

import React from 'react';
import {Button, DatePicker, Space, theme} from 'antd';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import {BarChartOutlined} from '@ant-design/icons';

import PageHeader from '@/shared/ui/dashboard/PageHeader';

const TagAnalysisPage: React.FC = () => {
    const {token} = theme.useToken();

    const buttonStyle: React.CSSProperties = {
        height: '44px',
        paddingInline: '24px',
        fontSize: '15px',
        fontWeight: 500,
        borderRadius: token.borderRadiusLG,
    };

    const primaryButtonStyle: React.CSSProperties = {
        ...buttonStyle,
        background: `linear-gradient(135deg, ${token.colorInfo} 0%, ${token.colorInfoHover} 100%)`,
        border: 'none',
        boxShadow: token.boxShadow,
    };

    return (
        <PageContainer>
            <PageHeader
                title="数据分析"
                description="标签使用情况与数据质量监控，洞察标签价值与分布"
                icon={<BarChartOutlined/>}
                customActions={
                    <Space>
                        <DatePicker.RangePicker style={buttonStyle}/>
                        <Button type="primary" style={primaryButtonStyle}>导出报告</Button>
                    </Space>
                }
            />
        </PageContainer>
    );
};

export default TagAnalysisPage;
