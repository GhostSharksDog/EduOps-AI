import {Feature} from "@/shared/types/feature";
import {ModelColumnUpdateCommand} from '@/modules/data/contracts/data-model/commands/ModelColumnUpdateCommand';

export class UpdateDataModelCommand {
    constructor(
        public id: string,
        public name?: string,
        public description?: string,
        public tableName?: string,
        public columns?: ModelColumnUpdateCommand[],
        public feature?: Feature,
        public ownedBy?: string,
        public updatedBy: string = '',
    ) {
    }
}
