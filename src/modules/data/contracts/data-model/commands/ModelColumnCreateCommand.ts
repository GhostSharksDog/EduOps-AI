import {Feature} from "@/shared/types/feature";
import {DataType} from "@/shared/enums/data-models/DataType";

export class ModelColumnCreateCommand {
    constructor(
        public name: string,
        public createdBy: string,
        public displayName?: string,
        public dataType: DataType = DataType.STRING,
        public length: number | null = null,
        public precision: number | null = null,
        public scale: number | null = null,
        public isNullable: boolean = true,
        public defaultValue?: unknown,
        public description?: string,
        public orderIndex: number = 0,
        public isPrimaryKey: boolean = false,
        public feature?: Feature,
        public ownedBy?: string
    ) {
    }
}
