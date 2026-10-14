import {NextRequest} from 'next/server';
import type {DataModelDetailVO, DataModelVO, ModelColumnVO} from '@/modules/data/contracts/schemas/response/data-model/index';
import {DataModel} from '@/modules/data/domain/data-model/entities/DataModel';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {GetDataModelQuery, ListDataModelsQuery} from '@/modules/data/contracts/data-model/queries/index';
import {
    ActivateDataModelCommand,
    CreateDataModelCommand,
    DeactivateDataModelCommand,
    DeleteDataModelCommand,
    UpdateDataModelCommand
} from '@/modules/data/contracts/data-model/commands/index';

/**
 * 数据模型OHS适配器接口
 */
export interface IDataModelOHSAdapter {
    /**
     * 将HTTP请求转换为列表查询对象
     * @param request HTTP请求对象
     * @returns ListDataModelsQuery
     */
    fromRequestToListDataModelsQuery(request: NextRequest): ListDataModelsQuery;

    /**
     * 将HTTP请求转换为获取单个对象查询
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns GetDataModelQuery
     */
    fromRequestToGetDataModelQuery(request: NextRequest, id?: string): GetDataModelQuery;

    /**
     * 将HTTP请求转换为创建命令
     * @param request HTTP请求对象
     * @returns Promise<CreateDataModelCommand>
     */
    fromRequestToCreateDataModelCommand(request: NextRequest): Promise<CreateDataModelCommand>;

    /**
     * 将HTTP请求转换为更新命令
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns Promise<UpdateDataModelCommand>
     */
    fromRequestToUpdateDataModelCommand(request: NextRequest, id?: string): Promise<UpdateDataModelCommand>;

    /**
     * 将HTTP请求转换为删除命令
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns DeleteDataModelCommand
     */
    fromRequestToDeleteDataModelCommand(request: NextRequest, id?: string): DeleteDataModelCommand;

    /**
     * 将HTTP请求转换为激活命令
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns ActivateDataModelCommand
     */
    fromRequestToActivateDataModelCommand(request: NextRequest, id?: string): ActivateDataModelCommand;

    /**
     * 将HTTP请求转换为停用命令
     * @param request HTTP请求对象
     * @param id 可选的ID参数（用于动态路由）
     * @returns DeactivateDataModelCommand
     */
    fromRequestToDeactivateDataModelCommand(request: NextRequest, id?: string): DeactivateDataModelCommand;

    /**
     * 将领域对象转换为VO
     * @param domain 数据模型领域对象
     * @returns 数据模型VO
     */
    fromDataModelToDataModelVO(domain: DataModel): DataModelVO;

    /**
     * 将领域对象转换为详情VO
     * @param domain 数据模型领域对象
     * @returns 数据模型详情VO
     */
    fromDataModelToDataModelDetailVO(domain: DataModel): DataModelDetailVO;

    /**
     * 将模型列领域对象转换为VO
     * @param column 模型列领域对象
     * @returns 模型列VO
     */
    toColumnResponse(column: ModelColumn): ModelColumnVO;

    /**
     * 批量将领域对象转换为VO
     * @param domains 数据模型领域对象列表
     * @returns 数据模型VO列表
     */
    fromDataModelListToDataModelVOList(domains: DataModel[]): DataModelVO[];
}
