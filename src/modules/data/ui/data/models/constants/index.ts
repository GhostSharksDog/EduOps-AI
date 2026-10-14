import {DataModelStatus, DataType} from '@/shared/enums/index';

export {DataModelStatus, DataType};

export const DATA_MODEL_STATUS_LABELS: Record<DataModelStatus, string> = {
    [DataModelStatus.DRAFT]: '草稿',
    [DataModelStatus.ACTIVE]: '激活',
    [DataModelStatus.INACTIVE]: '停用'
};

export const DATA_MODEL_STATUS_COLORS: Record<DataModelStatus, string> = {
    [DataModelStatus.DRAFT]: 'default',
    [DataModelStatus.ACTIVE]: 'success',
    [DataModelStatus.INACTIVE]: 'error'
};

export const DATA_TYPE_LABELS: Record<DataType, string> = {
    [DataType.STRING]: '字符串',
    [DataType.NUMBER]: '数字',
    [DataType.BOOLEAN]: '布尔',
    [DataType.DATE]: '日期',
    [DataType.DATETIME]: '日期时间',
    [DataType.ARRAY]: '数组',
    [DataType.OBJECT]: '对象'
};
