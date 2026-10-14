import {create} from 'zustand';
import {SegmentStatus, SegmentType} from '@/shared/enums/index';

interface SegmentListState {
    page: number;
    pageSize: number;
    searchText: string;
    typeFilter: SegmentType | undefined;
    statusFilter: SegmentStatus | undefined;
}

interface SegmentListActions {
    setPage: (page: number) => void;
    setPageSize: (pageSize: number) => void;
    setSearchText: (text: string) => void;
    setTypeFilter: (type: SegmentType | undefined) => void;
    setStatusFilter: (status: SegmentStatus | undefined) => void;
}

export const useSegmentListStore = create<SegmentListState & SegmentListActions>((set) => ({
    page: 1,
    pageSize: 20,
    searchText: '',
    typeFilter: undefined,
    statusFilter: undefined,

    setPage: (page) => set({page}),

    setPageSize: (pageSize) => set({pageSize}),

    setSearchText: (text) => set({searchText: text}),

    setTypeFilter: (type) => set({typeFilter: type}),

    setStatusFilter: (status) => set({statusFilter: status}),
}));
