import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getCurrentTenantId,
    getTenantFilter,
    isTenantIsolationEnabled,
    createTenantFilter,
    applyTenantFilterToWhere,
} from '@/platform/get-current-tenant';

// Mock config module
vi.mock('@/platform/config/index', () => ({
    config: {
        system: {
            userId: 'system-user-id'
        }
    }
}));

describe('get-current-tenant', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getCurrentTenantId', () => {
        it('should return tenant ID from x-tenant-id header', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-tenant-id': 'tenant-123' }
            });
            expect(getCurrentTenantId(request)).toBe('tenant-123');
        });

        it('should return system user ID when no tenant header', () => {
            const request = new Request('http://localhost');
            expect(getCurrentTenantId(request)).toBe('system-user-id');
        });

        it('should return system user ID when tenant header is empty', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-tenant-id': '' }
            });
            expect(getCurrentTenantId(request)).toBe('system-user-id');
        });
    });

    describe('createTenantFilter', () => {
        it('should return empty object when no tenant ID provided', () => {
            expect(createTenantFilter(undefined)).toEqual({});
        });

        it('should return empty object when tenant ID is system user ID', () => {
            expect(createTenantFilter('system-user-id')).toEqual({});
        });

        it('should return tenant filter options when tenant ID is provided', () => {
            expect(createTenantFilter('tenant-123')).toEqual({ tenantId: 'tenant-123' });
        });
    });

    describe('applyTenantFilterToWhere', () => {
        it('should return original where when no tenant filter options', () => {
            const where = { name: 'test' };
            expect(applyTenantFilterToWhere(where, undefined)).toEqual(where);
        });

        it('should return original where when tenant filter has no tenantId', () => {
            const where = { name: 'test' };
            expect(applyTenantFilterToWhere(where, {})).toEqual(where);
        });

        it('should add OR filter when tenantId is provided', () => {
            const where = { name: 'test' };
            const result = applyTenantFilterToWhere(where, { tenantId: 'tenant-123' });
            
            expect(result).toEqual({
                name: 'test',
                OR: [
                    { ownedBy: 'tenant-123' },
                    { ownedBy: 'system-user-id' }
                ]
            });
        });

        it('should preserve existing conditions in where clause', () => {
            const where = { 
                name: 'test', 
                status: 'active',
                AND: [{ deletedAt: null }]
            };
            const result = applyTenantFilterToWhere(where, { tenantId: 'tenant-123' });
            
            expect(result).toMatchObject({
                name: 'test',
                status: 'active',
                AND: [{ deletedAt: null }],
                OR: [
                    { ownedBy: 'tenant-123' },
                    { ownedBy: 'system-user-id' }
                ]
            });
        });
    });

    describe('getTenantFilter', () => {
        it('should return empty object for system user (no tenant header)', () => {
            const request = new Request('http://localhost');
            expect(getTenantFilter(request)).toEqual({});
        });

        it('should return OR filter for tenant user', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-tenant-id': 'tenant-123' }
            });
            expect(getTenantFilter(request)).toEqual({
                OR: [
                    { ownedBy: 'tenant-123' },
                    { ownedBy: 'system-user-id' }
                ]
            });
        });

        it('should return empty object when tenant header equals system user ID', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-tenant-id': 'system-user-id' }
            });
            expect(getTenantFilter(request)).toEqual({});
        });
    });

    describe('isTenantIsolationEnabled', () => {
        it('should return false when no tenant ID header', () => {
            const request = new Request('http://localhost');
            expect(isTenantIsolationEnabled(request)).toBe(false);
        });

        it('should return true when tenant ID is set and different from system', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-tenant-id': 'tenant-123' }
            });
            expect(isTenantIsolationEnabled(request)).toBe(true);
        });

        it('should return false when tenant ID equals system user ID', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-tenant-id': 'system-user-id' }
            });
            expect(isTenantIsolationEnabled(request)).toBe(false);
        });

        it('should return false when tenant header is empty string', () => {
            const request = new Request('http://localhost', {
                headers: { 'x-tenant-id': '' }
            });
            expect(isTenantIsolationEnabled(request)).toBe(false);
        });
    });
});
