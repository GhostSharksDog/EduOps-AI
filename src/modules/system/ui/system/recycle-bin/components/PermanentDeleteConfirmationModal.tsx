'use client';

import React from 'react';
import {Flex, Modal, Typography} from 'antd';
import {MESSAGES} from '@/shared/messages/index';

const {Text, Paragraph} = Typography;

export interface PermanentDeleteConfirmationModalProps {
    open: boolean;
    recordName: string;
    onConfirm: () => Promise<void>;
}

export default function PermanentDeleteConfirmationModal({
                                                             open,
                                                             recordName,
                                                             onConfirm
                                                         }: PermanentDeleteConfirmationModalProps) {
    const handleOk = async () => {
        await onConfirm();
    };

    return (
        <Modal
            title={MESSAGES.COMMON.PERMANENT_DELETE_CONFIRM_TITLE}
            open={open}
            okText={MESSAGES.COMMON.CONFIRM_PERMANENT_DELETE}
            okButtonProps={{danger: true}}
            cancelText={MESSAGES.COMMON.CANCEL}
            onOk={handleOk}
        >
            <Flex vertical gap={8}>
                <Paragraph>{MESSAGES.RECYCLE_BIN.PERMANENT_DELETE_CONFIRM_CONTENT.replace('{name}', recordName)}</Paragraph>
                <Text type='danger'>{MESSAGES.RECYCLE_BIN.PERMANENT_DELETE_WARNING}</Text>
            </Flex>
        </Modal>
    );
}
