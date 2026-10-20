import {NextResponse} from 'next/server';
import {listCompanies} from '@/platform/company/registry';
export async function GET(){try{return NextResponse.json(listCompanies(),{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'公司注册表未就绪，请联系管理员'},{status:503});}}
