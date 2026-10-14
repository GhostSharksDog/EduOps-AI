'use client';

import {Modal} from 'antd';
import type {UploadFile} from 'antd/es/upload/interface';
import {MESSAGES} from '@/shared/messages/index';

export const uploadProps = {
    name: 'file',
    multiple: false,
    beforeUpload: (file: UploadFile) => {
        const isExcel = file.type === 'application/vnd.ms-excel' ||
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (!isExcel) {
            Modal.error({title: MESSAGES.DATA_IMPORT.EXCEL_ONLY});
            return false;
        }
        const isLt10M = (file.size || 0) / 1024 / 1024 < 10;
        if (!isLt10M) {
            Modal.error({title: MESSAGES.DATA_IMPORT.FILE_SIZE_LIMIT});
            return false;
        }
        return false;
    },
};
