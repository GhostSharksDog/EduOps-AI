'use client';

import React from 'react';
import {Modal} from 'antd';
import {MESSAGES} from '@/shared/messages/index';

export interface RestoreConfirmationModalProps {
    open: boolean;
    recordName: string;
    onConfirm: () => Promise<void>;
}

export default function RestoreConfirmationModal({open, recordName, onConfirm}: RestoreConfirmationModalProps) {
    const handleOk = async () => {
        await onConfirm();
    };

    const modalContent = (
        <div>{MESSAGES.RECYCLE_BIN.RESTORE_CONFIRM_CONTENT.replace('{name}', recordName)}</div>
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
