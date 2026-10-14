import {ModelColumnDomainService} from '@/modules/data/domain/data-model/services/ports/ModelColumnDomainService';
import {ModelColumnAddCommand, ModelColumnUpdateCommand} from '@/modules/data/contracts/data-model/commands/index';
import {ModelColumnRepository} from '@/modules/data/domain/ports/ModelColumnRepository';
import {DataModelRepository} from '@/modules/data/domain/ports/DataModelRepository';
import {ModelColumn} from '@/modules/data/domain/data-model/entities/ModelColumn';
import {DataType} from '@/shared/enums/index';

// Node.js crypto module
import crypto from 'crypto';
import { config } from "@/platform/config/index";

/**
 * 模型列领域服务实现
 */
export class ModelColumnDomainServiceImpl implements ModelColumnDomainService {
    constructor(
        private readonly modelColumnRepository: ModelColumnRepository,
        private readonly dataModelRepository: DataModelRepository
    ) {
    }

    /**
     * 添加模型列
     * @param command 添加模型列命令
     * @returns 添加的模型列
     */
    async addColumn(command: ModelColumnAddCommand): Promise<ModelColumn> {
        // 检查数据模型是否存在
        const dataModel = await this.dataModelRepository.findById(command.modelId);
        if (!dataModel) {
            throw new Error('数据模型不存在');
        }

        // 检查同一模型内列名是否已存在
        const existingColumns = await this.modelColumnRepository.findByModelId(command.modelId);
        if (existingColumns.some(col => col.name === command.column.name)) {
            throw new Error('列名在同一模型内已存在');
        }

        // 检查主键设置是否正确
        if (command.column.isPrimaryKey) {
            const primaryKeyColumns = existingColumns.filter(col => col.isPrimaryKey);
            if (primaryKeyColumns.length > 0) {
                throw new Error('每个模型只能有一个主键列');
            }
        }

        // 创建模型列实体
        const ownedBy = command.ownedBy ?? config.system.userId;
        const modelColumn = new ModelColumn(
            crypto.randomUUID(),
            command.modelId,
            command.column.name,
            ownedBy,
            new Date(),
            command.createdBy,
            command.column.description,
            {}, // feature默认值
            false,
            new Date(),
            null,
            null,
            null,
            command.column.displayName || command.column.name,
            command.column.dataType as DataType,
            command.column.length ?? null,
            command.column.precision ?? null,
            command.column.scale ?? null,
            command.column.isNullable ?? true,
            command.column.defaultValue ?? null,
            command.column.orderIndex ?? 0,
            command.column.isPrimaryKey ?? false
        );

        // 保存模型列
        return this.modelColumnRepository.create(modelColumn);
    }

    /**
     * 更新模型列
     * @param command 更新模型列命令
     * @returns 更新后的模型列
     */
    async updateColumn(command: ModelColumnUpdateCommand): Promise<ModelColumn> {
        // 检查模型列是否存在
        const existingColumn = await this.modelColumnRepository.findById(command.columnId!);
        if (!existingColumn) {
            throw new Error('模型列不存在');
        }

        // 检查同一模型内列名是否已存在（排除自身）
        const existingColumns = await this.modelColumnRepository.findByModelId(existingColumn.modelId);
        if (
            command.name &&
            command.name !== existingColumn.name &&
            existingColumns.some(col => col.name === command.name && col.id !== command.columnId)
        ) {
            throw new Error('列名在同一模型内已存在');
        }

        // 检查主键设置是否正确
        if (command.isPrimaryKey) {
            const primaryKeyColumns = existingColumns.filter(col => col.isPrimaryKey && col.id !== command.columnId);
            if (primaryKeyColumns.length > 0) {
                throw new Error('每个模型只能有一个主键列');
            }
        }

        // 更新模型列信息
        existingColumn.update({
            name: command.name,
            displayName: command.displayName,
            dataType: command.dataType as DataType,
            length: command.length,
            precision: command.precision,
            scale: command.scale,
            isNullable: command.isNullable,
            defaultValue: command.defaultValue,
            description: command.description,
            orderIndex: command.orderIndex,
            isPrimaryKey: command.isPrimaryKey
        });

        // 保存模型列
        return this.modelColumnRepository.update(existingColumn);
    }

    /**
     * 移除模型列
     * @param columnId 模型列ID
     */
    async removeColumn(columnId: string): Promise<void> {
        // 检查模型列是否存在
        const existingColumn = await this.modelColumnRepository.findById(columnId);
        if (!existingColumn) {
            throw new Error('模型列不存在');
        }

        // 删除模型列
        await this.modelColumnRepository.delete(columnId);
    }

    /**
     * 获取模型列列表
     * @param modelId 数据模型ID
     * @returns 模型列列表
     */
    async listColumns(modelId: string): Promise<ModelColumn[]> {
        // 检查数据模型是否存在
        const dataModel = await this.dataModelRepository.findById(modelId);
        if (!dataModel) {
            throw new Error('数据模型不存在');
        }

        // 获取模型列列表
        return this.modelColumnRepository.findByModelId(modelId);
    }
}
