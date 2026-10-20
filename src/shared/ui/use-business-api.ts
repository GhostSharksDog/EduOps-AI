'use client';
import {useCallback} from 'react';
import {useAuthStore} from '@/modules/identity/client';
export function useBusinessApi(){
    const token=useAuthStore(s=>s.token);
    return useCallback(async <T,>(path:string,input?:unknown,method?:string,signal?:AbortSignal):Promise<T>=>{
        const response=await fetch(path,{method:method??(input===undefined?'GET':'POST'),headers:{Authorization:'Bearer '+token,...(input===undefined?{}:{'Content-Type':'application/json'})},...(input===undefined?{}:{body:JSON.stringify(input)}),signal});
        const body=await response.json();if(!response.ok)throw new BusinessApiError(body.message??body.error??'请求失败',response.status,body.errorCode);return body.data as T;
    },[token]);
}
export class BusinessApiError extends Error {constructor(message:string,public status:number,public code?:string){super(message);}}
