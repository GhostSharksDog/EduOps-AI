export class DeleteDataModelCommand {
    constructor(
        public modelId: string,
        public deletedBy: string,
        public ownedBy?: string
    ) {
    }
}
