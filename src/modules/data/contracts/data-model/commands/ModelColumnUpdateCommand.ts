import {DataType} from "@/shared/enums/data-models/DataType";

/**
 * 列操作类型
 */
export enum ColumnOperation {
    UPDATE = 'UPDATE',
    CREATE = 'CREATE',
    DELETE = 'DELETE'
}

export class ModelColumnUpdateCommand {
    constructor(
        public readonly operation: ColumnOperation,
        public readonly columnId?: string,  // UPDATE/DELETE 时必需
        public readonly updatedBy?: string,
        public readonly ownedBy?: string,
        public readonly name?: string,
        public readonly displayName?: string,
        public readonly dataType?: DataType,
        public readonly length?: number,
        public readonly precision?: number,
        public readonly scale?: number,
        public readonly isNullable?: boolean,
        public readonly defaultValue?: unknown,
        public readonly description?: string,
        public readonly orderIndex?: number,
        public readonly isPrimaryKey?: boolean
    ) {
        // 验证：UPDATE/DELETE 必须提供 columnId
        if (operation === ColumnOperation.UPDATE || operation === ColumnOperation.DELETE) {
            if (!columnId) {
                throw new Error(`columnId 是 ${operation} 操作的必填项`);
            }
        }
    }
}
