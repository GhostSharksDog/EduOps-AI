import React from 'react';
import {theme} from 'antd';
import styles from './TableHeader.module.css';

interface TableHeaderProps {
    /** 标题文本 */
    title: string;
    /** 标题前的图标 */
    icon?: React.ReactNode;
    /** 过滤器组件 (右侧) */
    filter?: React.ReactNode;
    /** 操作按钮 (右侧，在filter后面) */
    actions?: React.ReactNode;
    /** 数据总数 */
    total?: number;
    /** 总数标签，默认 "条数据" */
    totalLabel?: string;
}

const TableHeader: React.FC<TableHeaderProps> = ({
    title,
    icon,
    filter,
    actions,
    total,
    totalLabel = '条数据',
}) => {
    const {token} = theme.useToken();

    return (
        <div
            className={styles.header}
            style={{
                background: token.colorBgContainer,
                padding: `${token.paddingMD}px ${token.paddingLG}px`,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
        >
            <div className={styles.titleSection}>
                {icon && (
                    <span style={{color: token.colorInfo, fontSize: '18px'}}>
                        {icon}
                    </span>
                )}
                <span
                    className={styles.title}
                    style={{
                        fontSize: '15px',
                        fontWeight: 500,
                        color: token.colorTextHeading,
                    }}
                >
                    {title}
                </span>
            </div>

            <div className={styles.rightSection}>
                {filter && <div className={styles.filterWrapper}>{filter}</div>}
                {actions && <div className={styles.actionsWrapper}>{actions}</div>}
                {total !== undefined && (
                    <span
                        className={styles.total}
                        style={{
                            fontSize: '12px',
                            color: token.colorTextSecondary,
                        }}
                    >
                        共 <strong style={{color: token.colorText}}>{total}</strong> {totalLabel}
                    </span>
                )}
            </div>
        </div>
    );
};

export default TableHeader;
