import {learningScopeSchema} from '@/shared/contracts/analysis';
import type {LearningScope} from '@/shared/contracts/analysis';
export interface LearningSelection {datasetId:string;learningScope:LearningScope;}
export function learningSelectionFromSearch(search:string):LearningSelection|null{
 const p=new URLSearchParams(search),datasetId=p.get('datasetId'),raw=p.get('learningScope');
 if(!datasetId||!raw||!/^[-a-f0-9]{36}$/i.test(datasetId))return null;
 try{const parsed=learningScopeSchema.safeParse(JSON.parse(raw));return parsed.success?{datasetId,learningScope:parsed.data}:null;}catch{return null;}
}
export function learningHref(path:string,selection:LearningSelection,extra:Record<string,string>={}){
 return path+'?'+new URLSearchParams({datasetId:selection.datasetId,learningScope:JSON.stringify(selection.learningScope),...extra});
}
