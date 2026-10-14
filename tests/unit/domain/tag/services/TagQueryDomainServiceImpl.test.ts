import {describe,expect,it,vi} from 'vitest';
import {TagQueryDomainServiceImpl} from '@/modules/tag/domain/services/TagQueryDomainServiceImpl';
import type {TagRepository} from '@/modules/tag/domain/ports/TagRepository';

describe('分类标签计数的机构边界',()=>{
  it('批量计数透传机构范围，保留共享类别下的过滤',async()=>{
    const counts=new Map([['category-a',2]]);
    const countTagsByCategoryIds=vi.fn().mockResolvedValue(counts);
    const service=new TagQueryDomainServiceImpl({countTagsByCategoryIds} as unknown as TagRepository);
    const tenantFilter={tenantId:'00000000-0000-4000-8000-000000000201'};
    expect(await service.countTagsByCategoryIds(['category-a'],tenantFilter)).toBe(counts);
    expect(countTagsByCategoryIds).toHaveBeenCalledWith(['category-a'],tenantFilter);
  });

  it('单类计数同时保留分类和机构过滤',async()=>{
    const findAll=vi.fn().mockResolvedValue([{},{}]);
    const service=new TagQueryDomainServiceImpl({findAll} as unknown as TagRepository);
    const criteria={categoryId:'category-a',tenantFilter:{tenantId:'00000000-0000-4000-8000-000000000201'}};
    expect(await service.countTagsByCriteria(criteria)).toBe(2);
    expect(findAll).toHaveBeenCalledWith(criteria);
  });
});
