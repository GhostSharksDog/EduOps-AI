import React from 'react';
import {
    AppstoreOutlined,
    DatabaseOutlined,
    TagOutlined,
    TeamOutlined,
} from '@ant-design/icons';

export const withStatIcons = <T extends { icon?: React.ReactNode }>(
    statCards: T[],
    fontSize: string,
): (T & { icon: React.ReactNode })[] => {
    const iconComponents: React.ReactNode[] = [
        React.createElement(TagOutlined, { key: 'tag', style: { fontSize } }),
        React.createElement(TeamOutlined, { key: 'team', style: { fontSize } }),
        React.createElement(DatabaseOutlined, { key: 'database', style: { fontSize } }),
        React.createElement(AppstoreOutlined, { key: 'appstore', style: { fontSize } }),
    ];

    return statCards.map((card, index) => ({
        ...card,
        icon: iconComponents[index],
    })) as (T & { icon: React.ReactNode })[];
};
