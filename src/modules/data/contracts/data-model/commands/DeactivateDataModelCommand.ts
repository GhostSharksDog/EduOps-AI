export class DeactivateDataModelCommand {
    constructor(
        public modelId: string,
        public updatedBy: string,
        public ownedBy?: string
    ) {
    }
}
