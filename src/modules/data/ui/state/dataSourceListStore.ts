import {create} from 'zustand';
import {DataSourceVO} from '@/modules/data/contracts/schemas/response/datasource/index';

interface DataSourceListState {
    page: number;
    pageSize: number;
    isModalVisible: boolean;
    isEditModalVisible: boolean;
    editingDataSource: DataSourceVO | null;
    searchText: string;
    typeFilter: string;
    statusFilter: string;
}

interface DataSourceListActions {
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    setSearchText: (text: string) => void;
    setTypeFilter: (type: string) => void;
    setStatusFilter: (status: string) => void;
    openCreateModal: () => void;
    closeCreateModal: () => void;
    openEditModal: (dataSource: DataSourceVO) => void;
    closeEditModal: () => void;
}

export const useDataSourceListStore = create<DataSourceListState & DataSourceListActions>((set) => ({
    page: 1,
    pageSize: 10,
    isModalVisible: false,
    isEditModalVisible: false,
    editingDataSource: null,
    searchText: '',
    typeFilter: '',
    statusFilter: '',

    setPage: (page) => set({page}),

    setPageSize: (pageSize) => set({pageSize}),

    setSearchText: (text) => set({searchText: text}),

    setTypeFilter: (type) => set({typeFilter: type}),

    setStatusFilter: (status) => set({statusFilter: status}),

    openCreateModal: () => set({isModalVisible: true}),

    closeCreateModal: () => set({isModalVisible: false}),

    openEditModal: (dataSource) => set({isEditModalVisible: true, editingDataSource: dataSource}),

    closeEditModal: () => set({isEditModalVisible: false, editingDataSource: null}),
}));
