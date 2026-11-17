// Simulation-only geometry. Values mirror AnimatedSupplyScene scene units.
// This is not an autonomous-vehicle or physical warehouse safety system.
// No physical-unit conversion is assumed. Clearance equals one rendered tine
// width (0.05 scene unit). The loaded turning radius encloses the farthest
// rendered tine corner. Keep simulation geometry and colliders in sync.
export const SIM_LAYOUT=Object.freeze({frontRackZ:-3,rackDepth:.8,rackPostX:.85,shelfWidth:1.75,levelPitch:.52,
 clearance:.05,loadedTurnRadius:Math.hypot(1.35,.115),
 get aisleWidth(){return 2*(this.loadedTurnRadius+this.clearance)},
 get rearRackZ(){return this.frontRackZ+this.rackDepth+this.aisleWidth}});
// Zone A racks: R01 (x = -2.80), R02 (x = 0.00), R03 (x = 2.80) along front row z = -3.00.
// Racks are unified across Sơ đồ kho 3D and Hành trình 3D.
export const RACK_X_POSITIONS = Object.freeze([-2.80, 0, 2.80]);
const rackXs = RACK_X_POSITIONS;
const rackZs = [SIM_LAYOUT.frontRackZ];
const shelfYs = Array.from({length: 4}, (_, i) => .3 + i * SIM_LAYOUT.levelPitch);
const box = (id, x, y, z, hx, hy, hz) => ({id, x, y, z, hx, hy, hz, yaw: 0});
export const rackComponents = rackXs.flatMap(x => rackZs.flatMap(z => [
  ...[-SIM_LAYOUT.rackPostX, SIM_LAYOUT.rackPostX].map(dx => box(`post:${x}:${z}:${dx}`, x + dx, 1, z, .04, 1, .4)),
  ...shelfYs.map(y => box(`shelf:${x}:${z}:${y}`, x, y, z, SIM_LAYOUT.shelfWidth / 2, .04, .4))
]));
export const wallComponents=[box('wall:back',0,2,-5,6,2,.075),box('wall:left',-6,2,-1.55,.075,2,3.45),box('wall:right',6,2,-1.55,.075,2,3.45)];
// Dock plates are flush with the y=0 simulation floor. They remain colliders;
// wheels may touch their top but cannot penetrate the plate.
export const dockComponents=[box('dock:in',-4,-.02,2.7,1,.02,.5),box('dock:out',4,-.02,2.7,1,.02,.5)];
export const sceneObstacles=[...rackComponents,...wallComponents,...dockComponents];

