import type { ITagBitmapSyncStateRepository } from '@/modules/tag/domain/ports/ITagBitmapSyncStateRepository';
import type { SyncState, SyncStatus, CreateSyncStateData, UpdateSyncStateData } from '@/modules/tag/domain/services/dto/TagBitmapSyncDto';
import { TagBitmapSyncStateRepositoryImpl } from '@/modules/tag/repositories/TagBitmapSyncStateRepositoryImpl';

export class DatabaseTagBitmapSyncStateRepository implements ITagBitmapSyncStateRepository {
  private adapter = new TagBitmapSyncStateRepositoryImpl();

  async findByTagId(tagId: string, ownedBy: string): Promise<SyncState | null> {
    return this.adapter.findByTagId(tagId, ownedBy);
  }

  async findByStatus(statuses: SyncStatus[], ownedBy: string): Promise<SyncState[]> {
    return this.adapter.findByStatus(statuses, ownedBy);
  }

  async findNeedsIncrementalSync(ownedBy: string): Promise<SyncState[]> {
    return this.adapter.findNeedsIncrementalSync(ownedBy);
  }

  async findByTagVersionMismatch(ownedBy: string): Promise<SyncState[]> {
    return this.adapter.findByTagVersionMismatch(ownedBy);
  }

  async create(data: CreateSyncStateData): Promise<SyncState> {
    return this.adapter.create(data);
  }

  async update(id: string, data: UpdateSyncStateData): Promise<void> {
    return this.adapter.update(id, data);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    return this.adapter.softDelete(id, deletedBy);
  }

  async findDistinctOwnedBy(): Promise<string[]> {
    return this.adapter.findDistinctOwnedBy();
  }
}

let repository: DatabaseTagBitmapSyncStateRepository | null = null;

export function getDatabaseTagBitmapSyncStateRepository(): ITagBitmapSyncStateRepository {
  if (!repository) {
    repository = new DatabaseTagBitmapSyncStateRepository();
  }
  return repository;
}
