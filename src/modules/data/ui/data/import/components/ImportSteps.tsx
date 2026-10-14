import React from 'react';
import {Card, Steps} from 'antd';

interface ImportStepsProps {
    currentStep: number;
}

const ImportSteps: React.FC<ImportStepsProps> = ({currentStep}) => {
    const stepsItems = [
        {
            title: '上传文件',
            content: '选择并上传数据文件',
        },
        {
            title: '导入数据',
            content: '系统处理并导入数据',
        },
        {
            title: '完成',
            content: '查看导入结果',
        },
    ];

    return (
        <Card variant="borderless">
            <Steps current={currentStep} items={stepsItems}/>
        </Card>
    );
};

export default ImportSteps;
