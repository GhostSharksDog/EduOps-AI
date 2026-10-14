import {generateSimulation, type SimulationOptions} from './simulation';

const day = (s:string,n:number) => new Date(Date.parse(s+'T08:00:00Z')+n*86400000).toISOString().slice(0,10);
const at = (s:string) => s+'T08:00:00Z';
/** 第二版单独生成；不会修改第一版CSV或数据库中的历史事实。 */
export function generateSimulationV2(options:SimulationOptions={seed:20261009,students:1000}) {
    const base=generateSimulation(options), data=base.data;
    let state=(options.seed^20261010)>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const students=data.student!, classes=data.class!, lessons=data.lesson!;
    const classMap=new Map(classes.map(c=>[String(c.id),c]));
    for(const kind of ['enrollment','contract','lead','trial','renewal','referral','complaint','refund','attendance','hours'] as const)data[kind]=[];
    const add=(kind:keyof typeof data,row:Record<string,unknown>)=>(data[kind]??=[]).push(row);
    const enrollments=new Map<string,Record<string,unknown>[]>(), contracts=new Map<string,Record<string,unknown>>();
    for(let i=1;i<=options.students;i++) {
        const student=students[i-1], studentId=String(student.id), cls=classes[(i-1)%classes.length];
        const located={campusId:cls.campusId,courseId:cls.courseId};
        const later=i>Math.floor(options.students*0.6);
        const acquired=later?'2026-'+String(4+i%5).padStart(2,'0')+'-20':'2026-03-20';
        const signed=day(acquired,i%17===0?36:8); // 包含跨月及超观察窗口签约。
        const signedMonth=Number(signed.slice(5,7));
        const expiryMonth=Math.min(9,Math.max(5,signedMonth+2+i%2));
        const expiry=new Date(Date.UTC(2026,expiryMonth,0)).toISOString().slice(0,10);
        const eligible=i%29!==0&&i%23!==0, renew=eligible&&expiryMonth<=8&&i%2===0;
        const oldId='sim:contract:'+i, leadId='sim:lead:'+i;
        const old={id:oldId,studentId,...located,purchasedHours:120,signedAt:at(signed),endDate:expiry,leadId,renewalEligible:eligible?'yes':'no'};
        add('contract',old);contracts.set(oldId,old);
        add('lead',{id:leadId,...located,channelId:['referral','online','walk_in'][i%3],acquiredAt:at(acquired),status:'converted'});
        add('trial',{id:'sim:trial:'+i,leadId,...located,occurredAt:at(day(acquired,5)),status:'attended'});
        const start=signed<'2026-04-01'?'2026-04-01':day(signed,1);
        let end:string|null=null, reason:string|null=null;
        if(i%23===0){end=day(start,35);reason='withdrawn';}
        else if(!renew){end=day(expiry,1);reason=eligible?'withdrawn':'completed';}
        if(end&&end>'2026-09-30'){end=null;reason=null;}
        const membership={id:'sim:enrollment:'+i,studentId,classId:cls.id,startDate:start,endDate:end,endReason:reason};
        add('enrollment',membership);enrollments.set(studentId,[membership]);
        if(renew){
            const renewalDay=day(expiry,i%4===0?7:-7), nextId='sim:renewed-contract:'+i;
            const next={id:nextId,studentId,...located,purchasedHours:120,signedAt:at(renewalDay),endDate:'2026-12-31',leadId:null,renewalEligible:'yes'};
            add('contract',next);contracts.set(nextId,next);
            add('renewal',{id:'sim:renewal:'+i,studentId,contractId:oldId,newContractId:nextId,occurredAt:at(renewalDay),amount:12000});
            // 迟续费形成真实在班间隔，不把购买行为自动当作出勤。
            if(renewalDay>expiry){membership.endDate=day(expiry,1);membership.endReason='completed';const resumed={id:'sim:resumed-enrollment:'+i,studentId,classId:cls.id,startDate:day(renewalDay,1),endDate:null,endReason:null};add('enrollment',resumed);enrollments.get(studentId)!.push(resumed);}
        }
        if(i%11===0)add('referral',{id:'sim:referral:'+i,studentId,leadId:'sim:lead:'+Math.max(1,i-1),occurredAt:at(signed)});
    }
    for(let i=options.students+1;i<=Math.ceil(options.students*1.3);i++){
        const acquired='2026-'+String(4+i%6).padStart(2,'0')+'-20', campusId='sim:campus:'+(i%3+1),courseId='sim:course:'+(i%6+1);
        add('lead',{id:'sim:lead:'+i,campusId,courseId,channelId:'online',acquiredAt:at(acquired),status:i%2?'new':'lost'});
        add('trial',{id:'sim:trial:'+i,leadId:'sim:lead:'+i,campusId,courseId,occurredAt:at(day(acquired,5)),status:i%2?'attended':'no_show'});
    }
    const consumed=new Map<string,number>();
    for(const lesson of lessons){
        if(lesson.status==='cancelled')continue;
        const date=String(lesson.startsAt).slice(0,10),cls=classMap.get(String(lesson.classId))!;
        for(let i=Number(String(cls.id).split(':').at(-1));i<=options.students;i+=classes.length){
            const studentId=String(students[i-1].id);
            if(!enrollments.get(studentId)!.some(e=>String(e.startDate)<=date&&(!e.endDate||String(e.endDate)>date)))continue;
            const old=contracts.get('sim:contract:'+i)!, next=contracts.get('sim:renewed-contract:'+i);
            const contract=String(old.endDate)<date?next:old;
            if(!contract||String(contract.signedAt).slice(0,10)>date)continue;
            const probability=cls.courseId==='sim:course:1'&&date.startsWith('2026-08')?0.42:0.92;
            const status=random()<probability?'present':random()<0.3?'leave':'absent', id=String(lesson.id)+':'+studentId;
            if(!(lesson.classId==='sim:class:002'&&date==='2026-04-06'&&i===2))add('attendance',{id,lessonId:lesson.id,studentId,status,recordedAt:lesson.startsAt});
            if(status==='present'){add('hours',{id:'sim:hours:'+id,studentId,contractId:contract.id,lessonId:lesson.id,hours:2,occurredAt:lesson.startsAt,status:'consumed'});consumed.set(String(contract.id),(consumed.get(String(contract.id))??0)+2);}
        }
    }
    for(let i=1;i<=options.students;i++){
        const studentId=String(students[i-1].id),contractId='sim:contract:'+i,old=contracts.get(contractId)!,membership=enrollments.get(studentId)![0];
        if(i%23===0&&membership.endDate){const remaining=120-(consumed.get(contractId)??0);add('refund',{id:'sim:refund:'+i,studentId,contractId,occurredAt:at(String(membership.endDate)),amount:remaining*100,refundedHours:remaining,status:'completed'});}
        else if(i%37===0)add('refund',{id:'sim:partial-refund:'+i,studentId,contractId,occurredAt:at(day(String(old.signedAt).slice(0,10),5)),amount:200,refundedHours:2,status:'completed'});
        if(i%41===0)add('refund',{id:'sim:revoked-refund:'+i,studentId,contractId,occurredAt:at(day(String(old.signedAt).slice(0,10),6)),amount:300,refundedHours:3,status:'revoked'});
        if(i%13===0){const month=Math.max(Number(String(old.signedAt).slice(5,7)),4+i%6);add('complaint',{id:'sim:complaint:'+i,studentId,campusId:old.campusId,courseId:old.courseId,occurredAt:at('2026-'+String(month).padStart(2,'0')+'-25'),category:['排课安排','课程服务','退费沟通'][i%3],status:i%2?'resolved':'open'});}
    }
    const dataset={...base.dataset,key:base.dataset.key+'-v2',name:'教培运营模拟数据 '+options.seed+' 第二版',schemaVersion:'2' as const,dataCutoff:'2026-09-30T15:59:59.999Z',description:options.students+'名模拟学员；补齐线索签约、续费资格、在班结束原因和跨月场景。与第一版分开统计。'};
    dataset.expectedRows=Object.fromEntries(Object.entries(data).map(([kind,rows])=>[kind,rows?.length??0]));
    return {dataset,data,seed:options.seed,scenarios:[...base.scenarios,{id:'cohort-windows',description:'跨月签约、到期前后续费及未成熟观察窗口'},{id:'completed-withdrawn',description:'正常结课、主动退班和迟续费在班间隔'},{id:'refund-states',description:'部分退款及撤销退款'},{id:'monthly-complaints',description:'多月份多类别客诉'}]};
}
