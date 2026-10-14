import type {SelectProps} from 'antd';

export const dataTypeOptions: SelectProps['options'] = [
    {label: '用户数据', value: 'user'},
    {label: '设备数据', value: 'device'},
    {label: '行为数据', value: 'behavior'},
    {label: '交易数据', value: 'transaction'},
];
