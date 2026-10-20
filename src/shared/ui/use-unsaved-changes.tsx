'use client';
import {useCallback,useEffect,useRef} from 'react';
import {App,Button,Flex} from 'antd';
import {useAuthStore} from '@/modules/identity/client';

const buffers=new Map<string,unknown>();
const navigationGuards=new Map<symbol,{dirty:()=>boolean;protect:(action:()=>void)=>void}>();
export function protectNavigation(action:()=>void){const guard=[...navigationGuards.values()].find(g=>g.dirty());if(guard)guard.protect(()=>protectNavigation(action));else action();}
let bufferUser:string|undefined;
function bufferKey(key:string){const identity=useAuthStore.getState().user,user=identity?`${identity.companyCode??identity.ownedBy??'default'}:${identity.id}`:undefined;if(bufferUser!==user){buffers.clear();bufferUser=user;}return `${user??'anonymous'}:${key}`;}
export function readEditBuffer<T>(key:string):T|undefined{return buffers.get(bufferKey(key)) as T|undefined;}
export function writeEditBuffer<T>(key:string,value:T){buffers.set(bufferKey(key),value);}
export function clearEditBuffer(key:string){buffers.delete(bufferKey(key));}

/** 只保留内存中的输入；保存失败时保留编辑和目标操作。 */
export function useUnsavedChanges(dirty:boolean,save:(()=>Promise<boolean>)|undefined,label='当前修改',discard?:()=>void){
 const {modal}=App.useApp(),current=useRef({dirty,save,label,discard}),opened=useRef(false);current.current={dirty,save,label,discard};
 const protect=useCallback((action:()=>void)=>{
  if(!current.current.dirty){action();return;}
  if(opened.current)return;opened.current=true;
  const close=()=>{opened.current=false;dialog.destroy();};
  const dialog=modal.confirm({title:'有未保存的内容',content:`${current.current.label}尚未保存，请选择如何继续。`,closable:false,footer:()=> <Flex gap={8} justify="end" wrap><Button onClick={close}>继续编辑</Button><Button danger onClick={()=>{current.current.discard?.();current.current.dirty=false;close();action();}}>放弃并继续</Button>{current.current.save&&<Button type="primary" onClick={async()=>{if(await current.current.save?.()){current.current.dirty=false;close();action();}}}>保存并继续</Button>}</Flex>});
 },[modal]);
 useEffect(()=>{
  const guardKey=Symbol('editor');navigationGuards.set(guardKey,{dirty:()=>current.current.dirty,protect});
  const leave=(event:BeforeUnloadEvent)=>{if(current.current.dirty){event.preventDefault();event.returnValue='';}};
  const click=(event:MouseEvent)=>{
   if(!current.current.dirty||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   const a=(event.target as Element)?.closest?.('a[href]') as HTMLAnchorElement|null;
   if(!a||a.target==='_blank'||a.hasAttribute('download'))return;
   const target=new URL(a.href,window.location.href);
   if(target.href===window.location.href||(target.pathname===window.location.pathname&&target.search===window.location.search))return;
   event.preventDefault();event.stopPropagation();protectNavigation(()=>window.location.assign(target.href));
  };
  window.addEventListener('beforeunload',leave);document.addEventListener('click',click,true);
  const navigation=(window as unknown as {navigation?:EventTarget}).navigation;
  const traverse=(raw:Event)=>{const event=raw as Event&{navigationType:string;destination:{url:string}};if(event.navigationType==='traverse'&&event.cancelable&&current.current.dirty){event.preventDefault();const destination=event.destination.url;protectNavigation(()=>window.location.assign(destination));}};
  navigation?.addEventListener('navigate',traverse);
  return()=>{navigationGuards.delete(guardKey);window.removeEventListener('beforeunload',leave);document.removeEventListener('click',click,true);navigation?.removeEventListener('navigate',traverse);};
 },[protect]);
 return protect;
}
