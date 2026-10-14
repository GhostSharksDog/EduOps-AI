'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Alert, Card, Table, Empty, Typography, Space, Tag, Spin, Popconfirm, Button } from 'antd';
import { WarningOutlined, DeleteOutlined } from '@ant-design/icons';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {MESSAGES} from '@/shared/messages/index';
import { useSearchParams, useRouter } from 'next/navigation';
import { ApiClient } from '@/shared/lib/api-client';
import { PreviewTab } from '@/modules/system/ui/system/db-browser/components/PreviewTab';

const { Text } = Typography;

const SCHEMA = 'public';

interface TableInfo {
  name: string;
  rowCount: number | null;
  comment: string | null;
}

function DbBrowserContent() {
  const {success, error} = useGlobalMessage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(searchParams.get('table'));
  const [tablesLoading, setTablesLoading] = useState(false);
  const [truncatingTable, setTruncatingTable] = useState<string | null>(null);

  useEffect(() => {
    const fetchTables = async () => {
      setTablesLoading(true);
      try {
        const data = await ApiClient.get<{ success: boolean; data: TableInfo[]; error?: string }>(
          '/admin/db-browser/tables',
          { schema: SCHEMA }
        );
        if (data.success) {
          setTables(data.data);
          if (selectedTable && !data.data.find((t: TableInfo) => t.name === selectedTable)) {
            setSelectedTable(null);
          }
        } else {
          error(data.error || MESSAGES.DB_BROWSER.LOAD_TABLES_FAILED);
        }
      } catch {
        error(MESSAGES.DB_BROWSER.LOAD_TABLES_FAILED);
      } finally {
        setTablesLoading(false);
      }
    };
    fetchTables();
  }, [selectedTable, error]);

  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    router.push(`/dashboard/system/db-browser?table=${tableName}`);
  };

  const handleTruncate = async (tableName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTruncatingTable(tableName);
    try {
      const result = await ApiClient.post<Record<string, never>, { success: boolean; error?: string }>(
        `/admin/db-browser/tables/${tableName}/truncate?schema=${SCHEMA}`,
        {}
      );
      if (result.success) {
        success(MESSAGES.DB_BROWSER.TRUNCATE_SUCCESS);
      } else {
        error(result.error || MESSAGES.DB_BROWSER.TRUNCATE_FAILED);
      }
    } catch {
      error(MESSAGES.DB_BROWSER.TRUNCATE_FAILED);
    } finally {
      setTruncatingTable(null);
    }
  };

  return (
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="warning"
        icon={<WarningOutlined />}
        title="仅用于 DEBUG 和排查"
        description="此功能仅在非生产环境可用，用于查看数据库结构。数据预览限制为前 100 条记录。"
        showIcon
      />

      <Card>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {selectedTable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text strong>当前表:</Text>
              <Tag color="blue">{selectedTable}</Tag>
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
            <div style={{ width: 350, flexShrink: 0 }}>
              <Table
                dataSource={tables}
                rowKey="name"
                loading={tablesLoading}
                size="small"
                pagination={false}
                scroll={{ y: 500 }}
                columns={[
                  {
                    title: '表名',
                    dataIndex: 'name',
                    key: 'name',
                    render: (name: string) => (
                      <a onClick={() => handleTableSelect(name)} style={{ color: 'inherit' }}>
                        {name}
                      </a>
                    ),
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 80,
                    render: (_: unknown, record: TableInfo) => (
                      <Popconfirm
                        title={MESSAGES.DB_BROWSER.TRUNCATE_CONFIRM_TITLE}
                        description={MESSAGES.DB_BROWSER.TRUNCATE_CONFIRM_CONTENT.replace('{name}', record.name)}
                        onConfirm={(e) => handleTruncate(record.name, e as React.MouseEvent)}
                        okText={MESSAGES.COMMON.CONFIRM}
                        cancelText={MESSAGES.COMMON.CANCEL}
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          loading={truncatingTable === record.name}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    ),
                  },
                ]}
                onRow={(record) => ({
                  onClick: () => handleTableSelect(record.name),
                  style: { cursor: 'pointer' },
                })}
                rowClassName={(record) =>
                  record.name === selectedTable ? 'ant-table-row-selected' : ''
                }
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {selectedTable ? (
                <Space orientation="vertical" style={{ width: '100%' }} size="middle">
                  <Card size="small" title={`表: ${selectedTable}`}>
                    <Space orientation="vertical" style={{ width: '100%' }}>
                      <Text type="secondary">
                        {tables.find((t) => t.name === selectedTable)?.comment || '暂无描述'}
                      </Text>
                    </Space>
                  </Card>
                  <Card
                    size="small"
                    title="数据预览 (前 100 条)"
                    styles={{ body: { padding: 12 } }}
                  >
                    <PreviewTab schema={SCHEMA} table={selectedTable} />
                  </Card>
                </Space>
              ) : (
                <Empty description="请选择一个表" />
              )}
            </div>
          </div>
        </Space>
      </Card>
    </Space>
  );
}

export default function DbBrowserPage() {
  return (
    <div style={{ padding: 24 }}>
      <Suspense fallback={<Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }} />}>
        <DbBrowserContent />
      </Suspense>
    </div>
  );
}
