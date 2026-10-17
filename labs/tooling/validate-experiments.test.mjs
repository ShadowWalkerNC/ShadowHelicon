import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateRegistry} from './validate-experiments.mjs';
test('registry requires unique lifecycle records and real bounded evidence',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'muselab-registry-'));
  fs.writeFileSync(path.join(root,'evidence.md'),'authored fixture');
  const item={id:'MUSE-001',lifecycle:'EXPERIMENT',executionStatus:'BLOCKED',simulation:false,decision:'INCONCLUSIVE',files:Object.fromEntries(['hypothesis','implementation','results','decision'].map(k=>[k,'evidence.md']))};
  const check=items=>validateRegistry(root,{schemaVersion:1,experiments:items});
  try{
    assert.deepEqual(check([item]),[]);
    assert.deepEqual(validateRegistry(root,null),['Invalid registry envelope']);
    assert.deepEqual(validateRegistry(path.join(root,'missing'),{}),['Invalid registry root']);
    assert.ok(check([null]).includes('Invalid experiment record'));
    assert.ok(check([item,item]).some(x=>x.includes('duplicate')));
    assert.ok(check([{...item,lifecycle:'MAGIC'}]).some(x=>x.includes('lifecycle')));
    assert.ok(check([{...item,lifecycle:'ADOPTED'}]).some(x=>x.includes('approval')));
    assert.ok(check([{...item,lifecycle:'ADOPTED',approvalEvidence:'missing.md'}]).some(x=>x.includes('approval')));
    assert.ok(check([{...item,files:{...item.files,results:'missing.md'}}]).some(x=>x.includes('results')));
    assert.ok(check([{...item,files:{...item.files,results:'../escape.md'}}]).some(x=>x.includes('outside')));
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
