import React from 'react';
import {Button, Card, Col, Row, theme, Tooltip, Typography} from 'antd';
import {
    BarChartOutlined,
    FileTextOutlined,
    PlusOutlined,
    QuestionCircleOutlined,
    SettingOutlined,
    TeamOutlined,
} from '@ant-design/icons';
import {useRouter} from 'next/navigation';

const {Text} = Typography;

interface QuickActionsProps {
    className?: string;
}

interface ActionItem {
    key: string;
    label: string;
    icon: React.ReactNode;
    path: string;
    description: string;
    color: string;
}

const QuickActions: React.FC<QuickActionsProps> = ({className}) => {
    const router = useRouter();
    const { token } = theme.useToken();

    const actions: ActionItem[] = [
        {
            key: 'createTag',
            label: '新建标签',
            icon: <PlusOutlined/>,
            path: '/dashboard/tags',
            description: '创建新的标签',
            color: token.colorPrimary,
        },
        {
            key: 'createSegment',
            label: '创建分群',
            icon: <TeamOutlined/>,
            path: '/dashboard/segments/risk',
            description: '从出勤风险标签建立人群快照',
            color: '#52c41a',
        },
        {
            key: 'importData',
            label: '数据导入',
            icon: <FileTextOutlined/>,
            path: '/dashboard/data/import',
            description: '批量导入数据',
            color: '#faad14',
        },
        {
            key: 'analysis',
            label: '经营指标',
            icon: <BarChartOutlined/>,
            path: '/dashboard/analytics',
            description: '查看分析数据',
            color: '#eb2f96',
        },
        {
            key: 'dataSources',
            label: '数据源管理',
            icon: <SettingOutlined/>,
            path: '/dashboard/data/sources',
            description: '管理数据连接',
            color: '#722ed1',
        },
        {
            key: 'help',
            label: '业务知识',
            icon: <QuestionCircleOutlined/>,
            path: '/dashboard/knowledge',
            description: '查询指标口径和运营制度',
            color: '#13c2c2',
        },
    ];

    const handleAction = (path: string) => {
        router.push(path);
    };

    return (
        <Card
            title="快捷操作"
            className={className}
            styles={{
                body: {
                    padding: '16px',
                },
            }}
        >
            <Row gutter={[12, 12]}>
                {actions.map((action) => (
                    <Col xs={12} sm={8} md={4} key={action.key}>
                        <Tooltip title={action.description}>
                            <Button
                                type="default"
                                block
                                onClick={() => handleAction(action.path)}
                                style={{
                                    height: 'auto',
                                    padding: '16px 8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 8,
                                    border: `1px solid ${token.colorPrimaryBorder}`,
                                    borderRadius: 8,
                                }}
                            >
                                <span style={{fontSize: 24, color: action.color}}>
                                    {action.icon}
                                </span>
                                <Text style={{fontSize: 12}}>{action.label}</Text>
                            </Button>
                        </Tooltip>
                    </Col>
                ))}
            </Row>
        </Card>
    );
};

export default QuickActions;
