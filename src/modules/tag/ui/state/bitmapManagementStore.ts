import {create} from 'zustand';

interface BitmapManagementState {
    entityTypeIdFilter: string | undefined;
    statusFilter: 'ACTIVE' | 'INACTIVE' | undefined;
    searchText: string;
    createDrawerVisible: boolean;
    drawerVisible: boolean;
    selectedTableId: string | null;
}

interface BitmapManagementActions {
    setEntityTypeIdFilter: (value: string | undefined) => void;
    setStatusFilter: (value: 'ACTIVE' | 'INACTIVE' | undefined) => void;
    setSearchText: (value: string) => void;
    openCreateDrawer: () => void;
    closeCreateDrawer: () => void;
    openDrawer: (id: string) => void;
    closeDrawer: () => void;
}

export const useBitmapManagementStore = create<BitmapManagementState & BitmapManagementActions>((set) => ({
    entityTypeIdFilter: undefined,
    statusFilter: undefined,
    searchText: '',
    createDrawerVisible: false,
    drawerVisible: false,
    selectedTableId: null,

    setEntityTypeIdFilter: (value) => set({entityTypeIdFilter: value}),
    setStatusFilter: (value) => set({statusFilter: value}),
    setSearchText: (value) => set({searchText: value}),
    openCreateDrawer: () => set({createDrawerVisible: true}),
    closeCreateDrawer: () => set({createDrawerVisible: false}),
    openDrawer: (id) => set({drawerVisible: true, selectedTableId: id}),
    closeDrawer: () => set({drawerVisible: false, selectedTableId: null}),
}));
