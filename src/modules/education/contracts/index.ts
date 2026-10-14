export type EducationEntityType='student'|'lead'|'guardian';
export type EducationEventType='lead_acquired'|'trial_attended'|'contract_signed'|'lesson_scheduled'|'attendance_recorded'|'hours_consumed'|'renewed'|'referred'|'complaint_recorded'|'refund_recorded'|'withdrawn';
export interface EducationIdentity {organizationId:string;entityId:string;entityType:EducationEntityType;sourceSystem:string;sourceId:string;}
export interface EducationEvent {id:string;organizationId:string;entityId:string;type:EducationEventType;occurredAt:string;campusId:string;courseId?:string;channelId?:string;payload:Record<string,unknown>;}
export * from './data';
export {fields,kindLabels} from '../domain/fields';
export type {AttendanceCounts,AttendanceFactsVO,StudentAttendanceVO} from './attendance';
// 无数据库及Node依赖的公共口径；服务端和离线核验使用同一个计算器。
export {buildAttendanceFacts,completeKinds} from '../domain/attendance';
export {buildStudentBusinessFacts,businessFactKinds} from '../domain/business-facts';
export type {StudentBusinessContext} from '../domain/business-facts';
export {buildChannelAttribution,channelAttributionVersion,unknownChannelId,channelName,channelCatalog,channelContextKey,effectiveChannelId,selectedChannelContext,validOperationalContract} from '../domain/channels';
export type {ChannelAttribution,ChannelAttributionIndex} from '../domain/channels';
