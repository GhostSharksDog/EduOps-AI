'use client';

import {useState, useCallback, useMemo} from 'react';
import type {TableProps} from 'antd';

/**
 * 批量选择状态管理 Hook
 * 
 * 统一管理表格批量选择的状态和行为，支持两种模式：
 * 1. 始终启用模式：checkbox 始终显示，选中后显示批量操作按钮
 * 2. 可选模式（enableBatchMode）：需要显式进入批量模式才显示 checkbox
 * 
 * @example
 * ```tsx
 * // 始终启用模式（RecycleBin 模式）
 * const batchSelection = useBatchSelection<TagVO>();
 * <Table rowSelection={batchSelection.rowSelectionConfig} />
 * 
 * // 可选模式（CategoryTable 模式）
 * const batchSelection = useBatchSelection<TagVO>({ enableBatchMode: true });
 * {batchSelection.isBatchMode ? <Button>批量删除</Button> : <Button onClick={batchSelection.enterBatchMode}>批量选择</Button>}
 * ```
 */

export interface UseBatchSelectionOptions<T> {
  /** 启用批量模式切换（CategoryTable 模式） */
  enableBatchMode?: boolean;
  /** 进入批量模式时的默认选中行（可选） */
  defaultSelectedRows?: T[];
  /** 获取行的唯一标识，默认使用 id 字段 */
  getRowKey?: (row: T) => string;
  /** 选择变化回调 */
  onSelectionChange?: (keys: React.Key[], rows: T[]) => void;
}

export interface UseBatchSelectionReturn<T> {
  // 状态
  /** 选中的行 keys */
  selectedRowKeys: string[];
  /** 选中的行数据 */
  selectedRows: T[];
  /** 是否有选中项 */
  hasSelection: boolean;
  /** 选中数量 */
  selectionCount: number;
  /** 计算后的 selectedRowKeys（可选模式下非批量模式返回 undefined） */
  computedSelectedRowKeys: string[] | undefined;
  
  // 批量模式相关（仅 enableBatchMode 时有效）
  /** 是否处于批量模式 */
  isBatchMode: boolean;
  /** 进入批量模式 */
  enterBatchMode: (initialRows?: T[]) => void;
  /** 退出批量模式 */
  exitBatchMode: () => void;
  /** 切换批量模式 */
  toggleBatchMode: () => void;
  
  // 操作方法
  /** 处理选择变化 */
  handleSelectionChange: (keys: React.Key[], rows: T[]) => void;
  /** 清空选择 */
  clearSelection: () => void;
  /** 全选当前页 */
  selectAll: (rows: T[], filterFn?: (row: T) => boolean) => void;
  /** 反选当前页 */
  invertSelection: (rows: T[], filterFn?: (row: T) => boolean) => void;
  /** 设置选择（用于外部控制） */
  setSelection: (keys: React.Key[], rows: T[]) => void;
  
  // Ant Design Table rowSelection 配置
  /** rowSelection 配置对象，直接传给 Table 的 rowSelection prop */
  rowSelectionConfig: TableProps<T>['rowSelection'];
  /** 获取自定义 rowSelection 配置 */
  getRowSelectionConfig: (options?: {
    getCheckboxProps?: (record: T) => { disabled?: boolean; [key: string]: unknown };
  }) => TableProps<T>['rowSelection'];
}

const DEFAULT_GET_ROW_KEY = <T extends { id?: string }>(row: T): string => {
  if (row.id && typeof row.id === 'string') {
    return row.id;
  }
  throw new Error('useBatchSelection: 行数据必须包含 id 字段，或提供 getRowKey 选项');
};

