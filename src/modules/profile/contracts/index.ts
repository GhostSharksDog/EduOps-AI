import {z} from 'zod';
import type {StudentAttendanceVO} from '@/modules/education/contracts';
import {snapshotPageSchema,type RiskSegmentSnapshotVO,type SnapshotPageInfo} from '@/modules/segment/contracts';
import type {EvidenceReference} from '@/shared/contracts/analysis';
import type {OperationalTagMember} from '@/modules/tag/contracts';
export const profileQuerySchema=z.object({snapshotId:z.uuid(),entityId:z.string().min(1).max(255).optional(),pagination:snapshotPageSchema.optional()}).strict();
export interface RiskStudentProfileVO extends OperationalTagMember {snapshotId:string;tagId:string;tagVersion:number;reason:string;datasetName:string;origin:'simulated'|'public';evidence:EvidenceReference[];}
export interface RiskCrowdProfileVO {
    pagination?:SnapshotPageInfo;
    snapshot:RiskSegmentSnapshotVO;attendance:{present:number;due:number;absent:number;leave:number;unknown:number;rate:number|null;observedStudents?:number};
    business?:{asOf:string;knownBalanceStudents:number;remainingHours:number|null;renewalFollowupStudents:number|null;recentComplaintStudents:number|null;unknownBalanceStudents:number};
    distributions:{key:string;title:string;values:{label:string;count:number}[]}[];
    facts:string[];hypotheses:string[];actions:string[];evidence:EvidenceReference[];
}
