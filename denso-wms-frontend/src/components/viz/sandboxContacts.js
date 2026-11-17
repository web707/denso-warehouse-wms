import { boxOverlap } from './warehouseNavigation.js';

// This classifier is deliberately narrow: it only certifies an axis-aligned
// pallet on its designated support surface. Unknown pairs are not exempted.
export function classifySupport({phase,pallet,shelf,slot,targetSlotId,tolerance=1e-6}) {
 if(!pallet||!shelf||!slot||!Number.isFinite(tolerance)||tolerance<=0||tolerance>1e-4)return {status:'UNKNOWN',reason:'thiếu hình học hoặc sai số không hợp lệ'};
 if([pallet.x,pallet.y,pallet.z,pallet.hx,pallet.hy,pallet.hz,shelf.x,shelf.y,shelf.z,shelf.hx,shelf.hy,shelf.hz,slot.x,slot.z,slot.hx,slot.hz].some(v=>!Number.isFinite(v)))return {status:'UNKNOWN',reason:'tọa độ hoặc kích thước không hợp lệ'};
 if([pallet.hx,pallet.hy,pallet.hz,shelf.hx,shelf.hy,shelf.hz,slot.hx,slot.hz].some(v=>v<=0))return {status:'UNKNOWN',reason:'kích thước phải dương'};
 if((pallet.yaw!=null&&!Number.isFinite(pallet.yaw))||(shelf.yaw!=null&&!Number.isFinite(shelf.yaw)))return {status:'UNKNOWN',reason:'góc xoay không hợp lệ'};
 if(!slot.id||!shelf.id||slot.id!==targetSlotId||slot.supportId!==shelf.id)return {status:'UNKNOWN',reason:'không xác minh được ô đích và mặt đỡ'};
 if(slot.occupancy==='OCCUPIED_OTHER')return {status:'FORBIDDEN_OVERLAP',reason:'ô mô phỏng đã có pallet khác'};
 if(slot.occupancy!=='EMPTY_SIMULATED')return {status:'UNKNOWN',reason:'chưa xác minh trạng thái ô mô phỏng'};
 if(!['LOWER','RELEASE'].includes(phase))return {status:'UNKNOWN',reason:'ngoài pha đặt/nhả'};
 if(Math.abs(pallet.yaw||0)>tolerance||Math.abs(shelf.yaw||0)>tolerance)return {status:'UNKNOWN',reason:'tư thế xoay chưa hỗ trợ'};
 const inside=Math.abs(pallet.x-slot.x)+pallet.hx<=slot.hx+tolerance&&Math.abs(pallet.z-slot.z)+pallet.hz<=slot.hz+tolerance;
 if(!inside)return {status:'FORBIDDEN_OVERLAP',reason:'pallet vượt biên ô đích'};
 if(Math.abs(pallet.x-shelf.x)+pallet.hx>shelf.hx+tolerance||Math.abs(pallet.z-shelf.z)+pallet.hz>shelf.hz+tolerance)return {status:'UNKNOWN',reason:'mặt đỡ không bao phủ pallet'};
 const verticalGap=(pallet.y-pallet.hy)-(shelf.y+shelf.hy);
 if(verticalGap < -tolerance)return {status:'FORBIDDEN_OVERLAP',reason:'pallet xuyên mặt đỡ',penetration:-verticalGap};
 if(Math.abs(verticalGap)<=tolerance)return {status:phase==='RELEASE'?'VALID_RELEASE_CONTACT':'VALID_SUPPORT_CONTACT',verticalGap,tolerance};
 return {status:'UNKNOWN',reason:'pallet chưa tiếp xúc mặt đỡ',verticalGap};
}

