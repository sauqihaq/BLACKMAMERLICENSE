// Pure message/JID helpers. No Baileys imports, so they are easily testable.
export function asPhoneJid(jid){
 const m=/^([1-9][0-9]{7,14})(?::[0-9]+)?@s\.whatsapp\.net$/.exec(String(jid||''));
 return m?m[1]+'@c.us':null;
}
export function outgoingJid(jid){
 const value=String(jid||'');
 if(/^[1-9][0-9]{7,14}@c\.us$/.test(value))return value.replace('@c.us','@s.whatsapp.net');
 if(/^[0-9]{6,20}@lid$/.test(value))return value;
 if(/^[1-9][0-9]{7,14}(?::[0-9]+)?@s\.whatsapp\.net$/.test(value))return value;
 throw Error('Unsupported private chat JID');
}
export function personalJid(jid){
 return /^[1-9][0-9]{7,14}@c\.us$/.test(String(jid||''))||
        /^[0-9]{6,20}@lid$/.test(String(jid||''));
}
export function incomingChatId(key, mappedPhoneJid=null){
 // Trust only the WhatsApp protocol's number mapping, not the displayed contact name.
 const original=String(key?.remoteJid||'');
 const alt=asPhoneJid(key?.remoteJidAlt);
 const mapped=asPhoneJid(mappedPhoneJid);
 return asPhoneJid(original)||alt||mapped||
   (/^[0-9]{6,20}@lid$/.test(original)?original:null);
}
export function unwrapContent(message){
 let content=message;
 for(let i=0;i<6&&content;i++){
  const next=content.ephemeralMessage?.message||content.viewOnceMessage?.message||
    content.viewOnceMessageV2?.message||content.viewOnceMessageV2Extension?.message||
    content.documentWithCaptionMessage?.message;
  if(!next)break;
  content=next;
 }
 return content||{};
}
export function messageText(content){
 const m=unwrapContent(content);
 return String(m.conversation||m.extendedTextMessage?.text||
  m.imageMessage?.caption||m.documentMessage?.caption||
  m.videoMessage?.caption||'');
}
export function attachment(content){
 const m=unwrapContent(content);
 if(m.imageMessage)return {type:'image',payload:m.imageMessage,mimetype:m.imageMessage.mimetype||'image/jpeg'};
 if(m.documentMessage)return {type:'document',payload:m.documentMessage,mimetype:m.documentMessage.mimetype||'application/octet-stream'};
 return null;
}
