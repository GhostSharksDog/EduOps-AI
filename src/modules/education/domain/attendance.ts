import type {EducationSnapshot,StoredEducationRow} from '../contracts/data';
import type {AttendanceCounts,AttendanceFactsVO,StudentAttendanceVO} from '../contracts/attendance';
import type {AuthorizedScope} from '@/shared/contracts/analysis';
import {buildChannelAttribution} from './channels';
export const educationDay=(value:unknown)=>new Date(Date.parse(String(value))+8*3600000).toISOString().slice(0,10);
export const enrollmentActive=(r:StoredEducationRow,day:string)=>String(r.payload.startDate)<=day&&(!r.payload.endDate||String(r.payload.endDate)>day);
export const attendancePercent=(n:number,d:number)=>d>0?Math.round(n/d*10000)/100:null;
export function effectiveEducationScope(snapshot:EducationSnapshot,requested:AuthorizedScope):AuthorizedScope {
    const cutoff=new Date(Math.min(Date.parse(snapshot.dataset.dataCutoff),requested.dataCutoff?Date.parse(requested.dataCutoff):Infinity,Date.parse(requested.endDate+'T23:59:59.999+08:00'))).toISOString();
    return {...requested,dataCutoff:cutoff};
}
export function completeKinds(snapshot:EducationSnapshot,kinds:readonly string[]):boolean {
    const completed=snapshot.batches.filter(b=>b.status==='completed');
    return kinds.every(kind=>completed.some(b=>b.kind===kind)&&(snapshot.dataset.expectedRows?.[kind]===undefined||completed.filter(b=>b.kind===kind).reduce((n,b)=>n+b.acceptedRows,0)===snapshot.dataset.expectedRows[kind]));
}
/** 看板、规则预览和画像共用逐课应出勤口径；不从点击或课耗推断签到。 */
export function buildAttendanceFacts(snapshot:EducationSnapshot,requested:AuthorizedScope):AttendanceFactsVO {
    const scope=effectiveEducationScope(snapshot,requested),cutoff=Date.parse(scope.dataCutoff!);
    const channels=buildChannelAttribution(snapshot,scope.dataCutoff!);
    const byKind=(kind:string)=>snapshot.records.filter(r=>r.kind===kind);
    const selected=(r:StoredEducationRow)=>(!scope.campusIds.length||scope.campusIds.includes(r.campusId))&&(!scope.authorizedCampusIds.length||scope.authorizedCampusIds.includes(r.campusId))&&(!scope.courseIds.length||scope.courseIds.includes(r.courseId));
    const classes=new Map(byKind('class').filter(selected).map(r=>[r.sourceId,r]));
    const enrollments=new Map<string,StoredEducationRow[]>();
    for(const r of byKind('enrollment')){const id=String(r.payload.classId);if(classes.has(id))enrollments.set(id,[...(enrollments.get(id)??[]),r]);}
    const signs=new Map<string,Set<string>>();
    for(const r of byKind('attendance')){if(Date.parse(String(r.payload.recordedAt))>cutoff)continue;const key=JSON.stringify([r.payload.lessonId,r.payload.studentId]),v=signs.get(key)??new Set<string>();v.add(String(r.payload.status));signs.set(key,v);}
    const courseNames=new Map(byKind('course').map(r=>[r.sourceId,String(r.payload.name)])),campusNames=new Map(byKind('campus').map(r=>[r.sourceId,String(r.payload.name)])),people=new Map(byKind('student').map(r=>[r.sourceId,r.payload]));
    const empty=():AttendanceCounts=>({present:0,due:0,absent:0,leave:0,unknown:0});
    const total=empty(),periods=new Map<string,AttendanceCounts>(),groups=new Map<string,AttendanceCounts&{campusId:string;courseId:string;name:string}>(),students=new Map<string,StudentAttendanceVO>(),studentGroups=new Map<string,StudentAttendanceVO&{campusId:string;courseId:string}>();
    for(const lesson of byKind('lesson')){
        const cls=classes.get(String(lesson.payload.classId));if(!cls||lesson.payload.status!=='completed'||Date.parse(String(lesson.payload.startsAt))>cutoff)continue;
        const day=educationDay(lesson.payload.startsAt);if(day<scope.startDate||day>scope.endDate)continue;
        const period=day.slice(0,7),month=periods.get(period)??empty();periods.set(period,month);
        const key=JSON.stringify([cls.campusId,cls.courseId]),group=groups.get(key)??{...empty(),campusId:cls.campusId,courseId:cls.courseId,name:(campusNames.get(cls.campusId)??cls.campusId)+' / '+(courseNames.get(cls.courseId)??cls.courseId)};groups.set(key,group);
        const due=new Set((enrollments.get(cls.sourceId)??[]).filter(r=>enrollmentActive(r,day)&&channels.matches(String(r.payload.studentId),cls.campusId,cls.courseId,scope.channelIds)).map(r=>String(r.payload.studentId)));
        for(const id of due){
            const v=signs.get(JSON.stringify([lesson.sourceId,id])),raw=v?.size===1?[...v][0]:'unknown',status=['present','absent','leave'].includes(raw)?raw:'unknown';
            const student=students.get(id)??{...empty(),studentId:id,displayName:String(people.get(id)?.displayName??id),gradeBand:String(people.get(id)?.gradeBand??'未填写'),attendanceRate:null,campusIds:[],courseIds:[]};students.set(id,student);
            if(!student.campusIds.includes(cls.campusId))student.campusIds.push(cls.campusId);if(!student.courseIds.includes(cls.courseId))student.courseIds.push(cls.courseId);
            const studentKey=JSON.stringify([id,cls.campusId,cls.courseId]),contextStudent=studentGroups.get(studentKey)??{...empty(),studentId:id,displayName:student.displayName,gradeBand:student.gradeBand,attendanceRate:null,campusId:cls.campusId,courseId:cls.courseId,campusIds:[cls.campusId],courseIds:[cls.courseId]};studentGroups.set(studentKey,contextStudent);
            for(const counts of [total,month,group,student,contextStudent]){counts.due++;counts[status as 'present'|'absent'|'leave'|'unknown']++;}
        }
    }
    for(const s of students.values()){s.attendanceRate=s.unknown?null:attendancePercent(s.present,s.due);s.campusIds.sort();s.courseIds.sort();}
    for(const s of studentGroups.values())s.attendanceRate=s.unknown?null:attendancePercent(s.present,s.due);
    return {scope,total,students:[...students.values()].sort((a,b)=>a.studentId.localeCompare(b.studentId)),studentGroups:[...studentGroups.values()],periods:[...periods].sort(([a],[b])=>a.localeCompare(b)).map(([period,counts])=>({period,counts})),groups:[...groups.values()]};
}
