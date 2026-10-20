import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import {db,execute,queryOne} from '@/platform/database';
import {config} from '@/platform/config';
import {DatabaseTagRepository} from '@/modules/tag/repositories/DatabaseTagRepository';
import {TagCategoryDomainServiceImpl} from '@/modules/tag/domain/services/TagCategoryDomainServiceImpl';
import {TagQueryDomainServiceImpl} from '@/modules/tag/domain/services/TagQueryDomainServiceImpl';
import {TagCategoryApplicationServiceImpl} from '@/modules/tag/services/TagCategoryApplicationServiceImpl';
import {TagCategoryOHSAdapterImpl} from '@/modules/tag/services/TagCategoryOHSAdapterImpl';
import type {ITagFactory} from '@/modules/tag/domain/factories/ports/ITagFactory';
import {getDefaultCompany} from '@/platform/company/registry';

const orgA=getDefaultCompany().organizationId,orgB=randomUUID(),actor=randomUUID();
const rootId=randomUUID(),childId=randomUUID(),emptyId=randomUUID(),foreignParentId=randomUUID();
const tagIds=Array.from({length:7},()=>randomUUID());
const keyword='分类计数隔离_'+randomUUID();
const tenantA={tenantId:orgA},tenantB={tenantId:orgB};
const repository=new DatabaseTagRepository();
const categoryDomain=new TagCategoryDomainServiceImpl(repository,{} as ITagFactory);
const service=new TagCategoryApplicationServiceImpl(
  categoryDomain,
  new TagQueryDomainServiceImpl(repository),
  new TagCategoryOHSAdapterImpl(),
);
let verified=false;
function assertDatabase(){
  const url=process.env.DATABASE_URL&&new URL(process.env.DATABASE_URL);
  if(!url||url.hostname!=='127.0.0.1'||url.port!=='25432'||url.pathname!=='/education_cleanup_test')throw new Error('只允许专用 education_cleanup_test 数据库');
}
beforeAll(async()=>{
  assertDatabase();
  expect((await queryOne<{name:string}>('SELECT current_database() AS name'))?.name).toBe('education_cleanup_test');
  verified=true;
  for(const [id,parent,order]of [[rootId,null,0],[childId,rootId,1],[emptyId,rootId,2]]as const){
    await execute('INSERT INTO tag_category(id,name,owned_by,parent_id,path,"order",created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,keyword+'_'+order,config.system.userId,parent,'/'+rootId+(parent?'/'+id:''),order,actor]);
  }
  await execute('INSERT INTO tag_category(id,name,owned_by,path,created_by) VALUES($1,$2,$3,$4,$5)',[foreignParentId,'外机构父分类_'+randomUUID(),orgB,'/'+foreignParentId,actor]);
  const owners=[orgA,orgA,orgB,orgB,orgB,config.system.userId,orgA];
  for(let i=0;i<tagIds.length;i++){
    await execute('INSERT INTO tag(id,name,owned_by,value_type,category_id,is_deleted,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[tagIds[i],keyword+'_标签_'+i,owners[i],'STRING',childId,i===6,actor]);
  }
});
afterAll(async()=>{
  if(!verified)return;
  assertDatabase();
  // 仅删除本文件随机编号的临时记录，保留其他机构和其他套件的数据。
  await execute('DELETE FROM tag WHERE id=ANY($1::uuid[])',[tagIds]);
  await execute('DELETE FROM tag_category WHERE id=ANY($1::uuid[])',[[childId,emptyId,rootId,foreignParentId]]);
  await db.end();
});

describe('分类标签数字的真实机构隔离',()=>{
  it('批量SQL只统计指定机构标签，排除其他机构及已删除标签',async()=>{
    expect(await repository.countTagsByCategoryIds([childId,emptyId],tenantA)).toEqual(new Map([[childId,3],[emptyId,0]]));
    expect(await repository.countTagsByCategoryIds([childId],tenantB)).toEqual(new Map([[childId,3]]));
    expect(await repository.countTagsByCategoryIds([childId])).toEqual(new Map([[childId,6]]));
    expect(await repository.countTagsByCategoryIds([],tenantA)).toEqual(new Map());
  });

  it('单条分类的tagCount遵守同一机构范围，其他机构不能读取',async()=>{
    expect((await service.getCategory({categoryId:childId,tenantFilter:tenantA})).tagCount).toBe(3);
    await expect(service.getCategory({categoryId:childId,tenantFilter:tenantB})).rejects.toThrow('分类不存在');
  });

  it('无parent的分类树只显示授权标签计数',async()=>{
    const result=await service.listCategories({keyword,page:1,pageSize:10,tenantFilter:tenantA});
    expect(result.totalCount).toBe(3);
    const root=result.items.find(row=>row.id===rootId);
    expect(root?.children?.find(row=>row.id===childId)?.tagCount).toBe(3);
    expect(root?.children?.find(row=>row.id===emptyId)?.tagCount).toBe(0);
  });

  it('指定parent的列表计数与单条查询保持一致',async()=>{
    const result=await service.listCategories({parentId:rootId,page:1,pageSize:10,tenantFilter:tenantB});
    expect(result.totalCount).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('排序包含外机构分类时，不会先修改前面的已授权分类',async()=>{
    await expect(categoryDomain.reorderCategories([emptyId,foreignParentId],[9,10],tenantA)).rejects.toThrow('分类不存在');
    expect((await queryOne<{order:number}>('SELECT "order" FROM tag_category WHERE id=$1',[emptyId]))?.order).toBe(2);
    expect((await queryOne<{order:number}>('SELECT "order" FROM tag_category WHERE id=$1',[foreignParentId]))?.order).toBe(0);
  });

  it('移动和更新均拒绝外机构父分类，并保留已有父节点及名称',async()=>{
    await expect(categoryDomain.moveCategory(childId,foreignParentId,tenantA)).rejects.toThrow('分类不存在');
    await expect(categoryDomain.updateCategory(childId,{categoryId:childId,parentId:foreignParentId,name:'应拒绝改名',updatedBy:actor},tenantA)).rejects.toThrow('分类不存在');
    const row=await queryOne<{parent_id:string;name:string}>('SELECT parent_id,name FROM tag_category WHERE id=$1',[childId]);
    expect(row?.parent_id).toBe(rootId);
    expect(row?.name).toBe(keyword+'_1');
  });

  it('创建分类时拒绝外机构父节点，不留下越权关联记录',async()=>{
    const name='越权创建验收_'+randomUUID();
    await expect(categoryDomain.createCategory({name,parentId:foreignParentId,description:'',orderIndex:0,createdBy:actor,ownedBy:orgA})).rejects.toThrow('分类不存在');
    expect((await queryOne<{count:number}>('SELECT COUNT(*)::int AS count FROM tag_category WHERE name=$1',[name]))?.count).toBe(0);
  });
});
