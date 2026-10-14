'use client';

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Button, Input, Select, Space, Tabs} from 'antd';
import {ReloadOutlined, SearchOutlined, TableOutlined} from '@ant-design/icons';
import {useTagMonitorStore} from '@/modules/tag/ui/state/tagMonitorStore';
import {useTagMonitorStatus, useTagMonitorErrorLogs} from '@/modules/tag/ui/tags/monitor/hooks/useTagMonitor';
import {useTags} from '@/modules/tag/ui/tags/hooks/useTags';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import StatusSummary from '@/modules/tag/ui/tags/monitor/components/StatusSummary';
import MvStatusTable from '@/modules/tag/ui/tags/monitor/components/MvStatusTable';
import ErrorLogList from '@/modules/tag/ui/tags/monitor/components/ErrorLogList';
import TableCard from '@/shared/ui/dashboard/TableCard/index';

/** 搜索防抖延迟（毫秒）— 改这个值即可调整延迟时长 */
const SEARCH_DEBOUNCE_MS = 800;

const MonitorView: React.FC = () => {
    const {
        statusFilter,
        searchText,
        showUnresolvedOnly,
        selectedTagId,
        setStatusFilter,
        setSearchText,
        setShowUnresolvedOnly,
        setSelectedTagId,
    } = useTagMonitorStore();

    // 本地输入值，不受 store 驱动，避免每个字符都触发查询
    const [localSearch, setLocalSearch] = useState(searchText);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // store 的 searchText 变化时同步到本地（如外部清空）
    useEffect(() => {
        setLocalSearch(searchText);
    }, [searchText]);

    const handleSearchChange = useCallback((value: string) => {
        setLocalSearch(value);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setSearchText(value);
        }, SEARCH_DEBOUNCE_MS);
    }, [setSearchText]);

    // 组件卸载时清理定时器
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const {data: tagsData} = useTags({page: 1, pageSize: 200});
    const tags = tagsData?.items || [];

    const {data: statusData = [], isLoading: statusLoading, refetch: refetchStatus} = useTagMonitorStatus({
        status: statusFilter,
        search: searchText || undefined,
        tagId: selectedTagId,
    });
    const {data: errorLogs = [], isLoading: errorLoading, refetch: refetchErrors} = useTagMonitorErrorLogs(showUnresolvedOnly);

    const loading = statusLoading || errorLoading;

    const handleRefresh = () => {
        refetchStatus();
        refetchErrors();
    };

    return (
        <div style={{padding: 24}}>
            <PageHeader
                title="MV 监控"
                description="监控标签物化视图的刷新状态和异常情况"
                showDefaultCreate={false}
            />

            <StatusSummary statusData={statusData} />

            <Tabs
                defaultActiveKey="status"
                items={[
                    {
                        key: 'status',
                        label: 'MV 状态',
                        children: (
                            <TableCard
                                title="MV 状态"
                                icon={<TableOutlined />}
                                filter={
                                    <Space>
                                        <Select
                                            value={selectedTagId}
                                            onChange={setSelectedTagId}
                                            style={{width: 200}}
                                            allowClear
                                            placeholder="选择标签"
                                            showSearch
                                            filterOption={(input, option) =>
                                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                            }
                                            options={tags.filter(t => !t.isDeleted).map(t => ({
                                                label: t.name,
                                                value: t.id,
                                            }))}
                                        />
                                        <Select
                                            value={statusFilter}
                                            onChange={setStatusFilter}
                                            style={{width: 120}}
                                            options={[
                                                {label: '全部状态', value: 'all'},
                                                {label: '正常', value: 'healthy'},
                                                {label: '警告', value: 'warning'},
                                                {label: '错误', value: 'error'},
                                            ]}
                                        />
                                        <Input
                                            placeholder="搜索标签名称"
                                            prefix={<SearchOutlined />}
                                            value={localSearch}
                                            onChange={e => handleSearchChange(e.target.value)}
                                            style={{width: 200}}
                                            allowClear
                                        />
                                    </Space>
                                }
                                actions={
                                    <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
                                        刷新
                                    </Button>
                                }
                                loading={loading}
                                table={<MvStatusTable data={statusData} loading={statusLoading} />}
                            />
                        ),
                    },
                    {
                        key: 'errors',
                        label: '异常日志',
                        children: (
                            <ErrorLogList
                                data={errorLogs}
                                loading={errorLoading}
                                showUnresolvedOnly={showUnresolvedOnly}
                                onToggleUnresolved={setShowUnresolvedOnly}
                            />
                        ),
                    },
                ]}
            />
        </div>
    );
};

export default MonitorView;
