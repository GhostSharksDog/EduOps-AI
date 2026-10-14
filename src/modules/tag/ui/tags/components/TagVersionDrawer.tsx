'use client';

import React, {useState} from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    Descriptions,
    Empty,
    Flex,
    Popconfirm,
    Space,
    Table,
    Tag as AntTag,
    theme,
    Tooltip,
    Typography
} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {CheckCircleOutlined, CopyOutlined, EyeOutlined, HistoryOutlined, PlusOutlined} from '@ant-design/icons';
import type {ColumnsType} from 'antd/es/table';
import {globalMessage} from '@/shared/lib/message';
import {MESSAGES} from '@/shared/messages/index';
import {TagStatus, TagType} from '@/shared/enums/index';
import {type TagFeatureVO, type TagVersionVO} from '@/modules/tag/contracts/schemas/response/tag/index';
import {type CreateTagVersionDTO} from '@/modules/tag/contracts/schemas/request/tag/index';
import CreateTagVersionDrawer from '@/modules/tag/ui/tags/components/CreateTagVersionDrawer';
import {useCreateTagVersion, useSetCurrentTagVersion, useTagVersions} from '@/modules/tag/ui/tags/hooks/useTags';


const {Title} = Typography;

type BadgeStatusType = 'success' | 'warning' | 'default' | 'error';

interface TagVersionDrawerProps {
    visible: boolean;
    tagId: string;
    tagName: string;
    onClose: () => void;
}

