'use client';
import {Suspense} from 'react';
import {RiskProfilesWorkspace} from '@/modules/profile/client';
export default function RiskSegmentsPage(){return <Suspense fallback={<div>加载已保存人群…</div>}><RiskProfilesWorkspace title="已保存人群" listPath="/api/segments/risk-snapshots"/></Suspense>;}
