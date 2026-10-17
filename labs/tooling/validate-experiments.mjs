import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function validateRegistry(root, registry) {
  const errors=[],ids=new Set();
  let base;
  try{base=fs.realpathSync(root);}catch{return ['Invalid registry root'];}
  if(!registry||typeof registry!=='object'||registry.schemaVersion!==1||!Array.isArray(registry.experiments))return ['Invalid registry envelope'];
  for(const item of registry.experiments){
    if(!item||typeof item!=='object'||Array.isArray(item)){errors.push('Invalid experiment record');continue;}
    if(!/^MUSE-\d{3}$/.test(item.id)||ids.has(item.id))errors.push('Invalid/duplicate ID: '+item.id);
    ids.add(item.id);
    if(!['IDEA','EXPERIMENT','VALIDATED','CANDIDATE','APPROVAL','ADOPTED','REJECTED'].includes(item.lifecycle))errors.push('Invalid lifecycle: '+item.id);
    if(!['NOT RUN','PASS','FAIL','BLOCKED'].includes(item.executionStatus))errors.push('Invalid execution status: '+item.id);
    if(typeof item.simulation!=='boolean'||typeof item.decision!=='string')errors.push('Missing simulation/decision: '+item.id);
    if(item.lifecycle==='ADOPTED'&&typeof item.approvalEvidence!=='string')errors.push('Adoption lacks approval evidence path: '+item.id);
    for(const key of ['hypothesis','implementation','results','decision',...(item.lifecycle==='ADOPTED'?['approval']:[])]){
      const name=key==='approval'?item.approvalEvidence:item.files?.[key];
      try{
        if(typeof name!=='string'||path.isAbsolute(name))throw Error();
        const resolved=fs.realpathSync(path.resolve(base,name));
        const relative=path.relative(base,resolved);
        if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative)||!fs.statSync(resolved).isFile())throw Error();
      }catch{errors.push('Missing/outside file '+key+': '+item.id);}
    }
  }
  return errors;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const errors=validateRegistry(root,JSON.parse(fs.readFileSync(path.join(root,'experiments/registry.json'),'utf8')));
  console.log(JSON.stringify({status:errors.length?'FAIL':'PASS',errors},null,2));
  if(errors.length)process.exitCode=1;
}
