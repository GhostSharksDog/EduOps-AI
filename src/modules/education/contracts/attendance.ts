import type {AuthorizedScope} from '@/shared/contracts/analysis';
export interface AttendanceCounts {present:number;due:number;absent:number;leave:number;unknown:number;}
export interface StudentAttendanceVO extends AttendanceCounts {
    studentId:string;displayName:string;gradeBand:string;attendanceRate:number|null;
    campusIds:string[];courseIds:string[];
}
export interface AttendanceFactsVO {
    scope:AuthorizedScope;total:AttendanceCounts;students:StudentAttendanceVO[];
    studentGroups?:(StudentAttendanceVO&{campusId:string;courseId:string})[];
    periods:{period:string;counts:AttendanceCounts}[];
    groups:(AttendanceCounts&{campusId:string;courseId:string;name:string})[];
}
