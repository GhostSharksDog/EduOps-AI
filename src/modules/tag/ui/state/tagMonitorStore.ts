import {create} from 'zustand';

export type MvStatus = 'healthy' | 'warning' | 'error';

interface TagMonitorState {
  statusFilter: MvStatus | 'all';
  searchText: string;
  showUnresolvedOnly: boolean;
  selectedTagId: string | undefined;
  setStatusFilter: (filter: MvStatus | 'all') => void;
  setSearchText: (text: string) => void;
  setShowUnresolvedOnly: (value: boolean) => void;
  setSelectedTagId: (tagId: string | undefined) => void;
}

export const useTagMonitorStore = create<TagMonitorState>((set) => ({
  statusFilter: 'all',
  searchText: '',
  showUnresolvedOnly: true,
  selectedTagId: undefined,
  setStatusFilter: (filter) => set({statusFilter: filter}),
  setSearchText: (text) => set({searchText: text}),
  setShowUnresolvedOnly: (value) => set({showUnresolvedOnly: value}),
  setSelectedTagId: (tagId) => set({selectedTagId: tagId}),
}));
