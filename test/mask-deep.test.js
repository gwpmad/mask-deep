const assert = require('assert');
const maskDeep = require('../mask-deep');

describe('mask deep', () => {
  it('should mask all requested elements of an array', () => {
    const source = [{ a: 1, b: 2 }, { b: 'dd', c: 'xx' }];
    const omit = ['b', 'c'];
    const expected = [{ a: 1, b: '*' }, { b: '**', c: '**' }];
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should completely mask anything 3 characters and under and 80% of anything over', () => {
    const source = [{ a: 1, b: 'aaa' }, { b: 'aaaaaa', c: 'a' }];
    const omit = ['b', 'c'];
    const expected = [{ a: 1, b: '***' }, { b: '*****a', c: '*' }];
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask all requested objects', () => {
    const source = { a: 1, b: 2, c: { a: { a: 1, b: 2 }, d: 4 }, d: { a: 1, b: 'aaaaaaaaa', d: 4 } };
    const omit = ['b'];
    const expected = { a: 1, b: '*', c: { a: { a: 1, b: '*' }, d: 4 }, d: { a: 1, b: '*******aa', d: 4 } };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask a certain percentage (if configured) but totally mask anything >=3 characters', () => {
    const source = { a: 1, b: 222, c: { a: { a: 1, b: 2 }, d: 4 }, d: { a: 1, b: 'aaaaaaaaa', d: 4 } };
    const omit = ['b'];
    const expected = { a: 1, b: '***', c: { a: { a: 1, b: '*' }, d: 4 }, d: { a: 1, b: '*****aaaa', d: 4 } };
    assert.deepEqual(maskDeep(source, omit, { percentage: 60 }), expected);
  });

  it('should mask dates and date strings', () => {
    const source = { a: { b: '01-03-2000 00:00:00' }, b: new Date('01-03-2000 00:00:00'), c: 4 };
    const omit = ['b'];
    const expected = { a: { b: '***************0:00' }, b: '*******************************00 (GMT)', c: 4 };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask multiple keys from complex structures', () => {
    const source = { a: 1, b: 2, c: [{ a: 1, b: 'longer string' }, { a: { a: 1, b: 2 }, d: 4 }], d: [{ a: 1, b: 2, d: 4 }, { a: 1, b: 2, d: 4 }] };
    const omit = ['b'];
    const expected = { a: 1, b: '*', c: [{ a: 1, b: '**********ing' }, { a: { a: 1, b: '*' }, d: 4 }], d: [{ a: 1, b: '*', d: 4 }, { a: 1, b: '*', d: 4 }] };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask everything inside an object/array', () => {
    const source = { a: 1, b: 2, c: [{ a: 'maskme', b: 'maskme' }, { a: { a: 'maskme', b: 'maskme' }, d: 'maskme' }], d: [{ c: { a: 'maskme' } }] };
    const omit = ['c'];
    const expected = { a: 1, b: 2, c: [{ a: '*****e', b: '*****e' }, { a: { a: '*****e', b: '*****e' }, d: '*****e' }], d: [{ c: { a: '*****e' } }] };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask instances of "?keyToMask=" or "&keyToMask=" in otherwise-non-masked strings and mask their values', () => {
    const source = { a: 1, b: 2, e: 'blahblah?c=maskThis', d: [{ f: '/url-path?d=dontMask&c=maskThis', c: /* should be fully masked because key is c */'/url-path?d=dontMask&c=maskThis' }] };
    const omit = ['c'];
    const expected = { a: 1, b: 2, e: 'blahblah?c=******is', d: [{ f: '/url-path?d=dontMask&c=******is', c: '*************************skThis' }] };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should correctly mask a query string in a url if passed only that', () => {
    const source = 'https://www.google.co.uk/search?q=shouldbemasked&oq=abc&aqs=shouldbemasked';
    const omit = ['q', 'aqs'];
    const expected = 'https://www.google.co.uk/search?q=***********ked&oq=abc&aqs=***********ked';
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should just return other values', () => {
    assert.deepEqual(maskDeep('a string', ['a', 'b']), 'a string');
    assert.deepEqual(maskDeep(1, []), 1);
  });
});
