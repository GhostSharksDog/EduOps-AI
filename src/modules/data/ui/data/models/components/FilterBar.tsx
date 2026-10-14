import React from 'react';
import {useQuery} from '@tanstack/react-query';
import {ApiClient} from '@/shared/lib/api-client';
import {Flex, Input, Select, theme} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import {DATA_MODEL_STATUS_LABELS, DataModelStatus} from '@/modules/data/ui/data/models/constants/index';

interface FilterBarProps {
    searchText: string;
    statusFilter: string;
    datasourceFilter: string;
    onSearchTextChange: (value: string) => void;
    onStatusFilterChange: (value: string) => void;
    onDatasourceFilterChange: (value: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
                                                 searchText,
                                                 statusFilter,
                                                 datasourceFilter,
                                                 onSearchTextChange,
                                                 onStatusFilterChange,
                                                 onDatasourceFilterChange,
                                             }) => {
    const {token} = theme.useToken();

    const statusOptions = [
        {value: '', label: '全部状态'},
        {value: DataModelStatus.DRAFT, label: DATA_MODEL_STATUS_LABELS[DataModelStatus.DRAFT]},
        {value: DataModelStatus.ACTIVE, label: DATA_MODEL_STATUS_LABELS[DataModelStatus.ACTIVE]},
        {value: DataModelStatus.INACTIVE, label: DATA_MODEL_STATUS_LABELS[DataModelStatus.INACTIVE]},
    ];

    const {data: dataSourcesResponse} = useQuery<{ items: Array<{ id: string; name: string }> }>({
        queryKey: ['datasources'],
        queryFn: async () => {
            return await ApiClient.get('/data-sources', {});
        },
    });

    const datasourceOptions = [
        {value: '', label: '全部数据源'},
        ...(dataSourcesResponse?.items?.map(ds => ({
            value: ds.id,
            label: ds.name,
        })) ?? []),
    ];

    return (
        <Flex gap={token.paddingSM} justify="flex-end" align="center" wrap="wrap">
            <Input
                placeholder="搜索模型名称或描述"
                prefix={<SearchOutlined/>}
                value={searchText}
                onChange={(e) => onSearchTextChange(e.target.value)}
                style={{width: 240}}
            />
            <Select
                placeholder="状态"
                value={statusFilter}
                onChange={onStatusFilterChange}
                style={{width: 140}}
                allowClear
                options={statusOptions}
            />
            <Select
                placeholder="数据源"
                value={datasourceFilter}
                onChange={onDatasourceFilterChange}
                style={{width: 140}}
                allowClear
                options={datasourceOptions}
            />
        </Flex>
    );
};

export default FilterBar;
