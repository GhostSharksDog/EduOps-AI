import { describe, it, expect } from 'vitest';
import { updateDataSourceSchema } from '@/modules/data/contracts/schemas/request/datasource/updateDataSourceSchema';
import { DataSourceType } from '@/shared/enums/datasource/DataSourceType';
import { DataSourceStatus } from '@/shared/enums/datasource/DataSourceStatus';

describe('updateDataSourceSchema', () => {
  const validInput = {
    name: 'Updated Database',
    host: 'db.example.com',
    port: 5433,
    databaseName: 'newdb',
    username: 'newuser',
    password: 'newpass',
    status: DataSourceStatus.ACTIVE,
    description: 'Updated description',
    feature: { enabled: true },
  };

  describe('all fields optional', () => {
    it('accepts empty object', () => {
      const result = updateDataSourceSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('accepts partial updates', () => {
      const input = { name: 'New Name' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('name field', () => {
    it('accepts valid name', () => {
      const input = { name: 'Test Database' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('host field', () => {
    it('accepts valid IPv4 address', () => {
      const input = { host: '192.168.1.1' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts valid domain name', () => {
      const input = { host: 'db.example.com' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('port field', () => {
    it('accepts number port', () => {
      const input = { port: 5432 };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects port as string (only integers allowed)', () => {
      const input = { port: '8080' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('accepts port as string in valid range', () => {
      const input = { port: 8080 };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('databaseName field', () => {
    it('accepts valid database name', () => {
      const input = { databaseName: 'mydb' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('username field', () => {
    it('accepts valid username', () => {
      const input = { username: 'admin' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('password field', () => {
    it('accepts valid password', () => {
      const input = { password: 'secret123' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('status field', () => {
    it('accepts valid status string', () => {
      const input = { status: DataSourceStatus.ACTIVE };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('description field', () => {
    it('accepts description', () => {
      const input = { description: 'Test description' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('feature field', () => {
    it('accepts any feature value', () => {
      const input = { feature: { any: 'value' } };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts null feature', () => {
      const input = { feature: null };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts string feature', () => {
      const input = { feature: 'feature-string' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('complete valid inputs', () => {
    it('accepts minimal update', () => {
      const input = { name: 'New Name' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts full update', () => {
      const result = updateDataSourceSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = updateDataSourceSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects extra fields (strict object)', () => {
      const input = { ...validInput, extra: 'field' };
      const result = updateDataSourceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
