'use client';
import type {CSSProperties,HTMLAttributes,ReactNode} from 'react';
import styles from './Workspace.module.css';

type RegionProps=HTMLAttributes<HTMLElement> & {children?:ReactNode};
/** Only layout and scroll regions live here; queries and selected objects belong to each module. */
export function Workspace({children,className='',fit=false,label,style,...rest}:RegionProps & {fit?:boolean;label?:string}){
 return <section data-spatial-enter="true" {...rest} aria-label={label??rest['aria-label']} className={`${styles.workspace} ${className}`} data-workspace="true" data-fit={fit||undefined} style={style}>{children}</section>;
}
export function WorkspaceToolbar({title,children,actions,className='',...rest}:Omit<RegionProps,'title'> & {title:ReactNode;actions?:ReactNode}){
 return <header {...rest} className={`${styles.toolbar} ${className}`}><div className={styles.title}>{title}</div><div className={styles.controls}>{children}</div>{actions&&<div className={styles.actions}>{actions}</div>}</header>;
}
export function WorkspaceSplit({children,columns='minmax(0,1fr) minmax(0,1fr)',className='',style,...rest}:RegionProps & {columns?:string}){
 return <div {...rest} className={`${styles.split} ${className}`} style={{'--workspace-columns':columns,...style} as CSSProperties}>{children}</div>;
}
export function WorkspacePane({children,title,actions,footer,className='',bodyClassName='',scroll=true,...rest}:Omit<RegionProps,'title'> & {title?:ReactNode;actions?:ReactNode;footer?:ReactNode;bodyClassName?:string;scroll?:boolean}){
 return <section {...rest} className={`${styles.pane} ${className}`}>{(title||actions)&&<header className={styles.paneHeader}><div>{title}</div>{actions&&<div>{actions}</div>}</header>}<div className={`${styles.body} ${bodyClassName}`} data-scroll={scroll||undefined}>{children}</div>{footer&&<footer className={styles.footer}>{footer}</footer>}</section>;
}
