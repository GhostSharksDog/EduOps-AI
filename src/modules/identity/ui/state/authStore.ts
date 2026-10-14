import {create} from 'zustand';
import type {UserVO} from '../../contracts/schemas/response/auth/userSchema';
import {clientConfig} from '@/shared/config/client';
const {tokenKey,userKey}=clientConfig.auth;
interface AuthState {user:UserVO|null;token:string|null;isAuthenticated:boolean;loading:boolean;isHydrated:boolean;setUser:(user:UserVO|null)=>void;setToken:(token:string|null)=>void;logout:()=>Promise<void>;hydrate:()=>void;resetHydration:()=>void;}
export const useAuthStore=create<AuthState>((set,get)=>({
 user:null,token:null,isAuthenticated:false,loading:false,isHydrated:false,
 setUser:user=>{if(user)localStorage.setItem(userKey,JSON.stringify(user));else localStorage.removeItem(userKey);set({user,isAuthenticated:!!user&&!!get().token});},
 setToken:token=>{if(token)localStorage.setItem(tokenKey,token);else localStorage.removeItem(tokenKey);set({token,isAuthenticated:!!token&&!!get().user});},
 logout:async()=>{localStorage.removeItem(tokenKey);localStorage.removeItem(userKey);set({user:null,token:null,isAuthenticated:false});},
 hydrate:()=>{try{const token=localStorage.getItem(tokenKey),raw=localStorage.getItem(userKey);const user=raw?JSON.parse(raw):null;set({token,user,isAuthenticated:!!token&&!!user,isHydrated:true});}catch{set({user:null,token:null,isAuthenticated:false,isHydrated:true});}},
 resetHydration:()=>set({isHydrated:false}),
}));
