import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';

export function createStore(directory){
 const dir=path.resolve(directory),file=path.join(dir,'orders.json');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 let data={orders:[],supportTickets:[]};
 if(fs.existsSync(file)){
  const read=JSON.parse(fs.readFileSync(file,'utf8'));
  if(!Array.isArray(read.orders))throw Error('Invalid order database');
  data={...read,supportTickets:Array.isArray(read.supportTickets)?read.supportTickets:[]};
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
 const getSupport=id=>data.supportTickets.find(t=>t.id===String(id).toUpperCase())||null;
 const activeSupportFor=jid=>data.supportTickets.find(t=>t.jid===jid&&t.status==='open')||null;
 const listSupport=()=>data.supportTickets.filter(t=>t.status==='open').slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const openSupport=(jid,orderId=null)=>{
  const existing=activeSupportFor(jid);
  if(existing)return {ticket:existing,created:false};
  let id;do{id=randomBytes(4).toString('hex').toUpperCase();}while(get(id)||getSupport(id));
  const now=new Date().toISOString();
  const ticket={id,jid,orderId,status:'open',createdAt:now,updatedAt:now};
  data.supportTickets.push(ticket);save();return {ticket,created:true};
 };
 const closeSupport=id=>{
  const ticket=getSupport(id);if(!ticket||ticket.status!=='open')return null;
  ticket.status='closed';ticket.updatedAt=new Date().toISOString();save();return ticket;
 };
 return {all,get,forChat,create,update,getSupport,activeSupportFor,listSupport,openSupport,closeSupport};
}
