'use client';

import React, {useState} from 'react';
import {Button, Space} from 'antd';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {MESSAGES} from '@/shared/messages/index';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import {DeleteOutlined, ReloadOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
    useBatchPermanentDelete,
    useBatchRestore,
    usePermanentDeleteItem,
    useRecycleBinItems,
    useRestoreItem
} from '@/modules/system/ui/system/recycle-bin/hooks/useRecycleBin';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';
import type {RecycleBinItemVO} from '@/modules/system/contracts/schemas/response/recycle-bin/index';
import {log} from '@/platform/logger';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import TableCard from '@/shared/ui/dashboard/TableCard/index';
import {RefreshButton} from '@/shared/ui/dashboard/RefreshButton/index';
import FilterBar from '@/modules/system/ui/system/recycle-bin/components/FilterBar';
import RecycleBinTable from '@/modules/system/ui/system/recycle-bin/components/RecycleBinTable';
import {usePageSize} from '@/shared/ui/dashboard/pagination/index';
import {useBatchSelection} from '@/shared/hooks/useBatchSelection';
import BatchOperationModal from '@/shared/ui/dashboard/BatchOperationModal/BatchOperationModal';

type ConfirmModalType = 'restore' | 'permanentDelete' | 'batchRestore' | 'batchPermanentDelete' | null;

