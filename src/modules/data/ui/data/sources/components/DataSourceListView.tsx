'use client';

import {useCallback, useMemo, useState} from 'react';
import {Modal, Space, Button} from 'antd';
import {CheckSquareOutlined, CloseOutlined, DatabaseOutlined, DeleteOutlined} from '@ant-design/icons';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import TableCard from '@/shared/ui/dashboard/TableCard/index';
import {RefreshButton} from '@/shared/ui/dashboard/RefreshButton/index';
import FilterBar from '@/modules/data/ui/data/sources/components/FilterBar';
import DataSourceTable from '@/modules/data/ui/data/sources/components/DataSourceTable';
import DataSourceTableSkeleton from '@/modules/data/ui/data/sources/components/DataSourceTableSkeleton';
import CreateDataSourceDrawer from '@/modules/data/ui/data/sources/components/CreateDataSourceDrawer';
import EditDataSourceDrawer from '@/modules/data/ui/data/sources/components/EditDataSourceDrawer';
import BatchOperationModal from '@/shared/ui/dashboard/BatchOperationModal/BatchOperationModal';
import {useBatchSelection} from '@/shared/hooks/useBatchSelection';
import {
    useChangeDataSourceStatus,
    useCreateDataSource,
    useDataSources,
    useDeleteDataSource,
    useUpdateDataSource
} from '@/modules/data/ui/data/sources/hooks/useDataSources';
import {DataSourceStatus, DataSourceType} from '@/shared/enums/index';
import {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';
import {CreateDataSourceDTO, UpdateDataSourceDTO} from '@/modules/data/contracts/schemas/request/datasource/index';
import {globalMessage} from '@/shared/lib/message';
import {MESSAGES} from '@/shared/messages/index';
import {usePageSize} from '@/shared/ui/dashboard/pagination/index';

interface DataSourceListViewProps {
    page?: number;
    pageSize?: number;
    onPageChange?: (page: number, pageSize: number) => void;
    onPageSizeChange?: (page: number, pageSize: number) => void;
}

export default function DataSourceListView({
                                               page: initialPage = 1,
                                               pageSize: initialPageSize,
                                               onPageChange,
                                               onPageSizeChange
                                           }: DataSourceListViewProps) {
    const {pageSize: storePageSize, setPageSize} = usePageSize();
    const [page, setPage] = useState(initialPage);
    const [pageSize, setLocalPageSize] = useState(initialPageSize ?? storePageSize);
    const [searchText, setSearchText] = useState('');
    const [typeFilter, setTypeFilter] = useState<DataSourceType | undefined>();
    const [statusFilter, setStatusFilter] = useState<DataSourceStatus | undefined>();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingDataSource, setEditingDataSource] = useState<DataSourceVO | null>(null);
    const [isBatchDeleteModalVisible, setIsBatchDeleteModalVisible] = useState(false);

    const batchSelection = useBatchSelection<DataSourceVO>({enableBatchMode: true});

    

    const {
        data: dataSourceData,
        isLoading: loading,
        refetch
    } = useDataSources({
        page,
        pageSize,
        keyword: searchText,
        type: typeFilter,
        status: statusFilter
    });

    const createMutation = useCreateDataSource();
    const updateMutation = useUpdateDataSource();
    const deleteMutation = useDeleteDataSource();
    const changeStatusMutation = useChangeDataSourceStatus();

    const data = useMemo(() => dataSourceData?.items || [], [dataSourceData?.items]);
    const total = useMemo(() => dataSourceData?.totalCount || 0, [dataSourceData?.totalCount]);

    const isRowSelectable = useCallback((record: DataSourceVO) => {
        return record.status !== DataSourceStatus.ACTIVE;
    }, []);

    const hasSelectableRows = useMemo(() => {
        return data.some(isRowSelectable);
    }, [data, isRowSelectable]);

    const handleBatchSelect = useCallback(() => {
        const selectableData = data.filter(isRowSelectable);
        batchSelection.enterBatchMode(selectableData);
    }, [data, isRowSelectable, batchSelection]);

    const handleBatchDelete = useCallback(() => {
        setIsBatchDeleteModalVisible(true);
    }, []);

    const handleBatchDeleteOk = useCallback(async () => {
        const selectedKeys = batchSelection.selectedRowKeys;
        const selectedCount = selectedKeys.length;

        try {
            const results = await Promise.allSettled(
                selectedKeys.map(id => deleteMutation.mutateAsync(id))
            );

            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
                globalMessage.error(`删除失败: ${failed.length} 个数据源`);
            } else {
                globalMessage.success(`成功删除 ${selectedCount} 个数据源`);
            }
            batchSelection.exitBatchMode();
            setIsBatchDeleteModalVisible(false);
            refetch();
        } catch {
            globalMessage.error('批量删除失败');
        }
    }, [batchSelection, deleteMutation, refetch]);

    const openCreateModal = () => {
        setIsModalVisible(true);
    };

    const closeCreateModal = () => {
        setIsModalVisible(false);
    };

    const openEditModal = (dataSource: DataSourceVO) => {
        setIsEditModalVisible(true);
        setEditingDataSource(dataSource);
    };

    const closeEditModal = () => {
        setIsEditModalVisible(false);
        setEditingDataSource(null);
    };

    const handleDelete = (id: string) => {
        const closeModal = () => closeEditModal();
        Modal.confirm({
            title: MESSAGES.COMMON.DELETE_CONFIRM_TITLE,
            content: MESSAGES.DATA_SOURCE.DELETE_CONFIRM_CONTENT,
            okText: MESSAGES.COMMON.OK,
            cancelText: MESSAGES.COMMON.CANCEL,
            onOk: async () => {
                try {
                    await deleteMutation.mutateAsync(id);
                    globalMessage.success(MESSAGES.DATA_SOURCE.DELETE_SUCCESS);
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : MESSAGES.COMMON.UNKNOWN_ERROR;
                    globalMessage.error(MESSAGES.DATA_SOURCE.DELETE_FAILED + ': ' + errorMessage);
                }
                closeModal();
            },
        });
    };

    const handleCreateDataSource = async (values: CreateDataSourceDTO) => {
        try {
            await createMutation.mutateAsync({
                name: values.name,
                type: values.type,
                host: values.host,
                port: Number(values.port),
                databaseName: values.databaseName,
                username: values.username,
                password: values.password,
                status: values.status,
                description: values.description,
                feature: typeof values.feature === 'string' && values.feature.trim() !== '' ? JSON.parse(values.feature) : undefined
            });
            setIsModalVisible(false);
            globalMessage.success(MESSAGES.DATA_SOURCE.CREATE_SUCCESS);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : MESSAGES.COMMON.UNKNOWN_ERROR;
            globalMessage.error(MESSAGES.DATA_SOURCE.CREATE_FAILED + ': ' + errorMessage);
        }
    };

    const handleUpdateDataSource = async (values: UpdateDataSourceDTO) => {
        if (!editingDataSource) return;

        try {
            await updateMutation.mutateAsync({
                dataSourceId: editingDataSource.id,
                dataSourceData: {
                    name: values.name,
                    host: values.host,
                    port: Number(values.port),
                    databaseName: values.databaseName,
                    username: values.username,
                    password: values.password,
                    status: values.status,
                    description: values.description,
                    feature: typeof values.feature === 'string' && values.feature.trim() !== '' ? JSON.parse(values.feature) : undefined
                }
            });
            setIsEditModalVisible(false);
            setEditingDataSource(null);
            globalMessage.success(MESSAGES.DATA_SOURCE.UPDATE_SUCCESS);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : MESSAGES.COMMON.UNKNOWN_ERROR;
            globalMessage.error(MESSAGES.DATA_SOURCE.UPDATE_FAILED + ': ' + errorMessage);
        }
    };

    const handleChangeDataSourceStatus = async (id: string, newStatus: DataSourceStatus) => {
        try {
            await changeStatusMutation.mutateAsync({dataSourceId: id, status: newStatus});
            globalMessage.success(MESSAGES.DATA_SOURCE.STATUS_UPDATE_SUCCESS);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : MESSAGES.COMMON.UNKNOWN_ERROR;
            globalMessage.error(MESSAGES.DATA_SOURCE.STATUS_UPDATE_FAILED + ': ' + errorMessage);
        }
    };

    const handleSearchTextChange = (value: string) => {
        setSearchText(value);
        setPage(1);
    };

    const handleTypeFilterChange = (value: DataSourceType | undefined) => {
        setTypeFilter(value);
        setPage(1);
    };

    const handlePageChange = (newPage: number, newPageSize: number) => {
        setPage(newPage);
        setLocalPageSize(newPageSize);
        setPageSize(newPageSize);
        onPageChange?.(newPage, newPageSize);
        onPageSizeChange?.(newPage, newPageSize);
    };

    const handleStatusFilterChange = (value: DataSourceStatus | undefined) => {
        setStatusFilter(value);
        setPage(1);
    };

    return (
        <PageContainer>
            <PageHeader
                title="数据源管理"
                description="管理系统中的所有数据源连接，支持多种数据源的接入和配置"
                iconComponent={DatabaseOutlined}
                showDefaultCreate
                onCreate={openCreateModal}
            />

            <TableCard
                title="数据源列表"
                icon={<DatabaseOutlined />}
                actions={
                    batchSelection.isBatchMode ? (
                        <Space>
                            <Button
                                icon={<CloseOutlined />}
                                onClick={batchSelection.exitBatchMode}
                            >
                                取消选择
                            </Button>
                            <Button
                                type="primary"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={handleBatchDelete}
                                disabled={!batchSelection.hasSelection}
                            >
                                批量删除 ({batchSelection.selectionCount})
                            </Button>
                        </Space>
                    ) : (
                        <Space>
                            <Button
                                icon={<CheckSquareOutlined />}
                                onClick={handleBatchSelect}
                                disabled={!hasSelectableRows}
                            >
                                批量选择
                            </Button>
                            <RefreshButton onClick={() => refetch()} loading={loading} />
                        </Space>
                    )
                }
                filter={
                    <FilterBar
                        searchText={searchText}
                        typeFilter={typeFilter}
                        statusFilter={statusFilter}
                        onSearchTextChange={handleSearchTextChange}
                        onTypeFilterChange={handleTypeFilterChange}
                        onStatusFilterChange={handleStatusFilterChange}
                    />
                }
                total={total}
                loading={loading}
                table={
                    loading ? (
                        <DataSourceTableSkeleton/>
                    ) : (
                        <DataSourceTable
                            data={data}
                            total={total}
                            loading={loading}
                            page={page}
                            pageSize={pageSize}
                            onEdit={openEditModal}
                            onDelete={handleDelete}
                            onStatusChange={handleChangeDataSourceStatus}
                            onPageChange={handlePageChange}
                            onPageSizeChange={setPageSize}
                            selectedRowKeys={batchSelection.computedSelectedRowKeys}
                            onSelectionChange={batchSelection.handleSelectionChange}
                            getCheckboxProps={(record) => ({disabled: !isRowSelectable(record)})}
                        />
                    )
                }
            />

            <CreateDataSourceDrawer
                visible={isModalVisible}
                loading={createMutation.isPending}
                onOk={handleCreateDataSource}
                onCancel={closeCreateModal}
            />

            <EditDataSourceDrawer
                open={isEditModalVisible}
                loading={updateMutation.isPending}
                editingDataSource={editingDataSource}
                onSubmit={handleUpdateDataSource}
                onClose={closeEditModal}
            />

            <BatchOperationModal
                open={isBatchDeleteModalVisible}
                operationType="delete"
                count={batchSelection.selectionCount}
                itemName="数据源"
                onConfirm={handleBatchDeleteOk}
                onCancel={() => setIsBatchDeleteModalVisible(false)}
                loading={deleteMutation.isPending}
            />
        </PageContainer>
    );
}
