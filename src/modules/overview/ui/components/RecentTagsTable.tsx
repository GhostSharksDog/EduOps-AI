import React from 'react';
import {Badge, Card, Table, Skeleton} from 'antd';
import Link from 'next/link';
import type {TagVO} from '@/modules/tag/contracts';
import {TagStatus} from '@/shared/enums/index';
import {useRecentTags} from '@/modules/overview/ui/hooks/useDashboardData';

interface CategoryInfo {
    name: string;
}

interface RecentTagsTableProps {
    tags?: TagVO[];
}

const RecentTagsTable: React.FC<RecentTagsTableProps> = () => {
    const {data, isLoading} = useRecentTags(1, 5);

    const columns = [
        {
            title: '标签名称',
            dataIndex: 'name',
            key: 'name',
            ellipsis: true,
        },
        {
            title: '分类',
            dataIndex: 'category',
            key: 'category',
            ellipsis: true,
            render: (category: CategoryInfo | null) => category?.name || '-',
        },
        {
            title: '更新时间',
            dataIndex: 'updateTime',
            key: 'updateTime',
        },
        {
            title: '状态',
            key: 'status',
            render: (record: TagVO) => (
                <Badge status={record.status === TagStatus.ACTIVE ? 'success' : 'default'}
                       text={record.status === TagStatus.ACTIVE ? '活跃' : '非活跃'}/>
            ),
        },
    ];

    if (isLoading || !data?.items) {
        return (
            <Card
                title="最近标签"
                extra={<Link href="/dashboard/tags">全部</Link>}
                styles={{
                    body: {
                        padding: '16px',
                    },
                }}
            >
                <Table
                    dataSource={[]}
                    columns={columns}
                    pagination={false}
                    rowKey="id"
                    size="small"
                    loading
                />
            </Card>
        );
    }

    return (
        <Card
            title="最近标签"
            extra={<Link href="/dashboard/tags">全部</Link>}
            styles={{
                body: {
                    padding: '16px',
                },
            }}
        >
            <Table
                dataSource={data.items}
                columns={columns}
                pagination={false}
                rowKey="id"
                size="small"
            />
        </Card>
    );
};

export default RecentTagsTable;
