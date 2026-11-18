/** Server-authoritative daily price and truthful per-product promotion. */
export function effectiveDiscount(percent,until,now=Date.now()){
 const rate=Number(percent);
 if(!Number.isInteger(rate)||rate<1||rate>90)return 0;
 if(until!==null&&until!==undefined&&until!==''&&(!Number.isFinite(Date.parse(until))||Date.parse(until)<=now))return 0;
 return rate;
}
export function calculatePrice(dailyPrice,percent=0,until=null,now=Date.now()){
 if(dailyPrice===null||dailyPrice===undefined||dailyPrice===''){
  return {price:null,originalPrice:null,discountPercent:0,discountUntil:null};
 }
 const base=Number(dailyPrice);
 if(!Number.isSafeInteger(base)||base<0)throw Error('Invalid daily price');
 const discountPercent=effectiveDiscount(percent,until,now);
 return {
  price:discountPercent?Math.round(base*(100-discountPercent)/100):base,
  originalPrice:base,
  discountPercent,
  discountUntil:discountPercent&&until?new Date(until).toISOString():null
 };
}
