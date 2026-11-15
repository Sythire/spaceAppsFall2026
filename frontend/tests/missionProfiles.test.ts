import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradeMetric, MISSION_PROFILES } from '../src/utils/missionProfiles.ts';

const p = (id: string) => MISSION_PROFILES.find(x => x.id === id)!;

test('every graded limit has a numeric threshold and a linked source', () => {
 for (const profile of MISSION_PROFILES) {
  assert.ok(profile.criteria.length > 0, profile.id);
  for (const c of profile.criteria) {
   assert.match(c.source.url, /^https:\/\//, `${profile.id}/${c.metric}`);
   if (c.kind === 'max' || c.kind === 'min') assert.ok(Number.isFinite(c.limit), `${profile.id}/${c.metric}`);
  }
 }
});

test('max limits: green with margin, yellow within 20%, red beyond (crewed HLS slope 10°)', () => {
 const crewed = p('crewed');
 assert.equal(gradeMetric(crewed, 'slope', 3).grade, 'good');
 assert.equal(gradeMetric(crewed, 'slope', 8).grade, 'good');      // exactly at the band edge counts as good
 assert.equal(gradeMetric(crewed, 'slope', 9).grade, 'edge');
 assert.equal(gradeMetric(crewed, 'slope', 10).grade, 'edge');     // at the limit = at risk, not failed
 assert.equal(gradeMetric(crewed, 'slope', 10.5).grade, 'bad');
});

test('min limits: 6.5 days continuous sunlight for crewed landing', () => {
 const crewed = p('crewed');
 assert.equal(gradeMetric(crewed, 'longestSunlit', 354).grade, 'good');
 assert.equal(gradeMetric(crewed, 'longestSunlit', 170).grade, 'edge');
 assert.equal(gradeMetric(crewed, 'longestSunlit', 100).grade, 'bad');
});

test('the same number grades differently per mission type', () => {
 assert.equal(gradeMetric(p('crewed'), 'slope', 12).grade, 'bad');        // > 10° landing limit
 assert.equal(gradeMetric(p('solar-rover'), 'slope', 12).grade, 'good');  // 12° is fine for a 15° drive limit
 assert.equal(gradeMetric(p('solar-rover'), 'slope', 13).grade, 'edge');  // 12–15° = near the limit
 assert.equal(gradeMetric(p('robotic-lander'), 'slope', 12).grade, 'edge');
 assert.equal(gradeMetric(p('ice'), 'dayMaxTemp', 90).grade, 'good');     // a cold trap is what an ice mission wants
 assert.equal(gradeMetric(p('ice'), 'dayMaxTemp', 390).grade, 'bad');
});

test('ice cold trap uses a tight 5% band around 110 K', () => {
 const ice = p('ice');
 assert.equal(gradeMetric(ice, 'dayMaxTemp', 104).grade, 'good');
 assert.equal(gradeMetric(ice, 'dayMaxTemp', 108).grade, 'edge');
 assert.equal(gradeMetric(ice, 'dayMaxTemp', 111).grade, 'bad');
});

test('no mission → ungraded; no published limit → not relevant (grey); missing data → not graded (black)', () => {
 assert.equal(gradeMetric(null, 'slope', 30).grade, 'na');
 assert.equal(gradeMetric(p('crewed'), 'earthVisible', 0).grade, 'irrelevant');   // no published number for crewed
 assert.equal(gradeMetric(p('ice'), 'slope', 40).grade, 'irrelevant');
 assert.equal(gradeMetric(p('crewed'), 'slope', null).grade, 'unknown');          // relevant, but no data
 assert.equal(gradeMetric(p('crewed'), 'slope', NaN).grade, 'unknown');
 assert.match(gradeMetric(p('crewed'), 'slope', null).reason, /not available/i);
});

test('card classes: real verdicts beat missing data, which beats not relevant; no mission → plain card', async () => {
 const { combineGrades, gradeClass } = await import('../src/utils/missionProfiles.ts');
 assert.equal(combineGrades('irrelevant', 'good'), 'good');
 assert.equal(combineGrades('good', 'bad'), 'bad');
 assert.equal(combineGrades('irrelevant', 'unknown'), 'unknown');
 assert.equal(combineGrades('irrelevant', 'irrelevant'), 'irrelevant');
 assert.equal(gradeClass(null, 'bad'), '');
 assert.equal(gradeClass(p('crewed')), ' graded-irrelevant');                      // ungradeable card
 assert.equal(gradeClass(p('crewed'), 'unknown'), ' graded-unknown');
 assert.equal(gradeClass(p('crewed'), 'edge'), ' graded-edge');
});