const RecycleBinPage: React.FC = () => {
    const {success, error} = useGlobalMessage();
    const {pageSize, setPageSize} = usePageSize();
    const [page, setPage] = useState(1);
    const [searchText, setSearchText] = useState('');
    const [typeFilter, setTypeFilter] = useState<RecycleBinItemType | undefined>(undefined);
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
    
    const [confirmModalType, setConfirmModalType] = useState<ConfirmModalType>(null);
    const [currentRecord, setCurrentRecord] = useState<RecycleBinItemVO | null>(null);
    const [confirmLoading, setConfirmLoading] = useState(false);

    const batchSelection = useBatchSelection<RecycleBinItemVO>();

    const queryParams = {
        page,
        pageSize,
        keyword: searchText,
        type: typeFilter,
        deletedFrom: dateRange?.[0]?.toISOString(),
        deletedTo: dateRange?.[1]?.toISOString(),
    };

    const {data: recycleBinData, isLoading: loading, refetch} = useRecycleBinItems(queryParams);
    const restoreMutation = useRestoreItem();
    const permanentDeleteMutation = usePermanentDeleteItem();
    const batchRestoreMutation = useBatchRestore();
    const batchPermanentDeleteMutation = useBatchPermanentDelete();

    const handleRestore = (record: RecycleBinItemVO): Promise<void> => {
        setCurrentRecord(record);
        setConfirmModalType('restore');
        return new Promise((resolve) => {
            (window as unknown as {_resolveRestore: () => void})._resolveRestore = resolve;
        });
    };

    const handlePermanentDelete = (record: RecycleBinItemVO): Promise<void> => {
        setCurrentRecord(record);
        setConfirmModalType('permanentDelete');
        return new Promise((resolve) => {
            (window as unknown as {_resolvePermanentDelete: () => void})._resolvePermanentDelete = resolve;
        });
    };

    const handleBatchRestore = () => {
        setConfirmModalType('batchRestore');
    };

    const handleBatchPermanentDelete = () => {
        setConfirmModalType('batchPermanentDelete');
    };

    const handleConfirmOk = async () => {
        setConfirmLoading(true);
        try {
            switch (confirmModalType) {
                case 'restore':
                    if (!currentRecord) return;
                    await restoreMutation.mutateAsync({
                        id: currentRecord.id,
                        type: currentRecord.type
                    });
                    success(MESSAGES.COMMON.RESTORE_SUCCESS);
                    (window as unknown as {_resolveRestore: () => void})._resolveRestore?.();
                    break;
                case 'permanentDelete':
                    if (!currentRecord) return;
                    await permanentDeleteMutation.mutateAsync({
                        id: currentRecord.id,
                        type: currentRecord.type
                    });
                    success(MESSAGES.COMMON.PERMANENT_DELETE_SUCCESS);
                    (window as unknown as {_resolvePermanentDelete: () => void})._resolvePermanentDelete?.();
                    break;
                case 'batchRestore': {
                    const ids = batchSelection.selectedRows.map(row => ({id: row.id, type: row.type}));
                    await batchRestoreMutation.mutateAsync({ids});
                    success(MESSAGES.COMMON.RESTORE_SUCCESS);
                    batchSelection.clearSelection();
                    break;
                }
                case 'batchPermanentDelete': {
                    const ids = batchSelection.selectedRows.map(row => ({id: row.id, type: row.type}));
                    await batchPermanentDeleteMutation.mutateAsync({ids});
                    success(MESSAGES.COMMON.PERMANENT_DELETE_SUCCESS);
                    batchSelection.clearSelection();
                    break;
                }
            }
            setConfirmModalType(null);
            setCurrentRecord(null);
        } catch (err) {
            log.error('操作失败', err);
            error(MESSAGES.COMMON.OPERATION_FAILED);
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleConfirmCancel = () => {
        setConfirmModalType(null);
        setCurrentRecord(null);
    };

    const handlePageChange = (newPage: number, newPageSize: number) => {
        setPage(newPage);
        setPageSize(newPageSize);
    };

    const items = recycleBinData?.items || [];

    return (
        <PageContainer>
            <PageHeader
                title="回收站"
                description="查看和管理所有已删除的数据，支持恢复或永久删除"
                iconComponent={DeleteOutlined}
                useErrorTheme
            />
            <TableCard
                title="已删除数据"
                icon={<DeleteOutlined />}
                filter={
                    <FilterBar
                        searchText={searchText}
                        typeFilter={typeFilter}
                        dateRange={dateRange}
                        onSearchTextChange={setSearchText}
                        onTypeFilterChange={setTypeFilter}
                        onDateRangeChange={setDateRange}
                    />
                }
                total={recycleBinData?.totalCount || 0}
                totalLabel="条记录"
                actions={
                    <Space>
                        <RefreshButton onClick={() => refetch()} loading={loading} />
                        {batchSelection.hasSelection && (
                            <>
                                <Button 
                                    icon={<ReloadOutlined />}
                                    onClick={handleBatchRestore}
                                >
                                    批量恢复 ({batchSelection.selectionCount})
                                </Button>
                                <Button 
                                    danger 
                                    onClick={handleBatchPermanentDelete}
                                >
                                    批量删除 ({batchSelection.selectionCount})
                                </Button>
                            </>
                        )}
                    </Space>
                }
                table={
                    <RecycleBinTable
                        data={items}
                        loading={loading}
                        page={page}
                        pageSize={pageSize}
                        total={recycleBinData?.totalCount || 0}
                        selectedRowKeys={batchSelection.selectedRowKeys}
                        onRestore={handleRestore}
                        onPermanentDelete={handlePermanentDelete}
                        onPageChange={handlePageChange}
                        onSelectionChange={batchSelection.handleSelectionChange}
                    />
                }
            />
            
            <BatchOperationModal
                open={confirmModalType === 'restore'}
                operationType="restore"
                count={1}
                itemName={`"${currentRecord?.name}"`}
                loading={confirmLoading}
                onConfirm={handleConfirmOk}
                onCancel={handleConfirmCancel}
            />

            <BatchOperationModal
                open={confirmModalType === 'permanentDelete'}
                operationType="delete"
                count={1}
                itemName={`"${currentRecord?.name}"`}
                loading={confirmLoading}
                onConfirm={handleConfirmOk}
                onCancel={handleConfirmCancel}
            />

            <BatchOperationModal
                open={confirmModalType === 'batchRestore'}
                operationType="restore"
                count={batchSelection.selectionCount}
                itemName="条数据"
                loading={confirmLoading}
                onConfirm={handleConfirmOk}
                onCancel={handleConfirmCancel}
            />

            <BatchOperationModal
                open={confirmModalType === 'batchPermanentDelete'}
                operationType="delete"
                count={batchSelection.selectionCount}
                itemName="条数据"
                loading={confirmLoading}
                onConfirm={handleConfirmOk}
                onCancel={handleConfirmCancel}
            />
        </PageContainer>
    );
};

export default RecycleBinPage;
