'use client';

import React, {useMemo} from 'react';
import {Button, Checkbox, Empty, Space, Tag, theme, Flex} from 'antd';
import {CheckOutlined, ClockCircleOutlined, WarningOutlined} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import type {ErrorLog} from '@/modules/tag/ui/tags/monitor/hooks/useTagMonitor';
import {useResolveMonitorError} from '@/modules/tag/ui/tags/monitor/hooks/useTagMonitor';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

interface ErrorLogListProps {
    data: ErrorLog[];
    loading: boolean;
    showUnresolvedOnly: boolean;
    onToggleUnresolved: (value: boolean) => void;
}

const ErrorLogList: React.FC<ErrorLogListProps> = ({data, loading, showUnresolvedOnly, onToggleUnresolved}) => {
    const {token} = theme.useToken();
    const resolveErrorMutation = useResolveMonitorError();
    
    const filteredErrorLogs = useMemo(() => {
        if (showUnresolvedOnly) {
            return data.filter(log => !log.isResolved);
        }
        return data;
    }, [data, showUnresolvedOnly]);

    const formatTime = (time: string) => {
        return dayjs(time).format('MM-DD HH:mm');
    };

    const handleResolve = (logId: string) => {
        resolveErrorMutation.mutate(logId);
    };

    return (
        <div>
            <div style={{marginBottom: 16}}>
                <Checkbox
                    checked={showUnresolvedOnly}
                    onChange={e => onToggleUnresolved(e.target.checked)}
                >
                    仅显示未解决
                </Checkbox>
            </div>

            {filteredErrorLogs.length === 0 ? (
                <Empty description="暂无异常日志" />
            ) : (
                <div>
                    {filteredErrorLogs.map((log: ErrorLog) => (
                        <Flex
                            key={log.id}
                            align="flex-start"
                            gap={12}
                            style={{
                                padding: '12px 0',
                                borderBottom: '1px solid #f0f0f0',
                            }}
                        >
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Space>
                                    {log.isSevere && (
                                        <WarningOutlined style={{color: token.colorError}} />
                                    )}
                                    <span style={{ fontWeight: 500 }}>{log.tagName}</span>
                                    <code style={{fontSize: 12, color: token.colorTextSecondary}}>
                                        {log.mvName}
                                    </code>
                                </Space>
                                <div style={{ marginTop: 4 }}>
                                    <Space size={4} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <span style={{color: token.colorError}}>{log.errorMessage}</span>
                                        <Space>
                                            <ClockCircleOutlined style={{color: token.colorTextSecondary}} />
                                            <span style={{color: token.colorTextSecondary, fontSize: 12}}>
                                                {formatTime(log.occurredAt)}
                                            </span>
                                        </Space>
                                    </Space>
                                </div>
                            </div>
                            <div>
                                {log.isResolved ? (
                                    <Tag color="green" icon={<CheckOutlined />}>已解决</Tag>
                                ) : (
                                    <Button
                                        type="link"
                                        size="small"
                                        onClick={() => handleResolve(log.id)}
                                        loading={loading || resolveErrorMutation.isPending}
                                    >
                                        标记已解决
                                    </Button>
                                )}
                            </div>
                        </Flex>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ErrorLogList;
