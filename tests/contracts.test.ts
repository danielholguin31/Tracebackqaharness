import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testSchema,pageNumber} from '../server/lib/validation';
import {selectedViewports,dimensions} from '../server/lib/runner';
import {encrypt,decrypt} from '../server/lib/secrets';
test('rejects malformed or non-browser URLs and empty definitions',()=>{for(const entryPoint of ['javascript:alert(1)','file:///etc/passwd','bad'])assert.equal(testSchema.safeParse({name:'Test',mode:'autonomous',entryPoint}).success,false);assert.equal(testSchema.safeParse({name:'',mode:'deterministic',entryPoint:'https://example.com'}).success,false);});
test('normalizes invalid pagination and duplicate viewports',()=>{for(const page of ['0','-1','NaN','Infinity'])assert.equal(pageNumber(page),1);assert.deepEqual(selectedViewports('{"mode":"multi","multi":["mobile","mobile","desktop"]}'),['mobile','desktop']);assert.deepEqual(dimensions('mobile'),{width:390,height:844});});
test('encrypted credentials round-trip and fail on tampering',()=>{const plain='test-only-not-a-real-secret';const encrypted=encrypt(plain);assert.ok(!encrypted.includes(plain));assert.equal(decrypt(encrypted),plain);assert.throws(()=>decrypt(encrypted.slice(0,-2)+'00'));});
