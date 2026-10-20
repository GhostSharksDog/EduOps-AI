import {describe,expect,it} from 'vitest';
import {getNavigationSection,getSelectedKey,getWorkbenchEntries,getWorkbenchQuickEntries,menuItems,workbenchCatalog,menuKeyToPath} from '@/modules/overview/ui/config/menuConfig';
describe('工作台导航与真实入口权限',()=>{
 it('四个主入口不变，工作台所属页面单独选中且不生成17项次级导航',()=>{
  expect(menuItems).toHaveLength(4);expect(getSelectedKey('/dashboard/workbench')).toEqual(['workbench']);
  for(const item of workbenchCatalog.filter(x=>x.group!=='common'))expect(getSelectedKey(item.path)).toEqual(['workbench']);
  expect(getNavigationSection('workbench')).toEqual([]);expect(getNavigationSection(undefined)).toEqual([]);
  expect(getSelectedKey('/dashboard/tags/risk')).toEqual(['segments-risk']);expect(getSelectedKey('/dashboard/reports/report-id')).toEqual(['decisions']);
  expect(getSelectedKey('/dashboard/help')).toEqual([]);expect(getSelectedKey('/dashboard/unrecognized')).toEqual([]);
 });
 it('目录路径唯一复用映射，每种角色都有六个常用入口',()=>{
  expect(new Set(workbenchCatalog.map(x=>x.key)).size).toBe(workbenchCatalog.length);
  for(const entry of workbenchCatalog)expect(entry.path).toBe(menuKeyToPath[entry.key]);
  for(const role of ['admin','operator','viewer'])expect(getWorkbenchQuickEntries(role,false).map(x=>x.key)).toEqual(['agent','tags-risk','segments-risk','knowledge','data-import','evaluation']);
 });
 it('沿用管理员和诊断额外限制，生产环境不展示数据库浏览器',()=>{
  const admin=getWorkbenchEntries('admin',false).map(x=>x.key),operator=getWorkbenchEntries('operator',false).map(x=>x.key),viewer=getWorkbenchEntries('viewer',false).map(x=>x.key);
  expect(admin).toHaveLength(16);expect(operator).toHaveLength(11);expect(viewer).toHaveLength(10);
  for(const key of ['permissions','audit-logs','settings','recycle-bin','tags-bitmap']){expect(admin).toContain(key);expect(operator).not.toContain(key);expect(viewer).not.toContain(key);}
  expect(operator).toContain('diagnostics');expect(viewer).not.toContain('diagnostics');expect(viewer).toContain('tags-monitor');
  expect(admin).not.toContain('db-browser');expect(getWorkbenchEntries('admin',true).map(x=>x.key)).toContain('db-browser');expect(getWorkbenchEntries(undefined,false)).toEqual([]);
 });
});
