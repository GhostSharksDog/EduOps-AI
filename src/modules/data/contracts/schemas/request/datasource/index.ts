import type {CreateDataSourceDTO} from '@/modules/data/contracts/schemas/request/datasource/createDataSourceSchema';
import {createDataSourceSchema, hostRegex} from '@/modules/data/contracts/schemas/request/datasource/createDataSourceSchema';
import type {UpdateDataSourceDTO} from '@/modules/data/contracts/schemas/request/datasource/updateDataSourceSchema';
import {updateDataSourceSchema} from '@/modules/data/contracts/schemas/request/datasource/updateDataSourceSchema';
import {testDataSourceConnectionSchema} from '@/modules/data/contracts/schemas/request/datasource/testDataSourceConnectionSchema';
import type {ListDataSourcesDTO} from '@/modules/data/contracts/schemas/request/datasource/listDataSourcesSchema';
import {listDataSourcesSchema} from '@/modules/data/contracts/schemas/request/datasource/listDataSourcesSchema';

export {
    createDataSourceSchema,
    hostRegex,
    updateDataSourceSchema,
    testDataSourceConnectionSchema,
    listDataSourcesSchema
};

export type {
    CreateDataSourceDTO,
    UpdateDataSourceDTO,
    ListDataSourcesDTO
};
