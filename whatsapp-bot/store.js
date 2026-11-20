import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export function createStore(directory){
 const dir=path.resolve(directory),file=path.join(dir,'orders.json');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 let data={orders:[]};
 if(fs.existsSync(file)){
  const read=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(read.orders))throw Error('Invalid order database');
  data=read;
 }
 const save=()=>{
  const tmp=file+'.'+process.pid+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});
  fs.renameSync(tmp,file);
 };
 const all=()=>data.orders.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const get=id=>data.orders.find(o=>o.id===String(id).toUpperCase());
 const forChat=jid=>all().find(o=>o.jid===jid&&['choose_duration','awaiting_proof','pending_review'].includes(o.status));
 const create=info=>{
  let id;do{id=randomBytes(4).toString('hex').toUpperCase();}while(get(id));
  const now=new Date().toISOString();
  const order={...info,id,status:'choose_duration',createdAt:now,updatedAt:now};
  data.orders.push(order);save();return order;
 };
 const update=(id,patch)=>{
  const order=get(id);if(!order)return null;
  Object.assign(order,patch,{updatedAt:new Date().toISOString()});
  save();return order;
 };
 return {all,get,forChat,create,update};
}
