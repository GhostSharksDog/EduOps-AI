'use client';

import { useState, useCallback } from 'react';

export interface UseDrawerOptions {
  initialOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseDrawerReturn {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  setOpen: (open: boolean) => void;
}

export function useDrawer(options: UseDrawerOptions = {}): UseDrawerReturn {
  const { initialOpen = false, onOpen, onClose } = options;
  const [open, setOpen] = useState(initialOpen);

  const openDrawer = useCallback(() => {
    setOpen(true);
    onOpen?.();
  }, [onOpen]);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const toggleDrawer = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) onOpen?.();
      else onClose?.();
      return next;
    });
  }, [onOpen, onClose]);

  return { open, openDrawer, closeDrawer, toggleDrawer, setOpen };
}
