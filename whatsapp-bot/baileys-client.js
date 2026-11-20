/**
 * Lightweight Baileys adapter preserving the existing BLACKMAMERSTUDIO order flow.
 * No Chrome, Puppeteer, HTTP server, or Meta Cloud API.
 * A connected WhatsApp Business account is required and must be permitted by the host.
 */
import {EventEmitter} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import makeWASocket, {
 DisconnectReason, useMultiFileAuthState, downloadContentFromMessage
} from '@whiskeysockets/baileys';
import {incomingChatId,outgoingJid,personalJid,messageText,attachment} from './baileys-message.js';

const MAX_PROOF=5*1024*1024;
const logger=pino({level:'silent'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function mediaSize(value){
 if(value==null)return null;
 const n=Number(value);
 return Number.isSafeInteger(n)&&n>=0?n:null;
}
async function downloadProof(media){
 if(!media||!['image','document'].includes(media.type))return null;
 const known=mediaSize(media.payload.fileLength);
 if(known!==null&&known>MAX_PROOF)throw Error('Bukti pembayaran terlalu besar (maksimal 5 MB)');
 const chunks=[];let count=0;
 const stream=await downloadContentFromMessage(media.payload,media.type);
 for await(const chunk of stream){
  count+=chunk.length;
  if(count>MAX_PROOF)throw Error('Bukti pembayaran terlalu besar (maksimal 5 MB)');
  chunks.push(chunk);
 }
 const buffer=Buffer.concat(chunks);
 return {mimetype:media.mimetype,data:buffer.toString('base64'),buffer};
}
export class Client extends EventEmitter {
 constructor({authDir}={}){
  super();
  this.authDir=path.resolve(authDir||'./.baileys_auth');
  this.socket=null;
  this.ready=false;
  this.stopping=false;
  this.retries=0;
  this.reconnectTimer=null;
  this.serial=0;
 }
 async initialize(){
  fs.mkdirSync(this.authDir,{recursive:true,mode:0o700});
  const {state,saveCreds}=await useMultiFileAuthState(this.authDir);
  this.authState=state;
  this.saveCreds=saveCreds;
  await this.openSocket();
 }
 async openSocket(){
  if(this.stopping)return;
  const generation=++this.serial;
  console.log('[BAILEYS] Connecting to WhatsApp WebSocket (no Chromium)...');
  const sock=makeWASocket({
   auth:this.authState,
   logger,
   syncFullHistory:false,
   markOnlineOnConnect:false,
   connectTimeoutMs:60000,
   defaultQueryTimeoutMs:60000,
   keepAliveIntervalMs:20000
  });
  this.socket=sock;
  sock.ev.on('creds.update',async ()=>{
   try{await this.saveCreds();}catch(e){console.error('[BAILEYS AUTH SAVE FAILED]',e.message);}
  });
  sock.ev.on('connection.update',update=>{
   if(this.stopping||generation!==this.serial)return;
   if(update.qr)this.emit('qr',update.qr);
   if(update.connection)this.emit('change_state',update.connection);
   if(update.connection==='open'){
    this.ready=true;
    this.retries=0;
    this.emit('authenticated');
    this.emit('ready');
   }
   if(update.connection==='close'){
    this.ready=false;
    const code=Number(update.lastDisconnect?.error?.output?.statusCode||0);
    const message=String(update.lastDisconnect?.error?.message||'Connection closed').slice(0,150);
    this.emit('disconnected','code='+code+' '+message);
    if(code===DisconnectReason.loggedOut){
     this.emit('auth_failure','WhatsApp logout. Periksa Perangkat Tertaut; sesi perlu dihubungkan lagi.');
     console.error('[BAILEYS] Logged out. Stop bot dan hubungkan ulang secara sengaja. Jangan hapus session secara otomatis.');
     return;
    }
    const seconds=code===DisconnectReason.restartRequired?1:Math.min(60,2**Math.min(++this.retries,6));
    console.warn('[BAILEYS] Reconnect in',seconds,'seconds; code',code);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer=setTimeout(()=>{
     if(!this.stopping&&generation===this.serial){
      this.openSocket().catch(e=>this.scheduleRetry(e));
     }
    },seconds*1000);
   }
  });
  sock.ev.on('messages.upsert',async event=>{
   if(this.stopping||generation!==this.serial||!this.ready)return;
   const incoming=(event.messages||[]).filter(m=>m?.message&&!m.key?.fromMe);
   if(incoming.length)console.log('[BAILEYS INCOMING] event='+event.type+' count='+incoming.length);
   // 'append' is normally chat-history sync, not a new incoming order.
   if(event.type!=='notify')return;
   for(const raw of incoming){
    try{
     if(!raw.message||raw.key?.fromMe)continue;
     let mapped=null;
     const lid=raw.key?.remoteJid;
     if(typeof lid==='string'&&lid.endsWith('@lid')){
      try{mapped=await sock.signalRepository?.lidMapping?.getPNForLID(lid);}
      catch(e){console.warn('[BAILEYS LID]',String(e.message).slice(0,120));}
     }
     const from=incomingChatId(raw.key,mapped);
     if(!personalJid(from))continue;
     const type=attachment(raw.message);
     let downloaded=null;
     const load=async()=>{
      if(downloaded)return downloaded;
      downloaded=await downloadProof(type);
      return downloaded;
     };
     const msg={
      id:{_serialized:raw.key.id||''},
      from,fromMe:false,
      body:messageText(raw.message),
      hasMedia:!!type,
      _data:{notifyName:raw.pushName||''},
      reply:body=>this.sendMessage(from,String(body)),
      downloadMedia:load,
      forward:async dest=>{
       const media=await load();
       if(!media)throw Error('No proof attachment');
       const label='Bukti pembayaran dari '+from+'. Periksa transaksi sebelum menyetujui.';
       if(media.mimetype==='application/pdf'){
        return this.sendMessage(dest,{document:media.buffer,mimetype:'application/pdf',
          fileName:'bukti-pembayaran.pdf',caption:label});
       }
       if(!/^image\/(?:png|jpeg|webp)$/i.test(media.mimetype))throw Error('Unsupported proof type');
       return this.sendMessage(dest,{image:media.buffer,mimetype:media.mimetype,caption:label});
      }
     };
     this.emit('message',msg);
    }catch(e){console.error('[BAILEYS INCOMING]',String(e?.message||e).slice(0,240));}
   }
  });
 }
 scheduleRetry(e){
  if(this.stopping)return;
  const seconds=Math.min(60,2**Math.min(++this.retries,6));
  console.error('[BAILEYS CONNECT ERROR]',String(e?.message||e).slice(0,250));
  clearTimeout(this.reconnectTimer);
  this.reconnectTimer=setTimeout(()=>this.openSocket().catch(err=>this.scheduleRetry(err)),seconds*1000);
 }
 async sendMessage(jid,message){
  if(!this.socket||!this.ready)throw Error('WhatsApp belum READY; pesan tidak terkirim');
  const destination=outgoingJid(jid);
  const payload=typeof message==='string'?{text:message}:message;
  return this.socket.sendMessage(destination,payload);
 }
 async destroy(){
  this.stopping=true;this.ready=false;clearTimeout(this.reconnectTimer);
  try{this.socket?.end(new Error('BLACKMAMERSTUDIO shutdown'));}catch{}
 }
}
