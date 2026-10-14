import React from 'react';
import {Card, Flex, Progress, theme, Typography} from 'antd';

const {Title, Text} = Typography;

interface ImportProgressProps {
    importing: boolean;
    importProgress: number;
}

const ImportProgress: React.FC<ImportProgressProps> = ({
                                                           importing,
                                                           importProgress,
                                                       }) => {
    const {token} = theme.useToken();

    return (
        <Card>
            <Flex vertical align="center" gap={token.marginLG}>
                <Title level={4}>正在导入数据...</Title>
                <Progress
                    type="circle"
                    percent={Math.round(importProgress)}
                    status={importing ? 'active' : 'success'}
                    size={120}
                />
                <Text type="secondary">请稍候，正在处理数据</Text>
            </Flex>
        </Card>
    );
};

export default ImportProgress;
