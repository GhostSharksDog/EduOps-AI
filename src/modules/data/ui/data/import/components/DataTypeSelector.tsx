import React from 'react';
import {Button, Flex, Space, theme, Typography} from 'antd';

const {Title} = Typography;

interface DataTypeSelectorProps {
    selectedDataType: string;
    dataTypeOptions: { label: string; value: string }[];
    onSelectDataType: (value: string) => void;
}

const DataTypeSelector: React.FC<DataTypeSelectorProps> = ({
                                                               selectedDataType,
                                                               dataTypeOptions,
                                                               onSelectDataType,
                                                           }) => {
    const {token} = theme.useToken();

    return (
        <Flex vertical gap={token.marginLG}>
            <Title level={4}>选择数据类型</Title>
            <Space wrap>
                {dataTypeOptions.map(option => (
                    <Button
                        key={option.value}
                        type={selectedDataType === option.value ? 'primary' : 'default'}
                        onClick={() => onSelectDataType(option.value)}
                    >
                        {option.label}
                    </Button>
                ))}
            </Space>
        </Flex>
    );
};

export default DataTypeSelector;
