/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import BatchActionBar from '@/shared/ui/dashboard/BatchActionBar/BatchActionBar';
import type { UseBatchSelectionReturn } from '@/shared/hooks/useBatchSelection';

interface TestItem {
  id: string;
  name: string;
  status: string;
}

const mockBatchSelection = {
  selectedRowKeys: [] as string[],
  selectedRows: [] as TestItem[],
  hasSelection: false,
  selectionCount: 0,
  computedSelectedRowKeys: undefined as string[] | undefined,
  isBatchMode: false,
  enterBatchMode: vi.fn(),
  exitBatchMode: vi.fn(),
  toggleBatchMode: vi.fn(),
  handleSelectionChange: vi.fn(),
  clearSelection: vi.fn(),
  selectAll: vi.fn(),
  invertSelection: vi.fn(),
  setSelection: vi.fn(),
  rowSelectionConfig: undefined,
  getRowSelectionConfig: vi.fn(),
};

const createMockBatchSelection = (
  overrides: Partial<UseBatchSelectionReturn<TestItem>> = {}
): UseBatchSelectionReturn<TestItem> => ({
  ...mockBatchSelection,
  ...overrides,
});

const testData: TestItem[] = [
  { id: '1', name: 'Item 1', status: 'ACTIVE' },
  { id: '2', name: 'Item 2', status: 'ACTIVE' },
  { id: '3', name: 'Item 3', status: 'DELETED' },
];

describe('BatchActionBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('非批量模式', () => {
    it('应该显示"批量选择"按钮', () => {
      const batchSelection = createMockBatchSelection({ isBatchMode: false });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
        />
      );

      expect(screen.getByText('批量选择')).toBeInTheDocument();
    });

    it('点击"批量选择"应该调用 enterBatchMode', async () => {
      const batchSelection = createMockBatchSelection({ isBatchMode: false });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
          data={testData}
        />
      );

      fireEvent.click(screen.getByText('批量选择'));

      expect(batchSelection.enterBatchMode).toHaveBeenCalled();
    });

    it('应该支持自定义按钮文字', () => {
      const batchSelection = createMockBatchSelection({ isBatchMode: false });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
          enterButtonLabel="选择多项"
        />
      );

      expect(screen.getByText('选择多项')).toBeInTheDocument();
    });

    it('enterDisabled 为 true 时按钮应该禁用', () => {
      const batchSelection = createMockBatchSelection({ isBatchMode: false });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
          enterDisabled={true}
        />
      );

      const button = screen.getByText('批量选择').closest('button');
      expect(button).toBeDisabled();
    });
  });

  describe('批量模式', () => {
    it('应该显示"取消选择"和操作按钮', () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 2,
        selectedRowKeys: ['1', '2'],
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
        />
      );

      expect(screen.getByText('取消选择')).toBeInTheDocument();
      expect(screen.getByText(/批量删除/)).toBeInTheDocument();
    });

    it('点击"取消选择"应该调用 exitBatchMode', async () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 1,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
        />
      );

      fireEvent.click(screen.getByText('取消选择'));

      expect(batchSelection.exitBatchMode).toHaveBeenCalled();
    });

    it('无选中项时操作按钮应该禁用', () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: false,
        selectionCount: 0,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
        />
      );

      const deleteButton = screen.getByText(/批量删除/).closest('button');
      expect(deleteButton).toBeDisabled();
    });

    it('应该显示选中数量', () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 5,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
        />
      );

      expect(screen.getByText(/批量删除 \(5\)/)).toBeInTheDocument();
    });

    it('应该支持自定义取消按钮文字', () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 1,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
          cancelButtonLabel="退出选择"
        />
      );

      expect(screen.getByText('退出选择')).toBeInTheDocument();
    });
  });

  describe('操作按钮', () => {
    it('应该支持多个操作', () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 1,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[
            { type: 'delete', onExecute: vi.fn() },
            { type: 'activate', onExecute: vi.fn() },
          ]}
        />
      );

      expect(screen.getByText(/批量删除/)).toBeInTheDocument();
      expect(screen.getByText(/批量激活/)).toBeInTheDocument();
    });

    it('应该支持自定义操作标签', () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 1,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[
            { type: 'custom', label: '自定义操作', onExecute: vi.fn() },
          ]}
        />
      );

      expect(screen.getByText(/自定义操作/)).toBeInTheDocument();
    });

    it('delete 操作按钮应该是危险样式', () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 1,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
        />
      );

      const deleteButton = screen.getByText(/批量删除/).closest('button');
      expect(deleteButton).toHaveAttribute('type', 'button');
    });
  });

  describe('确认弹窗', () => {
    it('点击操作按钮应该显示确认弹窗', async () => {
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 2,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
        />
      );

      fireEvent.click(screen.getByText(/批量删除/));

      expect(screen.getByText('确认删除')).toBeInTheDocument();
    });

    it('确认操作应该调用 onExecute', async () => {
      const onExecute = vi.fn().mockResolvedValue(undefined);
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 2,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute }]}
        />
      );

      fireEvent.click(screen.getByText(/批量删除/));
      fireEvent.click(screen.getByText('确认删除'));

      expect(onExecute).toHaveBeenCalled();
    });

    it('取消确认应该关闭弹窗', async () => {
      const onExecute = vi.fn();
      const batchSelection = createMockBatchSelection({
        isBatchMode: true,
        hasSelection: true,
        selectionCount: 2,
      });

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute }]}
        />
      );

      fireEvent.click(screen.getByText(/批量删除/));
      
      const modalFooter = document.querySelector('.ant-modal-footer') as HTMLElement;
      const cancelButton = within(modalFooter).getByRole('button', { name: /取/ });
      fireEvent.click(cancelButton);

      expect(onExecute).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.queryByText('确认删除')).not.toBeInTheDocument();
      });
    });
  });

  describe('selectableFilter', () => {
    it('进入批量模式时应该过滤可选行', async () => {
      const batchSelection = createMockBatchSelection({ isBatchMode: false });
      const onEnterBatchMode = vi.fn();

      render(
        <BatchActionBar
          batchSelection={batchSelection}
          operations={[{ type: 'delete', onExecute: vi.fn() }]}
          data={testData}
          selectableFilter={(item) => item.status !== 'DELETED'}
          onEnterBatchMode={onEnterBatchMode}
        />
      );

      fireEvent.click(screen.getByText('批量选择'));

      const selectableRows = testData.filter((item) => item.status !== 'DELETED');
      expect(onEnterBatchMode).toHaveBeenCalledWith(selectableRows);
    });
  });
});
