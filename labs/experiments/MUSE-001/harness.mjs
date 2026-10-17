import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const compiler = process.env.MUSE001_TSC ?? 'C:/Users/white/Documents/GitHub/BibleDesk/node_modules/typescript/bin/tsc';
const ts = createRequire(import.meta.url)(path.resolve(path.dirname(compiler),'../lib/typescript.js'));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const types = `export type PortfolioEvent = { kind: 'active'; name: string } | { kind: 'paused'; reason: string } | { kind: 'migration'; target: string };\nexport type EventResult = string;\n`;
const tasks = {
  slicer: {
    allowed: ['src/slicer.ts'],
    prompt: 'Fix sliceRange(input:number[],start:number,end:number):number[]. Bounds are integer offsets clamped to zero; end is exclusive. Return a fresh array; start beyond end returns empty. Preserve the input. Only edit src/slicer.ts.',
    baseline: { 'src/slicer.ts': `export function sliceRange(input: number[], start: number, end: number): number[] {\n if(start < 0 || end < 0) throw new Error('negative');\n if(start===end)return []; return input.slice(start,end + 1);\n}\n` },
    reference: { 'src/slicer.ts': `export function sliceRange(input: number[], start: number, end: number): number[] {\n return input.slice(Math.max(0,start),Math.max(0,end));\n}\n` },
    tests: `const {sliceRange:f}=await import(SOURCE);\ntest('exclusive end',()=>{const a=[1,2,3];const b=f(a,0,2);assert.deepEqual(b,[1,2]);assert.deepEqual(a,[1,2,3]);assert.notEqual(a,b);});\ntest('negative clamp',()=>assert.deepEqual(f([1,2,3],-2,2),[1,2]));\ntest('negative end',()=>assert.deepEqual(f([1,2,3],0,-1),[]));\ntest('empty',()=>assert.deepEqual(f([],0,0),[]));\ntest('large end',()=>assert.deepEqual(f([1,2],0,100),[1,2]));\ntest('empty reversed',()=>{assert.deepEqual(f([1,2],2,1),[]);const a=[1,2];const b=f(a,0,0);assert.deepEqual(b,[]);assert.notEqual(a,b);assert.deepEqual(a,[1,2]);});`,
    entry: 'slicer.ts', expectedFailures: 3,
  },
  backoff: {
    allowed: ['src/backoff.ts'],
    prompt: 'Implement calculateBackoff(attempt:number,baseMs:number,maxMs:number,jitterRatio:number):number. Mathematical formula min(maxMs,baseMs*2**attempt)*(1+jitterRatio); cap applies BEFORE jitter. Zero base or cap returns zero even for huge attempt; positive exponential overflow caps at maxMs; nonfinite final output throws RangeError. All inputs finite; attempt nonnegative integer; baseMs/maxMs nonnegative; jitterRatio in [0,1]. Invalid inputs throw RangeError. Only edit src/backoff.ts.',
    baseline: { 'src/backoff.ts': `export function calculateBackoff(attempt:number,baseMs:number,maxMs:number,jitterRatio:number):number { throw new Error('Not implemented'); }\n` },
    reference: { 'src/backoff.ts': `export function calculateBackoff(attempt:number,baseMs:number,maxMs:number,jitterRatio:number):number {\n if(![attempt,baseMs,maxMs,jitterRatio].every(Number.isFinite)||!Number.isInteger(attempt)||attempt<0||baseMs<0||maxMs<0||jitterRatio<0||jitterRatio>1) throw new RangeError('invalid input');\n if(baseMs===0||maxMs===0)return 0;\n const result=Math.min(maxMs,baseMs*2**attempt)*(1+jitterRatio);if(!Number.isFinite(result))throw new RangeError('overflow');return result;\n}\n` },
    tests: `const {calculateBackoff:f}=await import(SOURCE);\ntest('base',()=>assert.equal(f(0,100,5000,0),100));\ntest('scale',()=>{for(let i=1;i<=4;i++)assert.equal(f(i,100,5000,0),100*2**i);});\ntest('cap before jitter',()=>assert.equal(f(10,100,1000,.5),1500));\ntest('zero base/cap',()=>{assert.equal(f(3,0,100,0),0);assert.equal(f(3,100,0,1),0);});\ntest('jitter endpoints',()=>{assert.equal(f(1,100,1000,1),400);assert.equal(f(1,100,1000,.25),250);});\ntest('overflow domain',()=>{assert.equal(f(10000,0,100,1),0);assert.equal(f(10000,10,100,0),100);assert.equal(f(10000,10,0,1),0);assert.throws(()=>f(0,Number.MAX_VALUE,Number.MAX_VALUE,1),RangeError);});\ntest('invalid inputs',()=>{for(const args of [[-1,1,2,0],[.5,1,2,0],[0,-1,2,0],[0,1,-2,0],[0,1,2,-.1],[0,1,2,1.1],[Infinity,1,2,0],[0,NaN,2,0],[0,1,Infinity,0],[0,1,2,NaN]])assert.throws(()=>f(...args),RangeError);});`,
    entry: 'backoff.ts', expectedFailures: 7,
  },
  events: {
    allowed: ['src/events.ts','src/types.ts'],
    prompt: "Repair processEvent(evt:PortfolioEvent):EventResult using discriminant narrowing. active => 'active:'+name; paused => 'paused:'+reason; migration => 'migration:'+target. Retain the three event variants and string result. Exhaustive handling must assign unreachable evt to never so new variants fail compilation. No any, type assertion casts or @ts-ignore/@ts-nocheck. Only edit src/events.ts and src/types.ts.",
    baseline: { 'src/types.ts': types, 'src/events.ts': `import type {PortfolioEvent,EventResult} from './types.ts';\nexport function processEvent(evt:PortfolioEvent):EventResult {\n if(evt.kind==='migration')throw new Error('unhandled event');\n return evt.kind==='active'?'active:'+evt.name:'paused:'+evt.reason;\n}\n` },
    reference: { 'src/types.ts': types, 'src/events.ts': `import type {PortfolioEvent,EventResult} from './types.ts';\nexport function processEvent(evt:PortfolioEvent):EventResult {\n switch(evt.kind){case 'active':return 'active:'+evt.name;case 'paused':return 'paused:'+evt.reason;case 'migration':return 'migration:'+evt.target;}\n const exhaustive:never=evt;throw new Error(String(exhaustive));\n}\n` },
    tests: `const {processEvent:f}=await import(SOURCE);\nfor(const [kind,key] of [['active','name'],['paused','reason'],['migration','target']])for(const value of ['x',''])test(kind+' '+JSON.stringify(value),()=>assert.equal(f({kind,[key]:value}),kind+':'+value));`,
    entry: 'events.ts', expectedFailures: 2,
  },
};

