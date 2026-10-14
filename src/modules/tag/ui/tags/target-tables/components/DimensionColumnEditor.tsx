'use client';

import React from 'react';
import { Input, Select, Button, Space, Card } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

/**
 * 维度列配置编辑器
 * 
 * 用于 INTERMEDIATE 目标表创建时配置维度列。
 * 基于 Ant Design Form.List 实现，支持动态增删维度列。
 */

// ClickHouse 常用类型选项
const CLICKHOUSE_TYPE_OPTIONS = [
  { label: 'String', value: 'String' },
  { label: 'UInt64', value: 'UInt64' },
  { label: 'UInt32', value: 'UInt32' },
  { label: 'Int64', value: 'Int64' },
  { label: 'Float64', value: 'Float64' },
  { label: 'Date', value: 'Date' },
  { label: 'DateTime', value: 'DateTime' },
  { label: 'LowCardinality(String)', value: 'LowCardinality(String)' },
  { label: 'Nullable(String)', value: 'Nullable(String)' },
  { label: 'Array(String)', value: 'Array(String)' },
];

export interface DimensionColumnValue {
  name: string;
  type: string;
  defaultExpression?: string;
  comment?: string;
}

interface DimensionColumnEditorProps {
  value?: DimensionColumnValue[];
  onChange?: (value: DimensionColumnValue[]) => void;
}

const DimensionColumnEditor: React.FC<DimensionColumnEditorProps> = ({ value = [], onChange }) => {
  const handleAdd = () => {
    const newColumn: DimensionColumnValue = {
      name: '',
      type: 'String',
      defaultExpression: undefined,
      comment: undefined,
    };
    onChange?.([...value, newColumn]);
  };

  const handleRemove = (index: number) => {
    const newValue = [...value];
    newValue.splice(index, 1);
    onChange?.(newValue);
  };

  const handleChange = (index: number, field: keyof DimensionColumnValue, fieldValue: string | undefined) => {
    const newValue = [...value];
    newValue[index] = { ...newValue[index], [field]: fieldValue };
    onChange?.(newValue);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((col, index) => (
        <Card
          key={index}
          size="small"
          title={`维度列 ${index + 1}`}
          extra={
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => handleRemove(index)}
            >
              删除
            </Button>
          }
          style={{ marginBottom: 0 }}
        >
          <Space orientation="horizontal" size="middle" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>列名</div>
              <Input
                placeholder="列名 (如: region)"
                value={col.name}
                onChange={(e) => handleChange(index, 'name', e.target.value)}
                style={{ width: 180 }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>类型</div>
              <Select
                options={CLICKHOUSE_TYPE_OPTIONS}
                value={col.type}
                onChange={(v) => handleChange(index, 'type', v)}
                style={{ width: 200 }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>默认值</div>
              <Input
                placeholder="默认值表达式 (可选)"
                value={col.defaultExpression ?? ''}
                onChange={(e) => handleChange(index, 'defaultExpression', e.target.value || undefined)}
                style={{ width: 180 }}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4, fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>注释</div>
              <Input
                placeholder="列注释 (可选)"
                value={col.comment ?? ''}
                onChange={(e) => handleChange(index, 'comment', e.target.value || undefined)}
                style={{ width: 180 }}
              />
            </div>
          </Space>
        </Card>
      ))}
      <Button
        type="dashed"
        onClick={handleAdd}
        icon={<PlusOutlined />}
        style={{ width: '100%' }}
      >
        添加维度列
      </Button>
    </div>
  );
};

export default DimensionColumnEditor;
