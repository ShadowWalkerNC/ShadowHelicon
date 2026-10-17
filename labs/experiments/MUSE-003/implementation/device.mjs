const denied = code => ({ok:false,error:{code}});
const valid = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Synthetic device adapter; no discovery transport, hardware or write control. */
export function createDeviceSimulation({permissions=[],onRead=()=>{},timestamp='2026-10-03T00:00:00.000Z'}={}){
 const granted=new Set(permissions);
 const device={id:'sim-esp32-001',kind:'esp32',simulated:true,connection:'simulated',status:'ready'};
 return request=>{
  if(!valid(request)||request.version!==1||typeof request.method!=='string')return denied('INVALID_REQUEST');
  if(!['devices.discover','devices.status','devices.events'].includes(request.method))return denied('UNSUPPORTED_OPERATION');
  if(!granted.has('read'))return denied('PERMISSION_DENIED');
  if(request.method!=='devices.discover'){
   if(!valid(request.params)||typeof request.params.deviceId!=='string')return denied('INVALID_PARAMS');
   if(request.params.deviceId!==device.id)return denied('UNKNOWN_DEVICE');
  }
  onRead(request.method);
  if(request.method==='devices.discover')return {ok:true,version:1,simulated:true,devices:[{...device}]};
  if(request.method==='devices.status')return {ok:true,version:1,simulated:true,device:{...device}};
  return {ok:true,version:1,simulated:true,events:[{version:1,type:'device.status',deviceId:device.id,status:device.status,simulated:true,timestamp}]};
 };
}
