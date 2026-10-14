'use client';

import React from 'react';
import {Skeleton} from 'antd';

const DataSourceTableSkeleton: React.FC = () => {
    return (
        <div style={{padding: '16px'}}>
            {Array.from({length: 5}).map((_, index) => (
                <Skeleton
                    key={index}
                    active
                    paragraph={{rows: 1}}
                    style={{marginBottom: '16px'}}
                />
            ))}
        </div>
    );
};

export default DataSourceTableSkeleton;