function inventory(dir) {
  const entries = {};
  function visit(current) {
    for(const item of fs.readdirSync(current,{withFileTypes:true})) {
      const absolute=path.join(current,item.name), relative=path.relative(dir,absolute).split(path.sep).join('/');
      if(item.isSymbolicLink()) throw new Error('Symlink is outside supported scratch contract: '+relative);
      if(item.isDirectory())visit(absolute);else if(item.isFile())entries[relative]=digest(fs.readFileSync(absolute));else throw new Error('Unsupported file: '+relative);
    }
  }
  visit(dir);return Object.fromEntries(Object.entries(entries).sort(([a],[b])=>a.localeCompare(b)));
}
function writeTree(dir, files) {for(const [name,content] of Object.entries(files)){const target=path.join(dir,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);}}
function check(taskId, scratch, control) {
  const task=tasks[taskId];fs.mkdirSync(control,{recursive:true});
  const source=pathToFileURL(path.join(scratch,'src',task.entry)).href;
  const testFile=path.join(control,'acceptance.test.mjs');
  fs.writeFileSync(testFile,`import test from 'node:test';import assert from 'node:assert/strict';const SOURCE=${JSON.stringify(source)};\n${task.tests}\n`);
  // Resource guard for trusted local fixtures, not a malicious-code sandbox.
  const tests=spawnSync(process.execPath,['--permission','--allow-fs-read='+scratch,'--allow-fs-read='+control,'--test-reporter=tap',testFile],{encoding:'utf8',timeout:30000,cwd:control,env:{SystemRoot:process.env.SystemRoot, TEMP:process.env.TEMP, TMP:process.env.TMP}});
  const sourceFiles=Object.keys(task.baseline).map(name=>path.join(scratch,name));
  const typecheck=spawnSync(process.execPath,[compiler,'--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext','--allowImportingTsExtensions',...sourceFiles],{encoding:'utf8',timeout:30000});
  let staticPassed=true;
  if(taskId==='events'){
    const options={strict:true,noEmit:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,allowImportingTsExtensions:true};
    const program=ts.createProgram(sourceFiles,options),checker=program.getTypeChecker();
    let alias;
    for(const file of sourceFiles){
      const ast=program.getSourceFile(file),scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,ast.text);
      for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan()){
        if((token===ts.SyntaxKind.SingleLineCommentTrivia||token===ts.SyntaxKind.MultiLineCommentTrivia)&&/^[\s/*]*@ts-(?:ignore|nocheck)\b/.test(scanner.getTokenText()))staticPassed=false;
      }
      function walk(node){
        if(node.kind===ts.SyntaxKind.AnyKeyword||ts.isAsExpression(node)||ts.isTypeAssertionExpression(node))staticPassed=false;
        if(file.endsWith('types.ts')&&ts.isTypeAliasDeclaration(node)&&node.name.text==='PortfolioEvent')alias=node;
        ts.forEachChild(node,walk);
      }walk(ast);
    }
    // Preserve the exact public variants, rather than accepting a narrowed alias.
    if(!alias)staticPassed=false;
    else{
      const union=checker.getTypeAtLocation(alias);
      const variants=union.isUnion()?union.types:[];
      const expected={active:'name',paused:'reason',migration:'target'},seen=new Set();
      if(variants.length!==3)staticPassed=false;
      for(const variant of variants){
        const kind=variant.getProperty('kind'),kindType=kind&&checker.getTypeOfSymbolAtLocation(kind,alias);
        const value=kindType?.isStringLiteral()?kindType.value:undefined;
        const field=expected[value],property=field&&variant.getProperty(field);
        const fieldType=property&&checker.getTypeOfSymbolAtLocation(property,alias);
        if(!field||seen.has(value)||!fieldType||(fieldType.flags&ts.TypeFlags.String)===0||(property.flags&ts.SymbolFlags.Optional)!==0)staticPassed=false;
        seen.add(value);
      }
      const probe=path.join(control,'exhaustiveness');fs.mkdirSync(probe,{recursive:true});
      const original=fs.readFileSync(path.join(scratch,'src/types.ts'),'utf8');
      const expanded=original.slice(0,alias.type.getStart())+'('+original.slice(alias.type.getStart(),alias.type.end)+") | {kind:'unexpected';extra:string}"+original.slice(alias.type.end);
      writeTree(probe,{'package.json':'{"type":"module"}','events.ts':fs.readFileSync(path.join(scratch,'src/events.ts'),'utf8'),'types.ts':expanded});
      const probeProgram=ts.createProgram([path.join(probe,'events.ts'),path.join(probe,'types.ts')],options);
      const diagnostics=ts.getPreEmitDiagnostics(probeProgram);
      const genuine=diagnostics.some(d=>[2322,2345].includes(d.code)&&/never/.test(ts.flattenDiagnosticMessageText(d.messageText,' '))&&/unexpected/.test(ts.flattenDiagnosticMessageText(d.messageText,' ')));
      staticPassed=staticPassed&&genuine;
      fs.writeFileSync(path.join(control,'exhaustiveness.txt'),ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>control,getCanonicalFileName:x=>x,getNewLine:()=>"\n"}));
    }
  }
  fs.writeFileSync(path.join(control,'tests.txt'),tests.stdout+tests.stderr);fs.writeFileSync(path.join(control,'typecheck.txt'),typecheck.stdout+typecheck.stderr);
  return {testsPassed:tests.status===0,testsFailedCount:Number(tests.stdout.match(/# fail (\d+)/)?.[1]??-1),strictTypecheckPassed:typecheck.status===0,staticPassed};
}
function prepare(taskId) {
  const task=tasks[taskId];if(!task)throw new Error('Unknown task');
  const run=fs.mkdtempSync(path.join(root,'runs',taskId+'-'));
  const scratch=path.join(run,'scratch'),control=path.join(run,'control');fs.mkdirSync(scratch);fs.mkdirSync(control);
  writeTree(scratch,{...task.baseline,'package.json':'{"private":true,"type":"module"}\n'});
  const before=inventory(scratch),baseline=check(taskId,scratch,path.join(control,'baseline'));
  if(baseline.testsFailedCount!==task.expectedFailures||!baseline.strictTypecheckPassed)throw new Error('Unexpected baseline evidence');
  const fixtureHash=digest(JSON.stringify(before));
  const prompt=task.prompt+'\nDo not add, delete or edit other files. Do not install packages, access secrets or change permissions. Independent tests/typecheck are outside this scratch directory. Stop after implementing the requested source change.';
  fs.writeFileSync(path.join(control,'prompt.txt'),prompt);
  fs.writeFileSync(path.join(control,'manifest.json'),JSON.stringify({taskId,scratch,before,fixtureHash,allowed:task.allowed,baseline,createdAt:new Date().toISOString()},null,2));
  return {run,scratch,promptFile:path.join(control,'prompt.txt'),manifest:path.join(control,'manifest.json')};
}
function verify(run, trustedFixture=false) {
  const control=path.join(run,'control');const manifest=JSON.parse(fs.readFileSync(path.join(control,'manifest.json'),'utf8'));
  const after=inventory(manifest.scratch),changed=[...new Set([...Object.keys(manifest.before),...Object.keys(after)])].filter(p=>manifest.before[p]!==after[p]).sort();
  const unauthorized=changed.filter(p=>!manifest.allowed.includes(p)||!(p in after)||!(p in manifest.before));
  const verification=unauthorized.length===0&&trustedFixture
    ? {...check(manifest.taskId,manifest.scratch,path.join(control,'final')),checksExecuted:true}
    : {testsPassed:'NOT RUN',testsFailedCount:'NOT RUN',strictTypecheckPassed:'NOT RUN',staticPassed:'NOT RUN',checksExecuted:false};
  const result={experimentId:'MUSE-001',taskId:manifest.taskId,timestamp:new Date().toISOString(),verificationStatus:unauthorized.length>0?'FAIL':!trustedFixture?'NOT RUN':verification.testsPassed&&verification.strictTypecheckPassed&&verification.staticPassed?'PASS':'FAIL',verification:{...verification,baselineFailed:true,unauthorizedFiles:unauthorized},metrics:{changedFiles:changed,filesChangedCount:changed.length,wallClockSeconds:'unknown',modelStepsCount:'unknown',toolCallsCount:'unknown',retries:'unknown',rework:'unknown',tokensPrompt:'unknown',tokensCompletion:'unknown',estimatedCostUsd:'unknown'},provenance:{fixtureHash:manifest.fixtureHash,nodeVersion:process.version,compiler,scratchDirectory:manifest.scratch},limitations:['File hashes observe scratch changes, not a security sandbox or out-of-scratch access monitor.','No network isolation is enforced by this harness.','Acceptance PASS alone does not establish agent budget or repeatability thresholds.']};
  fs.writeFileSync(path.join(control,'verification.json'),JSON.stringify(result,null,2));return result;
}
fs.mkdirSync(path.join(root,'runs'),{recursive:true});
const [command,arg]=process.argv.slice(2);
if(command==='prepare-run')console.log(JSON.stringify(prepare(arg),null,2));
else if(command==='verify-run'){const result=verify(path.resolve(arg));console.log(JSON.stringify(result,null,2));if(result.verificationStatus!=='PASS')process.exitCode=1;}
else if(command==='selftest'){
  const results=[];
  for(const taskId of Object.keys(tasks)){
    const prepared=prepare(taskId);writeTree(prepared.scratch,tasks[taskId].reference);const accepted=verify(prepared.run,true);if(accepted.verificationStatus!=='PASS')throw new Error('Reference failed '+taskId);fs.writeFileSync(path.join(prepared.run,'control/reference-verification.json'),JSON.stringify(accepted,null,2));
    if(taskId==='events'){
      const valid={...tasks.events.reference,'src/types.ts':types.replace('export type PortfolioEvent =', '/* any as ordinary prose */ export type PortfolioEvent\n ='), 'src/events.ts':`import type {PortfolioEvent as Input,EventResult as Output} from './types.ts';
function assertNever(value:never):never {throw new Error(String(value));}
export function processEvent(input:Input):Output {
 switch(input.kind){case 'active':return 'active:'+input.name;case 'paused':return 'paused:'+input.reason;case 'migration':return 'migration:'+input.target;default:return assertNever(input);}
}`};
      writeTree(prepared.scratch,valid);
      const positive=verify(prepared.run,true);if(positive.verificationStatus!=='PASS')throw new Error('Reformatted alias/assertNever rejected');
      fs.writeFileSync(path.join(prepared.run,'control/events-positive.json'),JSON.stringify(positive,null,2));
      const negatives={
        any:valid['src/events.ts'].replace('value:never','value:any'),
        cast:valid['src/events.ts'].replace('assertNever(input)','assertNever(input as never)'),
        suppression:'// @ts-nocheck\n'+valid['src/events.ts'],
        missingExhaustiveness:valid['src/events.ts'].replace('assertNever(input)',"'unknown'"),
      };
      for(const [name,code] of Object.entries(negatives)){
        writeTree(prepared.scratch,{...valid,'src/events.ts':code});
        const result=verify(prepared.run,true);if(result.verificationStatus!=='FAIL'||result.verification.staticPassed)throw new Error('Event rejection missed '+name);
        fs.writeFileSync(path.join(prepared.run,'control/events-negative-'+name+'.json'),JSON.stringify(result,null,2));
      }
      writeTree(prepared.scratch,{...valid,'src/types.ts':`export type PortfolioEvent={kind:'active';name:string}|{kind:'paused';reason:string};export type EventResult=string;`});
      if(verify(prepared.run,true).verification.staticPassed)throw new Error('Removed public variant accepted');
      writeTree(prepared.scratch,tasks.events.reference);
    }
    const protectedFile=path.join(prepared.scratch,'package.json');
    const original=fs.readFileSync(protectedFile);
    const outcomes=[];
    for(const mode of ['added','modified','deleted']) {
      if(mode==='added')fs.writeFileSync(path.join(prepared.scratch,'unexpected.txt'),'tamper');
      if(mode==='modified')fs.writeFileSync(protectedFile,'{}');
      if(mode==='deleted')fs.unlinkSync(protectedFile);
      const tamper=verify(prepared.run,true);
      if(tamper.verificationStatus!=='FAIL'||tamper.verification.unauthorizedFiles.length!==1||tamper.verification.checksExecuted!==false)throw new Error('Tamper ran checks: '+mode);
      fs.writeFileSync(path.join(prepared.run,'control',mode+'-tamper.json'),JSON.stringify(tamper,null,2));
      if(mode==='added')fs.unlinkSync(path.join(prepared.scratch,'unexpected.txt'));else fs.writeFileSync(protectedFile,original);
      outcomes.push(mode);
    }
    results.push({taskId,baselineFailures:tasks[taskId].expectedFailures,reference:'PASS',...(taskId==='events'?{eventVerifierTests:['reformatted alias and assertNever accepted','any rejected','cast rejected','suppression rejected','missing exhaustiveness rejected','removed variant rejected']}:{}),rejectBeforeExecution:outcomes,run:prepared.run});
  }
  const evidence={selftest:'PASS',timestamp:new Date().toISOString(),nodeVersion:process.version,results};fs.writeFileSync(path.join(root,'selftest.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
}else throw new Error('Use selftest | prepare-run slicer|backoff|events | verify-run <run-directory>');





