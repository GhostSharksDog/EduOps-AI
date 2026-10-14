'use client';

import React from 'react';
import {Button, Card, Flex, Modal, Space, Tag, theme, Typography} from 'antd';
import {UploadOutlined} from '@ant-design/icons';
import type {UploadFile} from 'antd/es/upload/interface';
import type {ImportTask} from '@/modules/data/ui/state/dataImportStore';
import {useDataImportStore} from '@/modules/data/ui/state/dataImportStore';
import {MESSAGES} from '@/shared/messages/index';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import ImportSteps from '@/modules/data/ui/data/import/components/ImportSteps';
import DataTypeSelector from '@/modules/data/ui/data/import/components/DataTypeSelector';
import FileUploader from '@/modules/data/ui/data/import/components/FileUploader';
import ImportProgress from '@/modules/data/ui/data/import/components/ImportProgress';
import ImportSuccess from '@/modules/data/ui/data/import/components/ImportSuccess';
import ImportHistory from '@/modules/data/ui/data/import/components/ImportHistory';


const {Text} = Typography;

const DataImportPage: React.FC = () => {
    const {
        currentStep,
        fileList,
        importing,
        importProgress,
        importTasks,
        selectedDataType,
        downloadTemplate,
        startImport,
        resetImport,
        setSelectedDataType,
        setFileList,
    } = useDataImportStore();

    const {token} = theme.useToken();

    const dataTypeOptions = [
        {label: '用户数据', value: 'user'},
        {label: '设备数据', value: 'device'},
        {label: '行为数据', value: 'behavior'},
        {label: '交易数据', value: 'transaction'},
    ];

    const uploadProps = {
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

    const handleViewDetails = (record: ImportTask) => {
        Modal.info({
            title: MESSAGES.DATA_IMPORT.IMPORT_DETAILS_TITLE,
            width: 600,
            content: (
                < >
                    <Space>
                        <Text>文件:</Text>
                        <Text strong>{record.fileName}</Text>
                    </Space>
                    <Space>
                        <Text>数据类型:</Text>
                        <Text>{record.dataType}</Text>
                    </Space>
                    <Space>
                        <Text>状态:</Text>
                        <Tag color={record.status === 'success' ? 'success' : 'processing'}>
                            {record.status === 'success' ? '成功' : '处理中'}
                        </Tag>
                    </Space>
                    <Space>
                        <Text>成功:</Text>
                        <Text style={{color: token.colorSuccess}}>{record.successCount.toLocaleString()}</Text>
                    </Space>
                    <Space>
                        <Text>失败:</Text>
                        <Text style={{color: token.colorError}}>{record.errorCount.toLocaleString()}</Text>
                    </Space>
                </>
            ),
        });
    };

    return (
        <Flex vertical style={{padding: token.paddingLG, minHeight: '100vh'}} gap={token.marginLG}>
            <PageHeader
                title="批量导入"
                description="批量导入用户、设备、行为等数据，支持Excel格式导入，快速扩充数据资产"
                iconComponent={UploadOutlined}
                onDownloadTemplate={downloadTemplate}
            />

            <Card variant="borderless" styles={{body: {padding: 0}}}>
                <ImportSteps currentStep={currentStep}/>

                <Flex vertical gap={token.marginXL} style={{padding: token.paddingLG}}>
                    <DataTypeSelector
                        selectedDataType={selectedDataType}
                        dataTypeOptions={dataTypeOptions}
                        onSelectDataType={setSelectedDataType}
                    />

                    <FileUploader
                        fileList={fileList}
                        onFileListChange={setFileList}
                        {...uploadProps}
                    />

                    {currentStep === 0 && (
                        <Flex justify="end">
                            <Button
                                type="primary"
                                size="large"
                                icon={<UploadOutlined/>}
                                onClick={startImport}
                                loading={importing}
                            >
                                开始导入
                            </Button>
                        </Flex>
                    )}

                    {currentStep === 1 && (
                        <ImportProgress importing={importing} importProgress={importProgress}/>
                    )}

                    {currentStep === 2 && (
                        <ImportSuccess onContinue={resetImport}/>
                    )}
                </Flex>
            </Card>

            <ImportHistory importTasks={importTasks} onViewDetails={handleViewDetails}/>
        </Flex>
    );
};

export default DataImportPage;
