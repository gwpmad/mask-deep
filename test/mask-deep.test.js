const assert = require('assert');
const maskDeep = require('../src/mask-deep');

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

  it('should mask from the right if configured to do so', () => {
    const source = { a: 1, b: 2, c: { a: { a: 1, b: 2 }, d: 4 }, d: { a: 1, b: 'abcdefghi', d: 4 } };
    const omit = ['b'];
    const expected = { a: 1, b: '*', c: { a: { a: 1, b: '*' }, d: 4 }, d: { a: 1, b: 'ab*******', d: 4 } };
    assert.deepEqual(maskDeep(source, omit, { maskFromRight: true }), expected);
  });

  it('should mask a certain percentage (if configured) but totally mask anything <=3 characters', () => {
    const source = { a: 1, b: 222, c: { a: { a: 1, b: 2 }, d: 4 }, d: { a: 1, b: 'aaaaaaaaa', d: 4 } };
    const omit = ['b'];
    const expected = { a: 1, b: '***', c: { a: { a: 1, b: '*' }, d: 4 }, d: { a: 1, b: '*****aaaa', d: 4 } };
    assert.deepEqual(maskDeep(source, omit, { percentage: 60 }), expected);
  });

  it('should turn primitive values with \'time\' or \'date\' in their key into empty strings, unless configured not to', () => {
    const source = { a: { b: '01-03-2000 00:00:00', myTime: 'blahh' }, myDate: new Date('01-03-2000 00:00:00'), c: 4 };
    const omit = ['b', 'myDate', 'myTime'];
    const expected = { a: { b: '***************0:00', myTime: '' }, myDate: '', c: 4 };
    assert.deepEqual(maskDeep(source, omit), expected);

    const expectedWithMaskTimePropsNormally = { a: { b: '***************0:00', myTime: '****h' }, myDate: '*******************************00 (GMT)', c: 4 };
    assert.deepEqual(maskDeep(source, omit, { maskTimePropsNormally: true }), expectedWithMaskTimePropsNormally);
  });

  it('should mask multiple keys from complex structures', () => {
    const source = { a: 1, b: 2, c: [{ a: 1, b: 'longer string' }, { a: { a: 1, b: 2 }, d: 4 }], d: [{ a: 1, b: 2, d: 4 }, { a: 1, b: 2, d: 4 }] };
    const omit = ['b'];
    const expected = { a: 1, b: '*', c: [{ a: 1, b: '**********ing' }, { a: { a: 1, b: '*' }, d: 4 }], d: [{ a: 1, b: '*', d: 4 }, { a: 1, b: '*', d: 4 }] };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask everything inside an object/array', () => {
    const source = { a: 1, b: 2, c: [{ a: 'maskme', b: 'maskme' }, { a: { a: 'maskme', b: 'maskme' }, d: 'maskme' }], d: [{ c: { a: 'maskme' } }], e: ['maskme', 'maskme', 'maskme'] };
    const omit = ['c', 'e'];
    const expected = { a: 1, b: 2, c: [{ a: '*****e', b: '*****e' }, { a: { a: '*****e', b: '*****e' }, d: '*****e' }], d: [{ c: { a: '*****e' } }], e: ['*****e', '*****e', '*****e'] };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask instances of "?keyToMask=" or "&keyToMask=" in otherwise-non-masked strings and mask their values', () => {
    const source = { a: 1, b: 2, e: 'blahblah?c=maskThis', d: [{ f: '/url-path?d=dontMask&c=maskThis', c: /* should be fully masked because key is c but c query prop should be masked additionally */'/url-path?d=dontMask&c=maskThis' }] };
    const omit = ['c'];
    const expected = { a: 1, b: 2, e: 'blahblah?c=******is', d: [{ f: '/url-path?d=dontMask&c=******is', c: '*****************************is' }] };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should correctly mask a query string in a url if passed only that', () => {
    const source = 'https://www.google.co.uk/search?q=shouldbemasked&oq=abc&aqs=shouldbemasked';
    const omit = ['q', 'aqs'];
    const expected = 'https://www.google.co.uk/search?q=***********ked&oq=abc&aqs=***********ked';
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should mask query string values correctly even if the whole string is also being masked', () => {
    const source = { a: 'http://www.google.com?&b=foobarfoobar&c=quxfoobar&d=foobar&e=barfooquxbarfooqux&a=shouldbemasked', b: 1234 };
    const omit = ['a'];
    const expected = { a: '****************************************************************************ux&a=***********ked', b: 1234 };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should chop query off a url with a query that has an un-decodable escape sequence (avoid URI malformed bug), whether it has a keyToMask in it or not', () => {
    const source = { a: 'http://www.google.com?george=%E0%A4%', b: 'http://www.google.com?george=%E0%A4%', c: 1234 };
    const omit = ['a'];
    const expected = { a: '*****************.com', b: 'http://www.google.com', c: 1234 };
    assert.deepEqual(maskDeep(source, omit), expected);
  });

  it('should just return other values', () => {
    assert.deepEqual(maskDeep('a string', ['a', 'b']), 'a string');
    assert.deepEqual(maskDeep(1, []), 1);
  });

  it('should treat a null value as maskable', () => {
    assert.deepEqual(maskDeep({ a: null }, ['a']), { a: '***l' });
  });
});
