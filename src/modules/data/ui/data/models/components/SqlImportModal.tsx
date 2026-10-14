'use client';

import React from 'react';
import {Button, Flex, Modal, Select, Space, Spin, theme} from 'antd';
import dynamic from 'next/dynamic';

const MySQLSQLEditor = dynamic(
    () => import('@/shared/ui/MySQLSQLEditor/index'),
    { ssr: false, loading: () => <Spin /> }
);

const PostgreSQLEditor = dynamic(
    () => import('@/shared/ui/PostgreSQLEditor/index'),
    { ssr: false, loading: () => <Spin /> }
);

const ClickHouseSQLEditor = dynamic(
    () => import('@/shared/ui/ClickHouseSQLEditor/index'),
    { ssr: false, loading: () => <Spin /> }
);

interface SqlImportModalProps {
    open: boolean;
    sqlDialect: 'mysql' | 'postgresql' | 'clickhouse';
    sqlInput: string;
    parsing: boolean;
    onSqlDialectChange: (value: 'mysql' | 'postgresql' | 'clickhouse') => void;
    onSqlInputChange: (value: string) => void;
    onCancel: () => void;
    onImport: () => void;
}

const SqlImportModal: React.FC<SqlImportModalProps> = ({
                                                           open,
                                                           sqlDialect,
                                                           sqlInput,
                                                           parsing,
                                                           onSqlDialectChange,
                                                           onSqlInputChange,
                                                           onCancel,
                                                           onImport
                                                       }) => {
    const {token} = theme.useToken();

    const handleCancel = () => {
        onCancel();
        onSqlInputChange('');
    };

    return (
        <Modal
            title="从SQL导入"
            open={open}
            onCancel={handleCancel}
            footer={null}
            width={800}
        >
            <Flex vertical gap={token.marginMD} style={{width: '100%'}}>
                <Flex gap={token.marginMD}>
                    <Select
                        value={sqlDialect}
                        onChange={onSqlDialectChange}
                        style={{width: 150}}
                        options={[
                            {value: 'mysql', label: 'MySQL'},
                            {value: 'postgresql', label: 'PostgreSQL'},
                            {value: 'clickhouse', label: 'ClickHouse'},
                        ]}
                    />
                </Flex>
                <div style={{width: '100%', overflow: 'hidden'}}>
                    {sqlDialect === 'mysql' ? (
                        <MySQLSQLEditor
                            value={sqlInput}
                            onChange={onSqlInputChange}
                            placeholder="请输入CREATE TABLE语句，例如：&#10;CREATE TABLE users (&#10;    id INT PRIMARY KEY,&#10;    name VARCHAR(100) NOT NULL,&#10;    email VARCHAR(255),&#10;    created_at DATETIME DEFAULT CURRENT_TIMESTAMP&#10;);"
                        />
                    ) : sqlDialect === 'postgresql' ? (
                        <PostgreSQLEditor
                            value={sqlInput}
                            onChange={onSqlInputChange}
                            placeholder="请输入CREATE TABLE语句，例如：&#10;CREATE TABLE users (&#10;    id SERIAL PRIMARY KEY,&#10;    name VARCHAR(100) NOT NULL,&#10;    email VARCHAR(255),&#10;    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP&#10;);"
                        />
                    ) : (
                        <ClickHouseSQLEditor
                            value={sqlInput}
                            onChange={onSqlInputChange}
                            placeholder="请输入CREATE TABLE语句，例如：&#10;CREATE TABLE users (&#10;    id UInt64,&#10;    name String,&#10;    email String,&#10;    created_at DateTime&#10;) ENGINE = MergeTree()&#10;ORDER BY id;"
                        />
                    )}
                </div>
                <Flex justify="flex-end">
                    <Space>
                        <Button onClick={handleCancel}>
                            取消
                        </Button>
                        <Button type="primary" loading={parsing} onClick={onImport}>
                            解析
                        </Button>
                    </Space>
                </Flex>
            </Flex>
        </Modal>
    );
};

export default SqlImportModal;
