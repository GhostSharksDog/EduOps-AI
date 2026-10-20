import {create} from 'zustand';
import type {UserVO} from '../../contracts/schemas/response/auth/userSchema';
import {clientConfig} from '@/shared/config/client';
import {changeClientIdentity,installClientRequestBoundary} from '@/shared/lib/client-session';
const {tokenKey,userKey}=clientConfig.auth;
installClientRequestBoundary();
const identityKey=(user:UserVO|null)=>user?`${user.companyCode??user.ownedBy??'default'}:${user.id}`:'anonymous';
interface AuthState {user:UserVO|null;token:string|null;isAuthenticated:boolean;loading:boolean;isHydrated:boolean;setUser:(user:UserVO|null)=>void;setToken:(token:string|null)=>void;logout:()=>Promise<void>;hydrate:()=>void;resetHydration:()=>void;}
export const useAuthStore=create<AuthState>((set,get)=>({
 user:null,token:null,isAuthenticated:false,loading:false,isHydrated:false,
 setUser:user=>{changeClientIdentity(identityKey(user));if(user)localStorage.setItem(userKey,JSON.stringify(user));else localStorage.removeItem(userKey);set({user,isAuthenticated:!!user&&!!get().token});},
 setToken:token=>{if(get().token!==token)changeClientIdentity(identityKey(get().user),true);if(token)localStorage.setItem(tokenKey,token);else localStorage.removeItem(tokenKey);set({token,isAuthenticated:!!token&&!!get().user});},
 logout:async()=>{changeClientIdentity('anonymous',true);localStorage.removeItem(tokenKey);localStorage.removeItem(userKey);set({user:null,token:null,isAuthenticated:false});},
 hydrate:()=>{try{const token=localStorage.getItem(tokenKey),raw=localStorage.getItem(userKey);const user=raw?JSON.parse(raw):null;changeClientIdentity(identityKey(user));set({token,user,isAuthenticated:!!token&&!!user,isHydrated:true});}catch{changeClientIdentity('anonymous',true);set({user:null,token:null,isAuthenticated:false,isHydrated:true});}},
 resetHydration:()=>set({isHydrated:false}),
}));
if(typeof window!=='undefined')window.addEventListener('storage',event=>{if(event.key===tokenKey||event.key===userKey)useAuthStore.getState().hydrate();});
