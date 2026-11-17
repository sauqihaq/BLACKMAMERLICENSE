import {apiHandler,method,http} from '../lib/common.js';
import {setup,query} from '../lib/store.js';
import {CATALOG,defaultPrices} from '../lib/catalog.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET']))return;
  let config={discord_url:'',whatsapp_number:'',contact_note:'',prices:defaultPrices};
  if(process.env.DATABASE_URL){
    await setup();
    const [s]=await query('SELECT discord_url,whatsapp_number,contact_note,prices FROM bm_store_settings WHERE id=1');
    if(s)config={...config,...s,prices:{...defaultPrices,...s.prices}};
  }
  const catalog=CATALOG.map(p=>({...p,price:config.prices[p.slug]??null}));
  http(res,200,{ok:true,catalog,contacts:{discordUrl:config.discord_url,whatsappNumber:config.whatsapp_number,note:config.contact_note},payment:'manual',currency:'IDR'});
});
