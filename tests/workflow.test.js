const test = require('node:test');
const assert = require('node:assert/strict');
const {scoreOne, analyze, safeDomain} = require('../scoring');
const {researchWebsite, isPublicIP} = require('../websiteResearch');
const base = {name:'PeopleFlow', industry:'HR Software', product:'HR employee management and attendance', customers:'Small and medium businesses'};
test('missing product has partial evidence coverage', () => {
 const x=scoreOne(base,{name:'Zoho',industry:'Business Software',product:'Software Suite, Finance, Cloud Software',customers:'Businesses',website:'https://www.zoho.com/'});
 assert.equal(x.factors.product,null); assert.equal(x.coverage,55); assert.ok(x.warnings.some(w=>w.includes('55%')));
});
test('full product, customer, industry evidence is 100% coverage',()=>{
 const x=scoreOne(base,{name:'Payroll',industry:'HR Software',product:'Payroll processing',customers:'Small and medium businesses'});
 assert.equal(x.coverage,100); assert.equal(x.factors.product,95);
});
test('empty and repeated names are handled',()=>{
 const a=analyze(base,[{name:' '},{name:'One',website:'https://www.example.com'},{name:'one',website:'https://example.com'}]);
 assert.equal(a.stats.unique,1); assert.equal(a.stats.duplicates,1);
});
test('safe domain rejects malformed URLs',()=>{assert.equal(safeDomain('not a domain'),'');assert.equal(safeDomain('https://www.example.com/'),'example.com')});
test('private IP ranges rejected',()=>{for(const ip of ['127.0.0.1','10.1.1.1','192.168.1.1','169.254.2.1','::1']) assert.equal(isPublicIP(ip),false)});
test('research blocks localhost without connecting',async()=>{const x=await researchWebsite('http://localhost');assert.equal(x.status,'Failed')});
