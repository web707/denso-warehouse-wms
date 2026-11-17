import { planCandidate } from './warehouseNavigation';
import { certifyStaticSweep } from './continuousCollision';

self.onmessage = ({ data }) => {
 try {
  const result=planCandidate(data.start,data.goal,data.options);
  if(result.path){
   let checked=0,continuousStatic='CLEAR',detail=null;
   for(let i=0;i<result.path.length-1;i++){
    const check=certifyStaticSweep(result.path[i],result.path[i+1],{liftFrom:data.options?.lift??.45,carried:data.options?.carried??true,clearance:data.options?.clearance??.05});
    checked++;if(check.status!=='CLEAR'){continuousStatic=check.status;detail={edge:i,...check};break;}
   }
   result.continuousStatic=continuousStatic;result.continuousEdgesChecked=checked;result.continuousDetail=detail;
  }
  self.postMessage({ result });
 }
 catch (error) { self.postMessage({ error: String(error?.message || error) }); }
};
