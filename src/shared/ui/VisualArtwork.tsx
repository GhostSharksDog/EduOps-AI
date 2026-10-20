'use client';

import Image from 'next/image';
import {useState} from 'react';
import styles from './VisualArtwork.module.css';

type ArtworkName='login'|'agent'|'workbench';
export default function VisualArtwork({name,className='',priority=false,sizes='100vw',alt=''}:{name:ArtworkName;className?:string;priority?:boolean;sizes?:string;alt?:string}){
 const [failed,setFailed]=useState(false);
 return <div className={`${styles.artwork} ${className}`} data-artwork={name} data-image-state={failed?'failed':'available'} role={failed&&alt?'img':undefined} aria-label={failed&&alt?alt+'（图片暂未加载）':undefined}>
  {!failed&&<Image src={'/visuals/'+name+'-spatial.png'} alt={alt} fill sizes={sizes} priority={priority} onError={()=>setFailed(true)}/>}
 </div>;
}
