import React from 'react';
import {Button, Flex, Space, Table, Tag, theme, Typography} from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import type {DataModelVO, ModelColumnVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import {DATA_MODEL_STATUS_LABELS, DataModelStatus} from '@/modules/data/ui/data/models/constants/index';
import {TableOutlined} from '@ant-design/icons';
import styles from './DataModelDetail.module.css';

const {Title, Text} = Typography;

interface DataModelDetailProps {
    visible: boolean;
    dataModel: DataModelVO | null;
    onClose: () => void;
}

const DataModelDetail: React.FC<DataModelDetailProps> = ({visible, dataModel, onClose}) => {
    const {token} = theme.useToken();

    if (!dataModel) {
        return null;
    }

    const formatDateTime = (dateTime: string | Date) => {
        if (!dateTime) return '-';
        return new Date(dateTime).toLocaleString('zh-CN');
    };

    const formatDataType = (column: ModelColumnVO): string => {
        let type = column.dataType as string;
        if (column.length) {
            type += `(${column.length})`;
        } else if (column.precision && column.scale) {
            type += `(${column.precision},${column.scale})`;
        } else if (column.precision) {
            type += `(${column.precision})`;
        }
        return type;
    };

    const columns = [
        {
            title: '列名',
            dataIndex: 'name',
            key: 'name',
            width: 150,
        },
        {
            title: '显示名称',
            dataIndex: 'displayName',
            key: 'displayName',
            width: 120,
            render: (text: string) => text || '-'
        },
        {
            title: '数据类型',
            key: 'dataType',
            width: 150,
            render: (_text: unknown, record: ModelColumnVO) => formatDataType(record)
        },
        {
            title: '主键',
            key: 'isPrimaryKey',
            width: 80,
            render: (_text: unknown, record: ModelColumnVO) => (
                record.isPrimaryKey ? '是' : '否'
            ),
        },
        {
            title: '可空',
            key: 'isNullable',
            width: 80,
            render: (_text: unknown, record: ModelColumnVO) => (
                record.isNullable ? '是' : '否'
            ),
        },
        {
            title: '默认值',
            dataIndex: 'defaultValue',
            key: 'defaultValue',
            width: 120,
            render: (text: string) => text || '-'
        },
        {
            title: '描述',
            dataIndex: 'description',
            key: 'description',
            ellipsis: true,
            render: (text: string) => text || '-'
        },
    ];

    const datasourceMap: Record<string, string> = {
        '550e8400-e29b-41d4-a716-446655440100': '主数据源',
        '550e8400-e29b-41d4-a716-446655440101': '备份数据源'
    };

    return (
        <BaseDrawer
            title={<Space><TableOutlined/> 数据模型详情</Space>}
            onClose={onClose}
            open={visible}
            size="lg"
            footerMode="none"
            bodyPadding="none"
        >
            <Flex vertical className={styles.container}>
                <div
                    className={styles.header}
                    style={{
                        background: token.colorBgContainer,
                        borderBottom: `1px solid ${token.colorBorder}`
                    }}
                >
                    <Title level={4} className={styles.headerTitle} style={{color: token.colorTextHeading}}>
                        {dataModel.name}
                    </Title>
                    <Text type="secondary" className={styles.headerSubtitle}>
                        详细配置信息
                    </Text>
                </div>

                <div className={styles.content}>
                    <Flex vertical gap={token.marginMD}>
                        <div
                            className={styles.section}
                            style={{
                                background: token.colorBgElevated,
                                border: `1px solid ${token.colorBorder}`
                            }}
                        >
                            <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                基本信息
                            </Title>
                            <div className={styles.fieldGroup}>
                                <div className={styles.fieldRow}>
                                    <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                        模型名称
                                    </Text>
                                    <div className={styles.fieldValue}>
                                        <Text>{dataModel.name}</Text>
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                        状态
                                    </Text>
                                    <div className={styles.fieldValue}>
                                        <Tag
                                            color={dataModel.status === DataModelStatus.ACTIVE ? 'success' : dataModel.status === DataModelStatus.INACTIVE ? 'error' : 'default'}>
                                            {DATA_MODEL_STATUS_LABELS[dataModel.status]}
                                        </Tag>
                                    </div>
                                </div>
                            </div>
                            <div className={`${styles.fieldGroup} ${styles.fieldGroupSpacing}`}>
                                <div className={styles.fieldRow}>
                                    <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                        数据源
                                    </Text>
                                    <div className={styles.fieldValue}>
                                        <Text>{datasourceMap[dataModel.datasource?.id || ''] || dataModel.datasource?.name || '-'}</Text>
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                        表名
                                    </Text>
                                    <div className={styles.fieldValue}>
                                        <Text>{dataModel.tableName || '-'}</Text>
                                    </div>
                                </div>
                            </div>
                            {dataModel.description && (
                                <div className={styles.fieldSpacing}>
                                    <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                        描述
                                    </Text>
                                    <div className={styles.fieldValue}>
                                        <Text>{dataModel.description}</Text>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div
                            className={styles.section}
                            style={{
                                background: token.colorBgElevated,
                                border: `1px solid ${token.colorBorder}`
                            }}
                        >
                            <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                时间信息
                            </Title>
                            <div className={styles.fieldGroup}>
                                <div className={styles.fieldRow}>
                                    <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                        创建时间
                                    </Text>
                                    <div className={styles.fieldValueSmall}>
                                        <Text style={{fontSize: '12px'}}>{formatDateTime(dataModel.createTime)}</Text>
                                    </div>
                                </div>
                                <div className={styles.fieldRow}>
                                    <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                        更新时间
                                    </Text>
                                    <div className={styles.fieldValueSmall}>
                                        <Text style={{fontSize: '12px'}}>{formatDateTime(dataModel.updateTime || '')}</Text>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.fieldSpacing}>
                                <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                    字段数量
                                </Text>
                                <div className={styles.fieldValue}>
                                    <Text>{dataModel.columns?.length || 0}</Text>
                                </div>
                            </div>
                        </div>

                        <div
                            className={styles.section}
                            style={{
                                background: token.colorBgElevated,
                                border: `1px solid ${token.colorBorder}`
                            }}
                        >
                            <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                字段列表
                            </Title>
                            <Table
                                columns={columns}
                                dataSource={dataModel.columns || []}
                                rowKey="id"
                                pagination={false}
                                size="small"
                                scroll={{x: 700}}
                            />
                        </div>
                    </Flex>
                </div>

                <div
                    className={styles.footer}
                    style={{
                        borderTop: `1px solid ${token.colorBorder}`,
                    }}
                >
                    <Button size="small" onClick={onClose}>
                        关闭
                    </Button>
                </div>
            </Flex>
        </BaseDrawer>
    );
};

export default DataModelDetail;
