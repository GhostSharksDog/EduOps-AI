import React from 'react';
import {Button, Card, Flex, Tag, Timeline, theme, Typography, Skeleton} from 'antd';
import {CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined,} from '@ant-design/icons';
import Link from 'next/link';
import {useRecentActivities} from '@/modules/overview/ui/hooks/useDashboardData';

const {Text} = Typography;

interface RecentActivitiesProps {
    className?: string;
}

const RecentActivities: React.FC<RecentActivitiesProps> = ({className}) => {
    const { token } = theme.useToken();
    const {data, isLoading} = useRecentActivities(1, 5);

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'create':
                return <PlusOutlined style={{color: token.colorSuccess}}/>;
            case 'update':
                return <EditOutlined style={{color: token.colorPrimary}}/>;
            case 'delete':
                return <DeleteOutlined style={{color: token.colorError}}/>;
            case 'sync':
                return <SyncOutlined style={{color: token.colorWarning}}/>;
            case 'approve':
                return <CheckCircleOutlined style={{color: token.colorInfo}}/>;
            default:
                return <SyncOutlined style={{color: token.colorWarning}}/>;
        }
    };

    const getActivityTag = (type: string) => {
        const colors: Record<string, string> = {
            create: 'green',
            update: 'blue',
            delete: 'red',
            sync: 'orange',
            approve: 'purple',
        };
        const labels: Record<string, string> = {
            create: '新建',
            update: '更新',
            delete: '删除',
            sync: '同步',
            approve: '审批',
        };
        return <Tag color={colors[type] || 'default'}>{labels[type] || type}</Tag>;
    };

    if (isLoading || !data?.items) {
        return (
            <Card
                title="最近活动"
                extra={
                    <Link href="/dashboard/system/audit-logs">
                        <Button type="link" size="small">
                            查看全部
                        </Button>
                    </Link>
                }
                className={className}
                styles={{
                    body: {
                        padding: '16px',
                    },
                }}
            >
                <Flex vertical gap={8}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} active paragraph={{ rows: 3 }} />
                    ))}
                </Flex>
            </Card>
        );
    }

    const formatActivity = (activity: typeof data.items[0]) => {
        const entityName = activity.metadata?.entityName || activity.entityId || '-';
        const description = `${activity.action} ${activity.entity}${entityName !== '-' ? ` - ${entityName}` : ''}`;
        const timeAgo = getTimeAgo(new Date(activity.createdAt));
        
        return {
            ...activity,
            description,
            entityName,
            timeAgo,
        };
    };

    const getTimeAgo = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}天前`;
        if (hours > 0) return `${hours}小时前`;
        if (minutes > 0) return `${minutes}分钟前`;
        return '刚刚';
    };

    return (
        <Card
            title="最近活动"
            extra={
                <Link href="/dashboard/system/audit-logs">
                    <Button type="link" size="small">
                        查看全部
                    </Button>
                </Link>
            }
            className={className}
            styles={{
                body: {
                    padding: '16px',
                },
            }}
        >
            <Timeline
                mode="start"
                items={data.items.map((activity) => {
                    const formatted = formatActivity(activity);
                    return {
                        icon: getActivityIcon(activity.action),
                        content: (
                            <Flex key={activity.id} vertical gap={4}>
                                <Flex justify="space-between" align="center">
                                    <Flex align="center" gap={8}>
                                        {getActivityTag(activity.action)}
                                        <Text strong style={{fontSize: 13}}>
                                            {formatted.description}
                                        </Text>
                                    </Flex>
                                    <Text type="secondary" style={{fontSize: 12}}>
                                        {formatted.timeAgo}
                                    </Text>
                                </Flex>
                                <Flex gap={8} align="center">
                                    <Text type="secondary" style={{fontSize: 12}}>
                                        {activity.actorUsername || '系统'}
                                    </Text>
                                </Flex>
                            </Flex>
                        ),
                    };
                })}
            />
        </Card>
    );
};

export default RecentActivities;
