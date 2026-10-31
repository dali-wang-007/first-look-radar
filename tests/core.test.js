import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, validateReport, readModelResult } from '../server/analysis.js';
import { hashPassword, verifyPassword, validateCredentials } from '../server/security.js';
import { report, jpeg } from './fixtures.js';

test('accepts a photo and rejects fake MIME, missing consent and unknown scenes',()=>{
  const input={image:jpeg,scene:'avatar',goal:'clear',consent:true};
  assert.equal(validateInput(input).scene,'avatar');
  for(const mutation of [{image:'data:image/jpeg;base64,PHNjcmlwdD4='},{consent:false},{scene:'anything'},{image:jpeg+'A'.repeat(2_100_000)}]) assert.throws(()=>validateInput({...input,...mutation}));
});
test('report requires five distinct axes, bounded levels and actionable evidence',()=>{
  assert.equal(validateReport(report()).dimensions.length,5);
  for(const change of [r=>r.dimensions[0].level=6,r=>r.dimensions[1].name='明快感',r=>r.highlights=[],r=>r.suggestions[0].reason='',r=>r.summary='你的智商很高，性格温柔，适合做管理者。']) {
    const r=report();change(r);assert.throws(()=>validateReport(r));
  }
});
test('model refusals and malformed results never turn into sample reports',()=>{
  assert.throws(()=>readModelResult({response:'not json'}));
  assert.throws(()=>readModelResult({response:JSON.stringify({canAnalyze:false,reason:'请上传面部清晰的单人照片。'})}),/单人/);
  assert.equal(readModelResult({response:JSON.stringify({canAnalyze:true,report:report()})}).title,'清爽利落，自然有光');
});
test('report rejects unsupported personality, age/ethnicity and claimed stranger reactions',()=>{
 for(const summary of ['你天生善良、诚实可靠，做事自律，遇到压力也能保持冷静。','陌生人看到你会立刻信任你，认为你很专业，会愿意与你合作。','你看起来只有二十五岁，是典型的东亚女性，事业一定发展顺利。']){
  const r=report();r.summary=summary;assert.throws(()=>validateReport(r));
 }
});
test('salted password verification rejects wrong passwords and bad usernames',async()=>{
  const first=await hashPassword('My-strong-password');
  const second=await hashPassword('My-strong-password');
  assert.notEqual(first,second);
  assert.equal(await verifyPassword('My-strong-password',first),true);
  assert.equal(await verifyPassword('wrong-password',first),false);
  assert.throws(()=>validateCredentials({username:'ab',password:'123'}));
  assert.throws(()=>validateCredentials({username:'<script>',password:'12345678901'}));
  assert.equal(validateCredentials({username:'Alice_01',password:'12345678901'}).username,'alice_01');
});
