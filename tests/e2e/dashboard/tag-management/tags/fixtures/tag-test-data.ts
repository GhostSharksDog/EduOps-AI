import { APIRequestContext } from '@playwright/test';

export interface TagTestData {
  name: string;
  dataType: 'BOOLEAN' | 'SCORE' | 'VALUE';
  updateCycle: 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  categoryId?: string;
  ruleType: 'SQL' | 'CASCADE';
  ruleContent?: string;
  steps?: Array<{ order: number; sql: string }>;
  version?: string;
  description?: string;
}

export class TagTestDataFactory {
  private static counter = 0;

  static generateName(prefix = '测试标签'): string {
    return `${prefix}_${Date.now()}_${++this.counter}`;
  }

  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  static generateUUIDs(count: number): string[] {
    return Array.from({ length: count }, () => this.generateUUID());
  }

  static createBooleanTag(overrides?: Partial<TagTestData>): TagTestData {
    return {
      name: this.generateName('布尔标签'),
      dataType: 'BOOLEAN',
      updateCycle: 'DAILY',
      ruleType: 'SQL',
      ruleContent: 'SELECT entity_id, true as value FROM users WHERE created_at > now() - INTERVAL 7 DAY LIMIT 100',
      ...overrides
    };
  }

  static createScoreTag(overrides?: Partial<TagTestData>): TagTestData {
    return {
      name: this.generateName('分数标签'),
      dataType: 'SCORE',
      updateCycle: 'HOURLY',
      ruleType: 'SQL',
      ruleContent: 'SELECT entity_id, score as value FROM user_scores WHERE score > 0 LIMIT 100',
      ...overrides
    };
  }

  static createCascadeTag(overrides?: Partial<TagTestData>): TagTestData {
    return {
      name: this.generateName('级联标签'),
      dataType: 'BOOLEAN',
      updateCycle: 'DAILY',
      ruleType: 'CASCADE',
      steps: [
        { order: 1, sql: 'SELECT entity_id FROM users WHERE status = 1 LIMIT 100' },
        { order: 2, sql: 'SELECT entity_id FROM step1 WHERE login_count > 10' }
      ],
      ...overrides
    };
  }

  static getBoundaryTestData() {
    return {
      nameMinLength: 'A',
      nameMaxLength: 'A'.repeat(255),
      nameOverMaxLength: 'A'.repeat(256),
      nameEmpty: '',
      nameWithSpecialChars: '标签_测试-001（特殊）',
      nameWithSqlInjection: "'; DROP TABLE tags; --",
      nameWithXss: '<script>alert("xss")</script>',
      invalidEntityIds: [
        'not-a-uuid',
        '12345',
        'abc-def-ghi',
        '00000000-0000-0000-0000-000000000000',
      ],
    };
  }
}

export class TagApiHelper {
  constructor(
    private request: APIRequestContext,
    private baseUrl: string
  ) {}

  async createTag(data: TagTestData): Promise<{ id: string; name: string }> {
    const response = await this.request.post(`${this.baseUrl}/api/tags`, {
      data: {
        name: data.name,
        dataType: data.dataType,
        updateCycle: data.updateCycle,
        categoryId: data.categoryId,
        calculationRule: data.ruleType === 'SQL' 
          ? { ruleType: 'SQL', ruleContent: data.ruleContent }
          : { ruleType: 'CASCADE', steps: data.steps },
        version: data.version || '1',
        description: data.description,
      }
    });
    
    if (!response.ok()) {
      const errorBody = await response.text();
      throw new Error(`Failed to create tag: ${response.status()} - ${errorBody}`);
    }
    
    const result = await response.json();
    return { id: result.data.id, name: data.name };
  }

  async activateTag(tagId: string): Promise<void> {
    const response = await this.request.put(`${this.baseUrl}/api/tags/${tagId}/activate`, {});
    if (!response.ok()) {
      throw new Error(`Failed to activate tag: ${response.status()}`);
    }
  }

  async deactivateTag(tagId: string): Promise<void> {
    const response = await this.request.put(`${this.baseUrl}/api/tags/${tagId}/deactivate`, {});
    if (!response.ok()) {
      throw new Error(`Failed to deactivate tag: ${response.status()}`);
    }
  }

  async deleteTag(tagId: string): Promise<void> {
    const response = await this.request.delete(`${this.baseUrl}/api/tags/${tagId}`);
    if (!response.ok()) {
      throw new Error(`Failed to delete tag: ${response.status()}`);
    }
  }

  async findTagByName(name: string): Promise<{ id: string } | null> {
    const response = await this.request.get(
      `${this.baseUrl}/api/tags?search=${encodeURIComponent(name)}`
    );
    if (!response.ok()) return null;
    
    const result = await response.json();
    const tag = result.data?.items?.find((t: any) => t.name === name);
    return tag ? { id: tag.id } : null;
  }

  async cleanupTestTags(prefix: string): Promise<void> {
    const response = await this.request.get(
      `${this.baseUrl}/api/tags?search=${encodeURIComponent(prefix)}`
    );
    if (!response.ok()) return;
    
    const result = await response.json();
    const timestampPattern = /^\d{13}$/;
    const tagsToDelete = (result.data?.items || []).filter((tag: any) => {
      if (!tag.name.startsWith(prefix) || !tag.name.includes('_')) return false;
      const parts = tag.name.split('_');
      return parts.length >= 2 && timestampPattern.test(parts[1]);
    });
    
    for (const tag of tagsToDelete) {
      try {
        await this.deleteTag(tag.id);
      } catch (error) {
        console.warn(`Failed to cleanup tag ${tag.name}:`, error);
      }
    }
  }

  async queryTagValues(tagId: string, entityIds: string[]): Promise<any[]> {
    const response = await this.request.get(
      `${this.baseUrl}/api/tags/${tagId}/values?entityIds=${entityIds.join(',')}`
    );
    if (!response.ok()) {
      throw new Error(`Failed to query tag values: ${response.status()}`);
    }
    const result = await response.json();
    return result.data || [];
  }
}
