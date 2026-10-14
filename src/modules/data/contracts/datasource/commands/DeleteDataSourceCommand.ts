export interface DeleteDataSourceCommand {
    id: string;
    deletedBy: string;
    ownedBy?: string;
}
