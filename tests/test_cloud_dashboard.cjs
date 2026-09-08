const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(require('node:path').join(__dirname, '../docs/index.html'), 'utf8');
const elements = new Map(), lines = [], dots = [], labels = [];
const ctx = new Proxy({
 lineTo(x,y){lines.push({color:this.strokeStyle,x,y});},
 arc(){dots.push(this.fillStyle);},
 fillText(text){labels.push(text);}
}, {get:(o,k)=>o[k]||(()=>{})});
function element(id){
 if(!elements.has(id))elements.set(id,{style:{},needle:{style:{}},textContent:'',
 querySelector(){return this.needle;},setAttribute(){},remove(){},
 getBoundingClientRect(){return {width:800,height:230};},getContext(){return ctx;}});
 return elements.get(id);
}
const sandbox={document:{getElementById:element,createElement:()=>({}),head:{appendChild(){}}},window:{addEventListener(){}},devicePixelRatio:1,setTimeout(){},console};
vm.createContext(sandbox);
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],sandbox);
const now=Date.now();
function receive(offsets){
 lines.length=0;dots.length=0;labels.length=0;
 sandbox.data={ok:true,history:offsets.map((s,i)=>({timestamp:new Date(now-s*1000).toISOString(),device_id:'esp8266-01',temperature:25+i,humidity:60+i}))};
 vm.runInContext('receiveStationData(data)',sandbox);
}
receive([180,120,60]);
assert.equal(lines.filter(p=>p.color==='#efb72d').length,2,'minute samples must form temperature line');
assert.equal(lines.filter(p=>p.color==='#7f9fa6').length,2,'minute samples must form humidity line');
assert.equal(dots.length,6,'all measured points must be visible');
assert(labels.filter(s=>/^\d{2}:\d{2}$/.test(s)).length>=3);
assert.match(element('cadence').textContent,/60\.0 秒/);
receive([240,60]);
assert.equal(lines.filter(p=>p.color==='#efb72d').length,0,'missing uploads must remain a gap');
assert.equal(dots.length,4);
receive([60]);
assert.match(element('cadence').textContent,/尚需兩筆/);
receive([900]);
assert.equal(dots.length,0);
assert.match(element('empty').textContent,/沒有新資料/);
sandbox.data={ok:true,history:[{timestamp:'2026-09-08T23:49:19.142Z',temperature:30.7,humidity:86}]};
vm.runInContext('receiveStationData(data)',sandbox);
assert.equal(vm.runInContext("taipeiTime(Date.parse('2026-09-08T23:49:19.142Z')/1000)",sandbox),'2026/09/09 07:49:19');
const csv=vm.runInContext('csvContent()',sandbox);
assert.match(csv,/時間（臺灣 UTC\+8）/);
assert.match(csv,/2026\/09\/09 07:49:19,30.7,86/);
assert.match(element('updated').textContent,/2026\/09\/09 07:49:19/);
console.log('PASS: minute curves, all points, missing data gaps, clock labels, cadence and Taiwan CSV timestamps.');
