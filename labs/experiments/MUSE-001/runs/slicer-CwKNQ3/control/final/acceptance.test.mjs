import test from 'node:test';import assert from 'node:assert/strict';const SOURCE="file:///C:/Users/white/Documents/GitHub/MuseAiBots/experiments/MUSE-001/runs/slicer-CwKNQ3/scratch/src/slicer.ts";
const {sliceRange:f}=await import(SOURCE);
test('exclusive end',()=>assert.deepEqual(f([1,2,3],0,2),[1,2]));
test('negative clamp',()=>assert.deepEqual(f([1,2,3],-2,2),[1,2]));
test('empty',()=>assert.deepEqual(f([],0,0),[]));
test('large end',()=>assert.deepEqual(f([1,2],0,100),[1,2]));
test('empty reversed',()=>{assert.deepEqual(f([1,2],2,1),[]);const a=[1,2];const b=f(a,0,0);assert.deepEqual(b,[]);assert.notEqual(a,b);assert.deepEqual(a,[1,2]);});
