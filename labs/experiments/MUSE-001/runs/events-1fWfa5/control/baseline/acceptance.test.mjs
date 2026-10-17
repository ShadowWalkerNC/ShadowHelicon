import test from 'node:test';import assert from 'node:assert/strict';const SOURCE="file:///C:/Users/white/OneDrive/Documents/GitHub/ShadowHelicon/labs/experiments/MUSE-001/runs/events-1fWfa5/scratch/src/events.ts";
const {processEvent:f}=await import(SOURCE);
for(const [kind,key] of [['active','name'],['paused','reason'],['migration','target']])for(const value of ['x',''])test(kind+' '+JSON.stringify(value),()=>assert.equal(f({kind,[key]:value}),kind+':'+value));
