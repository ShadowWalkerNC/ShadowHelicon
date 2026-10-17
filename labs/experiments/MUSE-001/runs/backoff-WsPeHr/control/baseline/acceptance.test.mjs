import test from 'node:test';import assert from 'node:assert/strict';const SOURCE="file:///C:/Users/white/Documents/GitHub/MuseAiBots/experiments/MUSE-001/runs/backoff-WsPeHr/scratch/src/backoff.ts";
const {calculateBackoff:f}=await import(SOURCE);
test('base',()=>assert.equal(f(0,100,5000,0),100));
test('scale',()=>{for(let i=1;i<=4;i++)assert.equal(f(i,100,5000,0),100*2**i);});
test('cap before jitter',()=>assert.equal(f(10,100,1000,.5),1500));
test('zero base/cap',()=>{assert.equal(f(3,0,100,0),0);assert.equal(f(3,100,0,1),0);});
test('jitter endpoints',()=>{assert.equal(f(1,100,1000,1),400);assert.equal(f(1,100,1000,.25),250);});
test('overflow domain',()=>{assert.equal(f(10000,0,100,1),0);assert.equal(f(10000,10,100,0),100);assert.equal(f(10000,10,0,1),0);assert.throws(()=>f(0,Number.MAX_VALUE,Number.MAX_VALUE,1),RangeError);});
test('invalid inputs',()=>{for(const args of [[-1,1,2,0],[.5,1,2,0],[0,-1,2,0],[0,1,-2,0],[0,1,2,-.1],[0,1,2,1.1],[Infinity,1,2,0],[0,NaN,2,0],[0,1,Infinity,0],[0,1,2,NaN]])assert.throws(()=>f(...args),RangeError);});