// SAT in world X/Z with strict interior overlap; touching is not penetration.
export function boxOverlap(a,b,epsilon=1e-9){
 if(Math.abs(a.y-b.y)>=a.hy+b.hy-epsilon)return false;
 const axes=o=>{const c=Math.cos(o.yaw||0),s=Math.sin(o.yaw||0);return [[c,-s],[s,c]]};
 const aa=axes(a),bb=axes(b),dx=b.x-a.x,dz=b.z-a.z;
 // Conservative broad phase: only discard pairs whose world AABBs are
 // disjoint. Overlaps still run the complete oriented SAT below.
 const ax=a.hx*Math.abs(aa[0][0])+a.hz*Math.abs(aa[1][0]);
 const az=a.hx*Math.abs(aa[0][1])+a.hz*Math.abs(aa[1][1]);
 const bx=b.hx*Math.abs(bb[0][0])+b.hz*Math.abs(bb[1][0]);
 const bz=b.hx*Math.abs(bb[0][1])+b.hz*Math.abs(bb[1][1]);
 if(Math.abs(dx)>=ax+bx-epsilon||Math.abs(dz)>=az+bz-epsilon)return false;
 for(const axis of [...aa,...bb]){
  const dot=(u,v)=>u[0]*v[0]+u[1]*v[1];
  const ar=a.hx*Math.abs(dot(aa[0],axis))+a.hz*Math.abs(dot(aa[1],axis));
  const br=b.hx*Math.abs(dot(bb[0],axis))+b.hz*Math.abs(dot(bb[1],axis));
  if(Math.abs(dx*axis[0]+dz*axis[1])>=ar+br-epsilon)return false;
 }
 return true;
}
function localBox(id,pose,lx,y,lz,hx,hy,hz){
 const c=Math.cos(pose.yaw),s=Math.sin(pose.yaw);
 return {id,x:pose.x+lx*c+lz*s,y,z:pose.z-lx*s+lz*c,hx,hy,hz,yaw:pose.yaw};
}
// Parts are separate: body, mast, individual tines, and pallet. Dimensions
// exactly match their rendered meshes, not a shrunken collision proxy.
export function vehicleParts(pose,{lift=0,carried=false,forkExtension=0}={}){
 if(!Number.isFinite(forkExtension)||forkExtension<-.4||forkExtension>.85)throw new Error('Invalid simulated fork extension');
 const pieces=[localBox('body',pose,0,.35,0,.475,.275,.4),localBox('cabin',pose,-.25,.85,0,.24,.375,.34),localBox('mast',pose,.48,.8,0,.04,.75,.4),
  ...[-.3,.3].flatMap((x,i)=>[-.43,.43].map((z,j)=>localBox(`wheel:${i}:${j}`,pose,x,.15,z,.15,.15,.075))),
  ...[-.09,.09].map((z,i)=>localBox(`fork:${i}`,pose,.9+forkExtension/2,.034+lift,z,.45+forkExtension/2,.010,.018))];
 if(carried)pieces.push(localBox('pallet',pose,.95+forkExtension,lift+.165,0,.14,.165,.14));
 return pieces;
}
export function palletColliders(pose){
 const y=pose.y||0,c=Math.cos(pose.yaw||0),s=Math.sin(pose.yaw||0);
 const box=(id,lx,ly,lz,hx,hy,hz)=>({id,x:pose.x+lx*c+lz*s,y:ly,z:pose.z-lx*s+lz*c,hx,hy,hz,yaw:pose.yaw||0});
 return [
  box('pallet:top_deck',0,y+.062,0,.14,.008,.14),
  box('pallet:bottom_deck_left',0,y+.007,-.1325,.14,.007,.0075),
  box('pallet:bottom_deck_center',0,y+.007,0,.14,.007,.055),
  box('pallet:bottom_deck_right',0,y+.007,.1325,.14,.007,.0075),
  box('pallet:stringer_left',0,y+.034,-.1325,.14,.020,.0075),
  box('pallet:stringer_center',0,y+.034,0,.14,.020,.055),
  box('pallet:stringer_right',0,y+.034,.1325,.14,.020,.0075),
  box('pallet:cargo',0,y+.200,0,.12,.130,.12)
 ];
}
export function collisionReport(pose,options={}){
 const pieces=vehicleParts(pose,options),hits=[];
 const clearance=options.clearance??0;
 for(const part of pieces)for(const obstacle of sceneObstacles){const expanded=clearance?{...obstacle,hx:obstacle.hx+clearance,hy:obstacle.hy+clearance,hz:obstacle.hz+clearance}:obstacle;if(boxOverlap(part,expanded))hits.push({part:part.id,obstacle:obstacle.id});}
 return hits;
}