export function classifyPickup({phase,fork,fork0,fork1,wood,palletParts,tolerance=1e-4}) {
 if(phase!=='INSERT_FORKS'&&phase!=='LIFT')return {status:'UNKNOWN',reason:'không đúng pha lấy pallet'};
 if(wood&&!palletParts&&(!fork0||!fork1)){
  if(!boxOverlap(fork,wood))return {status:'UNKNOWN',reason:'chưa có tiếp xúc'};
  return {status:'UNKNOWN',reason:'đế pallet đặc; chưa mô hình hóa rãnh cho càng'};
 }
 const tines=fork0&&fork1?[fork0,fork1]:(fork?[fork]:[]);
 if(!tines.length||!palletParts)return {status:'UNKNOWN',reason:'thiếu collider càng hoặc pallet'};
 const stringers=palletParts.filter(p=>p.id&&(p.id.includes('stringer')||p.id.includes('bottom')));
 const cargo=palletParts.find(p=>p.id&&p.id.includes('cargo'));
 const topDeck=palletParts.find(p=>p.id&&p.id.includes('top_deck'));
 for(const t of tines){
  for(const s of stringers){
   if(boxOverlap(t,s))return {status:'FORBIDDEN_OVERLAP',reason:`càng va chạm với thanh đỡ ${s.id}`};
  }
  if(cargo&&boxOverlap(t,cargo))return {status:'FORBIDDEN_OVERLAP',reason:'càng va chạm với thùng hàng'};
 }
 if(phase==='INSERT_FORKS'){
  return {status:'FORKS_INSERTED',reason:'càng nâng vào đúng hai khe rãnh pallet với khoảng hở an toàn',tinesEngaged:tines.length};
 }
 if(topDeck){
  const topDeckUnderside=topDeck.y-topDeck.hy;
  for(const t of tines){
   const tineTop=t.y+t.hy,gap=topDeckUnderside-tineTop;
   if(gap < -tolerance)return {status:'FORBIDDEN_OVERLAP',reason:'càng xuyên mặt dưới ván trên pallet',penetration:-gap};
   if(Math.abs(gap)<=tolerance)return {status:'VALID_PICKUP_CONTACT',verticalGap:gap,tolerance,tinesEngaged:tines.length};
  }
  return {status:'UNKNOWN',reason:'càng chưa tiếp xúc mặt nâng pallet'};
 }
 return {status:'VALID_PICKUP_CONTACT',tinesEngaged:tines.length};
}

export function classifyRetreat({phase,forks,pallet,shelf,tolerance=1e-4}){
 if(phase!=='RETREAT')return {status:'UNKNOWN',reason:'ngoài pha rút càng'};
 if(!pallet)return {status:'UNKNOWN',reason:'thiếu thông tin pallet'};
 const shelfTop=shelf?shelf.y+shelf.hy:.34,palletBottom=pallet.y-pallet.hy;
 if(Math.abs(palletBottom-shelfTop)>tolerance)return {status:'FORBIDDEN_OVERLAP',reason:'pallet không giữ đúng cao độ tầng S01'};
 if(Array.isArray(forks)){
  for(const f of forks){
   if(boxOverlap(f,pallet))return {status:'FORBIDDEN_OVERLAP',reason:'càng va chạm pallet khi rút'};
   if(shelf&&boxOverlap(f,shelf))return {status:'FORBIDDEN_OVERLAP',reason:'càng va chạm mặt kệ khi rút'};
  }
 }
 return {status:'VALID_RETREAT',palletStationary:true,forksClear:true};
}

// A scalar gap is supplied by a separate geometry measurement; a passing gap
// alone cannot certify a complete swept route or an intentional contact.
export function classifyClearance({phase,pair,gap,required}) {
 if(!phase||!pair||!Number.isFinite(gap)||!Number.isFinite(required)||required<0)return {status:'UNKNOWN',reason:'thiếu số đo hoặc ngưỡng theo pha'};
 if(gap<0)return {status:'FORBIDDEN_OVERLAP',phase,pair,penetration:-gap};
 if(gap<required)return {status:'INSUFFICIENT_CLEARANCE',phase,pair,gap,required};
 return {status:'UNKNOWN',reason:'một số đo đơn lẻ không chứng nhận toàn tuyến',phase,pair,gap,required};
}
