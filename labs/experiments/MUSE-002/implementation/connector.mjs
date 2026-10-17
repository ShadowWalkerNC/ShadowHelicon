const denied = code => ({ok:false,error:{code}});
const valid = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/** Simulated adapter. Permissions are server-owned; request grants are ignored. */
export function createReadOnlyConnector({permissions=[],service}={}) {
 const granted=new Set(permissions);
 return async function handle(request) {
  if(!valid(request)||request.version!==1||typeof request.method!=='string')return denied('INVALID_REQUEST');
  if(!['resources.list','resources.read'].includes(request.method))return denied('UNSUPPORTED_OPERATION');
  if(!granted.has('read'))return denied('PERMISSION_DENIED');
  if(!service||typeof service.list!=='function'||typeof service.read!=='function')return denied('SERVICE_UNAVAILABLE');
  try {
  if(request.method==='resources.list')return {ok:true,version:1,resources:await service.list()};
  if(!valid(request.params)||typeof request.params.uri!=='string')return denied('INVALID_PARAMS');
  const content=await service.read(request.params.uri);
  return content===undefined?denied('NOT_FOUND'):{ok:true,version:1,resource:content};
  }catch{return denied('SERVICE_UNAVAILABLE');}
 };
}
export function createSimulatedDocuments(){
 const documents=[{uri:'sim://muselab/overview',title:'Simulation overview',text:'Synthetic MuseLab fixture; no production data.'}];
 return {list:async()=>documents.map(({uri,title})=>({uri,title})),read:async uri=>{const doc=documents.find(d=>d.uri===uri);return doc&&{...doc};}};
}
