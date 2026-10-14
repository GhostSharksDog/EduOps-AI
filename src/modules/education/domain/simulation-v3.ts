import {generateSimulationV2} from './simulation-v2';
import type {SimulationOptions} from './simulation';

/** 独立评审场景；复用业务字段，不修改以前的数据集或快照。 */
export function generateSimulationV3(options:SimulationOptions={seed:20261009,students:1000}) {
    const base=generateSimulationV2(options), data=base.data;
    const active=(id:unknown)=>data.enrollment!.some(e=>e.studentId===id&&String(e.startDate)<='2026-08-31'&&(!e.endDate||String(e.endDate)>'2026-08-31'));
    const examples=data.contract!.filter(c=>String(c.id).startsWith('sim:contract:')&&c.courseId==='sim:course:1'&&c.endDate==='2026-09-30'&&c.renewalEligible==='yes'&&active(c.studentId)&&!data.renewal!.some(r=>r.contractId===c.id)&&!data.refund!.some(r=>r.contractId===c.id)).slice(0,24);
    for(const [index,contract] of examples.entries()) {
        const nextId='review:renewed:'+contract.id;
        const oldHours=data.hours!.filter(h=>h.contractId===contract.id&&String(h.occurredAt)<'2026-09-05');
        const consumed=oldHours.reduce((n,h)=>n+Number(h.hours)*(h.status==='reversed'?-1:1),0);
        contract.purchasedHours=consumed+6;contract.endDate='2026-09-07';
        data.contract!.push({id:nextId,studentId:contract.studentId,campusId:contract.campusId,courseId:contract.courseId,purchasedHours:36,signedAt:'2026-09-05T08:00:00Z',endDate:'2026-12-31',leadId:null,renewalEligible:'yes'});
        data.renewal!.push({id:'review:renewal:'+index,studentId:contract.studentId,contractId:contract.id,newContractId:nextId,occurredAt:'2026-09-05T08:00:00Z',amount:3600});
        for(const h of data.hours!)if(h.contractId===contract.id&&String(h.occurredAt)>='2026-09-05')h.contractId=nextId;
        data.complaint!.push({id:'review:complaint:'+index,studentId:contract.studentId,campusId:contract.campusId,courseId:contract.courseId,occurredAt:'2026-08-25T08:00:00Z',category:index%2?'排课安排':'课程服务',status:index%2?'resolved':'open'});
    }
    // 另一个课程即将到期，不能被解释成同一课程的组合风险。
    const contrasting=data.contract!.filter(c=>String(c.id).startsWith('sim:contract:')&&c.courseId==='sim:course:1'&&active(c.studentId)&&!examples.includes(c)&&!data.renewal!.some(r=>r.contractId===c.id)).slice(0,6);
    const another=data.class!.find(c=>c.courseId==='sim:course:2')!;
    for(const [index,c] of contrasting.entries()) {
        c.endDate='2026-12-31';c.renewalEligible='no';
        data.contract!.push({id:'review:cross-contract:'+index,studentId:c.studentId,campusId:another.campusId,courseId:another.courseId,purchasedHours:24,signedAt:'2026-08-29T08:00:00Z',endDate:'2026-09-15',leadId:null,renewalEligible:'yes'});
        data.enrollment!.push({id:'review:cross-enrollment:'+index,studentId:c.studentId,classId:another.id,startDate:'2026-09-01',endDate:null,endReason:null});
    }
    // 撤销课耗仍引用有效的学员、合约和课次，净课耗须冲减。
    const reverse=data.hours!.find(h=>!examples.some(c=>c.id===h.contractId)&&String(h.occurredAt).startsWith('2026-07'));
    if(reverse)data.hours!.push({...reverse,id:'review:reversed-hours',status:'reversed',occurredAt:'2026-07-31T08:00:00Z'});
    const dataset={...base.dataset,key:'training-sim-'+options.seed+'-v3',name:'教培运营评审场景 '+options.seed+' 第三版',schemaVersion:'3' as const,description:options.students+'名模拟学员、3校区、6课程；小课包、续费跟进、近期客诉及同课程组合规则场景。所有记录仅用于演示与测试，与旧版独立统计。'};
    dataset.expectedRows=Object.fromEntries(Object.entries(data).map(([kind,rows])=>[kind,rows?.length??0]));
    return {dataset,data,seed:options.seed,scenarios:[...base.scenarios,{id:'review-attendance',startDate:'2026-08-01',endDate:'2026-08-31',courseId:'sim:course:1',description:'课程出勤下降，创建并确认风险标签，查看冻结人群画像'},{id:'review-combination',startDate:'2026-08-01',endDate:'2026-08-31',courseId:'sim:course:1',description:'同校区同课程出勤偏低且未来30天到期；模型和界面不能使用截止日后的续费记录'},{id:'small-pack-followup',description:'合理课包余额与近期客诉，覆盖人数由业务程序实际计算'},{id:'cross-course-control',description:'其他课程即将到期不能混入同课程组合；新在班记录保留其实际开始日期'}]};
}
