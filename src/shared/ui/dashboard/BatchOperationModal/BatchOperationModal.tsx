'use client';

import React from 'react';
import {Modal, Space, Button, Typography, theme} from 'antd';
import {
    CheckCircleOutlined,
    DeleteOutlined,
    ExclamationCircleOutlined,
    ReloadOutlined,
    StopOutlined,
} from '@ant-design/icons';

const {Text, Paragraph} = Typography;

export type BatchOperationType = 'delete' | 'restore' | 'activate' | 'deactivate' | 'custom';

export interface BatchOperationConfig {
    type: BatchOperationType;
    title?: string;
    icon?: React.ReactNode;
    confirmText?: string;
    danger?: boolean;
    warningMessage?: string;
    customIcon?: React.ReactNode;
}

const OPERATION_CONFIGS: Record<BatchOperationType, Omit<BatchOperationConfig, 'type'>> = {
    delete: {
        title: '确认删除',
        icon: <DeleteOutlined />,
        confirmText: '确认删除',
        danger: true,
        warningMessage: '此操作不可撤销，数据将无法恢复',
    },
    restore: {
        title: '确认恢复',
        icon: <ReloadOutlined />,
        confirmText: '确认恢复',
        danger: false,
        warningMessage: '恢复后数据将重新可用',
    },
    activate: {
        title: '确认激活',
        icon: <CheckCircleOutlined />,
        confirmText: '确认激活',
        danger: false,
    },
    deactivate: {
        title: '确认停用',
        icon: <StopOutlined />,
        confirmText: '确认停用',
        danger: false,
        warningMessage: '停用后相关功能将暂时不可用',
    },
    custom: {
        title: '确认操作',
        icon: <ExclamationCircleOutlined />,
        confirmText: '确认',
        danger: false,
    },
};

interface BatchOperationModalProps {
    open: boolean;
    operationType: BatchOperationType;
    count: number;
    itemName?: string;
    onConfirm: () => void | Promise<void>;
    onCancel: () => void;
    loading?: boolean;
    config?: Partial<BatchOperationConfig>;
}

const BatchOperationModal: React.FC<BatchOperationModalProps> = ({
    open,
    operationType,
    count,
    itemName = '项',
    onConfirm,
    onCancel,
    loading = false,
    config,
}) => {
    const {token} = theme.useToken();

    const mergedConfig = {
        ...OPERATION_CONFIGS[operationType],
        ...config,
    };

    const {
        title,
        icon,
        confirmText,
        danger,
        warningMessage,
    } = mergedConfig;

    const getDescription = () => {
        switch (operationType) {
            case 'delete':
                return `确定要删除选中的 ${count} ${itemName}吗？`;
            case 'restore':
                return `确定要恢复选中的 ${count} ${itemName}吗？`;
            case 'activate':
                return `确定要激活选中的 ${count} ${itemName}吗？`;
            case 'deactivate':
                return `确定要停用选中的 ${count} ${itemName}吗？`;
            default:
                return config?.title 
                    ? `确定要对选中的 ${count} ${itemName}执行此操作吗？`
                    : `确定要操作选中的 ${count} ${itemName}吗？`;
        }
    };

    return (
        <Modal
            open={open}
            title={
                <Space>
                    {icon}
                    <span>{config?.title || title}</span>
                </Space>
            }
            onCancel={onCancel}
            footer={
                <Space>
                    <Button onClick={onCancel}>取消</Button>
                    <Button
                        type="primary"
                        danger={danger}
                        loading={loading}
                        onClick={onConfirm}
                    >
                        {config?.confirmText || confirmText}
                    </Button>
                </Space>
            }
            closable={!loading}
            maskClosable={!loading}
        >
            <div style={{display: 'flex', flexDirection: 'column', gap: token.marginMD}}>
                <Paragraph style={{margin: 0, color: token.colorTextSecondary}}>
                    {getDescription()}
                </Paragraph>
                {warningMessage && (
                    <div
                        style={{
                            backgroundColor: danger ? token.colorErrorBg : token.colorInfoBg,
                            border: `1px solid ${danger ? token.colorErrorBorder : token.colorInfoBorder}`,
                            borderRadius: token.borderRadiusSM,
                            padding: token.paddingSM,
                        }}
                    >
                        <Text
                            type={danger ? 'danger' : 'secondary'}
                            style={{fontSize: '13px'}}
                        >
                            ⚠️ {warningMessage}
                        </Text>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default BatchOperationModal;
