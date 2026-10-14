import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {authenticateLocalUser} from '@/modules/identity/server';
import {createLocalJWT} from '@/modules/identity/server';
const schema=z.object({username:z.string().trim().min(1).max(100),password:z.string().min(1).max(256)}).strict();
const attempts=new Map<string,{count:number;resetAt:number}>();
export async function POST(request:NextRequest){
 const parsed=schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:'请输入有效的用户名和密码'},{status:400});
 const key=parsed.data.username.toLowerCase();const now=Date.now();
 if(attempts.size>1000)for(const[k,v]of attempts)if(v.resetAt<now)attempts.delete(k);
 const state=attempts.get(key);if(state&&state.resetAt>now&&state.count>=10)return NextResponse.json({error:'尝试次数过多，请15分钟后重试'},{status:429});
 try{
  const user=await authenticateLocalUser(parsed.data.username,parsed.data.password);
  if(!user){attempts.set(key,{count:state&&state.resetAt>now?state.count+1:1,resetAt:state&&state.resetAt>now?state.resetAt:now+15*60*1000});return NextResponse.json({error:'用户名或密码错误'},{status:401});}
  attempts.delete(key);const token=await createLocalJWT(user);return NextResponse.json({token,user});
 }catch{return NextResponse.json({error:'登录服务不可用，请检查数据库初始化状态'},{status:503});}
}
