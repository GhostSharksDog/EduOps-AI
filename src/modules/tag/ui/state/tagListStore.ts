import {create} from 'zustand';
import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import {type TagVO} from '@/modules/tag/contracts/schemas/response/tag/index';

interface TagListState {
    page: number;
    pageSize: number;
    isModalVisible: boolean;
    isEditModalVisible: boolean;
    editingTag: TagVO | null;
    isEditRuleModalVisible: boolean;
    editingRuleTag: TagVO | null;
    versionDrawerVisible: boolean;
    selectedTagId: string;
    selectedTagName: string;
    searchText: string;
    statusFilter: TagStatus | undefined;
    categoryFilter: string | undefined;
    dataTypeFilter: TagValueType | undefined;
    updateCycleFilter: UpdateCycle | undefined;
    isPublicFilter: boolean | undefined;
    statusConfirmModal: {
        visible: boolean;
        action: 'activate' | 'deactivate' | 'resume' | 'deprecate' | null;
        tag: TagVO | null;
    };
    valueQueryDrawerVisible: boolean;
    valueQueryTag: TagVO | null;
}

interface TagListActions {
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    setSearchText: (text: string) => void;
    setStatusFilter: (status: TagStatus | undefined) => void;
    setCategoryFilter: (category: string | undefined) => void;
    setDataTypeFilter: (dataType: TagValueType | undefined) => void;
    setUpdateCycleFilter: (updateCycle: UpdateCycle | undefined) => void;
    setIsPublicFilter: (isPublic: boolean | undefined) => void;
    openCreateModal: () => void;
    closeCreateModal: () => void;
    openEditModal: (tag: TagVO) => void;
    closeEditModal: () => void;
    openEditRuleModal: (tag: TagVO) => void;
    closeEditRuleModal: () => void;
    openVersionDrawer: (tagId: string, tagName: string) => void;
    closeVersionDrawer: () => void;
    openStatusConfirmModal: (action: 'activate' | 'deactivate' | 'resume' | 'deprecate', tag: TagVO) => void;
    closeStatusConfirmModal: () => void;
    openValueQueryDrawer: (tag: TagVO) => void;
    closeValueQueryDrawer: () => void;
}

export const useTagListStore = create<TagListState & TagListActions>((set) => ({
    page: 1,
    pageSize: 10,
    isModalVisible: false,
    isEditModalVisible: false,
    editingTag: null,
    isEditRuleModalVisible: false,
    editingRuleTag: null,
    versionDrawerVisible: false,
    selectedTagId: '',
    selectedTagName: '',
    searchText: '',
    statusFilter: undefined,
    categoryFilter: undefined,
    dataTypeFilter: undefined,
    updateCycleFilter: undefined,
    isPublicFilter: undefined,
    statusConfirmModal: {
        visible: false,
        action: null,
        tag: null,
    },
    valueQueryDrawerVisible: false,
    valueQueryTag: null,

    setPage: (page) => set({page}),

    setPageSize: (pageSize) => set({pageSize}),

    setSearchText: (text) => set({searchText: text}),

    setStatusFilter: (status) => set({statusFilter: status}),

    setCategoryFilter: (category) => set({categoryFilter: category}),
    setDataTypeFilter: (dataType) => set({dataTypeFilter: dataType}),
    setUpdateCycleFilter: (updateCycle) => set({updateCycleFilter: updateCycle}),
    setIsPublicFilter: (isPublic) => set({isPublicFilter: isPublic}),

    openCreateModal: () => set({isModalVisible: true}),

    closeCreateModal: () => set({isModalVisible: false}),

    openEditModal: (tag) => set({isEditModalVisible: true, editingTag: tag}),

    closeEditModal: () => set({isEditModalVisible: false, editingTag: null}),

    openEditRuleModal: (tag) => set({isEditRuleModalVisible: true, editingRuleTag: tag}),

    closeEditRuleModal: () => set({isEditRuleModalVisible: false, editingRuleTag: null}),

    openVersionDrawer: (tagId, tagName) => set({
        versionDrawerVisible: true,
        selectedTagId: tagId,
        selectedTagName: tagName
    }),

    closeVersionDrawer: () => set({versionDrawerVisible: false, selectedTagId: '', selectedTagName: ''}),

    openStatusConfirmModal: (action, tag) => set({
        statusConfirmModal: {
            visible: true,
            action,
            tag,
        },
    }),

    closeStatusConfirmModal: () => set({
        statusConfirmModal: {
            visible: false,
            action: null,
            tag: null,
        },
    }),

    openValueQueryDrawer: (tag) => set({
        valueQueryDrawerVisible: true,
        valueQueryTag: tag,
    }),

    closeValueQueryDrawer: () => set({
        valueQueryDrawerVisible: false,
        valueQueryTag: null,
    }),
}));
