import {apiHandler,method,http} from '../lib/common.js';
import {setup,query} from '../lib/store.js';
export default apiHandler(async(req,res)=>{
  if(!method(req,res,['GET']))return;
  await setup();
  const [{alive}]=await query('SELECT 1 AS alive');
  http(res,200,{ok:true,service:'BlackMamerStudio Tripo License V12',database:alive===1?'connected':'unknown'});
});
