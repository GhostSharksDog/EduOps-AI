import {create} from 'zustand';
import {type SegmentVO} from '@/modules/segment/contracts/schemas/response/segment/index';
import {type SegmentRuleDTO, type SegmentConditionGroupDTO} from '@/modules/segment/contracts/schemas/request/segment/index';

interface CreateSegmentState {
    estimatedCount: number | null;
    currentSegment: SegmentVO | null;
    rules: SegmentRuleDTO | SegmentConditionGroupDTO | null;
}

interface CreateSegmentActions {
    setEstimatedCount: (count: number | null) => void;
    setCurrentSegment: (segment: SegmentVO | null) => void;
    setRules: (rules: SegmentRuleDTO | SegmentConditionGroupDTO | null) => void;
    resetStore: () => void;
}

export const useCreateSegmentStore = create<CreateSegmentState & CreateSegmentActions>((set) => ({
    estimatedCount: null,
    currentSegment: null,
    rules: null,

    setEstimatedCount: (count) => set({estimatedCount: count}),

    setCurrentSegment: (segment) => set({currentSegment: segment}),

    setRules: (rules) => set({rules: rules}),

    resetStore: () => set({
        estimatedCount: null,
        currentSegment: null,
        rules: null,
    }),
}));
