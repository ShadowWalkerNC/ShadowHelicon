import test from 'node:test';import assert from 'node:assert/strict';
import {createReadOnlyConnector,createSimulatedDocuments} from './connector.mjs';
test('missing service and rejected callbacks return bounded errors',async()=>{
 const request={version:1,method:'resources.list'};
 assert.equal((await createReadOnlyConnector({permissions:['read']})(request)).error.code,'SERVICE_UNAVAILABLE');
 const service={list:async()=>{throw new Error('private provider detail');},read:async()=>{throw new Error('private detail');}};
 const handle=createReadOnlyConnector({permissions:['read'],service});
 assert.deepEqual(await handle(request),{ok:false,error:{code:'SERVICE_UNAVAILABLE'}});
 assert.deepEqual(await handle({version:1,method:'resources.read',params:{uri:'sim://x'}}),{ok:false,error:{code:'SERVICE_UNAVAILABLE'}});
});
test('versioned synthetic list/read and missing resource',async()=>{const handle=createReadOnlyConnector({permissions:['read'],service:createSimulatedDocuments()});const list=await handle({version:1,method:'resources.list'});assert.equal(list.version,1);assert.equal(list.resources.length,1);const read=await handle({version:1,method:'resources.read',params:{uri:list.resources[0].uri}});assert.match(read.resource.text,/Synthetic/);assert.equal((await handle({version:1,method:'resources.read',params:{uri:'sim://absent'}})).error.code,'NOT_FOUND');});
test('mutations denied before any domain callback',async()=>{let calls=0;const handle=createReadOnlyConnector({permissions:['read','write'],service:{list:()=>{calls++;},read:()=>{calls++;}}});for(const method of ['resources.write','database.query','tools.call'])assert.equal((await handle({version:1,method})).error.code,'UNSUPPORTED_OPERATION');assert.equal(calls,0);});
test('client grants cannot obtain read permission',async()=>{let calls=0;const handle=createReadOnlyConnector({service:{list:()=>{calls++;},read:()=>{calls++;}}});assert.equal((await handle({version:1,method:'resources.list',permissions:['read'],approved:true})).error.code,'PERMISSION_DENIED');assert.equal(calls,0);});
test('invalid envelopes/params rejected without callbacks',async()=>{let calls=0;const handle=createReadOnlyConnector({permissions:['read'],service:{list:()=>{calls++;},read:()=>{calls++;}}});for(const request of [null,[],{version:2,method:'resources.list'},{version:1,method:1}])assert.equal((await handle(request)).error.code,'INVALID_REQUEST');for(const params of [null,[],{}, {uri:42}])assert.equal((await handle({version:1,method:'resources.read',params})).error.code,'INVALID_PARAMS');assert.equal(calls,0);});
