export const localRoles=['admin','operator','viewer'] as const;
export type LocalRole=typeof localRoles[number];
export interface LocalUser {id:string;username:string;realName:string;email:string;role:LocalRole;ownedBy:string;}
export function canAccess(role:string,method:string,pathname:string):boolean {
 if(role==='admin')return true;
 if(!localRoles.includes(role as LocalRole))return false;
 if(/^\/api\/(settings|admin|recycle-bin|audit-logs)(\/|$)/.test(pathname))return false;
 if(/^\/api\/auth\/(logout|me)$/.test(pathname))return true;
 if(['GET','HEAD','OPTIONS'].includes(method))return true;
 if(role==='operator')return !/^\/api\/auth\/users(\/|$)/.test(pathname);
 // 只读角色可运行只读查询，但不能创建会话、任务、标签或草稿。
 return method==='POST'&&/^\/api\/(analytics\/(?:(?:learning|finance)\/)?query|analytics\/channels\/(?:query|catalog)|overview\/(?:journey\/)?query|knowledge\/search|profiles\/search|alerts\/replay|decisions\/[0-9a-f-]+\/review\/preview)$/.test(pathname);
}
