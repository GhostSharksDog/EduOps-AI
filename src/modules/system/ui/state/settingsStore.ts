import {create} from 'zustand';

interface SettingsState {
    activeTab: string;
    pageSize: number;
    isLoaded: boolean;
}

interface SettingsActions {
    setActiveTab: (tab: string) => void;
    setPageSize: (size: number) => void;
    setLoaded: (loaded: boolean) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
    activeTab: 'appearance',
    pageSize: 20,
    isLoaded: false,

    setActiveTab: (tab) => set({activeTab: tab}),
    setPageSize: (size) => set({pageSize: size, isLoaded: true}),
    setLoaded: (loaded) => set({isLoaded: loaded}),
}));
