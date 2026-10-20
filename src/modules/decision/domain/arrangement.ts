import type {DecisionCreate,DecisionTask} from '../contracts';
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>JSON.stringify(key)+':'+canonical(item)).join(',')+'}';
 return JSON.stringify(value)??'null';
}
export function decisionArrangementMatches(existing:Pick<DecisionTask,'action'|'ownerId'|'priority'|'dueDate'|'reviewMethod'|'segmentSnapshotId'|'recordType'|'goals'>,input:Pick<DecisionCreate,'action'|'ownerId'|'priority'|'dueDate'|'reviewMethod'|'segmentSnapshotId'|'recordType'|'goals'>,ownerId:string){
 const sameGoals=canonical(existing.goals?.targets??[])===canonical(input.goals?.targets??[])&&(!input.goals?.reviewPeriod||canonical(existing.goals?.reviewPeriod)===canonical(input.goals.reviewPeriod));
 return existing.action===input.action.trim()&&existing.ownerId===ownerId&&existing.priority===input.priority&&existing.dueDate===input.dueDate&&existing.reviewMethod===input.reviewMethod.trim()&&(existing.segmentSnapshotId??null)===(input.segmentSnapshotId??null)&&existing.recordType===input.recordType&&sameGoals;
}
