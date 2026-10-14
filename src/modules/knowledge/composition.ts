import 'server-only';
import {createEmbeddingClient} from '@/platform/ai/client';
import {KnowledgeApplicationService} from './services/service';
import {DatabaseKnowledgeRepository} from './repositories/repository';
export const knowledgeService=new KnowledgeApplicationService(new DatabaseKnowledgeRepository(),createEmbeddingClient());
export const getCapability=(organizationId:string)=>knowledgeService.getCapability(organizationId);

