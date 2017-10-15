const urlParse = require('url-parse');
const qs = require('querystring');
const isPlainObject = require('lodash/isPlainObject');
const mapValues = require('lodash/mapValues');

const defaultOptions = {
  percentage: 80,
  maskFrom: 'left',
};

const checkOptions = (options) => {
  const { percentage } = options;
  if (percentage && (Number.isNaN(Number(percentage)) || percentage > 100)) {
    throw new Error('Invalid percentage');
  }
};

const isMaskable = (value) => {
  const type = typeof value;
  return (value instanceof Date) || (type !== 'object' && type !== 'function');
};

const maskPrimitive = (value, options) => {
  const stringValue = String(value);
  const indexToMaskTo = stringValue.length > 3
    ? Math.round(stringValue.length * (options.percentage / 100)) - 1
    : stringValue.length - 1;
  return stringValue.split('').reduce((acc, char, i) =>
    `${acc}${i <= indexToMaskTo ? '*' : stringValue[i]}`, '');
};

const qsMask = (value, keysToMask, options) => {
  if (typeof value !== 'string') return null;
  const parsedUrl = urlParse(value);
  const parsedQs = qs.parse(parsedUrl.query.slice(1));
  const qsKeysToMask = Object.keys(parsedQs).filter(key => keysToMask.includes(key));
  if (qsKeysToMask.length) {
    qsKeysToMask.forEach((keyToMask) => { parsedQs[keyToMask] = maskPrimitive(parsedQs[keyToMask], options); });
    parsedUrl.set('query', qs.stringify(parsedQs));
    return parsedUrl.href;
  }
  return null;
};

const maskDeep = (source, keysToMask, options) => {
  if (isMaskable(source)) return maskPrimitive(source, options);
  if (Array.isArray(source)) return source.map(value => maskDeep(value, keysToMask, options));
  return mapValues(source, value => maskDeep(value, keysToMask, options));
};

const findAndMask = (source, keysToMask, options = {}) => {
  checkOptions(options);
  const finalOptions = Object.assign({}, defaultOptions, options);

  const topLevelQsMaskResult = qsMask(source, keysToMask, finalOptions);
  if (topLevelQsMaskResult) return topLevelQsMaskResult;
  if (isMaskable(source)) return source; // source is just stringlike - we've checked if it's a querystring, but it's not, so we're just returning it.

  function propertyHandler(value, key) {
    if (keysToMask.indexOf(key) > -1) return maskDeep(value, keysToMask, finalOptions);
    if (isPlainObject(value) || Array.isArray(value)) return findAndMask(value, keysToMask, options);

    const qsMaskResult = qsMask(value, keysToMask, finalOptions);
    if (qsMaskResult) return qsMaskResult;

    return value;
  }
  if (Array.isArray(source)) return source.map(propertyHandler);
  return mapValues(source, propertyHandler);
};

module.exports = findAndMask;
