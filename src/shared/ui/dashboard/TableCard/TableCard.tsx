import React from 'react';
import {Card} from 'antd';
import TableHeader from '@/shared/ui/dashboard/TableHeader/index';


interface TableCardProps {
    /** 标题 (透传给 TableHeader) */
    title: string;
    /** 图标 (透传给 TableHeader) */
    icon?: React.ReactNode;
    /** 过滤器组件 (透传给 TableHeader) */
    filter?: React.ReactNode;
    /** 操作按钮 (透传给 TableHeader) */
    actions?: React.ReactNode;
    /** 数据总数 (透传给 TableHeader) */
    total?: number;
    /** 总数标签 */
    totalLabel?: string;
    /** 表格组件 */
    table: React.ReactNode;
    /** 卡片变体 */
    variant?: 'borderless' | 'outlined';
    /** 加载状态 */
    loading?: boolean;
}

const TableCard: React.FC<TableCardProps> = ({
    title,
    icon,
    filter,
    actions,
    total,
    totalLabel,
    table,
    variant = 'borderless',
    loading,
}) => {
    return (
        <Card
            variant={variant}
            styles={{
                body: {
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                },
            }}
            loading={loading}
        >
            <TableHeader
                title={title}
                icon={icon}
                filter={filter}
                actions={actions}
                total={total}
                totalLabel={totalLabel}
            />
            <div>
                {table}
            </div>
        </Card>
    );
};

export default TableCard;
