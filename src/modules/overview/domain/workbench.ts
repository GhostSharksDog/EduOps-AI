import type {WorkbenchItem} from '@/shared/contracts/workbench';

const time=(item:WorkbenchItem)=>Number.isFinite(Date.parse(item.updatedAt))?Date.parse(item.updatedAt):0;
export const workbenchItemKey=(item:WorkbenchItem)=>item.kind+':'+item.id;
export function compareWorkbenchRecent(a:WorkbenchItem,b:WorkbenchItem){return time(b)-time(a)||workbenchItemKey(a).localeCompare(workbenchItemKey(b));}
export function compareWorkbenchTodos(a:WorkbenchItem,b:WorkbenchItem,today:string){
 const rank=(item:WorkbenchItem)=>item.kind==='task'&&item.dueDate&&item.dueDate<today?0:item.kind==='task'&&item.status==='review_pending'?1:2;
 const first=rank(a),second=rank(b);
 return first-second||(first===0&&second===0?(a.dueDate??'').localeCompare(b.dueDate??''):0)||compareWorkbenchRecent(a,b);
}
export function recentWorkbenchItems(items:WorkbenchItem[],limit=6){
 const sorted=[...items].sort(compareWorkbenchRecent),seen=new Set<string>();
 return sorted.filter(item=>{const key=workbenchItemKey(item);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
