import {DataSourceStatus, DataSourceType} from '@/shared/enums/datasource/index';
import {Feature} from "@/shared/types/feature";

export interface CreateDataSourceCommand {
    name: string;
    type: DataSourceType;
    host: string;
    port: number;
    databaseName: string;
    username: string;
    password: string;
    status: DataSourceStatus;
    ownedBy: string;
    description?: string;
    feature?: Feature;
    createdBy: string;
}
