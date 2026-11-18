import {apiHandler,method,http} from '../common.js';
import {setup,query} from '../store.js';
import {CATALOG,defaultPrices} from '../catalog.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET']))return;
  let config={discord_url:'',whatsapp_number:'',contact_note:'',prices:defaultPrices};
  if(process.env.DATABASE_URL){
    await setup();
    const [s]=await query('SELECT discord_url,whatsapp_number,contact_note,prices FROM bm_store_settings WHERE id=1');
    if(s)config={...config,...s,prices:{...defaultPrices,...s.prices}};
  }
  const products=process.env.DATABASE_URL?
    await query('SELECT slug,name,eyebrow,description,image,features,price_daily FROM bm_products WHERE active=TRUE ORDER BY created_at ASC,slug ASC'):CATALOG;
  const catalog=products.map(p=>({...p,features:p.features||[],price:p.price_daily??config.prices[p.slug]??null}));
  http(res,200,{ok:true,catalog,contacts:{discordUrl:config.discord_url,whatsappNumber:config.whatsapp_number,note:config.contact_note},payment:'manual',currency:'IDR',extension:{storeUrl:/^https:\/\/chromewebstore\.google\.com\/detail\//.test(process.env.CHROME_WEB_STORE_URL||'')?process.env.CHROME_WEB_STORE_URL:null,downloadAvailable:true}});
});
