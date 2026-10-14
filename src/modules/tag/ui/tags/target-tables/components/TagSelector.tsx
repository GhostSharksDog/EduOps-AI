'use client';

import React from 'react';
import {Select, Typography, Skeleton, Empty} from 'antd';
import {useTags} from '@/modules/tag/ui/tags/hooks/useTags';
import type {TagValueType} from '@/shared/enums/index';

interface TagSelectorProps {
    value?: string;
    onChange: (tagId: string, tagValueType: TagValueType, entityTypeCode: string) => void;
    entityTypeCode?: string;
}

const TagSelector: React.FC<TagSelectorProps> = ({value, onChange, entityTypeCode}) => {
    const {data, isLoading} = useTags({page: 1, pageSize: 200});

    const filteredTags = data?.items.filter((tag) => {
        if (tag.isDeleted) return false;
        if (entityTypeCode) {
            const tagEntityTypeCode = (tag.category?.feature as Record<string, unknown> | undefined)
                ?.entityTypeCode as string | undefined;
            if (tagEntityTypeCode !== entityTypeCode) return false;
        }
        return true;
    }) ?? [];

    const handleChange = (tagId: string) => {
        const selectedTag = filteredTags.find((t) => t.id === tagId);
        if (selectedTag) {
            const entityTypeCode = (selectedTag.category?.feature as Record<string, unknown> | undefined)
                ?.entityTypeCode as string ?? '';
            onChange(selectedTag.id, selectedTag.dataType, entityTypeCode);
        }
    };

    if (isLoading) {
        return <Skeleton.Input active block />;
    }

    if (filteredTags.length === 0) {
        return <Empty description={entityTypeCode ? `暂无匹配实体类型「${entityTypeCode}」的标签` : "暂无可用标签"} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    return (
        <Select
            value={value}
            onChange={handleChange}
            placeholder="选择标签"
            style={{width: '100%'}}
            showSearch
            filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            options={filteredTags.map((tag) => ({
                key: tag.id,
                value: tag.id,
                label: `${tag.name} (${tag.dataType})`,
            }))}
            optionRender={({value: optionValue, label}) => (
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <span>{typeof label === 'string' ? label.split(' (')[0] : label}</span>
                    <Typography.Text type="secondary" style={{fontSize: 12, marginLeft: 8}}>
                        {filteredTags.find((t) => t.id === optionValue)?.dataType}
                    </Typography.Text>
                </div>
            )}
        />
    );
};

export default TagSelector;
