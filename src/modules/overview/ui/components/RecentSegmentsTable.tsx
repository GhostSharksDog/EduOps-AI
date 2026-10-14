import React from 'react';
import {Badge, Card, Table} from 'antd';
import Link from 'next/link';
import type {SegmentListItemVO} from '@/modules/segment/contracts';
import {SegmentStatus} from '@/shared/enums/index';

interface RecentSegmentsTableProps {
    segments: SegmentListItemVO[];
}

const RecentSegmentsTable: React.FC<RecentSegmentsTableProps> = ({segments}) => {
    const columns = [
        {
            title: '分群名称',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            render: (type: string) => type === 'condition' ? '规则分群' : '手动分群',
        },
        {
            title: '人数',
            dataIndex: 'memberCount',
            key: 'memberCount',
            render: (count: number) => (count || 0).toLocaleString(),
        },
        {
            title: '状态',
            key: 'status',
            render: (record: SegmentListItemVO) => {
                let status: 'success' | 'processing' | 'default' = 'default';
                let text = '停用';
                if (record.status === SegmentStatus.ACTIVE) {
                    status = 'success';
                    text = '活跃';
                }
                return <Badge status={status} text={text}/>;
            },
        },
    ];

    return (
        <Card
            title="最近分群"
            extra={<Link href="/dashboard/segments">全部</Link>}
            styles={{
                body: {
                    padding: '16px',
                },
            }}
        >
            <Table
                dataSource={segments}
                columns={columns}
                pagination={false}
                rowKey="id"
                size="small"
            />
        </Card>
    );
};

export default RecentSegmentsTable;
