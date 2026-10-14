import 'server-only';
import {queryOne} from '@/platform/database';
export async function managedRiskTagOwner(id:string){
  return (await queryOne<{organizationId:string}>('SELECT "organizationId" FROM education_risk_proposal WHERE "publishedTagId"=$1 LIMIT 1',[id]))?.organizationId??null;
}
