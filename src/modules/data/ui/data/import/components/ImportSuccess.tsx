import React from 'react';
import {Button, Card, Flex, theme, Typography} from 'antd';
import {CheckCircleOutlined} from '@ant-design/icons';

const {Title, Text} = Typography;

interface ImportSuccessProps {
    onContinue: () => void;
}

const ImportSuccess: React.FC<ImportSuccessProps> = ({onContinue}) => {
    const {token} = theme.useToken();

    return (
        <Card>
            <Flex vertical align="center" gap={token.marginLG}>
                <CheckCircleOutlined style={{fontSize: token.fontSizeXL * 2, color: token.colorSuccess}}/>
                <Title level={4}>导入完成</Title>
                <Text>数据已成功导入系统</Text>
                <Button onClick={onContinue}>
                    继续导入
                </Button>
            </Flex>
        </Card>
    );
};

export default ImportSuccess;
