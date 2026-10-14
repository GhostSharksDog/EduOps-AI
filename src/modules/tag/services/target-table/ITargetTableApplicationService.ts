import {TargetTableVO, TargetTableListVO} from '@/shared/schemas/response/target-table/index';
import {CreateTargetTableDTO, UpdateTargetTableDTO, TargetTableQueryDTO} from '@/shared/schemas/request/target-table/index';

export interface ITargetTableApplicationService {
  listTargetTables(query: TargetTableQueryDTO, tenantId?: string): Promise<TargetTableListVO>;
  
  getTargetTableById(id: string): Promise<TargetTableVO | null>;
  
  createTargetTable(dto: CreateTargetTableDTO, tenantId?: string, userId?: string): Promise<TargetTableVO>;
  
  updateTargetTable(id: string, dto: UpdateTargetTableDTO): Promise<TargetTableVO>;
  
  deleteTargetTable(id: string, userId?: string): Promise<void>;
  
  createTable(id: string): Promise<TargetTableVO>;
  
  activate(id: string): Promise<TargetTableVO>;
  
  deactivate(id: string): Promise<TargetTableVO>;
  
  linkTag(id: string, tagId: string, tagVersionId: string): Promise<TargetTableVO>;

  syncStatus(id: string): Promise<TargetTableVO>;

  syncAllStatus(): Promise<{ synced: number; missing: number }>;
}
