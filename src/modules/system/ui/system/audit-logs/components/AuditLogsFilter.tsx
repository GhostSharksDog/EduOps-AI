'use client';

import React, {useState} from 'react';
import {Select, DatePicker, Button, Space, Input} from 'antd';
import {ClearOutlined} from '@ant-design/icons';
import type {AuditAction, AuditEntity} from '@/shared/schemas/request/audit/index';
import type {RangePickerProps} from 'antd/es/date-picker';
import dayjs from 'dayjs';

const ACTION_OPTIONS: {value: AuditAction; label: string}[] = [
    {value: 'CREATE', label: '创建'},
    {value: 'UPDATE', label: '更新'},
    {value: 'DELETE', label: '删除'},
    {value: 'ACTIVATE', label: '激活'},
    {value: 'DEACTIVATE', label: '停用'},
    {value: 'RESTORE', label: '恢复'},
    {value: 'BATCH_DELETE', label: '批量删除'},
    {value: 'BATCH_RESTORE', label: '批量恢复'},
    {value: 'REORDER', label: '排序'},
    {value: 'MOVE', label: '移动'},
    {value: 'SET_VERSION', label: '设置版本'},
    {value: 'TEST_CONNECTION', label: '测试连接'},
    {value: 'LOGIN', label: '登录'},
    {value: 'LOGOUT', label: '登出'},
];

const ENTITY_OPTIONS: {value: AuditEntity; label: string}[] = [
    {value: 'Tag', label: '标签'},
    {value: 'TagCategory', label: '标签分类'},
    {value: 'TagVersion', label: '标签版本'},
    {value: 'Segment', label: '人群'},
    {value: 'SegmentCondition', label: '人群条件'},
    {value: 'DataSource', label: '数据源'},
    {value: 'DataModel', label: '数据模型'},
    {value: 'RecycleBin', label: '回收站'},
    {value: 'Enum', label: '枚举'},
    {value: 'EnumValue', label: '枚举值'},
    {value: 'BitmapTable', label: '位图表'},
    {value: 'Session', label: '会话'},
];

interface Filters {
    action?: string;
    entity?: string;
    actorId?: string;
    startTime?: string;
    endTime?: string;
}

interface AuditLogsFilterProps {
    onFilterChange: (filters: Filters) => void;
}

const AuditLogsFilter: React.FC<AuditLogsFilterProps> = ({onFilterChange}) => {
    const [action, setAction] = useState<string | undefined>();
    const [entity, setEntity] = useState<string | undefined>();
    const [actorId, setActorId] = useState<string | undefined>();
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

    const handleActionChange = (value: string | undefined) => {
        setAction(value);
        onFilterChange({action: value, entity, actorId});
    };

    const handleEntityChange = (value: string | undefined) => {
        setEntity(value);
        onFilterChange({action, entity: value, actorId});
    };

    const handleActorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value || undefined;
        setActorId(value);
        onFilterChange({action, entity, actorId: value});
    };

    const handleDateRangeChange: RangePickerProps['onChange'] = (dates) => {
        const dayjsDates = dates as [dayjs.Dayjs, dayjs.Dayjs] | null;
        setDateRange(dayjsDates);
        if (dayjsDates) {
            onFilterChange({
                action,
                entity,
                actorId,
                startTime: dayjsDates[0].toISOString(),
                endTime: dayjsDates[1].toISOString(),
            });
        } else {
            onFilterChange({action, entity, actorId});
        }
    };

    const handleReset = () => {
        setAction(undefined);
        setEntity(undefined);
        setActorId(undefined);
        setDateRange(null);
        onFilterChange({});
    };

    return (
        <Space size={8} align="center">
            <Select
                placeholder="操作类型"
                allowClear
                style={{width: 120}}
                options={ACTION_OPTIONS}
                onChange={handleActionChange}
                value={action}
            />
            <Select
                placeholder="实体类型"
                allowClear
                style={{width: 120}}
                options={ENTITY_OPTIONS}
                onChange={handleEntityChange}
                value={entity}
            />
            <Input
                placeholder="操作人（用户名/姓名/邮箱）"
                allowClear
                style={{width: 180}}
                onChange={handleActorChange}
                value={actorId}
            />
            <DatePicker.RangePicker
                showTime
                style={{width: 360}}
                value={dateRange}
                placeholder={['开始时间', '结束时间']}
                onChange={handleDateRangeChange}
            />
            <Button onClick={handleReset} icon={<ClearOutlined />} size="small">
                重置
            </Button>
        </Space>
    );
};

export default AuditLogsFilter;
