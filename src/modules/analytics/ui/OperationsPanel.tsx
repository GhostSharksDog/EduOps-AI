'use client';
import {DashboardCanvas} from '@/modules/overview/client';
export default function OperationsPanel({compact=false}:{compact?:boolean}){return <DashboardCanvas detailed={!compact}/>;}
