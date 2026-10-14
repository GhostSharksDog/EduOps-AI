'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Form, Input, Button, Table, Space, Alert, Spin, Empty, Tag, Typography } from 'antd';
import BaseDrawer from '@/shared/ui/BaseDrawer/index';
import { SearchOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTagBatchValues, useTagSingleValue } from '@/modules/tag/ui/tags/hooks/useTagValues';
import type { TagVO } from '@/modules/tag/contracts/schemas/response/tag/index';
import { useGlobalMessage } from '@/shared/lib/message-service';
import { MESSAGES } from '@/shared/messages/index';

const { Text } = Typography;

interface ValueQueryDrawerProps {
  visible: boolean;
  tag: TagVO | null;
  onClose: () => void;
}

interface QueryResult {
  entityId: string;
  value: unknown;
  valueType: string;
  calculatedAt?: string;
}

const ValueQueryDrawer: React.FC<ValueQueryDrawerProps> = ({
  visible,
  tag,
  onClose,
}) => {
  const [form] = Form.useForm();
  const [entityIdInput, setEntityIdInput] = useState('');
  const [searchEntityIds, setSearchEntityIds] = useState<string[]>([]);
  const [searchType, setSearchType] = useState<'single' | 'batch' | null>(null);
  const { error: showError } = useGlobalMessage();

  const isSingleSearch = searchType === 'single' && searchEntityIds.length === 1;
  const isBatchSearch = searchType === 'batch' && searchEntityIds.length > 0;

  const singleResult = useTagSingleValue(
    tag?.id || '',
    searchEntityIds[0] || '',
    undefined,
    isSingleSearch && visible
  );

  const batchResult = useTagBatchValues(
    tag?.id || '',
    searchEntityIds,
    undefined,
    isBatchSearch && visible
  );

  const loading = singleResult.isLoading || batchResult.isLoading;
  const error = singleResult.error || batchResult.error;

  const queryResults: QueryResult[] = (() => {
    if (isSingleSearch && singleResult.data) {
      return [{
        entityId: singleResult.data.entityId,
        value: singleResult.data.value,
        valueType: singleResult.data.value === null ? 'null' : typeof singleResult.data.value,
        calculatedAt: singleResult.data.calculatedAt,
      }];
    }
    if (isBatchSearch && batchResult.data) {
      return batchResult.data.map(v => ({
        entityId: v.entityId,
        value: v.value,
        valueType: v.value === null ? 'null' : typeof v.value,
        calculatedAt: v.calculatedAt,
      }));
    }
    return [];
  })();

  const resetState = useCallback(() => {
    setEntityIdInput('');
    setSearchEntityIds([]);
    setSearchType(null);
    form.resetFields();
  }, [form]);

  useEffect(() => {
    if (visible && tag?.id) {
      const timer = setTimeout(() => {
        resetState();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [visible, tag?.id, resetState]);

  const handleSearch = useCallback(() => {
    if (!tag || !entityIdInput.trim()) return;

    const entityIds = entityIdInput
      .split(/[,\s]+/)
      .map(id => id.trim())
      .filter(Boolean);

    if (entityIds.length === 0) return;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = entityIds.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      const displayIds = invalidIds.slice(0, 3).join(', ');
      const moreText = invalidIds.length > 3 ? ` 等 ${invalidIds.length} 个` : '';
      showError(`${MESSAGES.VALIDATION.INVALID_UUID_FORMAT_DETAIL}: ${displayIds}${moreText}。${MESSAGES.VALIDATION.UUID_FORMAT_HINT}`);
      setSearchEntityIds([]);
      setSearchType(null);
      return;
    }

    setSearchEntityIds(entityIds);
    setSearchType(entityIds.length === 1 ? 'single' : 'batch');
  }, [tag, entityIdInput, showError]);

  const handleReset = useCallback(() => {
    setEntityIdInput('');
    setSearchEntityIds([]);
    setSearchType(null);
    form.resetFields();
  }, [form]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const columns = [
    {
      title: '实体 ID',
      dataIndex: 'entityId',
      key: 'entityId',
      width: 280,
      render: (text: string) => <Text copyable code>{text}</Text>,
    },
    {
      title: '标签值',
      dataIndex: 'value',
      key: 'value',
      render: (value: unknown) => {
        if (value === null || value === undefined) {
          return <Tag color="default">无值</Tag>;
        }
        if (typeof value === 'boolean') {
          return <Tag color={value ? 'green' : 'red'}>{value ? '是' : '否'}</Tag>;
        }
        if (typeof value === 'number') {
          return <Tag color="blue">{value}</Tag>;
        }
        return <Text>{String(value)}</Text>;
      },
    },
    {
      title: '值类型',
      dataIndex: 'valueType',
      key: 'valueType',
      width: 100,
      render: (type: string) => <Tag>{type}</Tag>,
    },
  ];

  return (
    <BaseDrawer
      title={`查询标签值 - ${tag?.name || ''}`}
      width={600}
      open={visible}
      onClose={handleClose}
                    okText={MESSAGES.COMMON.CLOSE}
      onOk={handleClose}
      cancelText={MESSAGES.COMMON.RESET}
      onCancel={handleReset}
    >
      {!tag?.id ? (
        <Alert type="warning" title="请先选择一个标签" />
      ) : (
        <>
          <Alert
            type="info"
            title="输入实体 ID 查询标签值"
            description={
              <span>
                支持单个或多个实体 ID（用逗号或空格分隔，最多 1000 个）
                <br />
                <Text type="secondary">
                  <InfoCircleOutlined style={{ marginRight: 4 }} />
                  实体 ID 必须是有效的 UUID 格式
                </Text>
              </span>
            }
            style={{ marginBottom: 16 }}
          />

          <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
            <Form.Item style={{ flex: 1, marginRight: 8 }}>
              <Input
                placeholder="输入 UUID 格式的实体 ID，多个用逗号分隔"
                value={entityIdInput}
                onChange={(e) => setEntityIdInput(e.target.value)}
                onPressEnter={handleSearch}
                prefix={<SearchOutlined />}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SearchOutlined />}
                  onClick={handleSearch}
                  loading={loading}
                  disabled={!entityIdInput.trim()}
                >
                  查询
                </Button>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                >
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>

          {error && (
            <Alert type="error" title={error.message || MESSAGES.TAGS.QUERY_FAILED} style={{ marginBottom: 16 }} />
          )}

          <Spin spinning={loading}>
            {queryResults.length > 0 ? (
              <Table
                dataSource={queryResults}
                columns={columns}
                rowKey="entityId"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                size="small"
              />
            ) : (
              !loading && entityIdInput && !error && (
                <Empty
                  description="未找到标签值"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )
            )}
          </Spin>

          <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
            <Text type="secondary">标签信息：</Text>
            <br />
            <Text>名称：{tag.name}</Text>
            <br />
            <Text>数据类型：{tag.dataType}</Text>
            <br />
            <Text>状态：{tag.status}</Text>
          </div>
        </>
      )}
    </BaseDrawer>
  );
};

export default ValueQueryDrawer;
