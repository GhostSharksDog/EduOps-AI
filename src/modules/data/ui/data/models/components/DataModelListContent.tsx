'use client';

import React, {useState} from 'react';
import PageContainer from '@/shared/ui/dashboard/PageContainer';
import {globalMessage} from '@/shared/lib/message';
import {DatabaseOutlined} from '@ant-design/icons';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import TableCard from '@/shared/ui/dashboard/TableCard/index';
import {RefreshButton} from '@/shared/ui/dashboard/RefreshButton/index';
import FilterBar from '@/modules/data/ui/data/models/components/FilterBar';
import DataModelTable from '@/modules/data/ui/data/models/components/DataModelTable';
import CreateDataModelDrawer from '@/modules/data/ui/data/models/components/CreateDataModelDrawer';
import EditDataModelDrawer from '@/modules/data/ui/data/models/components/EditDataModelDrawer';
import {
    useActivateDataModel,
    useCreateDataModel,
    useDataModels,
    useDeactivateDataModel,
    useDeleteDataModel,
    useUpdateDataModel
} from '@/modules/data/ui/data/models/hooks/useDataModels';
import type {DataModelVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import type {CreateDataModelDTO, UpdateDataModelDTO} from '@/modules/data/contracts/schemas/request/data-model/index';
import {DataModelStatus} from '@/shared/enums/data-models/DataModelStatus';
import {MESSAGES} from '@/shared/messages/index';
import {usePageSize} from '@/shared/ui/dashboard/pagination/index';

// 错误类型接口，用于捕获具有 message 属性的错误
interface ErrorWithMessage {
    message: string;
}

const DataModelListContent: React.FC = () => {
    const {pageSize, setPageSize} = usePageSize();
    const [page, setPage] = useState(1);
    const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingModel, setEditingModel] = useState<DataModelVO | null>(null);
    const [searchText, setSearchText] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [datasourceFilter, setDatasourceFilter] = useState('');

    // token usage removed

    // 使用 React Query Hooks
    const {
        data: dataModelList,
        isLoading: loading,
        refetch
    } = useDataModels({
        name: searchText || undefined,
        status: statusFilter ? (statusFilter as DataModelStatus) : undefined,
        datasourceId: datasourceFilter || undefined,
        page,
        pageSize
    });

    const createMutation = useCreateDataModel();
    const updateMutation = useUpdateDataModel();
    const deleteMutation = useDeleteDataModel();
    const activateMutation = useActivateDataModel();
    const deactivateMutation = useDeactivateDataModel();

    const handleCreate = () => {
        setIsCreateModalVisible(true);
    };

    const handleEdit = (model: DataModelVO) => {
        setEditingModel(model);
        setIsEditModalVisible(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMutation.mutateAsync(id);
            globalMessage.success(MESSAGES.DATA_MODEL.DELETE_SUCCESS);
        } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            if (err.message === 'DM_005') {
                globalMessage.error(MESSAGES.DATA_MODEL.MODEL_IN_USE);
            } else {
                globalMessage.error(MESSAGES.DATA_MODEL.DB_OPERATION_FAILED);
            }
        }
    };

    const handleStatusChange = async (id: string, status: string) => {
        try {
            if (status === DataModelStatus.ACTIVE) {
                await activateMutation.mutateAsync(id);
            } else {
                await deactivateMutation.mutateAsync(id);
            }
        } catch {
            globalMessage.error(MESSAGES.DATA_MODEL.DB_OPERATION_FAILED);
        }
    };

    const handleCreateOk = async (values: CreateDataModelDTO) => {
        try {
            await createMutation.mutateAsync(values);
            globalMessage.success(MESSAGES.DATA_MODEL.CREATE_SUCCESS);
            setIsCreateModalVisible(false);
        } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            if (err.message === 'DM_002') {
                globalMessage.error(MESSAGES.DATA_MODEL.NAME_EXISTS);
            } else if (err.message === 'DM_003') {
                globalMessage.error(MESSAGES.DATA_MODEL.DATASOURCE_NOT_FOUND);
            } else {
                globalMessage.error(MESSAGES.DATA_MODEL.DB_OPERATION_FAILED);
            }
        }
    };

    const handleEditOk = async (values: UpdateDataModelDTO) => {
        if (!editingModel) return;

        try {
            await updateMutation.mutateAsync({id: editingModel.id, data: values});
            globalMessage.success(MESSAGES.DATA_MODEL.UPDATE_SUCCESS);
            setIsEditModalVisible(false);
            setEditingModel(null);
        } catch (error: unknown) {
            const err = error as ErrorWithMessage;
            if (err.message === 'DM_002') {
                globalMessage.error(MESSAGES.DATA_MODEL.NAME_EXISTS);
            } else if (err.message === 'DM_004') {
                globalMessage.error(MESSAGES.DATA_MODEL.MODEL_NOT_FOUND);
            } else {
                globalMessage.error(MESSAGES.DATA_MODEL.DB_OPERATION_FAILED);
            }
        }
    };

    const handlePageChange = (newPage: number, newPageSize: number) => {
        setPage(newPage);
        setPageSize(newPageSize);
    };

    const handleSearchTextChange = (value: string) => {
        setSearchText(value);
        setPage(1);
    };

    const handleStatusFilterChange = (value: string) => {
        setStatusFilter(value);
        setPage(1);
    };

    const handleDatasourceFilterChange = (value: string) => {
        setDatasourceFilter(value);
        setPage(1);
    };

    return (
        <PageContainer>
            <PageHeader
                title="数据模型管理"
                description="管理系统中的所有数据模型定义，支持多维度数据建模和分析"
                iconComponent={DatabaseOutlined}
                showDefaultCreate
                onCreate={handleCreate}
            />

            <TableCard
                title="数据模型列表"
                icon={<DatabaseOutlined />}
                actions={<RefreshButton onClick={() => refetch()} loading={loading} />}
                filter={
                    <FilterBar
                        searchText={searchText}
                        statusFilter={statusFilter}
                        datasourceFilter={datasourceFilter}
                        onSearchTextChange={handleSearchTextChange}
                        onStatusFilterChange={handleStatusFilterChange}
                        onDatasourceFilterChange={handleDatasourceFilterChange}
                    />
                }
                total={dataModelList?.totalCount || 0}
                table={
                    <DataModelTable
                        data={dataModelList?.items || []}
                        loading={loading || createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}
                        total={dataModelList?.totalCount || 0}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                    />
                }
            />

            <CreateDataModelDrawer
                visible={isCreateModalVisible}
                loading={createMutation.isPending}
                onSubmit={handleCreateOk}
                onClose={() => setIsCreateModalVisible(false)}
            />

            <EditDataModelDrawer
                visible={isEditModalVisible}
                loading={updateMutation.isPending}
                editingModel={editingModel}
                onSubmit={handleEditOk}
                onClose={() => {
                    setIsEditModalVisible(false);
                    setEditingModel(null);
                }}
            />
        </PageContainer>
    );
};

export default DataModelListContent;
