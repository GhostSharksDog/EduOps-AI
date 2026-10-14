import type { DrawerSize } from '@/shared/ui/BaseDrawer/types';

export const SIZE_PRESETS: Record<DrawerSize, number | string> = {
  sm: 400,
  md: 560,
  lg: 720,
  xl: 1000,
  full: '100%',
} as const;
