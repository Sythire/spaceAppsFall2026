import {test} from 'node:test';
import assert from 'node:assert/strict';
import {candidateSites,mockAnalysis} from '../src/constants/mockData.ts';
import {comparisonTimeline} from '../src/utils/comparisonTimeline.ts';
import type {TimelinePoint} from '../src/types';

function result(index:number,timeline:TimelinePoint[]){
 const value=mockAnalysis({location:candidateSites[index],utc:'2026-11-15T12:00:00Z'});
 return {...value,illumination:{...value.illumination,timeline}};
}
const point=(hour:number,elevation:number):TimelinePoint=>({hour,sunlightPercent:50,earthVisibilityPercent:100,sun:{elevationDeg:elevation,azimuthDeg:90,distanceKm:149597870,aboveHorizon:elevation>0}});

test('compared curves align by elapsed hour when a site is missing a sample',()=>{
 const chart=comparisonTimeline([result(0,[point(0,-10),point(1,0),point(2,10)]),result(1,[point(0,30),point(2,40)])]);
 assert.equal(chart.hasElevation,true);
 assert.deepEqual(chart.samples.map(p=>p.values),[
  {'demo-a':-10,'demo-b':30},{'demo-a':0,'demo-b':null},{'demo-a':10,'demo-b':40},
 ]);
});
test('result order does not change the identity of a site’s values',()=>{
 const a=result(0,[point(0,10)]),b=result(1,[point(0,20)]);
 assert.deepEqual(comparisonTimeline([a,b]).samples,comparisonTimeline([b,a]).samples);
});
test('time samples are sorted and the full shared interval is retained',()=>{
 const chart=comparisonTimeline([result(0,[point(2,20),point(0,0)]),result(1,[point(1,10)])]);
 assert.deepEqual(chart.samples.map(p=>p.hour),[0,1,2]);
 assert.equal(chart.samples[2].values['demo-b'],null);
});
test('demo fixtures use percentages for every site, without mixing percent and degrees',()=>{
 const chart=comparisonTimeline([result(0,[point(0,10)]),result(1,[{hour:0,sunlightPercent:72,earthVisibilityPercent:100}])]);
 assert.equal(chart.hasElevation,false);
 assert.deepEqual(chart.samples[0].values,{'demo-a':50,'demo-b':72});
});
test('non-finite values create chart gaps rather than drawing invented readings',()=>{
 const chart=comparisonTimeline([result(0,[point(0,0),point(1,NaN)]),result(1,[point(0,20),point(1,Infinity)])]);
 assert.deepEqual(chart.samples[1].values,{'demo-a':null,'demo-b':null});
});
test('an empty selection yields no graph samples',()=>{
 assert.deepEqual(comparisonTimeline([]),{samples:[],hasElevation:false});
});
