/** Normalize a WhatsApp destination saved by the admin. */
export function normalizeWhatsAppNumber(value){
 const raw=String(value??'').trim();
 if(!raw)return '';
 const match=/^https:\/\/wa\.me\/(\+?[0-9][0-9\s-]*)\/?$/i.exec(raw);
 const candidate=match?match[1]:raw;
 if(!match&&!/^\+?[0-9()\s-]+$/.test(candidate))return null;
 const number=candidate.replace(/[^0-9]/g,'');
 const intl=number.startsWith('0')?'62'+number.slice(1):number;
 return /^[1-9][0-9]{7,14}$/.test(intl)?intl:null;
}
