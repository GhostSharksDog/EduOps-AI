import type {DatasetDTO, RecordKind} from '../contracts';

export interface SimulationOptions {seed: number; students: number;}
export function generateSimulation(options: SimulationOptions = {seed:20261009, students:1000}) {
    let state = options.seed >>> 0;
    const random = () => {state = (Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const data: Partial<Record<RecordKind, Record<string, unknown>[]>> = {};
    const add = (kind: RecordKind, payload: Record<string, unknown>) => (data[kind] ??= []).push(payload);
    const names = ['少儿编程','美术','书法','机器人','英语口语','音乐'];
    const sid = (i:number) => 'sim:student:' + String(i).padStart(4,'0');
    const cid = (i:number) => 'sim:class:' + String(i).padStart(3,'0');
    const classCount = Math.min(50, options.students);
    for (let i=1;i<=3;i++) add('campus',{id:'sim:campus:'+i,name:['东城校区','西城校区','中心校区'][i-1]});
    names.forEach((name,i)=>add('course',{id:'sim:course:'+(i+1),name}));
    for(let i=1;i<=classCount;i++) add('class',{id:cid(i),name:names[(i-1)%6]+'班'+i,campusId:'sim:campus:'+((i-1)%3+1),courseId:'sim:course:'+((i-1)%6+1),capacity:Math.ceil(options.students/classCount)+5,startDate:'2026-04-01',endDate:'2026-09-30'});
    const consumed = new Map<string,number>();
    for(let i=1;i<=options.students;i++) {
        const c=(i-1)%classCount+1, campusId='sim:campus:'+((c-1)%3+1), courseId='sim:course:'+((c-1)%6+1);
        add('student',{id:sid(i),displayName:'模拟学员'+String(i).padStart(4,'0'),gradeBand:'G'+(i%6+1)});
        add('enrollment',{id:'sim:enrollment:'+i,studentId:sid(i),classId:cid(c),startDate:i%10===0?'2026-04-08':'2026-04-01',endDate:i%23===0?'2026-06-01':null});
        add('contract',{id:'sim:contract:'+i,studentId:sid(i),campusId,courseId,purchasedHours:120,signedAt:'2026-03-28T08:00:00Z',endDate:'2026-09-30'});
        if(i%5===0) add('contract',{id:'sim:renewed-contract:'+i,studentId:sid(i),campusId,courseId,purchasedHours:24,signedAt:'2026-09-15T08:00:00Z',endDate:'2026-12-31'});
        add('lead',{id:'sim:lead:'+i,campusId,courseId,channelId:['referral','online','walk_in'][i%3],acquiredAt:'2026-03-20T08:00:00Z',status:'converted'});
        add('trial',{id:'sim:trial:'+i,leadId:'sim:lead:'+i,campusId,courseId,occurredAt:'2026-03-25T08:00:00Z',status:'attended'});
        if(i%5===0) add('renewal',{id:'sim:renewal:'+i,studentId:sid(i),contractId:'sim:contract:'+i,newContractId:'sim:renewed-contract:'+i,occurredAt:'2026-09-15T08:00:00Z',amount:2400});
        if(i%11===0) add('referral',{id:'sim:referral:'+i,studentId:sid(i),leadId:'sim:lead:'+Math.max(1,i-1),occurredAt:'2026-04-20T08:00:00Z'});
        if(i%31===0) add('complaint',{id:'sim:complaint:'+i,studentId:sid(i),campusId,courseId,occurredAt:'2026-08-12T08:00:00Z',category:'排课安排',status:i%2?'resolved':'open'});
    }
    for(let i=options.students+1;i<=Math.ceil(options.students*1.3);i++) {
        const campusId='sim:campus:'+(i%3+1),courseId='sim:course:'+(i%6+1);
        add('lead',{id:'sim:lead:'+i,campusId,courseId,channelId:'online',acquiredAt:'2026-05-01T08:00:00Z',status:i%2?'new':'lost'});
        if(i%2===0) add('trial',{id:'sim:trial:'+i,leadId:'sim:lead:'+i,campusId,courseId,occurredAt:'2026-05-07T08:00:00Z',status:'no_show'});
    }
    let lessonNumber=0;
    for(let day=new Date('2026-04-01T09:00:00Z');day<=new Date('2026-09-30T09:00:00Z');day=new Date(day.getTime()+86400000)) {
        if(![1,4].includes(day.getUTCDay())) continue;
        const date=day.toISOString().slice(0,10);
        for(let c=1;c<=classCount;c++) {
            const lessonId='sim:lesson:'+ (++lessonNumber),cancelled=date==='2026-05-04'&&c%7===0;
            add('lesson',{id:lessonId,classId:cid(c),startsAt:day.toISOString(),hours:2,status:cancelled?'cancelled':'completed'});
            if(cancelled) continue;
            for(let i=c;i<=options.students;i+=classCount) {
                if(i%23===0&&date>='2026-06-01'||i%10===0&&date<'2026-04-08') continue;
                const probability=c===1&&date>='2026-08-01'&&date<='2026-08-31'?0.5:0.92;
                const present=random()<probability;
                const status=present?'present':random()<0.3?'leave':'absent';
                const aid=lessonId+':'+sid(i);
                // 未知签到只放在独立的早期异常场景，不伪装为缺勤。
                if(!(c===2&&date==='2026-04-06'&&i===2)) add('attendance',{id:aid,lessonId,studentId:sid(i),status,recordedAt:day.toISOString()});
                if(present) {
                    add('hours',{id:'sim:hours:'+aid,studentId:sid(i),contractId:'sim:contract:'+i,lessonId,hours:2,occurredAt:day.toISOString(),status:'consumed'});
                    consumed.set(sid(i),(consumed.get(sid(i))??0)+2);
                }
            }
        }
    }
    for(let i=23;i<=options.students;i+=23) add('refund',{id:'sim:refund:'+i,studentId:sid(i),contractId:'sim:contract:'+i,occurredAt:'2026-06-01T08:00:00Z',amount:(120-(consumed.get(sid(i))??0))*100,refundedHours:120-(consumed.get(sid(i))??0),status:'completed'});
    const dataset:DatasetDTO={key:'training-sim-'+options.seed,name:'教培运营模拟数据 '+options.seed,origin:'simulated',license:'本项目自行生成，仅用于演示与测试',schemaVersion:'1',dataCutoff:'2026-09-30T15:59:59.000Z',description:options.students+'名学员、3校区、6类课程、2026年4—9月；所有经营记录为模拟数据。'};
    const scenarios=[{id:'attendance-drop',classId:cid(1),startDate:'2026-08-01',endDate:'2026-08-31',description:'人为设置出勤概率由0.92降至0.50，用于检验异常拆解，不代表实际机构经营效果'}, {id:'missing-attendance',classId:cid(2),date:'2026-04-06',studentId:sid(2),description:'缺失签到必须表示未知'}, {id:'cancelled-lessons',date:'2026-05-04',description:'取消课次不计入应出勤或课耗'}, {id:'withdrawal-refund',date:'2026-06-01',description:'退班后停止生成签到并退还未消耗课时'}];
    dataset.expectedRows=Object.fromEntries(Object.entries(data).map(([kind,rows])=>[kind,rows?.length??0]));
    return {dataset,data,scenarios,seed:options.seed};
}
