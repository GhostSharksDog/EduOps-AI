'use client';

import React from 'react';
import { Drawer, Button, Space, theme } from 'antd';
import type { BaseDrawerProps } from '@/shared/ui/BaseDrawer/types';
import { SIZE_PRESETS } from '@/shared/ui/BaseDrawer/constants';

const BaseDrawer: React.FC<BaseDrawerProps> = ({
  open,
  size = 'md',
  width,
  footerMode = 'form',
  okText = '确定',
  cancelText = '取消',
  confirmLoading = false,
  okButtonDisabled = false,
  onOk,
  onCancel,
  onClose,
  closable = true,
  bodyPadding = 'default',
  children,
  footer: customFooter,
  styles,
  ...restProps
}) => {
  const { token } = theme.useToken();

  const finalWidth = width ?? SIZE_PRESETS[size];

  const bodyPaddingValue = {
    none: 0,
    default: token.paddingMD,
    compact: `${token.paddingSM}px ${token.paddingMD}px`,
  }[bodyPadding];

  const renderFooter = () => {
    if (footerMode === 'none') return null;
    if (footerMode === 'custom') return customFooter;

    return (
      <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel ?? onClose}>
          {cancelText}
        </Button>
        <Button
          type="primary"
          loading={confirmLoading}
          disabled={okButtonDisabled}
          onClick={onOk}
        >
          {okText}
        </Button>
      </Space>
    );
  };

  return (
    <Drawer
      open={open}
      placement="right"
      closable={closable}
      onClose={onClose}
      styles={{
        wrapper: { width: finalWidth },
        body: { padding: bodyPaddingValue },
        ...styles,
      }}
      footer={renderFooter()}
      {...restProps}
    >
      {children}
    </Drawer>
  );
};

export default BaseDrawer;
export type { BaseDrawerProps, DrawerSize, FooterMode, BodyPadding } from '@/shared/ui/BaseDrawer/types';
export { SIZE_PRESETS } from '@/shared/ui/BaseDrawer/constants';
export { useDrawer } from '@/shared/ui/BaseDrawer/hooks/useDrawer';
export type { UseDrawerOptions, UseDrawerReturn } from '@/shared/ui/BaseDrawer/hooks/useDrawer';
