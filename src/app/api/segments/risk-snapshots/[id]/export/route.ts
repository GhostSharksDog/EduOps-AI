import {NextRequest} from 'next/server';
import {z} from 'zod';
import {authMiddleware,getCurrentUser} from '@/modules/identity/server';
import {riskSegments} from '@/modules/segment/server';
import {apiError} from '@/shared/lib/api-error';
import type {OperationalTagMember} from '@/modules/tag/contracts';

const cell=(value:unknown)=>'"'+String(value??'').replace(/^([\s\u0000-\u001f]*[=+\-@])/u,"'$1").replaceAll('"','""')+'"';
const csv=(row:unknown[])=>row.map(cell).join(',')+'\r\n';
/** Authenticated, bounded-page export; keep the original frozen order and never fetch the full JSONB array. */
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const denied=await authMiddleware(request);if(denied)return denied;
 try{
  const id=z.uuid().parse((await params).id),org=getCurrentUser(request)!.ownedBy!,pageSize=100;
  let current=await riskSegments.page(org,id,{page:1,pageSize}),page=1,header=true,cancelled=false;
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
   async pull(controller){
    if(cancelled||request.signal.aborted){controller.close();return;}
    try{
     if(header){header=false;controller.enqueue(encoder.encode('\uFEFF'+csv(['快照编号','人群名称','数据来源','标签版本','统计开始','统计结束','数据截止','学员内部编号','显示名称','年级','校区编号','课程编号','出勤率','匹配依据'])));return;}
     const s=current.snapshot,p=s.preview;
     const body=p.members.map((m:OperationalTagMember)=>csv([s.id,s.name,p.dataset.name,s.tagVersion,p.scope.startDate,p.scope.endDate,p.scope.dataCutoff??'',m.studentId,m.displayName,m.gradeBand,m.campusIds.join('；'),m.courseIds.join('；'),m.attendanceRate===null?'未知':m.attendanceRate??'未计算',m.reason])).join('');
     if(body)controller.enqueue(encoder.encode(body));
     if(!current.pagination.hasNext){controller.close();return;}
     current=await riskSegments.page(org,id,{page:++page,pageSize});
    }catch(error){controller.error(error);}
   },cancel(){cancelled=true;},
  });
  return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="segment-${id}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return apiError(error);}
}
