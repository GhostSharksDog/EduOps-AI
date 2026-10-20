export const localRoles=['admin','operator','viewer'] as const;
export type LocalRole=typeof localRoles[number];
export interface LocalUser {id:string;username:string;realName:string;email:string;role:LocalRole;ownedBy:string;companyCode?:string;companyName?:string;}
export function canAccess(role:string,method:string,pathname:string):boolean {
 if(role==='admin')return true;
 if(!localRoles.includes(role as LocalRole))return false;
 if(/^\/api\/(settings|admin|recycle-bin|audit-logs)(\/|$)/.test(pathname))return false;
 if(/^\/api\/auth\/(logout|me)$/.test(pathname))return true;
 if(['GET','HEAD','OPTIONS'].includes(method))return true;
 if(role==='operator')return !/^\/api\/auth\/users(\/|$)/.test(pathname);
 if(method==='PATCH'&&/^\/api\/agent\/sessions\/[0-9a-f-]+\/task-state$/.test(pathname))return true;
 if(method==='POST'&&/^\/api\/agent\/runs\/[0-9a-f-]+\/retry-interpretation$/.test(pathname))return true;
 // 只读角色可保存只读问答记录，网关仍逐工具禁止准备和执行业务写入。
 return method==='POST'&&/^\/api\/(agent\/(?:runs|research\/compare)|analytics\/(?:(?:learning|finance)\/)?query|analytics\/channels\/(?:query|catalog)|overview\/(?:journey\/)?query|knowledge\/search|profiles\/search|alerts\/replay|decisions\/[0-9a-f-]+\/review\/preview)$/.test(pathname);
}
