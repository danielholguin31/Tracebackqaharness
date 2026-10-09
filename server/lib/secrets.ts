import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
let master: Buffer;
function encryptionKey() {
 if(master)return master;
 if(process.env.SECRET_ENCRYPTION_KEY){master=createHash('sha256').update(process.env.SECRET_ENCRYPTION_KEY).digest();return master;}
 if(process.env.NODE_ENV==='production')throw new Error('SECRET_ENCRYPTION_KEY is required for stored credentials in production');
 const file=path.resolve('data/encryption.key');fs.mkdirSync(path.dirname(file),{recursive:true});
 if(!fs.existsSync(file))fs.writeFileSync(file,randomBytes(32),{mode:0o600});
 master=fs.readFileSync(file);return master;
}
export function encrypt(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return `v2:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;}
export function decrypt(value:string){if(!value.startsWith('v2:'))throw new Error('Legacy credentials must be re-saved before use');const [,iv,tag,data]=value.split(':');const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'hex'));decipher.setAuthTag(Buffer.from(tag,'hex'));return Buffer.concat([decipher.update(Buffer.from(data,'hex')),decipher.final()]).toString('utf8');}
