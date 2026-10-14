import type { DrawerProps } from 'antd';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type FooterMode = 'none' | 'form' | 'custom';
export type BodyPadding = 'none' | 'default' | 'compact';

export interface BaseDrawerProps extends Omit<DrawerProps, 'open' | 'visible' | 'placement'> {
  /** Control visibility - unified API (replaces deprecated 'visible') */
  open: boolean;
  /** Size preset, lower priority than width prop */
  size?: DrawerSize;
  /** Footer mode */
  footerMode?: FooterMode;
  /** Body padding mode */
  bodyPadding?: BodyPadding;
  /** OK button text */
  okText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** OK button loading state */
  confirmLoading?: boolean;
  /** OK button disabled state */
  okButtonDisabled?: boolean;
  /** OK button click handler */
  onOk?: () => void | Promise<void>;
  /** Cancel button click handler (defaults to onClose) */
  onCancel?: () => void;
}