export function useBatchSelection<T extends { id?: string }>(
  options: UseBatchSelectionOptions<T> = {}
): UseBatchSelectionReturn<T> {
  const {
    enableBatchMode = false,
    defaultSelectedRows = [],
    getRowKey = DEFAULT_GET_ROW_KEY,
    onSelectionChange,
  } = options;

  // 核心状态
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>(() => 
    defaultSelectedRows.map(getRowKey)
  );
  const [selectedRows, setSelectedRows] = useState<T[]>(defaultSelectedRows);
  
  // 批量模式状态
  const [isBatchMode, setIsBatchMode] = useState(false);

  // 计算属性
  const hasSelection = useMemo(() => selectedRowKeys.length > 0, [selectedRowKeys]);
  const selectionCount = selectedRowKeys.length;
  const computedSelectedRowKeys = useMemo(() => {
    if (enableBatchMode && !isBatchMode) {
      return undefined;
    }
    return selectedRowKeys;
  }, [enableBatchMode, isBatchMode, selectedRowKeys]);

  // 处理选择变化
  const handleSelectionChange = useCallback((keys: React.Key[], rows: T[]) => {
    setSelectedRowKeys(keys as string[]);
    setSelectedRows(rows);
    onSelectionChange?.(keys, rows);
  }, [onSelectionChange]);

  // 清空选择
  const clearSelection = useCallback(() => {
    setSelectedRowKeys([]);
    setSelectedRows([]);
  }, []);

  // 进入批量模式
  const enterBatchMode = useCallback((initialRows?: T[]) => {
    setIsBatchMode(true);
    if (initialRows && initialRows.length > 0) {
      const keys = initialRows.map(getRowKey);
      setSelectedRowKeys(keys);
      setSelectedRows(initialRows);
    }
  }, [getRowKey]);

  // 退出批量模式
  const exitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    clearSelection();
  }, [clearSelection]);

  // 切换批量模式
  const toggleBatchMode = useCallback(() => {
    if (isBatchMode) {
      exitBatchMode();
    } else {
      enterBatchMode();
    }
  }, [isBatchMode, enterBatchMode, exitBatchMode]);

  // 全选当前页
  const selectAll = useCallback((rows: T[], filterFn?: (row: T) => boolean) => {
    const selectableRows = filterFn ? rows.filter(filterFn) : rows;
    const keys = selectableRows.map(getRowKey);
    handleSelectionChange(keys, selectableRows);
  }, [getRowKey, handleSelectionChange]);

  // 反选当前页
  const invertSelection = useCallback((rows: T[], filterFn?: (row: T) => boolean) => {
    const selectableRows = filterFn ? rows.filter(filterFn) : rows;
    const currentKeySet = new Set(selectedRowKeys);
    
    const newRows: T[] = [];
    const newKeys: string[] = [];

    selectableRows.forEach(row => {
      const key = getRowKey(row);
      if (!currentKeySet.has(key)) {
        newKeys.push(key);
        newRows.push(row);
      }
    });

    // 保留不在当前页的已选项
    const selectableKeySet = new Set(selectableRows.map(getRowKey));
    const remainingKeys = selectedRowKeys.filter(k => !selectableKeySet.has(k));
    const remainingRows = selectedRows.filter(r => !selectableRows.includes(r));

    handleSelectionChange([...remainingKeys, ...newKeys], [...remainingRows, ...newRows]);
  }, [selectedRowKeys, selectedRows, getRowKey, handleSelectionChange]);

  // 设置选择
  const setSelection = useCallback((keys: React.Key[], rows: T[]) => {
    handleSelectionChange(keys, rows);
  }, [handleSelectionChange]);

  // 获取 rowSelection 配置
  const getRowSelectionConfig = useCallback((configOptions?: {
    getCheckboxProps?: (record: T) => { disabled?: boolean; [key: string]: unknown };
  }) => {
    // 可选模式下，非批量模式不显示 checkbox
    if (enableBatchMode && !isBatchMode) {
      return undefined;
    }

    return {
      selectedRowKeys,
      onChange: (keys: React.Key[], rows: T[]) => {
        handleSelectionChange(keys as string[], rows);
      },
      getCheckboxProps: configOptions?.getCheckboxProps,
    };
  }, [enableBatchMode, isBatchMode, selectedRowKeys, handleSelectionChange]);

  // 默认 rowSelection 配置
  const rowSelectionConfig = useMemo(() => {
    return getRowSelectionConfig();
  }, [getRowSelectionConfig]);

  return {
    // 状态
    selectedRowKeys,
    selectedRows,
    hasSelection,
    selectionCount,
    computedSelectedRowKeys,
    
    // 批量模式
    isBatchMode,
    enterBatchMode,
    exitBatchMode,
    toggleBatchMode,
    
    // 操作
    handleSelectionChange,
    clearSelection,
    selectAll,
    invertSelection,
    setSelection,
    
    // 配置
    rowSelectionConfig,
    getRowSelectionConfig,
  };
}

export default useBatchSelection;
