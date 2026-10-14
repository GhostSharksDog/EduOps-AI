import {create} from 'zustand';
import {type SegmentVO} from '@/modules/segment/contracts/schemas/response/segment/index';

interface SegmentDetailState {
    selectedSegmentId: string;
    selectedSegment: SegmentVO | null;
    memberPage: number;
    memberPageSize: number;
}

interface SegmentDetailActions {
    setSelectedSegmentId: (id: string) => void;
    setSelectedSegment: (segment: SegmentVO | null) => void;
    setMemberPage: (page: number) => void;
    setMemberPageSize: (pageSize: number) => void;
}

export const useSegmentDetailStore = create<SegmentDetailState & SegmentDetailActions>((set) => ({
    selectedSegmentId: '',
    selectedSegment: null,
    memberPage: 1,
    memberPageSize: 20,

    setSelectedSegmentId: (id) => set({selectedSegmentId: id}),

    setSelectedSegment: (segment) => set({selectedSegment: segment}),

    setMemberPage: (page) => set({memberPage: page}),

    setMemberPageSize: (pageSize) => set({memberPageSize: pageSize}),
}));
