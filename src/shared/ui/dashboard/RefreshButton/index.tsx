'use client';

import { ReloadOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { FC } from 'react';

export interface RefreshButtonProps {
  /** 刷新回调函数 */
  onClick: () => void;
  /** 是否处于加载状态 */
  loading?: boolean;
  /** Tooltip 提示文字，默认 "刷新" */
  tooltip?: string;
}

/**
 * 通用刷新按钮组件
 * 用于表格头部的数据刷新操作
 */
export const RefreshButton: FC<RefreshButtonProps> = ({
  onClick,
  loading = false,
  tooltip = '刷新',
}) => {
  return (
    <Tooltip title={tooltip}>
      <Button
        type="text"
        icon={<ReloadOutlined spin={loading} />}
        onClick={onClick}
        loading={loading}
      />
    </Tooltip>
  );
};

export default RefreshButton;
