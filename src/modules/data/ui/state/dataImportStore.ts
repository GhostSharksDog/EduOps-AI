import {create} from 'zustand';
import {globalMessage} from '@/shared/lib/message';
import type {UploadFile} from 'antd/es/upload/interface';
import {MESSAGES} from '@/shared/messages/index';

export interface ImportTask {
    id: string;
    fileName: string;
    dataType: string;
    status: 'pending' | 'processing' | 'success' | 'error';
    progress: number;
    successCount: number;
    errorCount: number;
    createdAt: string;
    completedAt?: string;
}

interface DataImportState {
    currentStep: number;
    fileList: UploadFile[];
    importing: boolean;
    importProgress: number;
    importTasks: ImportTask[];
    selectedDataType: string;
}

interface DataImportActions {
    setCurrentStep: (step: number) => void;
    setFileList: (fileList: UploadFile[]) => void;
    setImporting: (importing: boolean) => void;
    setImportProgress: (progress: number) => void;
    setImportTasks: (tasks: ImportTask[]) => void;
    setSelectedDataType: (dataType: string) => void;
    downloadTemplate: () => void;
    startImport: () => void;
    resetImport: () => void;
}

export const useDataImportStore = create<DataImportState & DataImportActions>((set, get) => ({
    currentStep: 0,
    fileList: [],
    importing: false,
    importProgress: 0,
    importTasks: [],
    selectedDataType: '',

    setCurrentStep: (step) => set({currentStep: step}),
    setFileList: (fileList) => set({fileList}),
    setImporting: (importing) => set({importing}),
    setImportProgress: (progress) => set({importProgress: progress}),
    setImportTasks: (tasks) => set({importTasks: tasks}),
    setSelectedDataType: (dataType) => set({selectedDataType: dataType}),

    downloadTemplate: () => {
        globalMessage.warning('导入模板将在业务字段映射完成后提供');
    },

    startImport: () => {globalMessage.warning('真实导入功能尚未接入，未上传或写入数据');},

    resetImport: () => {
        set({
            currentStep: 0,
            fileList: [],
            importProgress: 0,
        });
    },
}));
