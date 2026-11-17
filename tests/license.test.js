import test from 'node:test';
import assert from 'node:assert/strict';
import {KEY_REGEX,DEVICE_REGEX,keyHash,newKey,cleanName,publicDecision,publicLicense,statusOf} from '../lib/common.js';

test('random license keys have valid format and adequate uniqueness',()=>{
  const keys=Array.from({length:200},newKey);
  assert.equal(new Set(keys).size,200);
  for(const key of keys){assert.match(key,KEY_REGEX);assert.ok(!/[0O1I]/.test(key.replace('BM-TRIPO-', '')));}
});
test('key hashes are stable, normalized and not plaintext',()=>{
  const key=newKey();assert.equal(keyHash(key),keyHash('  '+key.toLowerCase()+'  '));assert.equal(keyHash(key).length,64);assert.ok(!keyHash(key).includes('BM-TRIPO-'));
});
test('Device ID format and names validated',()=>{
  assert.match('bmdev_01234567-89ab-4cde-8fab-123456789012',DEVICE_REGEX);
  assert.doesNotMatch('fake-hardware-id',DEVICE_REGEX);
  assert.equal(cleanName('  Sali\x00h\n  '),'Salih');
});
test('rejects invalid, expired, revoked and device mismatches',()=>{
  const current={id:'1',status:'active',device_id:'bmdev_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',expires_at:null};
  assert.equal(publicDecision(null,current.device_id,true).code,'INVALID_KEY');
  assert.equal(publicDecision({...current,status:'revoked'},current.device_id,true).code,'REVOKED');
  assert.equal(publicDecision({...current,expires_at:'2000-01-01T00:00:00Z'},current.device_id,true).code,'EXPIRED');
  assert.equal(publicDecision(current,'bmdev_ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee',true).code,'DEVICE_MISMATCH');
  assert.equal(publicDecision({...current,device_id:null},current.device_id,false).code,'NOT_ACTIVATED');
  assert.equal(publicDecision(current,current.device_id,false),null);
  assert.equal(publicDecision({...current,device_id:null},current.device_id,true),null);
});
test('public license data does not contain secrets',()=>{
  const row={id:'x',key_hash:'deadbeef',key_tail:'ABCDE',customer:'Test',plan:'Pro',status:'active',check_count:10};
  const r=publicLicense(row);assert.equal(statusOf(row),'active');assert.ok(!JSON.stringify(r).includes('deadbeef'));assert.equal(r.checkCount,10);assert.ok(r.keyMasked.includes('ABCDE'));
});
