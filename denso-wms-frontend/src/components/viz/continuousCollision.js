import { sceneObstacles, vehicleParts } from './warehouseNavigation.js';

// Separation on a fixed axis is a lower bound, not an exact distance. Positive
// means a separating axis exists; negative means all tested axes overlap.
function separation(a,b) {
 const axes=o=>{const c=Math.cos(o.yaw||0),s=Math.sin(o.yaw||0);return [[c,-s],[s,c]]};
 const aa=axes(a),bb=axes(b),dx=b.x-a.x,dz=b.z-a.z;
 let best=Math.abs(a.y-b.y)-a.hy-b.hy;
 for(const axis of [...aa,...bb]){
  const dot=(u,v)=>u[0]*v[0]+u[1]*v[1];
  const ar=a.hx*Math.abs(dot(aa[0],axis))+a.hz*Math.abs(dot(aa[1],axis));
  const br=b.hx*Math.abs(dot(bb[0],axis))+b.hz*Math.abs(dot(bb[1],axis));
  best=Math.max(best,Math.abs(dx*axis[0]+dz*axis[1])-ar-br);
 }
 return best;
}

// Conservative interval proof for one linearly interpolated segment and
// static boxes. No intentional contacts are ignored. Rotations use the shortest
// arc, matching the caller's path; split longer rotations into keyframes.
// An unresolved interval is INCONCLUSIVE, never treated as clear.
export function certifyStaticSweep(from,to,{liftFrom=0,liftTo=liftFrom,extensionFrom=0,extensionTo=extensionFrom,carried=false,clearance=0,obstacles=sceneObstacles,partIds=null,maxDepth=20}={}) {
 const values=[from.x,from.z,from.yaw,to.x,to.z,to.yaw,liftFrom,liftTo,extensionFrom,extensionTo,clearance];
 if(values.some(x=>!Number.isFinite(x))||clearance<0||extensionFrom<-.4||extensionFrom>.85||extensionTo<-.4||extensionTo>.85||!Number.isInteger(maxDepth)||maxDepth<0||maxDepth>24)return {status:'INVALID',reason:'invalid numeric input, extension or recursion limit'};
 const angle=((to.yaw-from.yaw+Math.PI*3)%(2*Math.PI))-Math.PI;
 const translation=Math.hypot(to.x-from.x,to.z-from.z);
 const rate=translation+3*Math.abs(angle)+Math.abs(liftTo-liftFrom)+Math.abs(extensionTo-extensionFrom);
 const at=t=>({pose:{x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,yaw:from.yaw+angle*t},
  lift:liftFrom+(liftTo-liftFrom)*t,forkExtension:extensionFrom+(extensionTo-extensionFrom)*t,carried});
 const allIds=vehicleParts(at(.5).pose,at(.5)).map(x=>x.id);
 if(partIds&&(!Array.isArray(partIds)||!partIds.length||partIds.some(x=>!allIds.includes(x))))return {status:'INVALID',reason:'invalid part selection'};
 const ids=partIds||allIds,partScope=partIds?'SELECTED_PARTS_ONLY':'ALL_PARTS';
 let intervals=0,minimumBound=Infinity;
 for(const id of ids)for(const source of obstacles){
  const obstacle={...source,hx:source.hx+clearance,hy:source.hy+clearance,hz:source.hz+clearance};
  // The wheel OBB has invariant Y. A zero-clearance tangent to the top of a
  // flush dock cannot penetrate it at any time; this does not ignore horizontal
  // contacts when the wheel is below the top, nor any non-wheel/dock pair.
  const initial=vehicleParts(at(0).pose,at(0)).find(x=>x.id===id);
  if(clearance===0&&id.startsWith('wheel:')&&source.id.startsWith('dock:')&&Math.abs((initial.y-initial.hy)-(source.y+source.hy))<1e-9){minimumBound=Math.min(minimumBound,0);continue;}
  const stack=[[0,1,0]];
  while(stack.length){const [lo,hi,depth]=stack.pop(),mid=(lo+hi)/2,state=at(mid),part=vehicleParts(state.pose,state).find(x=>x.id===id),gap=separation(part,obstacle),bound=rate*(hi-lo)/2;intervals++;
   if(gap < -1e-9)return {status:'CLEARANCE_VIOLATION',part:id,obstacle:source.id,time:mid,intervals,clearance,partScope};
   if(gap>bound+1e-9){minimumBound=Math.min(minimumBound,gap-bound);continue;}
   if(depth>=maxDepth)return {status:'INCONCLUSIVE',part:id,obstacle:source.id,interval:[lo,hi],intervals,clearance,partScope};
   stack.push([mid,hi,depth+1],[lo,mid,depth+1]);
  }
 }
 return {status:'CLEAR',intervals,clearance,partScope,minimumProvenSeparation:Number.isFinite(minimumBound)?minimumBound:null};
}
