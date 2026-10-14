'use client';

import React from 'react';
import {Input, theme} from 'antd';
import {SearchOutlined} from '@ant-design/icons';

interface CategoryFilterProps {
    keyword: string;
    onKeywordChange: (keyword: string) => void;
}

const CategoryFilter: React.FC<CategoryFilterProps> = ({keyword, onKeywordChange}) => {
    const {token} = theme.useToken();

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: token.marginMD,
        }}>
            <Input
                placeholder="搜索分类名称..."
                prefix={<SearchOutlined style={{color: token.colorTextSecondary}}/>}
                value={keyword}
                onChange={(e) => onKeywordChange(e.target.value)}
                allowClear
                style={{
                    width: 240,
                    borderRadius: token.borderRadiusLG,
                }}
            />
        </div>
    );
};

export default CategoryFilter;
