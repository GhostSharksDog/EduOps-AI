'use client';

import React, {useState, useCallback, useMemo} from 'react';
import {Button, Space} from 'antd';
import {
    CheckSquareOutlined,
    CloseOutlined,
    DeleteOutlined,
} from '@ant-design/icons';
import type {UseBatchSelectionReturn} from '@/shared/hooks/useBatchSelection';
import BatchOperationModal, {
    type BatchOperationType,
} from '@/shared/ui/dashboard/BatchOperationModal/BatchOperationModal';
import styles from './BatchActionBar.module.css';

/**
 * 批量操作配置
 */
export interface BatchOperation<T> {
    /** 操作类型 */
    type: BatchOperationType;
    /** 自定义按钮文字，默认根据 type 自动生成 */
    label?: string;
    /** 自定义图标 */
    icon?: React.ReactNode;
    /** 是否危险操作（红色按钮），默认 delete 为 true */
    danger?: boolean;
    /** 是否禁用 */
    disabled?: boolean;
    /** 执行回调 */
    onExecute: () => void | Promise<void>;
    /** 加载状态 */
    loading?: boolean;
    /** 确认弹窗配置 */
    confirmConfig?: {
        title?: string;
        warningMessage?: string;
        itemName?: string;
    };
}

/**
 * BatchActionBar 组件 Props
 */
export interface BatchActionBarProps<T = unknown> {
    /** 批量选择 hook 返回值 */
    batchSelection: UseBatchSelectionReturn<T>;
    /** 可用的批量操作列表 */
    operations: BatchOperation<T>[];
    /** 「批量选择」按钮文字 */
    enterButtonLabel?: string;
    /** 「取消选择」按钮文字 */
    cancelButtonLabel?: string;
    /** 进入批量模式时的回调，用于传入可选行 */
    onEnterBatchMode?: (selectableRows: T[]) => void;
    /** 判断行是否可选的函数 */
    selectableFilter?: (row: T) => boolean;
    /** 当前表格数据，用于筛选可选行 */
    data?: T[];
    /** 进入批量模式按钮是否禁用 */
    enterDisabled?: boolean;
    /** 进入批量模式按钮禁用时的提示 */
    enterDisabledTooltip?: string;
}

/**
 * 默认操作配置
 */
const DEFAULT_OPERATION_CONFIG: Record<
    BatchOperationType,
    { label: string; icon: React.ReactNode; danger: boolean }
> = {
    delete: {
        label: '批量删除',
        icon: <DeleteOutlined />,
        danger: true,
    },
    restore: {
        label: '批量恢复',
        icon: <CheckSquareOutlined />,
        danger: false,
    },
    activate: {
        label: '批量激活',
        icon: <CheckSquareOutlined />,
        danger: false,
    },
    deactivate: {
        label: '批量停用',
        icon: <CloseOutlined />,
        danger: false,
    },
    custom: {
        label: '批量操作',
        icon: <CheckSquareOutlined />,
        danger: false,
    },
};

/**
 * 批量操作工具栏组件
 *
 * 统一管理表格批量操作的 UI 和交互流程：
 * - 非批量模式：显示「批量选择」按钮
 * - 批量模式：显示「取消选择」+ 操作按钮 + 选中数量
 *
 * @example
 * ```tsx
 * const batchSelection = useBatchSelection<TagVO>({ enableBatchMode: true });
 *
 * <BatchActionBar
 *   batchSelection={batchSelection}
 *   data={tags}
 *   selectableFilter={(tag) => tag.status !== 'DELETED'}
 *   operations={[
 *     { type: 'delete', onExecute: handleBatchDelete, loading: isDeleting }
 *   ]}
 * />
 * ```
 */
function BatchActionBar<T extends { id?: string }>({
    batchSelection,
    operations,
    enterButtonLabel = '批量选择',
    cancelButtonLabel = '取消选择',
    onEnterBatchMode,
    selectableFilter,
    data = [],
    enterDisabled = false,
}: BatchActionBarProps<T>): React.ReactElement {
    // 当前正在确认的操作
    const [pendingOperation, setPendingOperation] = useState<BatchOperation<T> | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    // 进入批量模式
    const handleEnterBatchMode = useCallback(() => {
        const selectableRows = selectableFilter ? data.filter(selectableFilter) : data;
        batchSelection.enterBatchMode(selectableRows);
        onEnterBatchMode?.(selectableRows);
    }, [batchSelection, data, selectableFilter, onEnterBatchMode]);

    // 退出批量模式
    const handleExitBatchMode = useCallback(() => {
        batchSelection.exitBatchMode();
    }, [batchSelection]);

    // 点击操作按钮
    const handleOperationClick = useCallback((operation: BatchOperation<T>) => {
        setPendingOperation(operation);
    }, []);

    // 确认操作
    const handleConfirmOperation = useCallback(async () => {
        if (!pendingOperation) return;

        setConfirmLoading(true);
        try {
            await pendingOperation.onExecute();
            setPendingOperation(null);
        } catch (error) {
            // 错误处理由调用方负责
            console.error('Batch operation failed:', error);
        } finally {
            setConfirmLoading(false);
        }
    }, [pendingOperation]);

    // 取消确认
    const handleCancelConfirm = useCallback(() => {
        setPendingOperation(null);
    }, []);

    // 渲染操作按钮
    const operationButtons = useMemo(() => {
        return operations.map((operation, index) => {
            const config = DEFAULT_OPERATION_CONFIG[operation.type];
            const isDanger = operation.danger ?? config.danger;
            const label = operation.label ?? config.label;
            const icon = operation.icon ?? config.icon;

            return (
                <Button
                    key={`${operation.type}-${index}`}
                    type={isDanger ? 'primary' : 'default'}
                    danger={isDanger}
                    icon={icon}
                    disabled={operation.disabled || !batchSelection.hasSelection}
                    loading={operation.loading}
                    onClick={() => handleOperationClick(operation)}
                    className={styles.operationButton}
                >
                    {label} ({batchSelection.selectionCount})
                </Button>
            );
        });
    }, [operations, batchSelection.hasSelection, batchSelection.selectionCount, handleOperationClick]);

    // 非批量模式：显示「批量选择」按钮
    if (!batchSelection.isBatchMode) {
        return (
            <Button
                icon={<CheckSquareOutlined />}
                onClick={handleEnterBatchMode}
                disabled={enterDisabled}
            >
                {enterButtonLabel}
            </Button>
        );
    }

    // 批量模式：显示操作按钮
    return (
        <>
            <Space>
                <Button
                    icon={<CloseOutlined />}
                    onClick={handleExitBatchMode}
                    className={styles.cancelButton}
                >
                    {cancelButtonLabel}
                </Button>
                {operationButtons}
            </Space>

            {/* 确认弹窗 */}
            {pendingOperation && (
                <BatchOperationModal
                    open={true}
                    operationType={pendingOperation.type}
                    count={batchSelection.selectionCount}
                    itemName={pendingOperation.confirmConfig?.itemName}
                    loading={confirmLoading}
                    onConfirm={handleConfirmOperation}
                    onCancel={handleCancelConfirm}
                    config={{
                        title: pendingOperation.confirmConfig?.title,
                        warningMessage: pendingOperation.confirmConfig?.warningMessage,
                    }}
                />
            )}
        </>
    );
}

export default BatchActionBar;
