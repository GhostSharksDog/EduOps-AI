import React from 'react';
import {Flex, Input, Select, Switch, theme, TreeSelect} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import {TagStatus, TagValueType, UpdateCycle} from '@/shared/enums/index';
import type {TagCategoryVO} from '@/modules/tag/contracts/schemas/response/tag-category/index';


interface FilterBarProps {
    searchText: string;
    categoryFilter: string | undefined;
    statusFilter: TagStatus | undefined;
    dataTypeFilter: TagValueType | undefined;
    updateCycleFilter: UpdateCycle | undefined;
    isPublicFilter: boolean | undefined;
    categories: TagCategoryVO[];
    onSearchTextChange: (value: string) => void;
    onCategoryFilterChange: (value: string | undefined) => void;
    onStatusFilterChange: (value: TagStatus | undefined) => void;
    onDataTypeFilterChange: (value: TagValueType | undefined) => void;
    onUpdateCycleFilterChange: (value: UpdateCycle | undefined) => void;
    onIsPublicFilterChange: (value: boolean | undefined) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
                                                 searchText,
                                                 categoryFilter,
                                                 statusFilter,
                                                 dataTypeFilter,
                                                 updateCycleFilter,
                                                 isPublicFilter,
                                                 categories,
                                                 onSearchTextChange,
                                                 onCategoryFilterChange,
                                                 onStatusFilterChange,
                                                 onDataTypeFilterChange,
                                                 onUpdateCycleFilterChange,
                                                 onIsPublicFilterChange,
                                             }) => {
    const {token} = theme.useToken();

    return (
        <Flex gap={token.marginSM} justify="flex-end" align="center" wrap="wrap">
                <Input
                    placeholder="搜索标签名称/编码"
                    prefix={<SearchOutlined/>}
                    style={{width: token.controlHeight * 8, height: token.controlHeight}}
                    value={searchText}
                    onChange={e => onSearchTextChange(e.target.value)}
                />
                <TreeSelect
                    placeholder="所属分类"
                    style={{width: token.controlHeight * 4, height: token.controlHeight}}
                    allowClear
                    value={categoryFilter}
                    onChange={onCategoryFilterChange}
                    treeData={categories}
                    fieldNames={{label: 'name', value: 'id', children: 'children'}}
                    showSearch
                    filterTreeNode={(input, node) => {
                        const label = node.name || '';
                        return label.toLowerCase().includes(input.toLowerCase());
                    }}
                />
                <Select
                    placeholder="状态"
                    style={{width: token.controlHeight * 4, height: token.controlHeight}}
                    allowClear
                    value={statusFilter}
                    onChange={onStatusFilterChange}
                    options={[
                        {label: '草稿', value: TagStatus.DRAFT},
                        {label: '已激活', value: TagStatus.ACTIVE},
                        {label: '已停用', value: TagStatus.INACTIVE},
                        {label: '已废弃', value: TagStatus.DEPRECATED},
                    ]}
                />
                <Select
                    placeholder="值类型"
                    style={{width: token.controlHeight * 4, height: token.controlHeight}}
                    allowClear
                    value={dataTypeFilter}
                    onChange={onDataTypeFilterChange}
                    options={Object.values(TagValueType).map(type => ({
                        label: type,
                        value: type
                    }))}
                />
                <Select
                    placeholder="更新周期"
                    style={{width: token.controlHeight * 4, height: token.controlHeight}}
                    allowClear
                    value={updateCycleFilter}
                    onChange={onUpdateCycleFilterChange}
                    options={Object.values(UpdateCycle).map(cycle => ({
                        label: cycle,
                        value: cycle
                    }))}
                />
                <Flex gap={token.marginSM} align="center">
                    <span>是否公开:</span>
                    <Switch
                        checked={isPublicFilter}
                        onChange={(checked) => onIsPublicFilterChange(checked)}
                        style={{width: token.controlHeight * 2}}
                    />
                </Flex>
            </Flex>
    );
};

export default FilterBar;