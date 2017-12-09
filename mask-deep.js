const urlParse = require('url-parse');
const qs = require('querystring');
const isPlainObject = require('lodash/isPlainObject');
const mapValues = require('lodash/mapValues');

const defaultOptions = {
  percentage: 80,
  maskFrom: 'left',
};

const checkOptions = (options) => {
  const { percentage, maskDatePropsNormally } = options;
  if (percentage && (Number.isNaN(Number(percentage)) || percentage < 0 || percentage > 100)) {
    throw new Error('Invalid percentage');
  }
  if (maskDatePropsNormally && (typeof maskDatePropsNormally !== 'boolean')) {
    throw new Error('maskDatePropsNormally must be a boolean');
  }
};

const isMaskable = (value) => {
  const type = typeof value;
  return (value instanceof Date) || (type !== 'object' && type !== 'function');
};

const maskPrimitive = (value, key, options) => {
  const { percentage, maskDatePropsNormally } = options;
  /* Logging applications often call new Date() on the keys of property names that look like dates
    e.g. 'createDate'. If called on an asterisked string this can lead to a wrong but misleading
    (and unmasked) date, so to be on the safe side return an empty string unless configured to do otherwise. */
  if (!maskDatePropsNormally && key.toLowerCase().includes('date')) return '';

  const stringValue = String(value);
  const indexToMaskTo = stringValue.length > 3
    ? Math.round(stringValue.length * (percentage / 100)) - 1
    : stringValue.length - 1;
  return stringValue.split('').reduce((acc, char, i) =>
    `${acc}${i <= indexToMaskTo ? '*' : stringValue[i]}`, '');
};

const qsMask = (value, keysToMask, options) => {
  if (typeof value === 'string'); {
    const parsedUrl = urlParse(value);
    const parsedQs = qs.parse(parsedUrl.query.slice(1));
    const qsKeysToMask = Object.keys(parsedQs).filter(key => keysToMask.includes(key));
    if (qsKeysToMask.length) {
      qsKeysToMask.forEach((keyToMask) => { parsedQs[keyToMask] = maskPrimitive(parsedQs[keyToMask], keyToMask, options); });
      parsedUrl.set('query', qs.stringify(parsedQs));
      return parsedUrl.href;
    }
  }
  return null;
};

const maskDeep = (source, key, keysToMask, options) => {
  if (isMaskable(source)) return maskPrimitive(source, key, options);
  if (Array.isArray(source)) return source.map((value, idx) => maskDeep(value, idx, keysToMask, options));
  return mapValues(source, (value, _key) => maskDeep(value, _key, keysToMask, options));
};

const findAndMask = (source, keysToMask, options = {}) => {
  checkOptions(options);
  const finalOptions = Object.assign({}, defaultOptions, options);

  const topLevelQsMaskResult = qsMask(source, keysToMask, finalOptions);
  if (topLevelQsMaskResult) return topLevelQsMaskResult;
  if (isMaskable(source)) return source; // source is just stringlike - we've checked if it's a querystring, but it's not, so we're just returning it.

  const propertyHandler = (value, key) => {
    if (keysToMask.includes(key)) return maskDeep(value, key, keysToMask, finalOptions);
    if (isPlainObject(value) || Array.isArray(value)) return findAndMask(value, keysToMask, options);

    const qsMaskResult = qsMask(value, keysToMask, finalOptions);
    if (qsMaskResult) return qsMaskResult;

    return value;
  };
  if (Array.isArray(source)) return source.map(propertyHandler);
  return mapValues(source, propertyHandler);
};

module.exports = findAndMask;