// Heading-aware lattice search. Each edge is sampled at <= 0.05 scene units
// and <= 5 degrees. A returned path is a CANDIDATE only: slot occupancy,
// placement, intended fork/shelf contacts, dynamics and swept volumes must
// still be certified before the UI may mark it verified.
export function planCandidate(start,goal,{step=.2,lift=.45,carried=true,maxNodes=15000,clearance=SIM_LAYOUT.clearance}={}){
 const angles=[0,Math.PI/2,Math.PI,3*Math.PI/2];
 const wrap=n=>(n%4+4)%4, key=(x,z,h)=>`${x},${z},${h}`;
 // Anchor the grid at the requested goal: a successful path must not silently
 // place the vehicle at a rounded approximation of the selected slot.
 const anchorX=goal.x-Math.round(goal.x/step)*step,anchorZ=goal.z-Math.round(goal.z/step)*step;
 const quantX=v=>Math.round((v-anchorX)/step),quantZ=v=>Math.round((v-anchorZ)/step),
  toPose=(x,z,h)=>({x:x*step+anchorX,z:z*step+anchorZ,yaw:angles[wrap(h)]});
 const origin={x:quantX(start.x),z:quantZ(start.z),h:wrap(start.heading)},target={x:quantX(goal.x),z:quantZ(goal.z),h:wrap(goal.heading)};
 const options={lift,carried,clearance};
 const safe=p=>p.x>=-6.8&&p.x<=6.8&&p.z>=-4.5&&p.z<=3.4&&!collisionReport(p,options).length;
 const exactStart={x:start.x,z:start.z,yaw:angles[origin.h]},snappedStart=toPose(origin.x,origin.z,origin.h);
 if(!safe(exactStart)||!safe(snappedStart))return {status:'NO SAFE SIMULATED ROUTE',reason:'start pose intersects simulated obstacle'};
 const dx=snappedStart.x-exactStart.x,dz=snappedStart.z-exactStart.z;
 // A grid bridge must be longitudinal; the vehicle cannot strafe sideways.
 if(Math.abs(dx*Math.sin(exactStart.yaw)+dz*Math.cos(exactStart.yaw))>1e-8)return {status:'NO SAFE SIMULATED ROUTE',reason:'start is off-grid laterally; unverified bridge'};
 for(let i=1;i<=4;i++)if(!safe({x:exactStart.x+dx*i/4,z:exactStart.z+dz*i/4,yaw:exactStart.yaw}))return {status:'NO SAFE SIMULATED ROUTE',reason:'start-to-grid bridge intersects simulated obstacle'};
 if(!safe(toPose(target.x,target.z,target.h)))return {status:'NO SAFE SIMULATED ROUTE',reason:'approach pose intersects simulated obstacle'};
 const startKey=key(origin.x,origin.z,origin.h),open=[{...origin,g:0}],best=new Map([[startKey,0]]),previous=new Map();
 const heuristic=n=>Math.abs(n.x-target.x)+Math.abs(n.z-target.z)+(n.h===target.h?0:1);
 let visited=0;
 while(open.length&&visited++<maxNodes){
  open.sort((a,b)=>(a.g+heuristic(a))-(b.g+heuristic(b)));const node=open.shift(),nodeKey=key(node.x,node.z,node.h);
  if(node.g!==best.get(nodeKey))continue;
  if(node.x===target.x&&node.z===target.z&&node.h===target.h){const path=[];let k=nodeKey;while(k){const [x,z,h]=k.split(',').map(Number);path.push(toPose(x,z,h));k=previous.get(k)}path.reverse();if(Math.hypot(dx,dz)>1e-8)path.unshift(exactStart);return {status:'CANDIDATE ONLY',path,visited};}
  const h=wrap(node.h),forward=[[1,0],[0,-1],[-1,0],[0,1]][h];
  for(const next of [{x:node.x+forward[0],z:node.z+forward[1],h},{x:node.x-forward[0],z:node.z-forward[1],h},{x:node.x,z:node.z,h:wrap(h+1),turn:1},{x:node.x,z:node.z,h:wrap(h-1),turn:-1}]){
   const from=toPose(node.x,node.z,h),to=toPose(next.x,next.z,next.h),steps=next.turn?18:4;
   let clear=true;for(let i=1;i<=steps;i++){const t=i/steps,p={x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t,yaw:next.turn?from.yaw+next.turn*Math.PI/2*t:from.yaw};if(!safe(p)){clear=false;break}}
   if(!clear)continue;const nk=key(next.x,next.z,next.h),g=node.g+1;if(g>=(best.get(nk)??Infinity))continue;best.set(nk,g);previous.set(nk,nodeKey);open.push({...next,g});
  }
 }
 return {status:'NO SAFE SIMULATED ROUTE',reason:open.length?'search limit reached; result inconclusive':'no route in sampled conservative lattice',visited};
}
