import React from 'react';
import {Button, Modal, Space} from 'antd';
import type {DataModelVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import {MESSAGES} from '@/shared/messages/index';

interface DataModelConfirmModalProps {
    visible: boolean;
    confirmType: 'status' | 'delete';
    confirmData: {
        id: string;
        status?: boolean;
        record?: DataModelVO;
    };
    onOk: () => void;
    onCancel: () => void;
}

const DataModelConfirmModal: React.FC<DataModelConfirmModalProps> = ({
                                                                         visible,
                                                                         confirmType,
                                                                         confirmData,
                                                                         onOk,
                                                                         onCancel
                                                                     }) => {
    const title = confirmType === 'status'
        ? (confirmData.status ? MESSAGES.DATA_MODEL.ACTIVATE_CONFIRM_TITLE : MESSAGES.DATA_MODEL.DEACTIVATE_CONFIRM_TITLE)
        : MESSAGES.DATA_MODEL.DELETE_CONFIRM_TITLE;

    const content = confirmType === 'status'
        ? MESSAGES.DATA_MODEL.STATUS_CONFIRM_CONTENT
        : MESSAGES.DATA_MODEL.DELETE_CONFIRM_CONTENT;

    const handleOk = () => {
        onOk();
    };

    return (
        <Modal
            title={title}
            open={visible}
            onCancel={onCancel}
            footer={
                <Space>
                    <Button onClick={onCancel}>{MESSAGES.COMMON.CANCEL}</Button>
                    <Button
                        type="primary"
                        danger={confirmType === 'delete'}
                        onClick={handleOk}
                    >
                        {MESSAGES.COMMON.OK}
                    </Button>
                </Space>
            }
            closable={false}
        >
            {content}
        </Modal>
    );
};

export default DataModelConfirmModal;
