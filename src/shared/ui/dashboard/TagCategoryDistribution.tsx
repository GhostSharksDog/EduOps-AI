import React from 'react';
import {Card, Flex, Progress, Typography, Skeleton} from 'antd';
import {useCategoryDistribution} from '@/modules/overview/client';

const {Text} = Typography;

interface TagCategoryDistributionProps {
    className?: string;
}

const TagCategoryDistribution: React.FC<TagCategoryDistributionProps> = ({className}) => {
    const {data, isLoading} = useCategoryDistribution(1, 10);

    if (isLoading || !data) {
        return (
            <Card
                title="标签分类分布"
                className={className}
                styles={{
                    body: {
                        padding: '20px',
                    },
                }}
            >
                <Flex vertical gap={16}>
                    {[1, 2, 3, 4, 5].map((i) => (
                        <Flex key={i} justify="space-between" align="center">
                            <Flex align="center" gap={8}>
                                <Skeleton.Button active size="small" />
                                <Skeleton.Input active size="small" style={{ width: 80 }} />
                            </Flex>
                            <Flex align="center" gap={12}>
                                <Skeleton.Input active size="small" style={{ width: 40 }} />
                                <Skeleton.Input active size="small" style={{ width: 100 }} />
                            </Flex>
                        </Flex>
                    ))}
                </Flex>
            </Card>
        );
    }

    return (
        <Card
            title="标签分类分布"
            className={className}
            styles={{
                body: {
                    padding: '20px',
                },
            }}
        >
            <Flex vertical gap={16}>
                {data.map((category, index) => (
                    <Flex key={index} justify="space-between" align="center">
                        <Flex align="center" gap={8}>
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: category.color,
                                }}
                            />
                            <Text>{category.name}</Text>
                        </Flex>
                        <Flex align="center" gap={12}>
                            <Text type="secondary">{category.count}个</Text>
                            <Progress
                                percent={category.percentage}
                                size="small"
                                strokeColor={category.color}
                                showInfo={false}
                                style={{width: 100}}
                            />
                        </Flex>
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default TagCategoryDistribution;
