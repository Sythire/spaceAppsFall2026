import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSiteCatalogue} from '../src/services/siteCatalogue.ts';
import {referenceSites} from '../src/constants/referenceSites.ts';

test('a responding service supplies the current site catalogue',async()=>{
 const live=[{...referenceSites[0],name:'Updated mission name'}];
 assert.equal(await loadSiteCatalogue(async()=>live),live);
});
test('an offline service still exposes sourced landing-site metadata',async()=>{
 const sites=await loadSiteCatalogue(async()=>{throw new Error('Offline');});
 assert.equal(sites,referenceSites);
 assert.equal(sites.filter(s=>s.kind==='historical').length,6);
 assert.ok(sites.every(s=>Math.abs(s.latitudeDeg)<=90&&Math.abs(s.longitudeDeg)<=180));
});
test('an empty catalogue falls back to known sites',async()=>{
 assert.equal(await loadSiteCatalogue(async()=>[]),referenceSites);
});
test('a stalled API does not block site selection',async()=>{
 assert.equal(await loadSiteCatalogue(()=>new Promise(()=>{}),5),referenceSites);
});
