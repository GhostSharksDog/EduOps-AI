'use client';
import {entityTypes} from '@/shared/config/entity-types';
export type {EntityTypeOption} from '@/shared/config/entity-types';
export const useEntityTypeEnum=()=>({entityTypeOptions:entityTypes,isLoading:false});
