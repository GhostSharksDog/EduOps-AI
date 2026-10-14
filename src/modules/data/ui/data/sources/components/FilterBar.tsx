'use client';

import React from 'react';
import {Flex, Input, Select, theme} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import {DataSourceStatus, DataSourceStatusOptions, DataSourceType, DataSourceTypeOptions} from '@/shared/enums/index';

interface FilterBarProps {
    searchText: string;
    typeFilter: DataSourceType | undefined;
    statusFilter: DataSourceStatus | undefined;
    onSearchTextChange: (text: string) => void;
    onTypeFilterChange: (type: DataSourceType | undefined) => void;
    onStatusFilterChange: (status: DataSourceStatus | undefined) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
                                                 searchText,
                                                 typeFilter,
                                                 statusFilter,
                                                 onSearchTextChange,
                                                 onTypeFilterChange,
                                                 onStatusFilterChange
                                             }) => {
    const {token} = theme.useToken();

    return (
        <Flex gap={token.marginSM} justify="flex-end" align="center" wrap="wrap">
            <Input
                placeholder="搜索数据源名称"
                prefix={<SearchOutlined/>}
                value={searchText}
                onChange={(e) => onSearchTextChange(e.target.value)}
                style={{width: token.controlHeight * 8, height: token.controlHeight}}
            />
            <Select
                placeholder="数据源类型"
                value={typeFilter}
                onChange={onTypeFilterChange}
                style={{width: token.controlHeight * 4, height: token.controlHeight}}
                options={DataSourceTypeOptions}
                allowClear
            />
            <Select
                placeholder="数据源状态"
                value={statusFilter}
                onChange={onStatusFilterChange}
                style={{width: token.controlHeight * 4, height: token.controlHeight}}
                options={DataSourceStatusOptions}
                allowClear
            />
        </Flex>
    );
};

export default FilterBar;
