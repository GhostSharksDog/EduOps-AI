'use client';

import React, {useEffect} from 'react';
import {Modal} from 'antd';
import {MESSAGES} from '@/shared/messages/index';

export interface BatchPermanentDeleteConfirmationModalProps {
    ids: number[];
    onConfirm: () => void;
    onCancel: () => void;
}

const BatchPermanentDeleteConfirmationModal: React.FC<BatchPermanentDeleteConfirmationModalProps> = ({
                                                                                                         ids,
                                                                                                         onConfirm,
                                                                                                         onCancel
                                                                                                     }) => {
    const modalRef = React.useRef<ReturnType<typeof Modal.confirm> | null>(null);

    useEffect(() => {
        const modalInstance = Modal.confirm({
            title: MESSAGES.RECYCLE_BIN.BATCH_PERMANENT_DELETE_TITLE,
            content: MESSAGES.RECYCLE_BIN.BATCH_PERMANENT_DELETE_CONFIRM,
            okText: MESSAGES.COMMON.CONFIRM_PERMANENT_DELETE,
            okButtonProps: {danger: true},
            cancelText: MESSAGES.COMMON.CANCEL,
            onOk: onConfirm,
            onCancel,
        });
        modalRef.current = modalInstance;

        return () => {
            modalInstance?.destroy();
        };
    }, [ids, onConfirm, onCancel]);

    return null;
};

export default BatchPermanentDeleteConfirmationModal;
