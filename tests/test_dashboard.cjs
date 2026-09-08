// Isolated browser-logic test. Test values are never sent to the running monitor.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Map();
const context2d = new Proxy({}, {get: (o, k) => o[k] || (() => {}), set: (o, k, v) => (o[k] = v, true)});
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    style: {}, textContent: '', innerHTML: '', attributes: {}, needle: {style: {}},
    querySelector() { return this.needle; },
    setAttribute(k,v) { this.attributes[k] = v; },
    getBoundingClientRect() { return {width: 800, height: 230}; },
    getContext() { return context2d; }
  });
  return elements.get(id);
}
let response = {status:'live', port:'COM99', message:'test', latest:{timestamp:Date.now()/1000,temperature:25,humidity:60},history:[]};
const sandbox = {document:{getElementById:element}, window:{addEventListener(){}}, devicePixelRatio:1, Date, Math, console, AbortSignal,
  setTimeout(){}, fetch:async()=>({ok:true,json:async()=>response})};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
(async()=>{
  await vm.runInContext('poll()',sandbox);
  assert.equal(element('temp').textContent,'25.0');
  assert.equal(element('tempDial').needle.style.transform,'rotate(0deg)');
  assert.equal(element('humidityDial').needle.style.transform,'rotate(24deg)');
  assert.equal(element('tempDial').needle.style.visibility,'visible');
  response = {...response,status:'disconnected'};
  await vm.runInContext('poll()',sandbox);
  assert.equal(element('temp').textContent,'—');
  assert.equal(element('tempDial').needle.style.visibility,'hidden');
  response = {...response,status:'live',latest:{...response.latest,timestamp:Date.now()/1000-20}};
  await vm.runInContext('poll()',sandbox);
  assert.equal(element('humidity').textContent,'—');
  assert.equal(element('humidityDial').needle.style.visibility,'hidden');
  console.log('PASS: live gauges, disconnect, and stale data display.');
})().catch(e=>{console.error(e);process.exitCode=1});
