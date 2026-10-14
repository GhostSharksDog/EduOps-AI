import {randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
export async function hashPassword(password:string):Promise<string>{
 if(password.length<10)throw new Error('密码至少需要10个字符');
 const salt=randomBytes(16).toString('hex');
 const key=await scrypt(password,salt,64) as Buffer;
 return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password:string,stored:string):Promise<boolean>{
 const [scheme,salt,hex]=stored.split(':');
 if(scheme!=='scrypt'||!salt||!hex||hex.length!==128)return false;
 const expected=Buffer.from(hex,'hex'),actual=await scrypt(password,salt,64) as Buffer;
 return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
