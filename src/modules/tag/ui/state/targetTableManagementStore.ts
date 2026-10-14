import {create} from 'zustand';
import type {TargetTableStatus} from '@/modules/tag/domain/entities/TargetTable';

type TargetTableStatusFilter = TargetTableStatus | undefined;

interface TargetTableManagementState {
  entityTypeIdFilter: string | undefined;
  statusFilter: TargetTableStatusFilter;
  searchText: string;
  createDrawerVisible: boolean;
  createDrawerKey: number;
  drawerVisible: boolean;
  selectedTableId: string | null;
  lastCreatedTargetTableId: string | null;
}

interface TargetTableManagementActions {
  setEntityTypeIdFilter: (value: string | undefined) => void;
  setStatusFilter: (value: TargetTableStatusFilter) => void;
  setSearchText: (value: string) => void;
  openCreateDrawer: () => void;
  closeCreateDrawer: () => void;
  openDrawer: (id: string) => void;
  closeDrawer: () => void;
  resetFilters: () => void;
  setLastCreatedTargetTableId: (id: string | null) => void;
}

export const useTargetTableManagementStore = create<TargetTableManagementState & TargetTableManagementActions>((set) => ({
  entityTypeIdFilter: undefined,
  statusFilter: undefined,
  searchText: '',
  createDrawerVisible: false,
  createDrawerKey: 0,
  drawerVisible: false,
  selectedTableId: null,
  lastCreatedTargetTableId: null,

  setEntityTypeIdFilter: (value) => set({entityTypeIdFilter: value}),
  setStatusFilter: (value) => set({statusFilter: value}),
  setSearchText: (value) => set({searchText: value}),
  openCreateDrawer: () => set((s) => ({createDrawerVisible: true, createDrawerKey: s.createDrawerKey + 1})),
  closeCreateDrawer: () => set({createDrawerVisible: false}),
  openDrawer: (id: string) => set({drawerVisible: true, selectedTableId: id}),
  closeDrawer: () => set({drawerVisible: false, selectedTableId: null}),
  resetFilters: () => set({entityTypeIdFilter: undefined, statusFilter: undefined, searchText: ''}),
  setLastCreatedTargetTableId: (id: string | null) => set({lastCreatedTargetTableId: id}),
}));

// Helper selectors
export const selectEntityTypeIdFilter = (state: TargetTableManagementState) => state.entityTypeIdFilter;
export const selectStatusFilter = (state: TargetTableManagementState) => state.statusFilter;
