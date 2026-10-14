import React from 'react';
import {Avatar, Card, Flex, theme, Typography} from 'antd';


const {Link, Text} = Typography;

interface HotTagItem {
    name: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
}

const HotTagsList: React.FC = () => {
    const {token} = theme.useToken();

    const hotTags: HotTagItem[] = [
        {name: 'VIP用户', count: 45000, trend: 'up'},
        {name: '高频消费', count: 32000, trend: 'up'},
        {name: '地域-北京', count: 28000, trend: 'stable'},
        {name: '活跃用户', count: 21000, trend: 'down'},
        {name: '偏好-电子产品', count: 18000, trend: 'up'},
    ];

    return (
        <Card title="热门标签 Top 10" variant="borderless">
            <Flex vertical>
                {hotTags.map((item, index, arr) => (
                    <Flex
                        key={item.name}
                        justify="space-between"
                        align="center"
                        style={{
                            padding: `${token.paddingMD} 0`,
                            borderBottom: index === arr.length - 1 ? 'none' : `1px solid ${token.colorBorder}`
                        }}
                    >
                        <Flex align="center">
                            <Avatar style={{
                                marginRight: token.marginLG,
                                backgroundColor: index < 3 ? token.colorPrimary : token.colorBorder
                            }}>{index + 1}</Avatar>
                            <Flex vertical gap={token.marginSM}>
                                <Text style={{fontWeight: 500}}><Link href="#"
                                                                      style={{color: token.colorText}}>{item.name}</Link></Text>
                                <Text style={{
                                    color: token.colorTextSecondary,
                                    fontSize: token.fontSize
                                }}>用户画像、营销活动</Text>
                            </Flex>
                        </Flex>
                        <Flex vertical align="flex-end" gap={token.marginSM}>
                            <Text style={{fontWeight: 'bold'}}>{item.count.toLocaleString()}</Text>
                            <Text style={{
                                fontSize: token.fontSizeSM,
                                color: item.trend === 'up' ? token.colorSuccess : (item.trend === 'down' ? token.colorError : token.colorTextSecondary)
                            }}>
                                {item.trend === 'up' ? '上升' : (item.trend === 'down' ? '下降' : '持平')}
                            </Text>
                        </Flex>
                    </Flex>
                ))}
            </Flex>
        </Card>
    );
};

export default HotTagsList;
