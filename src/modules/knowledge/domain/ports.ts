import type {AuthorizedAnalysisScope} from '@/shared/contracts/analysis';
import type {CreateKnowledgeSourceDTO,KnowledgeSource,KnowledgeSearchHitVO} from '../contracts';
export interface KnowledgeEmbeddingPort {
 configuration():{configured:boolean;model:string;fingerprint:string};
 embed(input:string[],options?:{signal?:AbortSignal}):Promise<number[][]>;
}
export interface KnowledgeStoredSource extends KnowledgeSource {embeddingConfigFingerprint:string|null;indexAttemptId:string|null;}
export interface KnowledgeIndexClaim {source:KnowledgeStoredSource;attemptId:string;}
export interface KnowledgeRepository {
 list(organizationId:string):Promise<KnowledgeStoredSource[]>;
 get(id:string,organizationId:string):Promise<KnowledgeStoredSource|null>;
 create(input:CreateKnowledgeSourceDTO,organizationId:string,actorId:string,contentHash:string):Promise<KnowledgeStoredSource>;
 revise(id:string,organizationId:string,input:{title:string;content:string;expectedContentHash:string;contentHash:string}):Promise<KnowledgeStoredSource>;
 claimIndex(id:string,organizationId:string,actorId:string,expectedVersion:number,expectedContentHash:string,config:{model:string;fingerprint:string}):Promise<KnowledgeIndexClaim>;
 completeIndex(claim:KnowledgeIndexClaim,chunks:string[],vectors:number[][],config:{model:string;fingerprint:string}):Promise<KnowledgeStoredSource>;
 failIndex(claim:KnowledgeIndexClaim,message:string):Promise<void>;
 search(vector:number[],scope:AuthorizedAnalysisScope,config:{model:string;fingerprint:string},options:{limit:number;minSimilarity:number;includeSnapshots:boolean}):Promise<KnowledgeSearchHitVO[]>;
}
