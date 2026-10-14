import {DataSourceStatus} from '@/shared/enums/datasource/index';
import {Feature} from "@/shared/types/feature";

export interface UpdateDataSourceCommand {
    id: string;
    name?: string;
    host?: string;
    port?: number | string;
    databaseName?: string;
    username?: string;
    password?: string;
    status?: DataSourceStatus | string;
    description?: string;
    feature?: Feature;
    updatedBy: string;
    ownedBy?: string;
}
