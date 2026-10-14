import {describe,it,expect,vi} from 'vitest';
const {queryRows}=vi.hoisted(()=>({queryRows:vi.fn(async()=>[])}));
vi.mock('@/platform/database',()=>({queryRows,mapRow:(row:unknown)=>row}));
vi.mock('@/platform/config/index',()=>({config:{system:{userId:'default-organization'}}}));
import {DatabaseTagRepository} from '@/modules/tag/repositories/DatabaseTagRepository';

describe('标签仓储的机构范围',()=>{
    it('列表和计数使用的查询必须保留明确机构条件，包括默认机构与共享目录过滤',async()=>{
        const repository=new DatabaseTagRepository();
        await repository.findAll({ownedBy:'default-organization',name:'出勤风险'});
        expect(queryRows.mock.calls[0][0]).toContain('owned_by');
        expect(queryRows.mock.calls[0][1]).toContain('default-organization');
        expect(queryRows.mock.calls[0][1]).toContain('出勤风险');
        await repository.findAll({ownedBy:'other-organization',tenantFilter:{tenantId:'other-organization'}});
        expect(queryRows.mock.calls[1][1]).toContain('other-organization');
        await repository.findAll({isPublic:true,tenantFilter:{tenantId:'other-organization'}});
        expect(queryRows.mock.calls[2][0]).toContain('is_public');
        expect(queryRows.mock.calls[2][1]).toContain('other-organization');
    });
});
