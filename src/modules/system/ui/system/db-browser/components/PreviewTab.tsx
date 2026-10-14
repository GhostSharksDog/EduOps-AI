'use client';

import React, { useState, useEffect } from 'react';
import { Table, Spin, Empty, Alert } from 'antd';
import { ApiClient } from '@/shared/lib/api-client';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {MESSAGES} from '@/shared/messages/index';

interface PreviewData {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface PreviewTabProps {
  schema: string;
  table: string;
}

const scrollbarStyles = `
  .db-preview-table::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .db-preview-table::-webkit-scrollbar-track {
    background: transparent;
  }
  .db-preview-table::-webkit-scrollbar-thumb {
    background: rgba(150, 150, 150, 0.4);
    border-radius: 4px;
  }
  .db-preview-table::-webkit-scrollbar-thumb:hover {
    background: rgba(150, 150, 150, 0.6);
  }
  .db-preview-table::-webkit-scrollbar-corner {
    background: transparent;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'db-preview-scrollbar-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = scrollbarStyles;
    document.head.appendChild(style);
  }
}

export function PreviewTab({ schema, table }: PreviewTabProps) {
  const {error} = useGlobalMessage();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!schema || !table) return;
      setLoading(true);
      try {
        const data = await ApiClient.get<{ success: boolean; data: PreviewData; error?: string }>(
          `/admin/db-browser/tables/${table}/preview`,
          { schema }
        );
        if (data.success) {
          setPreview(data.data);
        } else {
          error(data.error || MESSAGES.DB_BROWSER.LOAD_PREVIEW_FAILED);
        }
      } catch {
        error(MESSAGES.DB_BROWSER.LOAD_PREVIEW_FAILED);
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [schema, table, error]);

  if (loading) return <Spin size="small" />;
  if (!preview) return <Empty description="无法加载数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  const columns = preview.columns.map((col) => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    render: (value: unknown) => {
      if (value === null) return <span style={{ color: 'var(--ant-color-text-disabled)' }}>NULL</span>;
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    },
  }));

  return (
    <div className="db-preview-table" style={{ overflow: 'auto', maxHeight: 350 }}>
      <Alert
        type="info"
        title={`共 ${preview.rows.length} 条记录`}
        style={{ marginBottom: 12 }}
        showIcon
      />
      <Table
        dataSource={preview.rows.map((row, idx) => ({ ...row, _key: idx }))}
        rowKey="_key"
        columns={columns}
        size="small"
        scroll={{ x: 'max-content' }}
        pagination={false}
      />
    </div>
  );
}
