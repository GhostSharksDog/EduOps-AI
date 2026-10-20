'use client';
import {useParams} from 'next/navigation';
import ReportReader from './ReportReader';
export default function ReportDetail(){const {id}=useParams<{id:string}>();return <ReportReader id={id}/>;}
