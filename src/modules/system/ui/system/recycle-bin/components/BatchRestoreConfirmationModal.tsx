'use client';

import React from 'react';
import {Modal} from 'antd';
import {MESSAGES} from '@/shared/messages/index';

export interface BatchRestoreConfirmationModalProps {
    open: boolean;
    count: number;
    onConfirm: () => Promise<void>;
}

export default function BatchRestoreConfirmationModal({open, count, onConfirm}: BatchRestoreConfirmationModalProps) {
    const handleOk = async () => {
        await onConfirm();
    };

    const modalContent = (
        <div>{MESSAGES.RECYCLE_BIN.BATCH_RESTORE_CONFIRM_CONTENT.replace('{count}', String(count))}</div>
    );

    return (
        <Modal
            title={MESSAGES.COMMON.CONFIRM_RESTORE}
            open={open}
            okText={MESSAGES.COMMON.CONFIRM_RESTORE}
            cancelText={MESSAGES.COMMON.CANCEL}
            onOk={handleOk}
        >
            {modalContent}
        </Modal>
    );
}
