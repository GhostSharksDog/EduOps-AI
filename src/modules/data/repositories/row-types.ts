import type { Feature } from '@/shared/types/feature';
export interface AuditRow {
    id: string;
    ownedBy: string;
    description: string | null;
    feature: Feature | null;
    isDeleted: boolean;
    createTime: Date;
    updateTime: Date | null;
    deleteTime: Date | null;
    createdBy: string;
    updatedBy: string | null;
    deletedBy: string | null;
}
export interface DataSourceRow extends AuditRow {
    name: string;
    type: string;
    host: string;
    port: number;
    databaseName: string;
    username: string;
    password: string;
    status: string;
}
export interface DataModelRow extends AuditRow {
    name: string;
    datasourceId: string;
    tableName: string | null;
    status: string;
    dataSource?: DataSourceRow;
}
export interface ModelColumnRow extends AuditRow {
    modelId: string;
    name: string;
    displayName: string | null;
    dataType: string;
    length: number | null;
    precision: number | null;
    scale: number | null;
    isNullable: boolean;
    defaultValue: string | null;
    orderIndex: number;
    isPrimaryKey: boolean;
}
