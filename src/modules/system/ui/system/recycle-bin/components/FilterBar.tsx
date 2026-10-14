import React from 'react';
import {DatePicker, Flex, Input, Select, theme} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import type {RangePickerProps} from 'antd/es/date-picker';
import dayjs from 'dayjs';
import {RecycleBinItemType} from '@/shared/enums/RecycleBinItemType';

const {RangePicker} = DatePicker;

interface FilterBarProps {
    searchText: string;
    typeFilter: RecycleBinItemType | undefined;
    dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
    onSearchTextChange: (value: string) => void;
    onTypeFilterChange: (value: RecycleBinItemType | undefined) => void;
    onDateRangeChange: (dates: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
                                                 searchText,
                                                 typeFilter,
                                                 dateRange,
                                                 onSearchTextChange,
                                                 onTypeFilterChange,
                                                 onDateRangeChange,
                                             }) => {
    const {token} = theme.useToken();
    const handleDateRangeChange: RangePickerProps['onChange'] = (dates) => {
        onDateRangeChange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
    };

    return (
        <Flex gap={token.marginSM} justify="flex-end" align="center" wrap="wrap">
            <Input
                placeholder="搜索名称/编码"
                prefix={<SearchOutlined/>}
                style={{width: token.controlHeight * 8, height: token.controlHeight}}
                allowClear
                value={searchText}
                onChange={e => onSearchTextChange(e.target.value)}
            />
            <Select
                placeholder="数据类型"
                style={{width: token.controlHeight * 4, height: token.controlHeight}}
                allowClear
                value={typeFilter}
                onChange={onTypeFilterChange}
                options={[
                    {label: '标签', value: RecycleBinItemType.TAG},
                    {label: '标签分类', value: RecycleBinItemType.TAG_CATEGORY},
                    {label: '分群', value: RecycleBinItemType.SEGMENT},
                    {label: '数据源', value: RecycleBinItemType.DATA_SOURCE},
                    {label: '数据模型', value: RecycleBinItemType.DATA_MODEL},
                ]}
            />
            <RangePicker
                style={{height: token.controlHeight}}
                placeholder={['删除开始时间', '删除结束时间']}
                value={dateRange}
                onChange={handleDateRangeChange}
            />
        </Flex>
    );
};

export default FilterBar;