const TagVersionDrawer: React.FC<TagVersionDrawerProps> = ({
                                                               visible,
                                                               tagId,
                                                               tagName,
                                                               onClose
                                                           }) => {
    const {token} = theme.useToken();

    const [selectedVersion, setSelectedVersion] = useState<TagVersionVO | null>(null);
    const [createVersionVisible, setCreateVersionVisible] = useState(false);

    // 使用react-query获取标签版本列表
    const {data: versionsData, isLoading: loading} = useTagVersions(tagId);
    const versions: TagVersionVO[] = versionsData?.items || [];

    // 使用react-query mutation设置当前版本
    const setCurrentVersionMutation = useSetCurrentTagVersion();

    // 使用react-query mutation创建标签版本
    const createTagVersionMutation = useCreateTagVersion();

    const handleSetCurrent = async (versionId: string) => {
        try {
            await setCurrentVersionMutation.mutateAsync({
                tagId,
                versionId
            });
            globalMessage.success(MESSAGES.TAG_VERSION.UPDATE_SUCCESS);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : MESSAGES.TAG_VERSION.SET_CURRENT_FAILED;
            globalMessage.error(errorMessage);
        }
    };

    const handleViewDetails = (record: TagVersionVO) => {
        setSelectedVersion(record);
    };

    const handleCreateVersion = () => {
        setCreateVersionVisible(true);
    };

    const handleCreateVersionOk = async (values: CreateTagVersionDTO) => {
        try {
            await createTagVersionMutation.mutateAsync({
                tagId,
                versionData: values
            });
            globalMessage.success(MESSAGES.TAG_VERSION.CREATE_SUCCESS);
            setCreateVersionVisible(false);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : MESSAGES.TAG_VERSION.CREATE_FAILED;
            globalMessage.error(errorMessage);
        }
    };

    const handleCreateVersionCancel = () => {
        setCreateVersionVisible(false);
    };

    const columns: ColumnsType<TagVersionVO> = [
        {
            title: '版本号',
            dataIndex: 'version',
            key: 'version',
            width: 130,
            render: (version, record) => (
                <Space size="small">
                    <Typography.Text strong>{version}</Typography.Text>
                    {record.isCurrent && (
                        <AntTag color="success" icon={<CheckCircleOutlined/>} bordered>
                            当前
                        </AntTag>
                    )}
                </Space>
            ),
        },
        {
            title: '版本名称',
            dataIndex: 'name',
            key: 'name',
            width: 250,
            render: (text, record) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{record.tag.name}</Typography.Text>
                    {record.description && (
                        <Typography.Text type="secondary">
                            {record.description}
                        </Typography.Text>
                    )}
                </Space>
            ),
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 120,
            render: (_type, record) => {
                const feature = record.feature as TagFeatureVO | undefined;
                const tagType = feature?.tagType;
                const color = tagType === TagType.SIMPLE ? 'blue' : 'purple';
                const displayText = tagType === TagType.SIMPLE ? '简单标签' : '计算标签';
                return <AntTag color={color}>{displayText}</AntTag>;
            },
        },
        {
            title: '值类型',
            dataIndex: 'dataType',
            key: 'dataType',
            width: 200,
            render: (_type, record) => (
                <Space size={4}>
                    <AntTag>{record.tag.dataType}</AntTag>
                    {record.enumValues?.map((v: string) => (
                        <AntTag key={v} color="blue">{v}</AntTag>
                    ))}
                </Space>
            ),
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (_status, record) => {
                const status = record.tag.status;
                let color: BadgeStatusType = 'default';
                let text = '未知';
                switch (status) {
                    case TagStatus.ACTIVE:
                        color = 'success';
                        text = '已激活';
                        break;
                    case TagStatus.INACTIVE:
                        color = 'warning';
                        text = '已停用';
                        break;
                    case TagStatus.DRAFT:
                        color = 'default';
                        text = '草稿';
                        break;
                    case TagStatus.DEPRECATED:
                        color = 'error';
                        text = '已废弃';
                        break;
                }
                return <Badge status={color} text={text}/>;
            },
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180,
            render: (_text, record) => record.createTime ? new Date(record.createTime).toLocaleString() : '-',
        },
        {
            title: '操作',
            key: 'action',
            width: 140,
            fixed: 'right',
            render: (_, record) => (
                <Space size="small">
                    <Tooltip title="查看详情">
                        <Button
                            type="text"
                            icon={<EyeOutlined/>}
                            size="small"
                            onClick={() => handleViewDetails(record)}
                        />
                    </Tooltip>
                    {!record.isCurrent && (
                        <Popconfirm
                            title="确认切换到该版本"
                            description={
                                <div style={{maxWidth: 320}}>
                                    <div>将删除旧版本 MV 与配置，新版本需重新激活后才生效。</div>
                                    <div style={{marginTop: 4, color: token.colorTextSecondary, fontSize: token.fontSizeSM}}>
                                        仅当标签非「已激活」状态时可切换。
                                    </div>
                                </div>
                            }
                            onConfirm={() => handleSetCurrent(record.id)}
                            okText={MESSAGES.COMMON.OK}
                            cancelText={MESSAGES.COMMON.CANCEL}
                        >
                            <Tooltip title="设为当前版本">
                                <Button
                                    type="text"
                                    icon={<CheckCircleOutlined/>}
                                    size="small"
                                />
                            </Tooltip>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <BaseDrawer
            title={
                selectedVersion ? (
                    <Space>
                        <Button
                            type="text"
                            icon={<CopyOutlined/>}
                            onClick={() => setSelectedVersion(null)}
                            style={{padding: 0, marginRight: token.marginXS}}
                        >
                            返回列表
                        </Button>
                        <Typography.Text>版本管理</Typography.Text>
                    </Space>
                ) : (
                    <Space>
                        <HistoryOutlined/>
                        <Typography.Text>版本管理</Typography.Text>
                    </Space>
                )
            }
            width={selectedVersion ? 1100 : 1000}
            open={visible}
            onClose={onClose}
            bodyPadding="none"
            footerMode="none"
        >
            <Flex vertical style={{maxHeight: '70vh'}}>
                <Card variant="borderless" styles={{
                    body: {
                        padding: `${token.paddingMD} ${token.paddingXL}`,
                        borderBottom: `1px solid ${token.colorBorder}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }
                }}>
                    <Space orientation="vertical" size={0}>
                        <Title level={4}>{tagName}</Title>
                        <Typography.Text
                            type="secondary">管理标签的所有版本，查看版本详情或切换当前生效版本</Typography.Text>
                    </Space>
                    <Button
                        type="primary"
                        icon={<PlusOutlined/>}
                        onClick={handleCreateVersion}
                    >
                        创建新版本
                    </Button>
                </Card>

                {selectedVersion ? (
                    <Card variant="borderless" styles={{
                        body: {
                            padding: token.paddingXL,
                            overflowY: 'auto',
                            flex: 1
                        }
                    }}>

                        <Descriptions column={3}>
                            <Descriptions.Item label="版本名称" span={2}>
                                {selectedVersion.tag.name}
                            </Descriptions.Item>
                            <Descriptions.Item label="版本号">
                                v{selectedVersion.version}
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                <Badge
                                    status={
                                        ((): BadgeStatusType => {
                                            switch (selectedVersion.tag.status) {
                                                case TagStatus.ACTIVE:
                                                    return 'success';
                                                case TagStatus.INACTIVE:
                                                    return 'warning';
                                                case TagStatus.DRAFT:
                                                    return 'default';
                                                case TagStatus.DEPRECATED:
                                                    return 'error';
                                                default:
                                                    return 'default';
                                            }
                                        })()
                                    }
                                    text={
                                        selectedVersion.tag.status === TagStatus.ACTIVE ? '已激活' :
                                            selectedVersion.tag.status === TagStatus.INACTIVE ? '已停用' :
                                                selectedVersion.tag.status === TagStatus.DRAFT ? '草稿' : '已废弃'
                                    }
                                />
                            </Descriptions.Item>
                            <Descriptions.Item label="标签类型">
                                {(() => {
                                    const feature = selectedVersion.feature as TagFeatureVO | undefined;
                                    const tagType = feature?.tagType;
                                    return (
                                        <AntTag color={tagType === TagType.SIMPLE ? 'blue' : 'purple'}>
                                            {tagType === TagType.SIMPLE ? '简单标签' : '计算标签'}
                                        </AntTag>
                                    );
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="值类型">
                                <AntTag>{selectedVersion.tag.dataType}</AntTag>
                            </Descriptions.Item>
                            {selectedVersion.enumValues && selectedVersion.enumValues.length > 0 && (
                                <Descriptions.Item label="枚举值" span={3}>
                                    <Space size={4}>
                                        {selectedVersion.enumValues.map((v: string) => (
                                            <AntTag key={v} color="blue">{v}</AntTag>
                                        ))}
                                    </Space>
                                </Descriptions.Item>
                            )}
                            <Descriptions.Item label="是否为当前版本" span={3}>
                                {selectedVersion.isCurrent ? (
                                    <AntTag color="success" icon={<CheckCircleOutlined/>}>
                                        是
                                    </AntTag>
                                ) : (
                                    <AntTag>否</AntTag>
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="描述" span={3}>
                                {selectedVersion.description || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="计算规则" span={3}>
                                {selectedVersion.rule ? (
                                    <div style={{
                                        padding: token.paddingMD,
                                        borderRadius: token.borderRadius,
                                        margin: 0,
                                        fontSize: token.fontSizeSM,
                                        lineHeight: token.lineHeight,
                                        overflowX: 'auto',
                                        maxHeight: '300px',
                                        overflowY: 'auto',
                                        background: token.colorFillContent
                                    }}>
                                        <div style={{marginBottom: token.marginXS}}>
                                            <Typography.Text strong>规则类型: </Typography.Text>
                                            <Typography.Text>{selectedVersion.rule.ruleType || '-'}</Typography.Text>
                                        </div>
                                        {selectedVersion.rule.dataModelIds && selectedVersion.rule.dataModelIds.length > 0 && (
                                            <div style={{marginBottom: token.marginXS}}>
                                                <Typography.Text strong>数据模型ID: </Typography.Text>
                                                <Typography.Text>{selectedVersion.rule.dataModelIds.join(', ')}</Typography.Text>
                                            </div>
                                        )}
                                        {selectedVersion.rule.ruleContent && (
                                            <div style={{marginBottom: token.marginXS}}>
                                                <Typography.Text strong>规则内容: </Typography.Text>
                                                <pre style={{
                                                    padding: token.paddingXS,
                                                    borderRadius: token.borderRadius,
                                                    margin: 0,
                                                    fontSize: token.fontSizeSM,
                                                    background: token.colorFillAlter,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}>
                                                    {selectedVersion.rule.ruleContent}
                                                </pre>
                                            </div>
                                        )}
                                        {selectedVersion.rule.steps && selectedVersion.rule.steps.length > 0 && (
                                            <div style={{marginBottom: token.marginXS}}>
                                                <Typography.Text strong>级联步骤: </Typography.Text>
                                                {selectedVersion.rule.steps.map((step: { order: number; sql: string; targetTableId?: string }, index: number) => (
                                                    <div key={index} style={{
                                                        marginTop: token.marginXS,
                                                        padding: token.paddingXS,
                                                        borderRadius: token.borderRadius,
                                                        background: token.colorFillAlter
                                                    }}>
                                                        <Typography.Text strong>步骤 {step.order}</Typography.Text>
                                                        <pre style={{
                                                            margin: 0,
                                                            fontSize: token.fontSizeSM,
                                                            whiteSpace: 'pre-wrap',
                                                            wordBreak: 'break-word'
                                                        }}>
                                                            {step.sql}
                                                        </pre>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="创建时间">
                                {selectedVersion.createTime ? new Date(selectedVersion.createTime).toLocaleString() : '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="更新时间">
                                {selectedVersion.updateTime ? new Date(selectedVersion.updateTime).toLocaleString() : '-'}
                            </Descriptions.Item>
                        </Descriptions>
                    </Card>
                ) : (
                    <>
                        <Alert
                            type="info"
                            showIcon
                            title="切换当前版本说明"
                            description={
                                <div style={{fontSize: token.fontSizeSM}}>
                                    <div style={{marginBottom: token.marginXXS}}>
                                        <Typography.Text strong>前置条件：</Typography.Text>
                                        <Typography.Text type="secondary">
                                            标签状态不能为「已激活」，请先将标签停用。
                                        </Typography.Text>
                                    </div>
                                    <div style={{marginBottom: token.marginXXS}}>
                                        <Typography.Text strong>切换后将发生：</Typography.Text>
                                    </div>
                                    <ul style={{margin: 0, paddingLeft: token.paddingMD, color: token.colorTextSecondary}}>
                                        <li>删除旧版本在 ClickHouse 中的物化视图（mv_tag_* 及 ENUM bitmap MV/表）</li>
                                        <li>清空 materialized_view_config 中该标签的配置</li>
                                        <li>更新 target_table 关联到新版本</li>
                                        <li>新版本 MV 不会立即生成，需要重新激活标签后创建</li>
                                    </ul>
                                </div>
                            }
                            style={{
                                margin: `${token.paddingSM} ${token.paddingXL} 0`,
                                borderRadius: 0,
                            }}
                        />
                        <Table
                            columns={columns}
                            dataSource={versions}
                            rowKey="id"
                            loading={loading}
                            pagination={false}
                            locale={{
                                emptyText: (
                                    <Empty
                                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        description="暂无版本数据"
                                    />
                                )
                            }}
                        />
                    </>
                )}
            </Flex>

            <CreateTagVersionDrawer
                visible={createVersionVisible}
                loading={createTagVersionMutation.isPending}
                tagId={tagId}
                tagName={tagName}
                onOk={handleCreateVersionOk}
                onCancel={handleCreateVersionCancel}
            />
        </BaseDrawer>
    );
};

export default TagVersionDrawer;
