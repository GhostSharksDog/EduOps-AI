'use client';

import React, {useState} from 'react';
import {Card, theme, Typography} from 'antd';
import {AuditOutlined} from '@ant-design/icons';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import AuditLogsTable from '@/modules/system/ui/system/audit-logs/components/AuditLogsTable';
import AuditLogsFilter from '@/modules/system/ui/system/audit-logs/components/AuditLogsFilter';
import {useAuditLogs} from '@/modules/system/ui/system/audit-logs/hooks/useAuditLogs';
import type {AuditLogListVO} from '@/shared/schemas/response/audit-log/index';
import {usePageSize} from '@/shared/ui/dashboard/pagination/index';

const {Text} = Typography;

const AuditLogsView: React.FC = () => {
    const {token} = theme.useToken();
    const {pageSize, setPageSize} = usePageSize();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<{
        action?: string;
        entity?: string;
        actorId?: string;
        startTime?: string;
        endTime?: string;
    }>({});

    const {data, isLoading} = useAuditLogs({page, pageSize, ...filters}) as {
        data: AuditLogListVO | undefined;
        isLoading: boolean;
    };

    const handleFilterChange = (newFilters: typeof filters) => {
        setFilters(newFilters);
        setPage(1);
    };

    const handlePageChange = (newPage: number, newPageSize: number) => {
        setPage(newPage);
        setPageSize(newPageSize);
    };

    return (
        <div style={{padding: token.marginLG}}>
            <PageHeader
                title="审计日志"
                description="查看系统操作记录"
            />
            <Card
                variant="borderless"
                styles={{body: {padding: 0}}}
                style={{
                    borderRadius: token.borderRadiusLG,
                    border: `1px solid ${token.colorBorder}`,
                    boxShadow: token.boxShadowSecondary,
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        background: token.colorBgContainer,
                        padding: `${token.paddingMD}px ${token.paddingLG}px`,
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginSM,
                    }}>
                        <AuditOutlined style={{color: token.colorInfo, fontSize: '18px'}} />
                        <span style={{
                            fontSize: '15px',
                            fontWeight: 500,
                            color: token.colorTextHeading,
                        }}>
                            操作记录
                        </span>
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: token.marginMD,
                    }}>
                        <AuditLogsFilter onFilterChange={handleFilterChange} />
                        <span style={{
                            fontSize: '12px',
                            color: token.colorTextSecondary,
                        }}>
                            共 <Text strong style={{color: token.colorText}}>{data?.total ?? 0}</Text> 条记录
                        </span>
                    </div>
                </div>
                <div style={{background: token.colorBgContainer, padding: token.paddingMD}}>
                    <AuditLogsTable
                        data={data?.items ?? []}
                        loading={isLoading}
                        total={data?.total ?? 0}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                    />
                </div>
            </Card>
        </div>
    );
};

export default AuditLogsView;
