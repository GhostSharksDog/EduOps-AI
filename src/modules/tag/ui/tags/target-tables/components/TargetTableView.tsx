'use client';

import React, {useMemo, useState} from 'react';
import {Select, Space, Input, Button} from 'antd';
import {TableOutlined} from '@ant-design/icons';
import {useGlobalMessage} from '@/shared/lib/message-service';
import {useTargetTableManagementStore} from '@/modules/tag/ui/state/targetTableManagementStore';
import {
    useTargetTables,
    useTargetTableDetail,
    useCreateTable,
    useActivateTable,
    useDeactivateTable,
    useDeleteTargetTable,
    useSyncStatus,
    useSyncAllStatus
} from '@/modules/tag/ui/tags/target-tables/hooks/useTargetTableManagement';
import type {TargetTableVO} from '@/shared/schemas/response/target-table/index';
import PageHeader from '@/shared/ui/dashboard/PageHeader';
import TableCard from '@/shared/ui/dashboard/TableCard/index';
import {RefreshButton} from '@/shared/ui/dashboard/RefreshButton/index';
import TargetTableList from '@/modules/tag/ui/tags/target-tables/components/TargetTableList';
import CreateTargetTableDrawer from '@/modules/tag/ui/tags/target-tables/components/CreateTargetTableDrawer';
import TargetTableDetailDrawer from '@/modules/tag/ui/tags/target-tables/components/TargetTableDetailDrawer';

const TargetTableView: React.FC = () => {
    const {success, error} = useGlobalMessage();
    const [syncingId, setSyncingId] = useState<string | undefined>();
    const {
        entityTypeIdFilter,
        statusFilter,
        searchText,
        selectedTableId,
        createDrawerKey,
        setEntityTypeIdFilter,
        setStatusFilter,
        setSearchText,
        openCreateDrawer,
        openDrawer,
        closeDrawer
    } = useTargetTableManagementStore();

    const {data: tablesData, isLoading, refetch} = useTargetTables({
        status: statusFilter,
        entityTypeId: entityTypeIdFilter,
        tableName: searchText || undefined,
        page: 1,
        pageSize: 100,
    });
    const {data: tableDetail} = useTargetTableDetail(selectedTableId || undefined);

    const createTableMutation = useCreateTable();
    const activateMutation = useActivateTable();
    const deactivateMutation = useDeactivateTable();
    const deleteMutation = useDeleteTargetTable();
    const syncStatusMutation = useSyncStatus();
    const syncAllMutation = useSyncAllStatus();

    const tables = useMemo(() => tablesData?.items || [], [tablesData?.items]);
    const total = tablesData?.total ?? 0;

    const entityTypes = useMemo(() => {
        const typeMap = new Map<string, string>();
        tables.forEach(t => {
            if (!typeMap.has(t.entityTypeId)) {
                typeMap.set(t.entityTypeId, t.entityType);
            }
        });
        return Array.from(typeMap.entries())
            .map(([id, name]) => ({id, name}))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [tables]);

    const handleViewDetail = (table: TargetTableVO) => {
        openDrawer(table.id);
    };

    const handleEntityTypeClick = (entityTypeId: string) => {
        setEntityTypeIdFilter(entityTypeId);
    };

    const handleCreateTable = async (table: TargetTableVO) => {
        try {
            await createTableMutation.mutateAsync(table.id);
            success('建表成功');
            refetch();
        } catch (err) {
            error('建表失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
    };

    const handleActivate = async (table: TargetTableVO) => {
        try {
            await activateMutation.mutateAsync(table.id);
            success('激活成功');
            refetch();
        } catch (err) {
            error('激活失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
    };

    const handleDeactivate = async (table: TargetTableVO) => {
        try {
            await deactivateMutation.mutateAsync(table.id);
            success('停用成功');
            refetch();
        } catch (err) {
            error('停用失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
    };

    const handleDelete = async (table: TargetTableVO) => {
        try {
            await deleteMutation.mutateAsync(table.id);
            success('删除成功');
            closeDrawer();
            refetch();
        } catch (err) {
            error('删除失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
    };

    const handleRebuild = async (table: TargetTableVO) => {
        try {
            await createTableMutation.mutateAsync(table.id);
            success('重建成功');
            refetch();
        } catch (err) {
            error('重建失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
    };

    const handleSyncStatus = async (table: TargetTableVO) => {
        setSyncingId(table.id);
        try {
            await syncStatusMutation.mutateAsync(table.id);
            success(`同步完成: ${table.tableName}`);
        } catch (err) {
            error('同步失败: ' + (err instanceof Error ? err.message : '未知错误'));
        } finally {
            setSyncingId(undefined);
        }
    };

    const handleSyncAll = async () => {
        try {
            const result = await syncAllMutation.mutateAsync();
            success(`批量同步完成: ${result.synced} 张表已检查, ${result.missing} 张丢失`);
        } catch (err) {
            error('批量同步失败: ' + (err instanceof Error ? err.message : '未知错误'));
        }
    };

    const filterComponent = (
        <Space>
            <Select
                placeholder="实体类型"
                allowClear
                style={{width: 150}}
                value={entityTypeIdFilter}
                onChange={setEntityTypeIdFilter}
                options={entityTypes.map(type => ({label: type.name, value: type.id}))}
            />
            <Select
                placeholder="状态"
                allowClear
                style={{width: 120}}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                    {label: '草稿', value: 'DRAFT'},
                    {label: '建表失败', value: 'CREATE_FAILED'},
                    {label: '已建表', value: 'CREATED'},
                    {label: '已激活', value: 'ACTIVE'},
                    {label: '已停用', value: 'INACTIVE'},
                ]}
            />
            <Input.Search
                placeholder="搜索表名..."
                allowClear
                style={{width: 200}}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
            />
        </Space>
    );

    return (
        <div style={{padding: 24}}>
            <PageHeader
                title="目标表管理"
                description="管理标签物化视图的目标表，监控表状态和数据"
                showDefaultCreate
                onCreate={openCreateDrawer}
                createButtonText="创建新表"
            />

            <TableCard
                title="目标表"
                icon={<TableOutlined />}
                actions={
                    <Space>
                        <Button size="small" onClick={handleSyncAll} loading={syncAllMutation.isPending}>
                            同步CH状态
                        </Button>
                        <RefreshButton onClick={() => refetch()} loading={isLoading} />
                    </Space>
                }
                filter={filterComponent}
                total={total}
                totalLabel="张表"
                table={
                    <TargetTableList
                        tables={tables}
                        loading={isLoading}
                        onViewDetail={handleViewDetail}
                        onCreateTable={handleCreateTable}
                        onActivate={handleActivate}
                        onDeactivate={handleDeactivate}
                        onDelete={handleDelete}
                        onEntityTypeClick={handleEntityTypeClick}
                        onSyncStatus={handleSyncStatus}
                        onRebuild={handleRebuild}
                        syncingId={syncingId}
                    />
                }
                loading={false}
            />

            <CreateTargetTableDrawer key={createDrawerKey} />
            <TargetTableDetailDrawer selectedTable={tableDetail || null} />
        </div>
    );
};

export default TargetTableView;
