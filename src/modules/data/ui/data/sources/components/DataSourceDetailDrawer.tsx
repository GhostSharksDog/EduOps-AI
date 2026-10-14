'use client';

import React from 'react';
import {Button, Flex, Space, Tag, theme, Typography} from 'antd';
import {DatabaseOutlined} from '@ant-design/icons';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {DataSourceStatus, DataSourceType, DataSourceTypeLabels} from '@/shared/enums/index';
import styles from './DataSourceDetailDrawer.module.css';

const {Title, Text} = Typography;

interface DataSourceDetailDrawerProps {
    visible: boolean;
    dataSource: DataSourceVO | null;
    onClose: () => void;
}

const DataSourceDetailDrawer: React.FC<DataSourceDetailDrawerProps> = ({
    visible,
    dataSource,
    onClose
}) => {
    const {token} = theme.useToken();

    const getTypeLabel = (type: DataSourceType) => {
        return DataSourceTypeLabels[type] || type;
    };

    const getStatusTag = (status: DataSourceStatus) => {
        if (status === DataSourceStatus.ACTIVE) {
            return <Tag color="success">已启用</Tag>;
        } else if (status === DataSourceStatus.DISABLED) {
            return <Tag color="default">已禁用</Tag>;
        }
        return <Tag>{status}</Tag>;
    };

    return (
        <BaseDrawer
            title={<Space><DatabaseOutlined/> 数据源详情</Space>}
            onClose={onClose}
            open={visible}
            size="lg"
            footerMode="none"
            bodyPadding="none"
        >
            {dataSource && (
                <Flex vertical className={styles.container}>
                    <div
                        className={styles.header}
                        style={{
                            background: token.colorBgContainer,
                            borderBottom: `1px solid ${token.colorBorder}`
                        }}
                    >
                        <Title level={4} className={styles.headerTitle} style={{color: token.colorTextHeading}}>
                            {dataSource.name}
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
                                    borderRadius: token.borderRadius,
                                    border: `1px solid ${token.colorBorder}`
                                }}
                            >
                                <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                    基本信息
                                </Title>
                                <Flex gap={token.marginMD}>
                                    <div className={styles.fieldRow}>
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            数据源类型
                                        </Text>
                                        <div className={styles.fieldValue}>
                                            <Text>{getTypeLabel(dataSource.type)}</Text>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            状态
                                        </Text>
                                        <div className={styles.fieldValue}>
                                            {getStatusTag(dataSource.status)}
                                        </div>
                                    </div>
                                </Flex>
                            </div>

                            <div
                                className={styles.section}
                                style={{
                                    background: token.colorBgElevated,
                                    borderRadius: token.borderRadius,
                                    border: `1px solid ${token.colorBorder}`
                                }}
                            >
                                <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                    连接信息
                                </Title>
                                <Flex vertical gap={token.marginXS}>
                                    <Flex justify="space-between" align="center">
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            主机
                                        </Text>
                                        <Text copyable className={styles.ellipsisText}>
                                            {dataSource.host}
                                        </Text>
                                    </Flex>
                                    <div className={styles.divider} style={{background: token.colorBorder}} />
                                    <Flex justify="space-between" align="center">
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            端口
                                        </Text>
                                        <Text>{dataSource.port}</Text>
                                    </Flex>
                                    <div className={styles.divider} style={{background: token.colorBorder}} />
                                    <Flex justify="space-between" align="center">
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            数据库
                                        </Text>
                                        <Text>{dataSource.databaseName}</Text>
                                    </Flex>
                                    <div className={styles.divider} style={{background: token.colorBorder}} />
                                    <Flex justify="space-between" align="center">
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            用户名
                                        </Text>
                                        <Text>{dataSource.username}</Text>
                                    </Flex>
                                </Flex>
                            </div>

                            {dataSource.description && (
                                <div
                                    className={styles.section}
                                    style={{
                                        background: token.colorBgElevated,
                                        borderRadius: token.borderRadius,
                                        border: `1px solid ${token.colorBorder}`
                                    }}
                                >
                                    <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                        描述
                                    </Title>
                                    <Text ellipsis>
                                        {dataSource.description}
                                    </Text>
                                </div>
                            )}

                            {dataSource.feature && (
                                <div
                                    className={styles.section}
                                    style={{
                                        background: token.colorBgElevated,
                                        borderRadius: token.borderRadius,
                                        border: `1px solid ${token.colorBorder}`
                                    }}
                                >
                                    <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                        特性配置
                                    </Title>
                                    <Text code style={{wordBreak: 'break-all'}}>
                                        {typeof dataSource.feature === 'object' 
                                            ? JSON.stringify(dataSource.feature, null, 2) 
                                            : String(dataSource.feature)}
                                    </Text>
                                </div>
                            )}

                            <div
                                className={styles.section}
                                style={{
                                    background: token.colorBgElevated,
                                    borderRadius: token.borderRadius,
                                    border: `1px solid ${token.colorBorder}`
                                }}
                            >
                                <Title level={5} className={styles.sectionTitle} style={{marginBottom: token.marginSM}}>
                                    时间信息
                                </Title>
                                <Flex gap={token.marginMD}>
                                    <div className={styles.fieldRow}>
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            创建时间
                                        </Text>
                                        <div className={styles.fieldValueSmall}>
                                            <Text>{dataSource.createTime}</Text>
                                        </div>
                                    </div>
                                    <div className={styles.fieldRow}>
                                        <Text strong className={styles.fieldLabel} style={{color: token.colorTextSecondary}}>
                                            更新时间
                                        </Text>
                                        <div className={styles.fieldValueSmall}>
                                            <Text>{dataSource.updateTime}</Text>
                                        </div>
                                    </div>
                                </Flex>
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
            )}
        </BaseDrawer>
    );
};

export default DataSourceDetailDrawer;
