const urlParse = require('url-parse');
const qs = require('querystring');
const isPlainObject = require('lodash/isPlainObject');
const mapValues = require('lodash/mapValues');

const defaultOptions = {
  percentage: 80,
  maskTimePropsNormally: false,
  maskFromRight: false,
};

const checkOptions = (options) => {
  const { percentage, maskTimePropsNormally, maskFromRight } = options;
  if (percentage && (Number.isNaN(Number(percentage)) || percentage < 0 || percentage > 100)) {
    throw new Error('Invalid percentage');
  }
  if (maskTimePropsNormally && (typeof maskTimePropsNormally !== 'boolean')) {
    throw new Error('maskTimePropsNormally must be a boolean');
  }
  if (maskFromRight && (typeof maskFromRight !== 'boolean')) {
    throw new Error('maskFromRight must be a boolean');
  }
};

const shouldBeEmptyString = (key, maskTimePropsNormally) =>
  ['date', 'time'].some(word => String(key).toLowerCase().includes(word)) && !maskTimePropsNormally;

const isMaskable = (value) => {
  const type = typeof value;
  return (value instanceof Date) || (type !== 'object' && type !== 'function');
};

const maskPrimitive = (value, key, options) => {
  const { percentage, maskTimePropsNormally, maskFromRight } = options;

  /* Logging applications sometimes call new Date() on properties whose keys make them look like times/dates
    e.g. 'timeStamp' or 'createDate'. If called on an asterisked string this can lead to a wrong but misleading
    (and unmasked) date, so to be on the safe side return an empty string unless configured to do otherwise. */
  if (shouldBeEmptyString(key, maskTimePropsNormally)) return '';

  const arrayFromString = !maskFromRight ? String(value).split('') : String(value).split('').reverse();
  const valueLength = arrayFromString.length;
  if (valueLength <= 3) return '*'.repeat(valueLength);

  const indexToMaskTo = Math.round(valueLength * (percentage / 100)) - 1;
  const maskedString = arrayFromString.reduce((acc, char, i) =>
    `${acc}${i <= indexToMaskTo ? '*' : arrayFromString[i]}`, '');

  if (maskFromRight) return maskedString.split('').reverse().join('');
  return maskedString;
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
