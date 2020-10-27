const urlParse = require('url-parse');
const isPlainObject = require('lodash/isPlainObject');
const mapValues = require('lodash/mapValues');

const defaultOptions = {
  percentage: 80,
  maskTimePropsNormally: false,
  maskFromRight: false,
  isMaskable(value) {
    const type = typeof value;
    if (value === null) return true;
    return (value instanceof Date) || (type !== 'object' && type !== 'function');
  }
};

const checkOptions = (options) => {
  const exists = value => typeof value !== 'undefined';

  const { percentage, maskTimePropsNormally, maskFromRight } = options;
  if (exists(percentage) && (Number.isNaN(Number(percentage)) || percentage < 0 || percentage > 100)) {
    throw new Error('Invalid percentage');
  }
  if (exists(maskTimePropsNormally) && (typeof maskTimePropsNormally !== 'boolean')) {
    throw new Error('maskTimePropsNormally must be a boolean');
  }
  if (exists(maskFromRight) && (typeof maskFromRight !== 'boolean')) {
    throw new Error('maskFromRight must be a boolean');
  }
};

const shouldBeEmptyString = (key, maskTimePropsNormally) =>
  ['date', 'time'].some(word => String(key).toLowerCase().includes(word)) && !maskTimePropsNormally;

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
  if (typeof value === 'string') {
    let parsedUrl;
    try {
      parsedUrl = urlParse(value, true);
    } catch (e) {
      // string is url with query and there is an un-decodable escape sequence in query, (e.g. '%E0%A4%A'). return with query chopped off
      return value.substring(0, value.indexOf('?'));
    }
    const qsKeysToMask = Object.keys(parsedUrl.query).filter(key => keysToMask.includes(key));
    if (qsKeysToMask.length) {
      qsKeysToMask.forEach((keyToMask) => {
        parsedUrl.query[keyToMask] = maskPrimitive(parsedUrl.query[keyToMask], keyToMask, options);
      });
      parsedUrl.set('query', parsedUrl.query);
      return parsedUrl.href;
    }
  }
  return null;
};

const maskDeep = (source, key, keysToMask, options) => {
  if (options.isMaskable(source)) return maskPrimitive(source, key, options);
  if (Array.isArray(source)) return source.map((value, idx) => maskDeep(value, idx, keysToMask, options));

  if (isPlainObject(source)) {
    return mapValues(source, (value, _key) => maskDeep(value, _key, keysToMask, options));
  }

  return source;
};

const findAndMask = (source, keysToMask, options = {}) => {
  checkOptions(options);
  const finalOptions = Object.assign({}, defaultOptions, options);

  const topLevelQsMaskResult = qsMask(source, keysToMask, finalOptions);
  if (topLevelQsMaskResult) return topLevelQsMaskResult;
  if (finalOptions.isMaskable(source)) return source; // source is url with no offending query props or it's just stringlike - so we're just returning it.

  const propertyHandler = (value, key) => {
    const qsMaskResult = qsMask(value, keysToMask, finalOptions);
    if (qsMaskResult) {
      value = qsMaskResult;
    }
    if (keysToMask.includes(key)) return maskDeep(value, key, keysToMask, finalOptions);
    if (isPlainObject(value) || Array.isArray(value)) return findAndMask(value, keysToMask, options);

    return value;
  };
  if (Array.isArray(source)) return source.map(propertyHandler);
  return mapValues(source, propertyHandler);
};

module.exports = findAndMask;
