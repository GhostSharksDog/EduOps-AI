import React from 'react';
import {Flex, theme, Typography, Upload} from 'antd';
import {InboxOutlined} from '@ant-design/icons';
import type {UploadFile, UploadProps} from 'antd/es/upload/interface';

const {Title} = Typography;
const {Dragger} = Upload;

interface FileUploaderProps extends Omit<UploadProps, 'fileList' | 'onChange'> {
    fileList: UploadFile[];
    onFileListChange: (fileList: UploadFile[]) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({
                                                       fileList,
                                                       onFileListChange,
                                                       ...uploadProps
                                                   }) => {
    const {token} = theme.useToken();

    const handleChange: UploadProps['onChange'] = (info) => {
        onFileListChange(info.fileList);
    };

    const handleRemove: UploadProps['onRemove'] = () => {
        onFileListChange([]);
    };

    return (
        <Flex vertical gap={token.marginLG}>
            <Title level={4}>上传文件</Title>
            <Dragger
                {...uploadProps}
                fileList={fileList}
                onChange={handleChange}
                onRemove={handleRemove}
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined/>
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                    支持 .xls, .xlsx 格式，文件大小不超过 10MB
                </p>
            </Dragger>
        </Flex>
    );
};

export default FileUploader;
