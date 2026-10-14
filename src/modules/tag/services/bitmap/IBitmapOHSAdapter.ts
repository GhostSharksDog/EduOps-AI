import {NextRequest} from 'next/server';
import {BitmapTableVO, BitmapTableDetailVO, BitInfoVO} from '@/shared/schemas/response/bitmap-table/index';
import {CreateBitmapTableDTO, UpdateBitmapTableStatusDTO} from '@/shared/schemas/request/bitmap-table/index';

export interface BitmapTableEntity {
    id: string;
    entityType: string;
    entityTypeId: string;
    name?: string;
    description?: string;
    sequence: number;
    totalBits: number;
    usedBits: number[];
    status: string;
    createTime: Date;
    updateTime?: Date | null;
    deleteTime?: Date | null;
    ownedBy: string;
    chTableName?: string;
}

export interface IBitmapOHSAdapter {
    fromRequestToCreateCommand(request: NextRequest): Promise<CreateBitmapTableDTO>;
    fromRequestToUpdateStatusCommand(request: NextRequest, id: string): Promise<UpdateBitmapTableStatusDTO & { id: string }>;
    fromRequestToListQuery(request: NextRequest): {
        entityTypeId?: string;
        entityType?: string;
        status?: string;
        search?: string;
    };
    
    fromEntityToVO(entity: BitmapTableEntity): BitmapTableVO;
    
    fromEntityToDetailVO(entity: BitmapTableEntity, bits: BitInfoVO[]): BitmapTableDetailVO;
}
