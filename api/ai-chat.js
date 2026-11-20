import {AI_MODEL,SYSTEM_PROMPT,containsSensitiveInput,parseChatPayload,faqAnswer} from '../lib/ai-chat-logic.js';

const rateBuckets=new Map();
const RATE_WINDOW=60000;
const RATE_MAX=10;
function throttled(req){
 const ip=String(req.headers['x-forwarded-for']||req.headers['x-real-ip']||'unknown').split(',')[0].trim().slice(0,80);
 const now=Date.now();
 const bucket=rateBuckets.get(ip);
 if(rateBuckets.size>1000)for(const [k,v] of rateBuckets)if(now-v.since>RATE_WINDOW)rateBuckets.delete(k);
 if(!bucket||now-bucket.since>RATE_WINDOW){rateBuckets.set(ip,{since:now,count:1});return false;}
 bucket.count++;
 return bucket.count>RATE_MAX;
}
function response(res,status,body){
 res.statusCode=status;
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store, private');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.end(JSON.stringify(body));
}
function allowedOrigin(req){
 const origin=req.headers.origin;
 if(!origin)return true; // Nonbrowser clients are still subject to input and rate limits.
 try{
  const url=new URL(origin);
  return ['https:','http:'].includes(url.protocol)&&url.host===req.headers.host;
 }catch{return false;}
}
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return response(res,405,{ok:false,error:'Method not allowed'});}
 if(!allowedOrigin(req))return response(res,403,{ok:false,error:'Origin not allowed'});
 if(!/application\/json/i.test(String(req.headers['content-type']||'')))
  return response(res,415,{ok:false,error:'Format data tidak didukung.'});
 if(Number(req.headers['content-length']||0)>6500)return response(res,413,{ok:false,error:'Pesan terlalu panjang.'});
 if(throttled(req))return response(res,429,{ok:false,error:'Pesan terlalu cepat. Coba lagi sebentar.'});
 const data=parseChatPayload(req.body);
 if(!data)return response(res,400,{ok:false,error:'Tulis pertanyaan maksimal 900 karakter.'});
 if(containsSensitiveInput(data.message))return response(res,400,{ok:false,error:'Jangan kirim token lisensi, password, OTP, atau API key lewat chat ini. Hubungi admin untuk bantuan.'});
 const key=String(process.env.GEMINI_API_KEY||'').trim();
 if(!key)return response(res,200,{ok:true,mode:'faq',reply:faqAnswer(data.message),notice:'Mode panduan otomatis. AI belum diaktifkan oleh admin.'});
 const contents=[
  ...data.history.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.text}]})),
  {role:'user',parts:[{text:data.message}]}
 ];
 try{
  const result=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+AI_MODEL+':generateContent',{
   method:'POST',signal:AbortSignal.timeout(14000),
   headers:{'Content-Type':'application/json','x-goog-api-key':key},
   body:JSON.stringify({
    systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},
    contents,generationConfig:{temperature:0.45,maxOutputTokens:550}
   })
  });
  if(!result.ok){
   console.warn('[BM AI CHAT] Provider returned HTTP',result.status);
   return response(res,200,{ok:true,mode:'faq',reply:faqAnswer(data.message),
    notice:result.status===429?'Kuota gratis AI sedang habis. Panduan otomatis tetap tersedia.':'AI sementara tidak tersedia. Berikut panduan otomatis.'});
  }
  const payload=await result.json();
  const reply=payload?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('').trim().slice(0,1600);
  if(!reply)return response(res,200,{ok:true,mode:'faq',reply:faqAnswer(data.message),notice:'AI belum menghasilkan jawaban. Berikut panduan otomatis.'});
  return response(res,200,{ok:true,mode:'ai',reply});
 }catch(e){
  console.warn('[BM AI CHAT] Provider unavailable:',e?.name||'error');
  return response(res,200,{ok:true,mode:'faq',reply:faqAnswer(data.message),notice:'AI sedang tidak merespons. Berikut panduan otomatis.'});
 }
}
