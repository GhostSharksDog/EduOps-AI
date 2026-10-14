export class ActivateDataModelCommand {
    constructor(
        public modelId: string,
        public updatedBy: string,
        public ownedBy?: string
    ) {
    }
}
