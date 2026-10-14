import { describe, it, expect } from 'vitest';
import { userResponseSchema } from '@/shared/schemas/index';
import {
  testSchema,
  testRequiredFields,
  testUUIDValidation,
} from '../../../../helpers/schema-test-utils';

describe('userResponseSchema', () => {
  const validUserInput = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    username: 'testuser',
    realName: 'Test User',
    email: 'test@example.com',
    role: 'admin',
  };

  // Note: userResponseSchema uses z.object() (not strict), so we don't test for strict mode
  // Also, z.string().trim() accepts empty strings (trim has no effect on empty string)

  describe('required fields', () => {
    testRequiredFields(userResponseSchema, ['id', 'username', 'realName', 'role'], validUserInput);
    it('允许省略邮箱和租户信息', () => {
      const { email, ...input } = validUserInput;
      expect(userResponseSchema.safeParse(input).success).toBe(true);
    });
  });

  describe('id field', () => {
    testUUIDValidation(userResponseSchema, 'id', validUserInput);
  });

  describe('username field', () => {
    it('accepts valid username', () => {
      const input = { ...validUserInput, username: 'testuser' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from username', () => {
      const input = { ...validUserInput, username: '  testuser  ' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('testuser');
      }
    });
  });

  describe('realName field', () => {
    it('accepts valid realName', () => {
      const input = { ...validUserInput, realName: 'Test User' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from realName', () => {
      const input = { ...validUserInput, realName: '  Test User  ' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.realName).toBe('Test User');
      }
    });
  });

  describe('email field', () => {
    it('accepts valid email format', () => {
      const input = { ...validUserInput, email: 'user@domain.com' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts email with subdomain', () => {
      const input = { ...validUserInput, email: 'user@mail.example.com' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('accepts email with plus sign', () => {
      const input = { ...validUserInput, email: 'user+tag@example.com' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const input = { ...validUserInput, email: 'not-an-email' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects email without domain', () => {
      const input = { ...validUserInput, email: 'user@' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('rejects email without @', () => {
      const input = { ...validUserInput, email: 'userexample.com' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('role field', () => {
    it('accepts valid role', () => {
      const input = { ...validUserInput, role: 'admin' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('trims whitespace from role', () => {
      const input = { ...validUserInput, role: '  admin  ' };
      const result = userResponseSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe('admin');
      }
    });

    it('accepts common role values', () => {
      const roles = ['admin', 'user', 'manager', 'viewer', 'editor'];
      roles.forEach((role) => {
        const input = { ...validUserInput, role };
        const result = userResponseSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('complete valid inputs', () => {
    testSchema({
      schema: userResponseSchema,
      validCases: [
        {
          input: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            username: 'john_doe',
            realName: 'John Doe',
            email: 'john@example.com',
            role: 'user',
          },
          description: 'minimal valid user',
        },
        {
          input: {
            id: '223e4567-e89b-12d3-a456-426614174001',
            username: 'admin_user',
            realName: 'Admin User',
            email: 'admin@company.org',
            role: 'admin',
          },
          description: 'admin user',
        },
        {
          input: {
            id: '323e4567-e89b-12d3-a456-426614174002',
            username: 'super_admin',
            realName: 'Super Admin',
            email: 'super.admin@enterprise.net',
            role: 'super_admin',
          },
          description: 'super admin user',
        },
      ],
      invalidCases: [
        {
          input: { username: 'test', realName: 'Test', email: 'test@test.com', role: 'admin' },
          description: 'missing id',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', realName: 'Test', email: 'test@test.com', role: 'admin' },
          description: 'missing username',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', username: 'test', email: 'test@test.com', role: 'admin' },
          description: 'missing realName',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', username: 'test', realName: 'Test', role: 'admin', ownedBy: 123 },
          description: 'invalid tenant identifier type',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', username: 'test', realName: 'Test', email: 'test@test.com' },
          description: 'missing role',
        },
        {
          input: { id: 'invalid-uuid', username: 'test', realName: 'Test', email: 'test@test.com', role: 'admin' },
          description: 'invalid UUID format',
        },
        {
          input: { id: '123e4567-e89b-12d3-a456-426614174000', username: 'test', realName: 'Test', email: 'invalid-email', role: 'admin' },
          description: 'invalid email format',
        },
      ],
    });
  });
});
