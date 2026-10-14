import {create} from 'zustand';
import {SegmentStatus, SegmentType, TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import type {TagVO} from '@/modules/tag/contracts';
import type {SegmentListItemVO} from '@/modules/segment/contracts';
import {log} from '@/platform/logger';

export interface StatCard {
    title: string;
    value: number;
    change: number;
    icon: React.ReactNode;
    color: string;
}

export interface CategoryDistribution {
    name: string;
    count: number;
    percentage: number;
    color: string;
}

export interface DataSourceInfo {
    id: string;
    name: string;
    type: string;
    status: 'normal' | 'warning' | 'error';
    recordCount: number;
    lastSync: string;
}

export interface Activity {
    id: string;
    type: 'create' | 'update' | 'delete' | 'sync' | 'approve';
    title: string;
    description: string;
    time: string;
    user: string;
    tag?: string;
}

export interface DataModelInfo {
    modelCount: number;
    tableCount: number;
    apiCount: number;
    usageRate: number;
    dataCompleteness: number;
    tagCoverage: number;
}

interface DashboardState {
    tags: TagVO[];
    segments: SegmentListItemVO[];
    statCards: StatCard[];
    categoryDistribution: CategoryDistribution[];
    dataSources: DataSourceInfo[];
    activities: Activity[];
    dataModelInfo: DataModelInfo;
    loading: boolean;
}

interface DashboardActions {
    fetchDashboardData: () => Promise<void>;
    setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
    tags: [],
    segments: [],
    statCards: [
        {
            title: '总标签数',
            value: 128,
            change: 8,
            icon: null,
            color: '#722ed1',
        },
        {
            title: '用户分群',
            value: 24,
            change: 4,
            icon: null,
            color: '#fa8c16',
        },
        {
            title: '标签使用次数',
            value: 125000,
            change: 12,
            icon: null,
            color: '#fa8c16',
        },
        {
            title: '标签分类',
            value: 12,
            change: 2,
            icon: null,
            color: '#eb2f96',
        },
    ],
    categoryDistribution: [
        {name: '用户属性', count: 45, percentage: 35, color: '#fa8c16'},
        {name: '消费行为', count: 32, percentage: 25, color: '#52c41a'},
        {name: '注册信息', count: 25, percentage: 20, color: '#faad14'},
        {name: '设备信息', count: 18, percentage: 14, color: '#eb2f96'},
        {name: '其他', count: 8, percentage: 6, color: '#999999'},
    ],
    dataSources: [
        {
            id: '1',
            name: '用户中心数据库',
            type: 'MySQL',
            status: 'normal',
            recordCount: 1250000,
            lastSync: '5分钟前',
        },
        {
            id: '2',
            name: '订单服务API',
            type: 'REST API',
            status: 'normal',
            recordCount: 890000,
            lastSync: '10分钟前',
        },
        {
            id: '3',
            name: '行为日志Kafka',
            type: 'Kafka',
            status: 'warning',
            recordCount: 5600000,
            lastSync: '2小时前',
        },
    ],
    activities: [
        {
            id: '1',
            type: 'create',
            title: '新建标签',
            description: '创建了标签"VIP用户识别"',
            time: '10分钟前',
            user: '张三',
            tag: 'VIP用户识别',
        },
        {
            id: '2',
            type: 'update',
            title: '更新分群',
            description: '修改了分群"高价值流失风险"规则',
            time: '30分钟前',
            user: '李四',
            tag: '高价值流失风险',
        },
        {
            id: '3',
            type: 'sync',
            title: '数据同步',
            description: '完成了订单数据的同步',
            time: '1小时前',
            user: '系统',
        },
        {
            id: '4',
            type: 'approve',
            title: '标签审批通过',
            description: '标签"消费频次"已通过审批',
            time: '2小时前',
            user: '王五',
            tag: '消费频次',
        },
        {
            id: '5',
            type: 'delete',
            title: '删除标签',
            description: '删除了标签"测试标签123"',
            time: '3小时前',
            user: '张三',
            tag: '测试标签123',
        },
    ],
    dataModelInfo: {
        modelCount: 18,
        tableCount: 156,
        apiCount: 42,
        usageRate: 87,
        dataCompleteness: 92,
        tagCoverage: 78,
    },
    loading: false,

    fetchDashboardData: async () => {
        try {
            set({loading: true});

            const tags: TagVO[] = [
                {
                    id: '1',
                    name: '用户等级',
                    category: {
                        id: '1001',
                        name: '用户属性',
                        path: '/用户属性',
                        orderIndex: 1,
                        tagCount: 0,
                        isDeleted: false,
                        createTime: new Date().toISOString()
                    },
                    dataType: TagValueType.STRING,
                    status: TagStatus.ACTIVE,
                    updateCycle: UpdateCycle.DAILY,
                    isPublic: true,
                    ownedBy: 'system',
                    isDeleted: false,
                    createTime: new Date().toISOString()
                },
                {
                    id: '2',
                    name: '高频消费',
                    category: {
                        id: '1002',
                        name: '消费行为',
                        path: '/消费行为',
                        orderIndex: 1,
                        tagCount: 0,
                        isDeleted: false,
                        createTime: new Date().toISOString()
                    },
                    dataType: TagValueType.STRING,
                    status: TagStatus.ACTIVE,
                    updateCycle: UpdateCycle.DAILY,
                    isPublic: true,
                    ownedBy: 'system',
                    isDeleted: false,
                    createTime: new Date().toISOString()
                },
                {
                    id: '3',
                    name: '新注册用户',
                    category: {
                        id: '1003',
                        name: '注册信息',
                        path: '/注册信息',
                        orderIndex: 1,
                        tagCount: 0,
                        isDeleted: false,
                        createTime: new Date().toISOString()
                    },
                    dataType: TagValueType.STRING,
                    status: TagStatus.ACTIVE,
                    updateCycle: UpdateCycle.DAILY,
                    isPublic: true,
                    ownedBy: 'system',
                    isDeleted: false,
                    createTime: new Date().toISOString()
                },
            ];

            const segments: SegmentListItemVO[] = [
                {
                    id: '1',
                    name: '高价值流失风险',
                    memberCount: 1200,
                    status: SegmentStatus.ACTIVE,
                    ownedBy: 'system',
                    entityType: SegmentType.DYNAMIC,
                    isDeleted: false,
                    createTime: new Date().toISOString(),
                    rules: [],
                    updateTime: new Date().toISOString()
                },
                {
                    id: '2',
                    name: '30天活跃',
                    memberCount: 89000,
                    status: SegmentStatus.ACTIVE,
                    ownedBy: 'system',
                    entityType: SegmentType.DYNAMIC,
                    isDeleted: false,
                    createTime: new Date().toISOString(),
                    rules: [],
                    updateTime: new Date().toISOString()
                },
            ];

            set({tags, segments});
        } catch (error: unknown) {
            log.error('加载仪表盘数据失败', error);
        } finally {
            set({loading: false});
        }
    },

    setLoading: (loading) => set({loading}),
}));
