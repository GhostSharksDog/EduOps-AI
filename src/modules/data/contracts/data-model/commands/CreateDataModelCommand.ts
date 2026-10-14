import {Feature} from "@/shared/types/feature";
import {ModelColumnCreateCommand} from '@/modules/data/contracts/data-model/commands/ModelColumnCreateCommand';
import {DataModelStatus} from "@/shared/enums/data-models/DataModelStatus";

export class CreateDataModelCommand {
    constructor(
        public name: string,
        public createdBy: string ,
        public datasourceId: string,
        public description: string = '',
        public tableName: string = '',
        public status: DataModelStatus = DataModelStatus.DRAFT,
        public columns: ModelColumnCreateCommand[] = [],
        public feature?: Feature,
        public ownedBy?: string,
    ) {
    }
}
