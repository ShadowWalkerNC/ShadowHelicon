import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

test('public verification withholds runtime even for an allowed source edit',()=>{
  const root=path.dirname(fileURLToPath(import.meta.url));
  const run=fs.mkdtempSync(path.join(root,'runs','isolation-regression-'));
  const scratch=path.join(run,'scratch'),control=path.join(run,'control');
  fs.mkdirSync(path.join(scratch,'src'),{recursive:true});fs.mkdirSync(control);
  const beforeText='export function sliceRange(){return [];}';
  const source=path.join(scratch,'src/slicer.ts');
  const marker=path.join(control,'must-not-exist.txt');
  const hash=crypto.createHash('sha256').update(beforeText).digest('hex');
  fs.writeFileSync(path.join(control,'manifest.json'),JSON.stringify({taskId:'slicer',scratch,before:{'src/slicer.ts':hash},allowed:['src/slicer.ts'],fixtureHash:'synthetic-regression',baseline:{}}));
  fs.writeFileSync(source,`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marker)},'executed');\n${beforeText}`);
  const child=spawnSync(process.execPath,[path.join(root,'harness.mjs'),'verify-run',run],{encoding:'utf8',timeout:10000});
  assert.equal(child.status,1);
  const result=JSON.parse(child.stdout);
  assert.equal(result.verificationStatus,'NOT RUN');
  assert.equal(result.verification.checksExecuted,false);
  assert.deepEqual(result.verification.unauthorizedFiles,[]);
  assert.equal(fs.existsSync(marker),false);
});
