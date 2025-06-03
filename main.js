'use strict';

var obsidian = require('obsidian');

/**
 * Fuse.js v6.6.2 - Lightweight fuzzy-search (http://fusejs.io)
 *
 * Copyright (c) 2022 Kiro Risk (http://kiro.me)
 * All Rights Reserved. Apache Software License 2.0
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

function isArray(value) {
  return !Array.isArray
    ? getTag(value) === '[object Array]'
    : Array.isArray(value)
}

// Adapted from: https://github.com/lodash/lodash/blob/master/.internal/baseToString.js
const INFINITY = 1 / 0;
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value
  }
  let result = value + '';
  return result == '0' && 1 / value == -INFINITY ? '-0' : result
}

function toString(value) {
  return value == null ? '' : baseToString(value)
}

function isString(value) {
  return typeof value === 'string'
}

function isNumber(value) {
  return typeof value === 'number'
}

// Adapted from: https://github.com/lodash/lodash/blob/master/isBoolean.js
function isBoolean(value) {
  return (
    value === true ||
    value === false ||
    (isObjectLike(value) && getTag(value) == '[object Boolean]')
  )
}

function isObject(value) {
  return typeof value === 'object'
}

// Checks if `value` is object-like.
function isObjectLike(value) {
  return isObject(value) && value !== null
}

function isDefined(value) {
  return value !== undefined && value !== null
}

function isBlank(value) {
  return !value.trim().length
}

// Gets the `toStringTag` of `value`.
// Adapted from: https://github.com/lodash/lodash/blob/master/.internal/getTag.js
function getTag(value) {
  return value == null
    ? value === undefined
      ? '[object Undefined]'
      : '[object Null]'
    : Object.prototype.toString.call(value)
}

const EXTENDED_SEARCH_UNAVAILABLE = 'Extended search is not available';

const INCORRECT_INDEX_TYPE = "Incorrect 'index' type";

const LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY = (key) =>
  `Invalid value for key ${key}`;

const PATTERN_LENGTH_TOO_LARGE = (max) =>
  `Pattern length exceeds max of ${max}.`;

const MISSING_KEY_PROPERTY = (name) => `Missing ${name} property in key`;

const INVALID_KEY_WEIGHT_VALUE = (key) =>
  `Property 'weight' in key '${key}' must be a positive integer`;

const hasOwn = Object.prototype.hasOwnProperty;

class KeyStore {
  constructor(keys) {
    this._keys = [];
    this._keyMap = {};

    let totalWeight = 0;

    keys.forEach((key) => {
      let obj = createKey(key);

      totalWeight += obj.weight;

      this._keys.push(obj);
      this._keyMap[obj.id] = obj;

      totalWeight += obj.weight;
    });

    // Normalize weights so that their sum is equal to 1
    this._keys.forEach((key) => {
      key.weight /= totalWeight;
    });
  }
  get(keyId) {
    return this._keyMap[keyId]
  }
  keys() {
    return this._keys
  }
  toJSON() {
    return JSON.stringify(this._keys)
  }
}

function createKey(key) {
  let path = null;
  let id = null;
  let src = null;
  let weight = 1;
  let getFn = null;

  if (isString(key) || isArray(key)) {
    src = key;
    path = createKeyPath(key);
    id = createKeyId(key);
  } else {
    if (!hasOwn.call(key, 'name')) {
      throw new Error(MISSING_KEY_PROPERTY('name'))
    }

    const name = key.name;
    src = name;

    if (hasOwn.call(key, 'weight')) {
      weight = key.weight;

      if (weight <= 0) {
        throw new Error(INVALID_KEY_WEIGHT_VALUE(name))
      }
    }

    path = createKeyPath(name);
    id = createKeyId(name);
    getFn = key.getFn;
  }

  return { path, id, weight, src, getFn }
}

function createKeyPath(key) {
  return isArray(key) ? key : key.split('.')
}

function createKeyId(key) {
  return isArray(key) ? key.join('.') : key
}

function get(obj, path) {
  let list = [];
  let arr = false;

  const deepGet = (obj, path, index) => {
    if (!isDefined(obj)) {
      return
    }
    if (!path[index]) {
      // If there's no path left, we've arrived at the object we care about.
      list.push(obj);
    } else {
      let key = path[index];

      const value = obj[key];

      if (!isDefined(value)) {
        return
      }

      // If we're at the last value in the path, and if it's a string/number/bool,
      // add it to the list
      if (
        index === path.length - 1 &&
        (isString(value) || isNumber(value) || isBoolean(value))
      ) {
        list.push(toString(value));
      } else if (isArray(value)) {
        arr = true;
        // Search each item in the array.
        for (let i = 0, len = value.length; i < len; i += 1) {
          deepGet(value[i], path, index + 1);
        }
      } else if (path.length) {
        // An object. Recurse further.
        deepGet(value, path, index + 1);
      }
    }
  };

  // Backwards compatibility (since path used to be a string)
  deepGet(obj, isString(path) ? path.split('.') : path, 0);

  return arr ? list : list[0]
}

const MatchOptions = {
  // Whether the matches should be included in the result set. When `true`, each record in the result
  // set will include the indices of the matched characters.
  // These can consequently be used for highlighting purposes.
  includeMatches: false,
  // When `true`, the matching function will continue to the end of a search pattern even if
  // a perfect match has already been located in the string.
  findAllMatches: false,
  // Minimum number of characters that must be matched before a result is considered a match
  minMatchCharLength: 1
};

const BasicOptions = {
  // When `true`, the algorithm continues searching to the end of the input even if a perfect
  // match is found before the end of the same input.
  isCaseSensitive: false,
  // When true, the matching function will continue to the end of a search pattern even if
  includeScore: false,
  // List of properties that will be searched. This also supports nested properties.
  keys: [],
  // Whether to sort the result list, by score
  shouldSort: true,
  // Default sort function: sort by ascending score, ascending index
  sortFn: (a, b) =>
    a.score === b.score ? (a.idx < b.idx ? -1 : 1) : a.score < b.score ? -1 : 1
};

const FuzzyOptions = {
  // Approximately where in the text is the pattern expected to be found?
  location: 0,
  // At what point does the match algorithm give up. A threshold of '0.0' requires a perfect match
  // (of both letters and location), a threshold of '1.0' would match anything.
  threshold: 0.6,
  // Determines how close the match must be to the fuzzy location (specified above).
  // An exact letter match which is 'distance' characters away from the fuzzy location
  // would score as a complete mismatch. A distance of '0' requires the match be at
  // the exact location specified, a threshold of '1000' would require a perfect match
  // to be within 800 characters of the fuzzy location to be found using a 0.8 threshold.
  distance: 100
};

const AdvancedOptions = {
  // When `true`, it enables the use of unix-like search commands
  useExtendedSearch: false,
  // The get function to use when fetching an object's properties.
  // The default will search nested paths *ie foo.bar.baz*
  getFn: get,
  // When `true`, search will ignore `location` and `distance`, so it won't matter
  // where in the string the pattern appears.
  // More info: https://fusejs.io/concepts/scoring-theory.html#fuzziness-score
  ignoreLocation: false,
  // When `true`, the calculation for the relevance score (used for sorting) will
  // ignore the field-length norm.
  // More info: https://fusejs.io/concepts/scoring-theory.html#field-length-norm
  ignoreFieldNorm: false,
  // The weight to determine how much field length norm effects scoring.
  fieldNormWeight: 1
};

var Config = {
  ...BasicOptions,
  ...MatchOptions,
  ...FuzzyOptions,
  ...AdvancedOptions
};

const SPACE = /[^ ]+/g;

// Field-length norm: the shorter the field, the higher the weight.
// Set to 3 decimals to reduce index size.
function norm(weight = 1, mantissa = 3) {
  const cache = new Map();
  const m = Math.pow(10, mantissa);

  return {
    get(value) {
      const numTokens = value.match(SPACE).length;

      if (cache.has(numTokens)) {
        return cache.get(numTokens)
      }

      // Default function is 1/sqrt(x), weight makes that variable
      const norm = 1 / Math.pow(numTokens, 0.5 * weight);

      // In place of `toFixed(mantissa)`, for faster computation
      const n = parseFloat(Math.round(norm * m) / m);

      cache.set(numTokens, n);

      return n
    },
    clear() {
      cache.clear();
    }
  }
}

class FuseIndex {
  constructor({
    getFn = Config.getFn,
    fieldNormWeight = Config.fieldNormWeight
  } = {}) {
    this.norm = norm(fieldNormWeight, 3);
    this.getFn = getFn;
    this.isCreated = false;

    this.setIndexRecords();
  }
  setSources(docs = []) {
    this.docs = docs;
  }
  setIndexRecords(records = []) {
    this.records = records;
  }
  setKeys(keys = []) {
    this.keys = keys;
    this._keysMap = {};
    keys.forEach((key, idx) => {
      this._keysMap[key.id] = idx;
    });
  }
  create() {
    if (this.isCreated || !this.docs.length) {
      return
    }

    this.isCreated = true;

    // List is Array<String>
    if (isString(this.docs[0])) {
      this.docs.forEach((doc, docIndex) => {
        this._addString(doc, docIndex);
      });
    } else {
      // List is Array<Object>
      this.docs.forEach((doc, docIndex) => {
        this._addObject(doc, docIndex);
      });
    }

    this.norm.clear();
  }
  // Adds a doc to the end of the index
  add(doc) {
    const idx = this.size();

    if (isString(doc)) {
      this._addString(doc, idx);
    } else {
      this._addObject(doc, idx);
    }
  }
  // Removes the doc at the specified index of the index
  removeAt(idx) {
    this.records.splice(idx, 1);

    // Change ref index of every subsquent doc
    for (let i = idx, len = this.size(); i < len; i += 1) {
      this.records[i].i -= 1;
    }
  }
  getValueForItemAtKeyId(item, keyId) {
    return item[this._keysMap[keyId]]
  }
  size() {
    return this.records.length
  }
  _addString(doc, docIndex) {
    if (!isDefined(doc) || isBlank(doc)) {
      return
    }

    let record = {
      v: doc,
      i: docIndex,
      n: this.norm.get(doc)
    };

    this.records.push(record);
  }
  _addObject(doc, docIndex) {
    let record = { i: docIndex, $: {} };

    // Iterate over every key (i.e, path), and fetch the value at that key
    this.keys.forEach((key, keyIndex) => {
      let value = key.getFn ? key.getFn(doc) : this.getFn(doc, key.path);

      if (!isDefined(value)) {
        return
      }

      if (isArray(value)) {
        let subRecords = [];
        const stack = [{ nestedArrIndex: -1, value }];

        while (stack.length) {
          const { nestedArrIndex, value } = stack.pop();

          if (!isDefined(value)) {
            continue
          }

          if (isString(value) && !isBlank(value)) {
            let subRecord = {
              v: value,
              i: nestedArrIndex,
              n: this.norm.get(value)
            };

            subRecords.push(subRecord);
          } else if (isArray(value)) {
            value.forEach((item, k) => {
              stack.push({
                nestedArrIndex: k,
                value: item
              });
            });
          } else ;
        }
        record.$[keyIndex] = subRecords;
      } else if (isString(value) && !isBlank(value)) {
        let subRecord = {
          v: value,
          n: this.norm.get(value)
        };

        record.$[keyIndex] = subRecord;
      }
    });

    this.records.push(record);
  }
  toJSON() {
    return {
      keys: this.keys,
      records: this.records
    }
  }
}

function createIndex(
  keys,
  docs,
  { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}
) {
  const myIndex = new FuseIndex({ getFn, fieldNormWeight });
  myIndex.setKeys(keys.map(createKey));
  myIndex.setSources(docs);
  myIndex.create();
  return myIndex
}

function parseIndex(
  data,
  { getFn = Config.getFn, fieldNormWeight = Config.fieldNormWeight } = {}
) {
  const { keys, records } = data;
  const myIndex = new FuseIndex({ getFn, fieldNormWeight });
  myIndex.setKeys(keys);
  myIndex.setIndexRecords(records);
  return myIndex
}

function computeScore$1(
  pattern,
  {
    errors = 0,
    currentLocation = 0,
    expectedLocation = 0,
    distance = Config.distance,
    ignoreLocation = Config.ignoreLocation
  } = {}
) {
  const accuracy = errors / pattern.length;

  if (ignoreLocation) {
    return accuracy
  }

  const proximity = Math.abs(expectedLocation - currentLocation);

  if (!distance) {
    // Dodge divide by zero error.
    return proximity ? 1.0 : accuracy
  }

  return accuracy + proximity / distance
}

function convertMaskToIndices(
  matchmask = [],
  minMatchCharLength = Config.minMatchCharLength
) {
  let indices = [];
  let start = -1;
  let end = -1;
  let i = 0;

  for (let len = matchmask.length; i < len; i += 1) {
    let match = matchmask[i];
    if (match && start === -1) {
      start = i;
    } else if (!match && start !== -1) {
      end = i - 1;
      if (end - start + 1 >= minMatchCharLength) {
        indices.push([start, end]);
      }
      start = -1;
    }
  }

  // (i-1 - start) + 1 => i - start
  if (matchmask[i - 1] && i - start >= minMatchCharLength) {
    indices.push([start, i - 1]);
  }

  return indices
}

// Machine word size
const MAX_BITS = 32;

function search(
  text,
  pattern,
  patternAlphabet,
  {
    location = Config.location,
    distance = Config.distance,
    threshold = Config.threshold,
    findAllMatches = Config.findAllMatches,
    minMatchCharLength = Config.minMatchCharLength,
    includeMatches = Config.includeMatches,
    ignoreLocation = Config.ignoreLocation
  } = {}
) {
  if (pattern.length > MAX_BITS) {
    throw new Error(PATTERN_LENGTH_TOO_LARGE(MAX_BITS))
  }

  const patternLen = pattern.length;
  // Set starting location at beginning text and initialize the alphabet.
  const textLen = text.length;
  // Handle the case when location > text.length
  const expectedLocation = Math.max(0, Math.min(location, textLen));
  // Highest score beyond which we give up.
  let currentThreshold = threshold;
  // Is there a nearby exact match? (speedup)
  let bestLocation = expectedLocation;

  // Performance: only computer matches when the minMatchCharLength > 1
  // OR if `includeMatches` is true.
  const computeMatches = minMatchCharLength > 1 || includeMatches;
  // A mask of the matches, used for building the indices
  const matchMask = computeMatches ? Array(textLen) : [];

  let index;

  // Get all exact matches, here for speed up
  while ((index = text.indexOf(pattern, bestLocation)) > -1) {
    let score = computeScore$1(pattern, {
      currentLocation: index,
      expectedLocation,
      distance,
      ignoreLocation
    });

    currentThreshold = Math.min(score, currentThreshold);
    bestLocation = index + patternLen;

    if (computeMatches) {
      let i = 0;
      while (i < patternLen) {
        matchMask[index + i] = 1;
        i += 1;
      }
    }
  }

  // Reset the best location
  bestLocation = -1;

  let lastBitArr = [];
  let finalScore = 1;
  let binMax = patternLen + textLen;

  const mask = 1 << (patternLen - 1);

  for (let i = 0; i < patternLen; i += 1) {
    // Scan for the best match; each iteration allows for one more error.
    // Run a binary search to determine how far from the match location we can stray
    // at this error level.
    let binMin = 0;
    let binMid = binMax;

    while (binMin < binMid) {
      const score = computeScore$1(pattern, {
        errors: i,
        currentLocation: expectedLocation + binMid,
        expectedLocation,
        distance,
        ignoreLocation
      });

      if (score <= currentThreshold) {
        binMin = binMid;
      } else {
        binMax = binMid;
      }

      binMid = Math.floor((binMax - binMin) / 2 + binMin);
    }

    // Use the result from this iteration as the maximum for the next.
    binMax = binMid;

    let start = Math.max(1, expectedLocation - binMid + 1);
    let finish = findAllMatches
      ? textLen
      : Math.min(expectedLocation + binMid, textLen) + patternLen;

    // Initialize the bit array
    let bitArr = Array(finish + 2);

    bitArr[finish + 1] = (1 << i) - 1;

    for (let j = finish; j >= start; j -= 1) {
      let currentLocation = j - 1;
      let charMatch = patternAlphabet[text.charAt(currentLocation)];

      if (computeMatches) {
        // Speed up: quick bool to int conversion (i.e, `charMatch ? 1 : 0`)
        matchMask[currentLocation] = +!!charMatch;
      }

      // First pass: exact match
      bitArr[j] = ((bitArr[j + 1] << 1) | 1) & charMatch;

      // Subsequent passes: fuzzy match
      if (i) {
        bitArr[j] |=
          ((lastBitArr[j + 1] | lastBitArr[j]) << 1) | 1 | lastBitArr[j + 1];
      }

      if (bitArr[j] & mask) {
        finalScore = computeScore$1(pattern, {
          errors: i,
          currentLocation,
          expectedLocation,
          distance,
          ignoreLocation
        });

        // This match will almost certainly be better than any existing match.
        // But check anyway.
        if (finalScore <= currentThreshold) {
          // Indeed it is
          currentThreshold = finalScore;
          bestLocation = currentLocation;

          // Already passed `loc`, downhill from here on in.
          if (bestLocation <= expectedLocation) {
            break
          }

          // When passing `bestLocation`, don't exceed our current distance from `expectedLocation`.
          start = Math.max(1, 2 * expectedLocation - bestLocation);
        }
      }
    }

    // No hope for a (better) match at greater error levels.
    const score = computeScore$1(pattern, {
      errors: i + 1,
      currentLocation: expectedLocation,
      expectedLocation,
      distance,
      ignoreLocation
    });

    if (score > currentThreshold) {
      break
    }

    lastBitArr = bitArr;
  }

  const result = {
    isMatch: bestLocation >= 0,
    // Count exact matches (those with a score of 0) to be "almost" exact
    score: Math.max(0.001, finalScore)
  };

  if (computeMatches) {
    const indices = convertMaskToIndices(matchMask, minMatchCharLength);
    if (!indices.length) {
      result.isMatch = false;
    } else if (includeMatches) {
      result.indices = indices;
    }
  }

  return result
}

function createPatternAlphabet(pattern) {
  let mask = {};

  for (let i = 0, len = pattern.length; i < len; i += 1) {
    const char = pattern.charAt(i);
    mask[char] = (mask[char] || 0) | (1 << (len - i - 1));
  }

  return mask
}

class BitapSearch {
  constructor(
    pattern,
    {
      location = Config.location,
      threshold = Config.threshold,
      distance = Config.distance,
      includeMatches = Config.includeMatches,
      findAllMatches = Config.findAllMatches,
      minMatchCharLength = Config.minMatchCharLength,
      isCaseSensitive = Config.isCaseSensitive,
      ignoreLocation = Config.ignoreLocation
    } = {}
  ) {
    this.options = {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreLocation
    };

    this.pattern = isCaseSensitive ? pattern : pattern.toLowerCase();

    this.chunks = [];

    if (!this.pattern.length) {
      return
    }

    const addChunk = (pattern, startIndex) => {
      this.chunks.push({
        pattern,
        alphabet: createPatternAlphabet(pattern),
        startIndex
      });
    };

    const len = this.pattern.length;

    if (len > MAX_BITS) {
      let i = 0;
      const remainder = len % MAX_BITS;
      const end = len - remainder;

      while (i < end) {
        addChunk(this.pattern.substr(i, MAX_BITS), i);
        i += MAX_BITS;
      }

      if (remainder) {
        const startIndex = len - MAX_BITS;
        addChunk(this.pattern.substr(startIndex), startIndex);
      }
    } else {
      addChunk(this.pattern, 0);
    }
  }

  searchIn(text) {
    const { isCaseSensitive, includeMatches } = this.options;

    if (!isCaseSensitive) {
      text = text.toLowerCase();
    }

    // Exact match
    if (this.pattern === text) {
      let result = {
        isMatch: true,
        score: 0
      };

      if (includeMatches) {
        result.indices = [[0, text.length - 1]];
      }

      return result
    }

    // Otherwise, use Bitap algorithm
    const {
      location,
      distance,
      threshold,
      findAllMatches,
      minMatchCharLength,
      ignoreLocation
    } = this.options;

    let allIndices = [];
    let totalScore = 0;
    let hasMatches = false;

    this.chunks.forEach(({ pattern, alphabet, startIndex }) => {
      const { isMatch, score, indices } = search(text, pattern, alphabet, {
        location: location + startIndex,
        distance,
        threshold,
        findAllMatches,
        minMatchCharLength,
        includeMatches,
        ignoreLocation
      });

      if (isMatch) {
        hasMatches = true;
      }

      totalScore += score;

      if (isMatch && indices) {
        allIndices = [...allIndices, ...indices];
      }
    });

    let result = {
      isMatch: hasMatches,
      score: hasMatches ? totalScore / this.chunks.length : 1
    };

    if (hasMatches && includeMatches) {
      result.indices = allIndices;
    }

    return result
  }
}

class BaseMatch {
  constructor(pattern) {
    this.pattern = pattern;
  }
  static isMultiMatch(pattern) {
    return getMatch(pattern, this.multiRegex)
  }
  static isSingleMatch(pattern) {
    return getMatch(pattern, this.singleRegex)
  }
  search(/*text*/) {}
}

function getMatch(pattern, exp) {
  const matches = pattern.match(exp);
  return matches ? matches[1] : null
}

// Token: 'file

class ExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'exact'
  }
  static get multiRegex() {
    return /^="(.*)"$/
  }
  static get singleRegex() {
    return /^=(.*)$/
  }
  search(text) {
    const isMatch = text === this.pattern;

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, this.pattern.length - 1]
    }
  }
}

// Token: !fire

class InverseExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'inverse-exact'
  }
  static get multiRegex() {
    return /^!"(.*)"$/
  }
  static get singleRegex() {
    return /^!(.*)$/
  }
  search(text) {
    const index = text.indexOf(this.pattern);
    const isMatch = index === -1;

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    }
  }
}

// Token: ^file

class PrefixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'prefix-exact'
  }
  static get multiRegex() {
    return /^\^"(.*)"$/
  }
  static get singleRegex() {
    return /^\^(.*)$/
  }
  search(text) {
    const isMatch = text.startsWith(this.pattern);

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, this.pattern.length - 1]
    }
  }
}

// Token: !^fire

class InversePrefixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'inverse-prefix-exact'
  }
  static get multiRegex() {
    return /^!\^"(.*)"$/
  }
  static get singleRegex() {
    return /^!\^(.*)$/
  }
  search(text) {
    const isMatch = !text.startsWith(this.pattern);

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    }
  }
}

// Token: .file$

class SuffixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'suffix-exact'
  }
  static get multiRegex() {
    return /^"(.*)"\$$/
  }
  static get singleRegex() {
    return /^(.*)\$$/
  }
  search(text) {
    const isMatch = text.endsWith(this.pattern);

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [text.length - this.pattern.length, text.length - 1]
    }
  }
}

// Token: !.file$

class InverseSuffixExactMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'inverse-suffix-exact'
  }
  static get multiRegex() {
    return /^!"(.*)"\$$/
  }
  static get singleRegex() {
    return /^!(.*)\$$/
  }
  search(text) {
    const isMatch = !text.endsWith(this.pattern);
    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices: [0, text.length - 1]
    }
  }
}

class FuzzyMatch extends BaseMatch {
  constructor(
    pattern,
    {
      location = Config.location,
      threshold = Config.threshold,
      distance = Config.distance,
      includeMatches = Config.includeMatches,
      findAllMatches = Config.findAllMatches,
      minMatchCharLength = Config.minMatchCharLength,
      isCaseSensitive = Config.isCaseSensitive,
      ignoreLocation = Config.ignoreLocation
    } = {}
  ) {
    super(pattern);
    this._bitapSearch = new BitapSearch(pattern, {
      location,
      threshold,
      distance,
      includeMatches,
      findAllMatches,
      minMatchCharLength,
      isCaseSensitive,
      ignoreLocation
    });
  }
  static get type() {
    return 'fuzzy'
  }
  static get multiRegex() {
    return /^"(.*)"$/
  }
  static get singleRegex() {
    return /^(.*)$/
  }
  search(text) {
    return this._bitapSearch.searchIn(text)
  }
}

// Token: 'file

class IncludeMatch extends BaseMatch {
  constructor(pattern) {
    super(pattern);
  }
  static get type() {
    return 'include'
  }
  static get multiRegex() {
    return /^'"(.*)"$/
  }
  static get singleRegex() {
    return /^'(.*)$/
  }
  search(text) {
    let location = 0;
    let index;

    const indices = [];
    const patternLen = this.pattern.length;

    // Get all exact matches
    while ((index = text.indexOf(this.pattern, location)) > -1) {
      location = index + patternLen;
      indices.push([index, location - 1]);
    }

    const isMatch = !!indices.length;

    return {
      isMatch,
      score: isMatch ? 0 : 1,
      indices
    }
  }
}

// ❗Order is important. DO NOT CHANGE.
const searchers = [
  ExactMatch,
  IncludeMatch,
  PrefixExactMatch,
  InversePrefixExactMatch,
  InverseSuffixExactMatch,
  SuffixExactMatch,
  InverseExactMatch,
  FuzzyMatch
];

const searchersLen = searchers.length;

// Regex to split by spaces, but keep anything in quotes together
const SPACE_RE = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
const OR_TOKEN = '|';

// Return a 2D array representation of the query, for simpler parsing.
// Example:
// "^core go$ | rb$ | py$ xy$" => [["^core", "go$"], ["rb$"], ["py$", "xy$"]]
function parseQuery(pattern, options = {}) {
  return pattern.split(OR_TOKEN).map((item) => {
    let query = item
      .trim()
      .split(SPACE_RE)
      .filter((item) => item && !!item.trim());

    let results = [];
    for (let i = 0, len = query.length; i < len; i += 1) {
      const queryItem = query[i];

      // 1. Handle multiple query match (i.e, once that are quoted, like `"hello world"`)
      let found = false;
      let idx = -1;
      while (!found && ++idx < searchersLen) {
        const searcher = searchers[idx];
        let token = searcher.isMultiMatch(queryItem);
        if (token) {
          results.push(new searcher(token, options));
          found = true;
        }
      }

      if (found) {
        continue
      }

      // 2. Handle single query matches (i.e, once that are *not* quoted)
      idx = -1;
      while (++idx < searchersLen) {
        const searcher = searchers[idx];
        let token = searcher.isSingleMatch(queryItem);
        if (token) {
          results.push(new searcher(token, options));
          break
        }
      }
    }

    return results
  })
}

// These extended matchers can return an array of matches, as opposed
// to a singl match
const MultiMatchSet = new Set([FuzzyMatch.type, IncludeMatch.type]);

/**
 * Command-like searching
 * ======================
 *
 * Given multiple search terms delimited by spaces.e.g. `^jscript .python$ ruby !java`,
 * search in a given text.
 *
 * Search syntax:
 *
 * | Token       | Match type                 | Description                            |
 * | ----------- | -------------------------- | -------------------------------------- |
 * | `jscript`   | fuzzy-match                | Items that fuzzy match `jscript`       |
 * | `=scheme`   | exact-match                | Items that are `scheme`                |
 * | `'python`   | include-match              | Items that include `python`            |
 * | `!ruby`     | inverse-exact-match        | Items that do not include `ruby`       |
 * | `^java`     | prefix-exact-match         | Items that start with `java`           |
 * | `!^earlang` | inverse-prefix-exact-match | Items that do not start with `earlang` |
 * | `.js$`      | suffix-exact-match         | Items that end with `.js`              |
 * | `!.go$`     | inverse-suffix-exact-match | Items that do not end with `.go`       |
 *
 * A single pipe character acts as an OR operator. For example, the following
 * query matches entries that start with `core` and end with either`go`, `rb`,
 * or`py`.
 *
 * ```
 * ^core go$ | rb$ | py$
 * ```
 */
class ExtendedSearch {
  constructor(
    pattern,
    {
      isCaseSensitive = Config.isCaseSensitive,
      includeMatches = Config.includeMatches,
      minMatchCharLength = Config.minMatchCharLength,
      ignoreLocation = Config.ignoreLocation,
      findAllMatches = Config.findAllMatches,
      location = Config.location,
      threshold = Config.threshold,
      distance = Config.distance
    } = {}
  ) {
    this.query = null;
    this.options = {
      isCaseSensitive,
      includeMatches,
      minMatchCharLength,
      findAllMatches,
      ignoreLocation,
      location,
      threshold,
      distance
    };

    this.pattern = isCaseSensitive ? pattern : pattern.toLowerCase();
    this.query = parseQuery(this.pattern, this.options);
  }

  static condition(_, options) {
    return options.useExtendedSearch
  }

  searchIn(text) {
    const query = this.query;

    if (!query) {
      return {
        isMatch: false,
        score: 1
      }
    }

    const { includeMatches, isCaseSensitive } = this.options;

    text = isCaseSensitive ? text : text.toLowerCase();

    let numMatches = 0;
    let allIndices = [];
    let totalScore = 0;

    // ORs
    for (let i = 0, qLen = query.length; i < qLen; i += 1) {
      const searchers = query[i];

      // Reset indices
      allIndices.length = 0;
      numMatches = 0;

      // ANDs
      for (let j = 0, pLen = searchers.length; j < pLen; j += 1) {
        const searcher = searchers[j];
        const { isMatch, indices, score } = searcher.search(text);

        if (isMatch) {
          numMatches += 1;
          totalScore += score;
          if (includeMatches) {
            const type = searcher.constructor.type;
            if (MultiMatchSet.has(type)) {
              allIndices = [...allIndices, ...indices];
            } else {
              allIndices.push(indices);
            }
          }
        } else {
          totalScore = 0;
          numMatches = 0;
          allIndices.length = 0;
          break
        }
      }

      // OR condition, so if TRUE, return
      if (numMatches) {
        let result = {
          isMatch: true,
          score: totalScore / numMatches
        };

        if (includeMatches) {
          result.indices = allIndices;
        }

        return result
      }
    }

    // Nothing was matched
    return {
      isMatch: false,
      score: 1
    }
  }
}

const registeredSearchers = [];

function register(...args) {
  registeredSearchers.push(...args);
}

function createSearcher(pattern, options) {
  for (let i = 0, len = registeredSearchers.length; i < len; i += 1) {
    let searcherClass = registeredSearchers[i];
    if (searcherClass.condition(pattern, options)) {
      return new searcherClass(pattern, options)
    }
  }

  return new BitapSearch(pattern, options)
}

const LogicalOperator = {
  AND: '$and',
  OR: '$or'
};

const KeyType = {
  PATH: '$path',
  PATTERN: '$val'
};

const isExpression = (query) =>
  !!(query[LogicalOperator.AND] || query[LogicalOperator.OR]);

const isPath = (query) => !!query[KeyType.PATH];

const isLeaf = (query) =>
  !isArray(query) && isObject(query) && !isExpression(query);

const convertToExplicit = (query) => ({
  [LogicalOperator.AND]: Object.keys(query).map((key) => ({
    [key]: query[key]
  }))
});

// When `auto` is `true`, the parse function will infer and initialize and add
// the appropriate `Searcher` instance
function parse(query, options, { auto = true } = {}) {
  const next = (query) => {
    let keys = Object.keys(query);

    const isQueryPath = isPath(query);

    if (!isQueryPath && keys.length > 1 && !isExpression(query)) {
      return next(convertToExplicit(query))
    }

    if (isLeaf(query)) {
      const key = isQueryPath ? query[KeyType.PATH] : keys[0];

      const pattern = isQueryPath ? query[KeyType.PATTERN] : query[key];

      if (!isString(pattern)) {
        throw new Error(LOGICAL_SEARCH_INVALID_QUERY_FOR_KEY(key))
      }

      const obj = {
        keyId: createKeyId(key),
        pattern
      };

      if (auto) {
        obj.searcher = createSearcher(pattern, options);
      }

      return obj
    }

    let node = {
      children: [],
      operator: keys[0]
    };

    keys.forEach((key) => {
      const value = query[key];

      if (isArray(value)) {
        value.forEach((item) => {
          node.children.push(next(item));
        });
      }
    });

    return node
  };

  if (!isExpression(query)) {
    query = convertToExplicit(query);
  }

  return next(query)
}

// Practical scoring function
function computeScore(
  results,
  { ignoreFieldNorm = Config.ignoreFieldNorm }
) {
  results.forEach((result) => {
    let totalScore = 1;

    result.matches.forEach(({ key, norm, score }) => {
      const weight = key ? key.weight : null;

      totalScore *= Math.pow(
        score === 0 && weight ? Number.EPSILON : score,
        (weight || 1) * (ignoreFieldNorm ? 1 : norm)
      );
    });

    result.score = totalScore;
  });
}

function transformMatches(result, data) {
  const matches = result.matches;
  data.matches = [];

  if (!isDefined(matches)) {
    return
  }

  matches.forEach((match) => {
    if (!isDefined(match.indices) || !match.indices.length) {
      return
    }

    const { indices, value } = match;

    let obj = {
      indices,
      value
    };

    if (match.key) {
      obj.key = match.key.src;
    }

    if (match.idx > -1) {
      obj.refIndex = match.idx;
    }

    data.matches.push(obj);
  });
}

function transformScore(result, data) {
  data.score = result.score;
}

function format(
  results,
  docs,
  {
    includeMatches = Config.includeMatches,
    includeScore = Config.includeScore
  } = {}
) {
  const transformers = [];

  if (includeMatches) transformers.push(transformMatches);
  if (includeScore) transformers.push(transformScore);

  return results.map((result) => {
    const { idx } = result;

    const data = {
      item: docs[idx],
      refIndex: idx
    };

    if (transformers.length) {
      transformers.forEach((transformer) => {
        transformer(result, data);
      });
    }

    return data
  })
}

class Fuse {
  constructor(docs, options = {}, index) {
    this.options = { ...Config, ...options };

    if (
      this.options.useExtendedSearch &&
      !true
    ) {
      throw new Error(EXTENDED_SEARCH_UNAVAILABLE)
    }

    this._keyStore = new KeyStore(this.options.keys);

    this.setCollection(docs, index);
  }

  setCollection(docs, index) {
    this._docs = docs;

    if (index && !(index instanceof FuseIndex)) {
      throw new Error(INCORRECT_INDEX_TYPE)
    }

    this._myIndex =
      index ||
      createIndex(this.options.keys, this._docs, {
        getFn: this.options.getFn,
        fieldNormWeight: this.options.fieldNormWeight
      });
  }

  add(doc) {
    if (!isDefined(doc)) {
      return
    }

    this._docs.push(doc);
    this._myIndex.add(doc);
  }

  remove(predicate = (/* doc, idx */) => false) {
    const results = [];

    for (let i = 0, len = this._docs.length; i < len; i += 1) {
      const doc = this._docs[i];
      if (predicate(doc, i)) {
        this.removeAt(i);
        i -= 1;
        len -= 1;

        results.push(doc);
      }
    }

    return results
  }

  removeAt(idx) {
    this._docs.splice(idx, 1);
    this._myIndex.removeAt(idx);
  }

  getIndex() {
    return this._myIndex
  }

  search(query, { limit = -1 } = {}) {
    const {
      includeMatches,
      includeScore,
      shouldSort,
      sortFn,
      ignoreFieldNorm
    } = this.options;

    let results = isString(query)
      ? isString(this._docs[0])
        ? this._searchStringList(query)
        : this._searchObjectList(query)
      : this._searchLogical(query);

    computeScore(results, { ignoreFieldNorm });

    if (shouldSort) {
      results.sort(sortFn);
    }

    if (isNumber(limit) && limit > -1) {
      results = results.slice(0, limit);
    }

    return format(results, this._docs, {
      includeMatches,
      includeScore
    })
  }

  _searchStringList(query) {
    const searcher = createSearcher(query, this.options);
    const { records } = this._myIndex;
    const results = [];

    // Iterate over every string in the index
    records.forEach(({ v: text, i: idx, n: norm }) => {
      if (!isDefined(text)) {
        return
      }

      const { isMatch, score, indices } = searcher.searchIn(text);

      if (isMatch) {
        results.push({
          item: text,
          idx,
          matches: [{ score, value: text, norm, indices }]
        });
      }
    });

    return results
  }

  _searchLogical(query) {

    const expression = parse(query, this.options);

    const evaluate = (node, item, idx) => {
      if (!node.children) {
        const { keyId, searcher } = node;

        const matches = this._findMatches({
          key: this._keyStore.get(keyId),
          value: this._myIndex.getValueForItemAtKeyId(item, keyId),
          searcher
        });

        if (matches && matches.length) {
          return [
            {
              idx,
              item,
              matches
            }
          ]
        }

        return []
      }

      const res = [];
      for (let i = 0, len = node.children.length; i < len; i += 1) {
        const child = node.children[i];
        const result = evaluate(child, item, idx);
        if (result.length) {
          res.push(...result);
        } else if (node.operator === LogicalOperator.AND) {
          return []
        }
      }
      return res
    };

    const records = this._myIndex.records;
    const resultMap = {};
    const results = [];

    records.forEach(({ $: item, i: idx }) => {
      if (isDefined(item)) {
        let expResults = evaluate(expression, item, idx);

        if (expResults.length) {
          // Dedupe when adding
          if (!resultMap[idx]) {
            resultMap[idx] = { idx, item, matches: [] };
            results.push(resultMap[idx]);
          }
          expResults.forEach(({ matches }) => {
            resultMap[idx].matches.push(...matches);
          });
        }
      }
    });

    return results
  }

  _searchObjectList(query) {
    const searcher = createSearcher(query, this.options);
    const { keys, records } = this._myIndex;
    const results = [];

    // List is Array<Object>
    records.forEach(({ $: item, i: idx }) => {
      if (!isDefined(item)) {
        return
      }

      let matches = [];

      // Iterate over every key (i.e, path), and fetch the value at that key
      keys.forEach((key, keyIndex) => {
        matches.push(
          ...this._findMatches({
            key,
            value: item[keyIndex],
            searcher
          })
        );
      });

      if (matches.length) {
        results.push({
          idx,
          item,
          matches
        });
      }
    });

    return results
  }
  _findMatches({ key, value, searcher }) {
    if (!isDefined(value)) {
      return []
    }

    let matches = [];

    if (isArray(value)) {
      value.forEach(({ v: text, i: idx, n: norm }) => {
        if (!isDefined(text)) {
          return
        }

        const { isMatch, score, indices } = searcher.searchIn(text);

        if (isMatch) {
          matches.push({
            score,
            key,
            value: text,
            idx,
            norm,
            indices
          });
        }
      });
    } else {
      const { v: text, n: norm } = value;

      const { isMatch, score, indices } = searcher.searchIn(text);

      if (isMatch) {
        matches.push({ score, key, value: text, norm, indices });
      }
    }

    return matches
  }
}

Fuse.version = '6.6.2';
Fuse.createIndex = createIndex;
Fuse.parseIndex = parseIndex;
Fuse.config = Config;

{
  Fuse.parseQuery = parse;
}

{
  register(ExtendedSearch);
}

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var hangul = {exports: {}};

/**
 * Hangul.js
 * https://github.com/e-/Hangul.js
 *
 * Copyright 2017, Jaemin Jo
 * under the MIT license.
 */

var hasRequiredHangul;

function requireHangul () {
	if (hasRequiredHangul) return hangul.exports;
	hasRequiredHangul = 1;
	(function (module) {
		(function () {
		    var CHO = [
		        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ',
		        'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ',
		        'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ',
		        'ㅍ', 'ㅎ'
		    ],
		        JUNG = [
		            'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ',
		            'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', ['ㅗ', 'ㅏ'], ['ㅗ', 'ㅐ'],
		            ['ㅗ', 'ㅣ'], 'ㅛ', 'ㅜ', ['ㅜ', 'ㅓ'], ['ㅜ', 'ㅔ'], ['ㅜ', 'ㅣ'],
		            'ㅠ', 'ㅡ', ['ㅡ', 'ㅣ'], 'ㅣ'
		        ],
		        JONG = [
		            '', 'ㄱ', 'ㄲ', ['ㄱ', 'ㅅ'], 'ㄴ', ['ㄴ', 'ㅈ'], ['ㄴ', 'ㅎ'], 'ㄷ', 'ㄹ',
		            ['ㄹ', 'ㄱ'], ['ㄹ', 'ㅁ'], ['ㄹ', 'ㅂ'], ['ㄹ', 'ㅅ'], ['ㄹ', 'ㅌ'], ['ㄹ', 'ㅍ'], ['ㄹ', 'ㅎ'], 'ㅁ',
		            'ㅂ', ['ㅂ', 'ㅅ'], 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
		        ],
		        HANGUL_OFFSET = 0xAC00,
		        CONSONANTS = [
		            'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄸ',
		            'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
		            'ㅁ', 'ㅂ', 'ㅃ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ',
		            'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
		        ],
		        COMPLETE_CHO = [
		            'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ',
		            'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ',
		            'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
		        ],
		        COMPLETE_JUNG = [
		            'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ',
		            'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
		            'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ',
		            'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
		        ],
		        COMPLETE_JONG = [
		            '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ',
		            'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ',
		            'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
		        ],
		        COMPLEX_CONSONANTS = [
		            ['ㄱ', 'ㅅ', 'ㄳ'],
		            ['ㄴ', 'ㅈ', 'ㄵ'],
		            ['ㄴ', 'ㅎ', 'ㄶ'],
		            ['ㄹ', 'ㄱ', 'ㄺ'],
		            ['ㄹ', 'ㅁ', 'ㄻ'],
		            ['ㄹ', 'ㅂ', 'ㄼ'],
		            ['ㄹ', 'ㅅ', 'ㄽ'],
		            ['ㄹ', 'ㅌ', 'ㄾ'],
		            ['ㄹ', 'ㅍ', 'ㄿ'],
		            ['ㄹ', 'ㅎ', 'ㅀ'],
		            ['ㅂ', 'ㅅ', 'ㅄ']
		        ],
		        COMPLEX_VOWELS = [
		            ['ㅗ', 'ㅏ', 'ㅘ'],
		            ['ㅗ', 'ㅐ', 'ㅙ'],
		            ['ㅗ', 'ㅣ', 'ㅚ'],
		            ['ㅜ', 'ㅓ', 'ㅝ'],
		            ['ㅜ', 'ㅔ', 'ㅞ'],
		            ['ㅜ', 'ㅣ', 'ㅟ'],
		            ['ㅡ', 'ㅣ', 'ㅢ']
		        ],
		        CONSONANTS_HASH,
		        CHO_HASH,
		        JUNG_HASH,
		        JONG_HASH,
		        COMPLEX_CONSONANTS_HASH,
		        COMPLEX_VOWELS_HASH
		        ;

		    function _makeHash(array) {
		        var length = array.length,
		            hash = { 0: 0 }
		            ;
		        for (var i = 0; i < length; i++) {
		            if (array[i])
		                hash[array[i].charCodeAt(0)] = i;
		        }
		        return hash;
		    }

		    CONSONANTS_HASH = _makeHash(CONSONANTS);
		    CHO_HASH = _makeHash(COMPLETE_CHO);
		    JUNG_HASH = _makeHash(COMPLETE_JUNG);
		    JONG_HASH = _makeHash(COMPLETE_JONG);

		    function _makeComplexHash(array) {
		        var length = array.length,
		            hash = {},
		            code1,
		            code2
		            ;
		        for (var i = 0; i < length; i++) {
		            code1 = array[i][0].charCodeAt(0);
		            code2 = array[i][1].charCodeAt(0);
		            if (typeof hash[code1] === 'undefined') {
		                hash[code1] = {};
		            }
		            hash[code1][code2] = array[i][2].charCodeAt(0);
		        }
		        return hash;
		    }

		    COMPLEX_CONSONANTS_HASH = _makeComplexHash(COMPLEX_CONSONANTS);
		    COMPLEX_VOWELS_HASH = _makeComplexHash(COMPLEX_VOWELS);

		    function _isConsonant(c) {
		        return typeof CONSONANTS_HASH[c] !== 'undefined';
		    }

		    function _isCho(c) {
		        return typeof CHO_HASH[c] !== 'undefined';
		    }

		    function _isJung(c) {
		        return typeof JUNG_HASH[c] !== 'undefined';
		    }

		    function _isJong(c) {
		        return typeof JONG_HASH[c] !== 'undefined';
		    }

		    function _isHangul(c /* code number */) {
		        return 0xAC00 <= c && c <= 0xd7a3;
		    }

		    function _isJungJoinable(a, b) {
		        return (COMPLEX_VOWELS_HASH[a] && COMPLEX_VOWELS_HASH[a][b]) ? COMPLEX_VOWELS_HASH[a][b] : false;
		    }

		    function _isJongJoinable(a, b) {
		        return COMPLEX_CONSONANTS_HASH[a] && COMPLEX_CONSONANTS_HASH[a][b] ? COMPLEX_CONSONANTS_HASH[a][b] : false;
		    }

		    var disassemble = function (string, grouped) {
		        if (string === null) {
		            throw new Error('Arguments cannot be null');
		        }

		        if (typeof string === 'object') {
		            string = string.join('');
		        }

		        var result = [],
		            length = string.length,
		            cho,
		            jung,
		            jong,
		            code,
		            r
		            ;

		        for (var i = 0; i < length; i++) {
		            var temp = [];

		            code = string.charCodeAt(i);
		            if (_isHangul(code)) { // 완성된 한글이면
		                code -= HANGUL_OFFSET;
		                jong = code % 28;
		                jung = (code - jong) / 28 % 21;
		                cho = parseInt((code - jong) / 28 / 21);
		                temp.push(CHO[cho]);
		                if (typeof JUNG[jung] === 'object') {
		                    temp = temp.concat(JUNG[jung]);
		                } else {
		                    temp.push(JUNG[jung]);
		                }
		                if (jong > 0) {
		                    if (typeof JONG[jong] === 'object') {
		                        temp = temp.concat(JONG[jong]);
		                    } else {
		                        temp.push(JONG[jong]);
		                    }
		                }
		            } else if (_isConsonant(code)) { //자음이면
		                if (_isCho(code)) {
		                    r = CHO[CHO_HASH[code]];
		                } else {
		                    r = JONG[JONG_HASH[code]];
		                }
		                if (typeof r === 'string') {
		                    temp.push(r);
		                } else {
		                    temp = temp.concat(r);
		                }
		            } else if (_isJung(code)) {
		                r = JUNG[JUNG_HASH[code]];
		                if (typeof r === 'string') {
		                    temp.push(r);
		                } else {
		                    temp = temp.concat(r);
		                }
		            } else {
		                temp.push(string.charAt(i));
		            }

		            if (grouped) result.push(temp);
		            else result = result.concat(temp);
		        }

		        return result;
		    };

		    var disassembleToString = function (str) {
		        if (typeof str !== 'string') {
		            return '';
		        }
		        str = disassemble(str);
		        return str.join('');
		    };

		    var assemble = function (array) {
		        if (typeof array === 'string') {
		            array = disassemble(array);
		        }

		        var result = [],
		            length = array.length,
		            code,
		            stage = 0,
		            complete_index = -1, //완성된 곳의 인덱스
		            previous_code,
		            jong_joined = false
		            ;

		        function _makeHangul(index) { // complete_index + 1부터 index까지를 greedy하게 한글로 만든다.
		            var cho,
		                jung1,
		                jung2,
		                jong1 = 0,
		                jong2,
		                hangul = ''
		                ;

		            jong_joined = false;
		            if (complete_index + 1 > index) {
		                return;
		            }
		            for (var step = 1; ; step++) {
		                if (step === 1) {
		                    cho = array[complete_index + step].charCodeAt(0);
		                    if (_isJung(cho)) { // 첫번째 것이 모음이면 1) ㅏ같은 경우이거나 2) ㅙ같은 경우이다
		                        if (complete_index + step + 1 <= index && _isJung(jung1 = array[complete_index + step + 1].charCodeAt(0))) { //다음것이 있고 모음이면
		                            result.push(String.fromCharCode(_isJungJoinable(cho, jung1)));
		                            complete_index = index;
		                            return;
		                        } else {
		                            result.push(array[complete_index + step]);
		                            complete_index = index;
		                            return;
		                        }
		                    } else if (!_isCho(cho)) {
		                        result.push(array[complete_index + step]);
		                        complete_index = index;
		                        return;
		                    }
		                    hangul = array[complete_index + step];
		                } else if (step === 2) {
		                    jung1 = array[complete_index + step].charCodeAt(0);
		                    if (_isCho(jung1)) { //두번째 또 자음이 오면 ㄳ 에서 ㅅ같은 경우이다
		                        cho = _isJongJoinable(cho, jung1);
		                        hangul = String.fromCharCode(cho);
		                        result.push(hangul);
		                        complete_index = index;
		                        return;
		                    } else {
		                        hangul = String.fromCharCode((CHO_HASH[cho] * 21 + JUNG_HASH[jung1]) * 28 + HANGUL_OFFSET);
		                    }
		                } else if (step === 3) {
		                    jung2 = array[complete_index + step].charCodeAt(0);
		                    if (_isJungJoinable(jung1, jung2)) {
		                        jung1 = _isJungJoinable(jung1, jung2);
		                    } else {
		                        jong1 = jung2;
		                    }
		                    hangul = String.fromCharCode((CHO_HASH[cho] * 21 + JUNG_HASH[jung1]) * 28 + JONG_HASH[jong1] + HANGUL_OFFSET);
		                    
		                } else if (step === 4) {
		                    jong2 = array[complete_index + step].charCodeAt(0);
		                    if (_isJongJoinable(jong1, jong2)) {
		                        jong1 = _isJongJoinable(jong1, jong2);
		                    } else {
		                        jong1 = jong2;
		                    }
		                    hangul = String.fromCharCode((CHO_HASH[cho] * 21 + JUNG_HASH[jung1]) * 28 + JONG_HASH[jong1] + HANGUL_OFFSET);
		                } else if (step === 5) {
		                    jong2 = array[complete_index + step].charCodeAt(0);
		                    jong1 = _isJongJoinable(jong1, jong2);
		                    hangul = String.fromCharCode((CHO_HASH[cho] * 21 + JUNG_HASH[jung1]) * 28 + JONG_HASH[jong1] + HANGUL_OFFSET);
		                }

		                if (complete_index + step >= index) {
		                    result.push(hangul);
		                    complete_index = index;
		                    return;
		                }
		            }
		        }

		        for (var i = 0; i < length; i++) {
		            code = array[i].charCodeAt(0);
		            if (!_isCho(code) && !_isJung(code) && !_isJong(code)) { //초, 중, 종성 다 아니면
		                _makeHangul(i - 1);
		                _makeHangul(i);
		                stage = 0;
		                continue;
		            }
		            //console.log(stage, array[i]);
		            if (stage === 0) { // 초성이 올 차례
		                if (_isCho(code)) { // 초성이 오면 아무 문제 없다.
		                    stage = 1;
		                } else if (_isJung(code)) {
		                    // 중성이오면 ㅐ 또는 ㅘ 인것이다. 바로 구분을 못한다. 따라서 특수한 stage인 stage4로 이동
		                    stage = 4;
		                }
		            } else if (stage == 1) { //중성이 올 차례
		                if (_isJung(code)) { //중성이 오면 문제없음 진행.
		                    stage = 2;
		                } else { //아니고 자음이오면 ㄻ같은 경우가 있고 ㄹㅋ같은 경우가 있다.
		                    if (_isJongJoinable(previous_code, code)) {
		                        // 합쳐질 수 있다면 ㄻ 같은 경우인데 이 뒤에 모음이 와서 ㄹ마 가 될수도 있고 초성이 올 수도 있다. 따라서 섣불리 완성할 수 없다. 이땐 stage5로 간다.
		                        stage = 5;
		                    } else { //합쳐질 수 없다면 앞 글자 완성 후 여전히 중성이 올 차례
		                        _makeHangul(i - 1);
		                    }
		                }
		            } else if (stage == 2) { //종성이 올 차례
		                if (_isJong(code)) { //종성이 오면 다음엔 자음 또는 모음이 온다.
		                    stage = 3;
		                } else if (_isJung(code)) { //그런데 중성이 오면 앞의 모음과 합칠 수 있는지 본다.
		                    if (_isJungJoinable(previous_code, code)) ; else { // 합칠 수 없다면 오타가 생긴 경우
		                        _makeHangul(i - 1);
		                        stage = 4;
		                    }
		                } else { // 받침이 안되는 자음이 오면 ㄸ 같은 이전까지 완성하고 다시시작
		                    _makeHangul(i - 1);
		                    stage = 1;
		                }
		            } else if (stage == 3) { // 종성이 하나 온 상태.
		                if (_isJong(code)) { // 또 종성이면 합칠수 있는지 본다.
		                    if (!jong_joined && _isJongJoinable(previous_code, code)) { //합칠 수 있으면 계속 진행. 왜냐하면 이번에 온 자음이 다음 글자의 초성이 될 수도 있기 때문. 대신 이 기회는 한번만
		                        jong_joined = true;
		                    } else { //없으면 한글자 완성
		                        _makeHangul(i - 1);
		                        stage = 1; // 이 종성이 초성이 되고 중성부터 시작
		                    }
		                } else if (_isCho(code)) { // 초성이면 한글자 완성.
		                    _makeHangul(i - 1);
		                    stage = 1; //이 글자가 초성이되므로 중성부터 시작
		                } else if (_isJung(code)) { // 중성이면 이전 종성은 이 중성과 합쳐지고 앞 글자는 받침이 없다.
		                    _makeHangul(i - 2);
		                    stage = 2;
		                }
		            } else if (stage == 4) { // 중성이 하나 온 상태
		                if (_isJung(code)) { //중성이 온 경우
		                    if (_isJungJoinable(previous_code, code)) { //이전 중성과 합쳐질 수 있는 경우
		                        _makeHangul(i);
		                        stage = 0;
		                    } else { //중성이 왔지만 못합치는 경우. ㅒㅗ 같은
		                        _makeHangul(i - 1);
		                    }
		                } else { // 아니면 자음이 온 경우.
		                    _makeHangul(i - 1);
		                    stage = 1;
		                }
		            } else if (stage == 5) { // 초성이 연속해서 두개 온 상태 ㄺ
		                if (_isJung(code)) { //이번에 중성이면 ㄹ가
		                    _makeHangul(i - 2);
		                    stage = 2;
		                } else {
		                    _makeHangul(i - 1);
		                    stage = 1;
		                }
		            }
		            previous_code = code;
		        }
		        _makeHangul(i - 1);
		        return result.join('');
		    };

		    var search = function (a, b) {
		        var ad = disassemble(a).join(''),
		            bd = disassemble(b).join('')
		            ;

		        return ad.indexOf(bd);
		    };

		    var rangeSearch = function (haystack, needle) {
		        var hex = disassemble(haystack).join(''),
		            nex = disassemble(needle).join(''),
		            grouped = disassemble(haystack, true),
		            re = new RegExp(nex, 'gi'),
		            indices = [],
		            result;

		        if (!needle.length) return [];

		        while ((result = re.exec(hex))) {
		            indices.push(result.index);
		        }

		        function findStart(index) {
		            for (var i = 0, length = 0; i < grouped.length; ++i) {
		                length += grouped[i].length;
		                if (index < length) return i;
		            }
		        }

		        function findEnd(index) {
		            for (var i = 0, length = 0; i < grouped.length; ++i) {
		                length += grouped[i].length;
		                if (index + nex.length <= length) return i;
		            }
		        }

		        return indices.map(function (i) {
		            return [findStart(i), findEnd(i)];
		        });
		    };

		    function Searcher(string) {
		        this.string = string;
		        this.disassembled = disassemble(string).join('');
		    }

		    Searcher.prototype.search = function (string) {
		        return disassemble(string).join('').indexOf(this.disassembled);
		    };
		    var endsWithConsonant = function (string) {
		        if (typeof string === 'object') {
		            string = string.join('');
		        }

		        var code = string.charCodeAt(string.length - 1);

		        if (_isHangul(code)) { // 완성된 한글이면
		            code -= HANGUL_OFFSET;
		            var jong = code % 28;
		            if (jong > 0) {
		                return true;
		            }
		        } else if (_isConsonant(code)) { //자음이면
		            return true;
		        }
		        return false;
		    };

		    var endsWith = function (string, target) {
		        return disassemble(string).pop() === target;
		    };


		    var hangul = {
		        disassemble: disassemble,
		        d: disassemble, // alias for disassemble
		        disassembleToString: disassembleToString,
		        ds: disassembleToString, // alias for disassembleToString
		        assemble: assemble,
		        a: assemble, // alias for assemble
		        search: search,
		        rangeSearch: rangeSearch,
		        Searcher: Searcher,
		        endsWithConsonant: endsWithConsonant,
		        endsWith: endsWith,
		        isHangul: function (c) {
		            if (typeof c === 'string')
		                c = c.charCodeAt(0);
		            return _isHangul(c);
		        },
		        isComplete: function (c) {
		            if (typeof c === 'string')
		                c = c.charCodeAt(0);
		            return _isHangul(c);
		        },
		        isConsonant: function (c) {
		            if (typeof c === 'string')
		                c = c.charCodeAt(0);
		            return _isConsonant(c);
		        },
		        isVowel: function (c) {
		            if (typeof c === 'string')
		                c = c.charCodeAt(0);
		            return _isJung(c);
		        },
		        isCho: function (c) {
		            if (typeof c === 'string')
		                c = c.charCodeAt(0);
		            return _isCho(c);
		        },
		        isJong: function (c) {
		            if (typeof c === 'string')
		                c = c.charCodeAt(0);
		            return _isJong(c);
		        },
		        isHangulAll: function (str) {
		            if (typeof str !== 'string') return false;
		            for (var i = 0; i < str.length; i++) {
		                if (!_isHangul(str.charCodeAt(i))) return false;
		            }
		            return true;
		        },
		        isCompleteAll: function (str) {
		            if (typeof str !== 'string') return false;
		            for (var i = 0; i < str.length; i++) {
		                if (!_isHangul(str.charCodeAt(i))) return false;
		            }
		            return true;
		        },
		        isConsonantAll: function (str) {
		            if (typeof str !== 'string') return false;
		            for (var i = 0; i < str.length; i++) {
		                if (!_isConsonant(str.charCodeAt(i))) return false;
		            }
		            return true;
		        },
		        isVowelAll: function (str) {
		            if (typeof str !== 'string') return false;
		            for (var i = 0; i < str.length; i++) {
		                if (!_isJung(str.charCodeAt(i))) return false;
		            }
		            return true;
		        },
		        isChoAll: function (str) {
		            if (typeof str !== 'string') return false;
		            for (var i = 0; i < str.length; i++) {
		                if (!_isCho(str.charCodeAt(i))) return false;
		            }
		            return true;
		        },
		        isJongAll: function (str) {
		            if (typeof str !== 'string') return false;
		            for (var i = 0; i < str.length; i++) {
		                if (!_isJong(str.charCodeAt(i))) return false;
		            }
		            return true;
		        }
		    };

		    {
		        module.exports = hangul;
		    }
		})(); 
	} (hangul));
	return hangul.exports;
}

var hangulExports = requireHangul();
var Hangul = /*@__PURE__*/getDefaultExportFromCjs(hangulExports);

const DEFAULT_SETTINGS = {
    fuzzyThreshold: 0.4,
    overrideQuickSwitcher: true,
};
class HangulIndex {
    constructor(plugin) {
        this.plugin = plugin;
        this.entries = [];
    }
    /** 볼트 전체 초기 색인 */
    async build() {
        const files = this.plugin.app.vault.getMarkdownFiles();
        this.entries = files.map((f) => this.toEntry(f));
        this.rebuildFuse();
    }
    /** 파일 이름이 바뀔 때마다 업데이트 */
    updateOnRename(file, oldPath) {
        const i = this.entries.findIndex((e) => e.path === oldPath);
        if (i > -1)
            this.entries.splice(i, 1, this.toEntry(file));
        else
            this.entries.push(this.toEntry(file));
        this.rebuildFuse();
    }
    /** 검색 */
    search(q) {
        const jamo = Hangul.disassemble(q).join('');
        return this.fuse.search(jamo).map((r) => r.item);
    }
    /* ---------- 내부 ---------- */
    toEntry(file) {
        const display = file.basename;
        return {
            display,
            jamo: Hangul.disassemble(display).join(''),
            path: file.path,
        };
    }
    rebuildFuse() {
        this.fuse = new Fuse(this.entries, {
            threshold: this.plugin.settings.fuzzyThreshold,
            keys: ['jamo', 'display'],
        });
    }
}
/* ---------- Quick Switcher 모달 ---------- */
class HangulSwitcher extends obsidian.FuzzySuggestModal {
    constructor(app, index) {
        super(app);
        this.index = index;
    }
    getItems() { return this.index.search(this.inputEl.value || ''); }
    getItemText(item) { return item.display; }
    onChooseItem(item) { this.app.workspace.openLinkText(item.path, '', false); }
}
/* ---------- [[ 링크 자동완성 ---------- */
class HangulLinkSuggest extends obsidian.EditorSuggest {
    constructor(app, index) {
        super(app);
        this.index = index;
    }
    onTrigger(cursor, editor) {
        const trigger = editor.getRange({ line: cursor.line, ch: cursor.ch - 2 }, cursor);
        if (trigger === '[[') {
            const file = this.app.workspace.getActiveFile();
            if (!file)
                return null;
            const context = {
                start: cursor,
                end: cursor,
                query: '',
                editor: editor,
                file: file
            };
            return context;
        }
        return null;
    }
    getSuggestions(ctx) {
        return this.index.search(ctx.query);
    }
    renderSuggestion(item, el) {
        el.textContent = item.display;
    }
    selectSuggestion(item, evt) {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf?.view.getViewType() === 'markdown') {
            const editor = activeLeaf.view.editor;
            if (editor) {
                const cursor = editor.getCursor();
                const lineText = editor.getLine(cursor.line);
                const beforeCursor = lineText.substring(0, cursor.ch);
                const linkStart = beforeCursor.lastIndexOf('[[');
                if (linkStart !== -1) {
                    const start = { line: cursor.line, ch: linkStart + 2 };
                    const end = cursor;
                    editor.replaceRange(item.display + ']]', start, end);
                }
            }
        }
    }
}
/* ---------- 플러그인 본체 ---------- */
class HangulSearchPlugin extends obsidian.Plugin {
    async onload() {
        /* 1) 설정 로드 */
        await this.loadSettings();
        /* 2) 색인 빌드 */
        this.index = new HangulIndex(this);
        await this.index.build();
        /* 3) 볼트 이벤트 감시 */
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (file instanceof obsidian.TFile)
                this.index.updateOnRename(file, oldPath);
        }));
        /* 4) Quick Switcher 대체 */
        if (this.settings.overrideQuickSwitcher) {
            this.addCommand({
                id: 'hangul-quick-switcher',
                name: 'Hangul Quick Switcher',
                hotkeys: [{ modifiers: ['Mod'], key: 'o' }], // ⌘O
                callback: () => new HangulSwitcher(this.app, this.index).open(),
            });
        }
        /* 5) 링크 자동완성 */
        this.registerEditorSuggest(new HangulLinkSuggest(this.app, this.index));
        /* 6) (선택) 설정 탭 */
        this.addSettingTab(new (class extends obsidian.PluginSettingTab {
            constructor(app, plugin) {
                super(app, plugin);
                this.plugin = plugin;
            }
            display() {
                const { containerEl } = this;
                containerEl.empty();
                containerEl.createEl('h2', { text: 'Hangul Fuzzy Search Settings' });
                // TODO: threshold 슬라이더 등 추가
            }
        })(this.app, this));
    }
    /* ---------- 설정 load/save ---------- */
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() { await this.saveData(this.settings); }
}

module.exports = HangulSearchPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL2Z1c2UuanMvZGlzdC9mdXNlLmVzbS5qcyIsIm5vZGVfbW9kdWxlcy9oYW5ndWwtanMvaGFuZ3VsLmpzIiwic3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBGdXNlLmpzIHY2LjYuMiAtIExpZ2h0d2VpZ2h0IGZ1enp5LXNlYXJjaCAoaHR0cDovL2Z1c2Vqcy5pbylcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMjIgS2lybyBSaXNrIChodHRwOi8va2lyby5tZSlcbiAqIEFsbCBSaWdodHMgUmVzZXJ2ZWQuIEFwYWNoZSBTb2Z0d2FyZSBMaWNlbnNlIDIuMFxuICpcbiAqIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICovXG5cbmZ1bmN0aW9uIGlzQXJyYXkodmFsdWUpIHtcbiAgcmV0dXJuICFBcnJheS5pc0FycmF5XG4gICAgPyBnZXRUYWcodmFsdWUpID09PSAnW29iamVjdCBBcnJheV0nXG4gICAgOiBBcnJheS5pc0FycmF5KHZhbHVlKVxufVxuXG4vLyBBZGFwdGVkIGZyb206IGh0dHBzOi8vZ2l0aHViLmNvbS9sb2Rhc2gvbG9kYXNoL2Jsb2IvbWFzdGVyLy5pbnRlcm5hbC9iYXNlVG9TdHJpbmcuanNcbmNvbnN0IElORklOSVRZID0gMSAvIDA7XG5mdW5jdGlvbiBiYXNlVG9TdHJpbmcodmFsdWUpIHtcbiAgLy8gRXhpdCBlYXJseSBmb3Igc3RyaW5ncyB0byBhdm9pZCBhIHBlcmZvcm1hbmNlIGhpdCBpbiBzb21lIGVudmlyb25tZW50cy5cbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgIHJldHVybiB2YWx1ZVxuICB9XG4gIGxldCByZXN1bHQgPSB2YWx1ZSArICcnO1xuICByZXR1cm4gcmVzdWx0ID09ICcwJyAmJiAxIC8gdmFsdWUgPT0gLUlORklOSVRZID8gJy0wJyA6IHJlc3VsdFxufVxuXG5mdW5jdGlvbiB0b1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT0gbnVsbCA/ICcnIDogYmFzZVRvU3RyaW5nKHZhbHVlKVxufVxuXG5mdW5jdGlvbiBpc1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJ1xufVxuXG5mdW5jdGlvbiBpc051bWJlcih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJ1xufVxuXG4vLyBBZGFwdGVkIGZyb206IGh0dHBzOi8vZ2l0aHViLmNvbS9sb2Rhc2gvbG9kYXNoL2Jsb2IvbWFzdGVyL2lzQm9vbGVhbi5qc1xuZnVuY3Rpb24gaXNCb29sZWFuKHZhbHVlKSB7XG4gIHJldHVybiAoXG4gICAgdmFsdWUgPT09IHRydWUgfHxcbiAgICB2YWx1ZSA9PT0gZmFsc2UgfHxcbiAgICAoaXNPYmplY3RMaWtlKHZhbHVlKSAmJiBnZXRUYWcodmFsdWUpID09ICdbb2JqZWN0IEJvb2xlYW5dJylcbiAgKVxufVxuXG5mdW5jdGlvbiBpc09iamVjdCh2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0J1xufVxuXG4vLyBDaGVja3MgaWYgYHZhbHVlYCBpcyBvYmplY3QtbGlrZS5cbmZ1bmN0aW9uIGlzT2JqZWN0TGlrZSh2YWx1ZSkge1xuICByZXR1cm4gaXNPYmplY3QodmFsdWUpICYmIHZhbHVlICE9PSBudWxsXG59XG5cbmZ1bmN0aW9uIGlzRGVmaW5lZCh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgIT09IHVuZGVmaW5lZCAmJiB2YWx1ZSAhPT0gbnVsbFxufVxuXG5mdW5jdGlvbiBpc0JsYW5rKHZhbHVlKSB7XG4gIHJldHVybiAhdmFsdWUudHJpbSgpLmxlbmd0aFxufVxuXG4vLyBHZXRzIHRoZSBgdG9TdHJpbmdUYWdgIG9mIGB2YWx1ZWAuXG4vLyBBZGFwdGVkIGZyb206IGh0dHBzOi8vZ2l0aHViLmNvbS9sb2Rhc2gvbG9kYXNoL2Jsb2IvbWFzdGVyLy5pbnRlcm5hbC9nZXRUYWcuanNcbmZ1bmN0aW9uIGdldFRhZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT0gbnVsbFxuICAgID8gdmFsdWUgPT09IHVuZGVmaW5lZFxuICAgICAgPyAnW29iamVjdCBVbmRlZmluZWRdJ1xuICAgICAgOiAnW29iamVjdCBOdWxsXSdcbiAgICA6IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSlcbn1cblxuY29uc3QgRVhURU5ERURfU0VBUkNIX1VOQVZBSUxBQkxFID0gJ0V4dGVuZGVkIHNlYXJjaCBpcyBub3QgYXZhaWxhYmxlJztcblxuY29uc3QgSU5DT1JSRUNUX0lOREVYX1RZUEUgPSBcIkluY29ycmVjdCAnaW5kZXgnIHR5cGVcIjtcblxuY29uc3QgTE9HSUNBTF9TRUFSQ0hfSU5WQUxJRF9RVUVSWV9GT1JfS0VZID0gKGtleSkgPT5cbiAgYEludmFsaWQgdmFsdWUgZm9yIGtleSAke2tleX1gO1xuXG5jb25zdCBQQVRURVJOX0xFTkdUSF9UT09fTEFSR0UgPSAobWF4KSA9PlxuICBgUGF0dGVybiBsZW5ndGggZXhjZWVkcyBtYXggb2YgJHttYXh9LmA7XG5cbmNvbnN0IE1JU1NJTkdfS0VZX1BST1BFUlRZID0gKG5hbWUpID0+IGBNaXNzaW5nICR7bmFtZX0gcHJvcGVydHkgaW4ga2V5YDtcblxuY29uc3QgSU5WQUxJRF9LRVlfV0VJR0hUX1ZBTFVFID0gKGtleSkgPT5cbiAgYFByb3BlcnR5ICd3ZWlnaHQnIGluIGtleSAnJHtrZXl9JyBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlcmA7XG5cbmNvbnN0IGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmNsYXNzIEtleVN0b3JlIHtcbiAgY29uc3RydWN0b3Ioa2V5cykge1xuICAgIHRoaXMuX2tleXMgPSBbXTtcbiAgICB0aGlzLl9rZXlNYXAgPSB7fTtcblxuICAgIGxldCB0b3RhbFdlaWdodCA9IDA7XG5cbiAgICBrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgbGV0IG9iaiA9IGNyZWF0ZUtleShrZXkpO1xuXG4gICAgICB0b3RhbFdlaWdodCArPSBvYmoud2VpZ2h0O1xuXG4gICAgICB0aGlzLl9rZXlzLnB1c2gob2JqKTtcbiAgICAgIHRoaXMuX2tleU1hcFtvYmouaWRdID0gb2JqO1xuXG4gICAgICB0b3RhbFdlaWdodCArPSBvYmoud2VpZ2h0O1xuICAgIH0pO1xuXG4gICAgLy8gTm9ybWFsaXplIHdlaWdodHMgc28gdGhhdCB0aGVpciBzdW0gaXMgZXF1YWwgdG8gMVxuICAgIHRoaXMuX2tleXMuZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICBrZXkud2VpZ2h0IC89IHRvdGFsV2VpZ2h0O1xuICAgIH0pO1xuICB9XG4gIGdldChrZXlJZCkge1xuICAgIHJldHVybiB0aGlzLl9rZXlNYXBba2V5SWRdXG4gIH1cbiAga2V5cygpIHtcbiAgICByZXR1cm4gdGhpcy5fa2V5c1xuICB9XG4gIHRvSlNPTigpIHtcbiAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkodGhpcy5fa2V5cylcbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVLZXkoa2V5KSB7XG4gIGxldCBwYXRoID0gbnVsbDtcbiAgbGV0IGlkID0gbnVsbDtcbiAgbGV0IHNyYyA9IG51bGw7XG4gIGxldCB3ZWlnaHQgPSAxO1xuICBsZXQgZ2V0Rm4gPSBudWxsO1xuXG4gIGlmIChpc1N0cmluZyhrZXkpIHx8IGlzQXJyYXkoa2V5KSkge1xuICAgIHNyYyA9IGtleTtcbiAgICBwYXRoID0gY3JlYXRlS2V5UGF0aChrZXkpO1xuICAgIGlkID0gY3JlYXRlS2V5SWQoa2V5KTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWhhc093bi5jYWxsKGtleSwgJ25hbWUnKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKE1JU1NJTkdfS0VZX1BST1BFUlRZKCduYW1lJykpXG4gICAgfVxuXG4gICAgY29uc3QgbmFtZSA9IGtleS5uYW1lO1xuICAgIHNyYyA9IG5hbWU7XG5cbiAgICBpZiAoaGFzT3duLmNhbGwoa2V5LCAnd2VpZ2h0JykpIHtcbiAgICAgIHdlaWdodCA9IGtleS53ZWlnaHQ7XG5cbiAgICAgIGlmICh3ZWlnaHQgPD0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoSU5WQUxJRF9LRVlfV0VJR0hUX1ZBTFVFKG5hbWUpKVxuICAgICAgfVxuICAgIH1cblxuICAgIHBhdGggPSBjcmVhdGVLZXlQYXRoKG5hbWUpO1xuICAgIGlkID0gY3JlYXRlS2V5SWQobmFtZSk7XG4gICAgZ2V0Rm4gPSBrZXkuZ2V0Rm47XG4gIH1cblxuICByZXR1cm4geyBwYXRoLCBpZCwgd2VpZ2h0LCBzcmMsIGdldEZuIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5UGF0aChrZXkpIHtcbiAgcmV0dXJuIGlzQXJyYXkoa2V5KSA/IGtleSA6IGtleS5zcGxpdCgnLicpXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUtleUlkKGtleSkge1xuICByZXR1cm4gaXNBcnJheShrZXkpID8ga2V5LmpvaW4oJy4nKSA6IGtleVxufVxuXG5mdW5jdGlvbiBnZXQob2JqLCBwYXRoKSB7XG4gIGxldCBsaXN0ID0gW107XG4gIGxldCBhcnIgPSBmYWxzZTtcblxuICBjb25zdCBkZWVwR2V0ID0gKG9iaiwgcGF0aCwgaW5kZXgpID0+IHtcbiAgICBpZiAoIWlzRGVmaW5lZChvYmopKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKCFwYXRoW2luZGV4XSkge1xuICAgICAgLy8gSWYgdGhlcmUncyBubyBwYXRoIGxlZnQsIHdlJ3ZlIGFycml2ZWQgYXQgdGhlIG9iamVjdCB3ZSBjYXJlIGFib3V0LlxuICAgICAgbGlzdC5wdXNoKG9iaik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBrZXkgPSBwYXRoW2luZGV4XTtcblxuICAgICAgY29uc3QgdmFsdWUgPSBvYmpba2V5XTtcblxuICAgICAgaWYgKCFpc0RlZmluZWQodmFsdWUpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICAvLyBJZiB3ZSdyZSBhdCB0aGUgbGFzdCB2YWx1ZSBpbiB0aGUgcGF0aCwgYW5kIGlmIGl0J3MgYSBzdHJpbmcvbnVtYmVyL2Jvb2wsXG4gICAgICAvLyBhZGQgaXQgdG8gdGhlIGxpc3RcbiAgICAgIGlmIChcbiAgICAgICAgaW5kZXggPT09IHBhdGgubGVuZ3RoIC0gMSAmJlxuICAgICAgICAoaXNTdHJpbmcodmFsdWUpIHx8IGlzTnVtYmVyKHZhbHVlKSB8fCBpc0Jvb2xlYW4odmFsdWUpKVxuICAgICAgKSB7XG4gICAgICAgIGxpc3QucHVzaCh0b1N0cmluZyh2YWx1ZSkpO1xuICAgICAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICBhcnIgPSB0cnVlO1xuICAgICAgICAvLyBTZWFyY2ggZWFjaCBpdGVtIGluIHRoZSBhcnJheS5cbiAgICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHZhbHVlLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICAgICAgZGVlcEdldCh2YWx1ZVtpXSwgcGF0aCwgaW5kZXggKyAxKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChwYXRoLmxlbmd0aCkge1xuICAgICAgICAvLyBBbiBvYmplY3QuIFJlY3Vyc2UgZnVydGhlci5cbiAgICAgICAgZGVlcEdldCh2YWx1ZSwgcGF0aCwgaW5kZXggKyAxKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLy8gQmFja3dhcmRzIGNvbXBhdGliaWxpdHkgKHNpbmNlIHBhdGggdXNlZCB0byBiZSBhIHN0cmluZylcbiAgZGVlcEdldChvYmosIGlzU3RyaW5nKHBhdGgpID8gcGF0aC5zcGxpdCgnLicpIDogcGF0aCwgMCk7XG5cbiAgcmV0dXJuIGFyciA/IGxpc3QgOiBsaXN0WzBdXG59XG5cbmNvbnN0IE1hdGNoT3B0aW9ucyA9IHtcbiAgLy8gV2hldGhlciB0aGUgbWF0Y2hlcyBzaG91bGQgYmUgaW5jbHVkZWQgaW4gdGhlIHJlc3VsdCBzZXQuIFdoZW4gYHRydWVgLCBlYWNoIHJlY29yZCBpbiB0aGUgcmVzdWx0XG4gIC8vIHNldCB3aWxsIGluY2x1ZGUgdGhlIGluZGljZXMgb2YgdGhlIG1hdGNoZWQgY2hhcmFjdGVycy5cbiAgLy8gVGhlc2UgY2FuIGNvbnNlcXVlbnRseSBiZSB1c2VkIGZvciBoaWdobGlnaHRpbmcgcHVycG9zZXMuXG4gIGluY2x1ZGVNYXRjaGVzOiBmYWxzZSxcbiAgLy8gV2hlbiBgdHJ1ZWAsIHRoZSBtYXRjaGluZyBmdW5jdGlvbiB3aWxsIGNvbnRpbnVlIHRvIHRoZSBlbmQgb2YgYSBzZWFyY2ggcGF0dGVybiBldmVuIGlmXG4gIC8vIGEgcGVyZmVjdCBtYXRjaCBoYXMgYWxyZWFkeSBiZWVuIGxvY2F0ZWQgaW4gdGhlIHN0cmluZy5cbiAgZmluZEFsbE1hdGNoZXM6IGZhbHNlLFxuICAvLyBNaW5pbXVtIG51bWJlciBvZiBjaGFyYWN0ZXJzIHRoYXQgbXVzdCBiZSBtYXRjaGVkIGJlZm9yZSBhIHJlc3VsdCBpcyBjb25zaWRlcmVkIGEgbWF0Y2hcbiAgbWluTWF0Y2hDaGFyTGVuZ3RoOiAxXG59O1xuXG5jb25zdCBCYXNpY09wdGlvbnMgPSB7XG4gIC8vIFdoZW4gYHRydWVgLCB0aGUgYWxnb3JpdGhtIGNvbnRpbnVlcyBzZWFyY2hpbmcgdG8gdGhlIGVuZCBvZiB0aGUgaW5wdXQgZXZlbiBpZiBhIHBlcmZlY3RcbiAgLy8gbWF0Y2ggaXMgZm91bmQgYmVmb3JlIHRoZSBlbmQgb2YgdGhlIHNhbWUgaW5wdXQuXG4gIGlzQ2FzZVNlbnNpdGl2ZTogZmFsc2UsXG4gIC8vIFdoZW4gdHJ1ZSwgdGhlIG1hdGNoaW5nIGZ1bmN0aW9uIHdpbGwgY29udGludWUgdG8gdGhlIGVuZCBvZiBhIHNlYXJjaCBwYXR0ZXJuIGV2ZW4gaWZcbiAgaW5jbHVkZVNjb3JlOiBmYWxzZSxcbiAgLy8gTGlzdCBvZiBwcm9wZXJ0aWVzIHRoYXQgd2lsbCBiZSBzZWFyY2hlZC4gVGhpcyBhbHNvIHN1cHBvcnRzIG5lc3RlZCBwcm9wZXJ0aWVzLlxuICBrZXlzOiBbXSxcbiAgLy8gV2hldGhlciB0byBzb3J0IHRoZSByZXN1bHQgbGlzdCwgYnkgc2NvcmVcbiAgc2hvdWxkU29ydDogdHJ1ZSxcbiAgLy8gRGVmYXVsdCBzb3J0IGZ1bmN0aW9uOiBzb3J0IGJ5IGFzY2VuZGluZyBzY29yZSwgYXNjZW5kaW5nIGluZGV4XG4gIHNvcnRGbjogKGEsIGIpID0+XG4gICAgYS5zY29yZSA9PT0gYi5zY29yZSA/IChhLmlkeCA8IGIuaWR4ID8gLTEgOiAxKSA6IGEuc2NvcmUgPCBiLnNjb3JlID8gLTEgOiAxXG59O1xuXG5jb25zdCBGdXp6eU9wdGlvbnMgPSB7XG4gIC8vIEFwcHJveGltYXRlbHkgd2hlcmUgaW4gdGhlIHRleHQgaXMgdGhlIHBhdHRlcm4gZXhwZWN0ZWQgdG8gYmUgZm91bmQ/XG4gIGxvY2F0aW9uOiAwLFxuICAvLyBBdCB3aGF0IHBvaW50IGRvZXMgdGhlIG1hdGNoIGFsZ29yaXRobSBnaXZlIHVwLiBBIHRocmVzaG9sZCBvZiAnMC4wJyByZXF1aXJlcyBhIHBlcmZlY3QgbWF0Y2hcbiAgLy8gKG9mIGJvdGggbGV0dGVycyBhbmQgbG9jYXRpb24pLCBhIHRocmVzaG9sZCBvZiAnMS4wJyB3b3VsZCBtYXRjaCBhbnl0aGluZy5cbiAgdGhyZXNob2xkOiAwLjYsXG4gIC8vIERldGVybWluZXMgaG93IGNsb3NlIHRoZSBtYXRjaCBtdXN0IGJlIHRvIHRoZSBmdXp6eSBsb2NhdGlvbiAoc3BlY2lmaWVkIGFib3ZlKS5cbiAgLy8gQW4gZXhhY3QgbGV0dGVyIG1hdGNoIHdoaWNoIGlzICdkaXN0YW5jZScgY2hhcmFjdGVycyBhd2F5IGZyb20gdGhlIGZ1enp5IGxvY2F0aW9uXG4gIC8vIHdvdWxkIHNjb3JlIGFzIGEgY29tcGxldGUgbWlzbWF0Y2guIEEgZGlzdGFuY2Ugb2YgJzAnIHJlcXVpcmVzIHRoZSBtYXRjaCBiZSBhdFxuICAvLyB0aGUgZXhhY3QgbG9jYXRpb24gc3BlY2lmaWVkLCBhIHRocmVzaG9sZCBvZiAnMTAwMCcgd291bGQgcmVxdWlyZSBhIHBlcmZlY3QgbWF0Y2hcbiAgLy8gdG8gYmUgd2l0aGluIDgwMCBjaGFyYWN0ZXJzIG9mIHRoZSBmdXp6eSBsb2NhdGlvbiB0byBiZSBmb3VuZCB1c2luZyBhIDAuOCB0aHJlc2hvbGQuXG4gIGRpc3RhbmNlOiAxMDBcbn07XG5cbmNvbnN0IEFkdmFuY2VkT3B0aW9ucyA9IHtcbiAgLy8gV2hlbiBgdHJ1ZWAsIGl0IGVuYWJsZXMgdGhlIHVzZSBvZiB1bml4LWxpa2Ugc2VhcmNoIGNvbW1hbmRzXG4gIHVzZUV4dGVuZGVkU2VhcmNoOiBmYWxzZSxcbiAgLy8gVGhlIGdldCBmdW5jdGlvbiB0byB1c2Ugd2hlbiBmZXRjaGluZyBhbiBvYmplY3QncyBwcm9wZXJ0aWVzLlxuICAvLyBUaGUgZGVmYXVsdCB3aWxsIHNlYXJjaCBuZXN0ZWQgcGF0aHMgKmllIGZvby5iYXIuYmF6KlxuICBnZXRGbjogZ2V0LFxuICAvLyBXaGVuIGB0cnVlYCwgc2VhcmNoIHdpbGwgaWdub3JlIGBsb2NhdGlvbmAgYW5kIGBkaXN0YW5jZWAsIHNvIGl0IHdvbid0IG1hdHRlclxuICAvLyB3aGVyZSBpbiB0aGUgc3RyaW5nIHRoZSBwYXR0ZXJuIGFwcGVhcnMuXG4gIC8vIE1vcmUgaW5mbzogaHR0cHM6Ly9mdXNlanMuaW8vY29uY2VwdHMvc2NvcmluZy10aGVvcnkuaHRtbCNmdXp6aW5lc3Mtc2NvcmVcbiAgaWdub3JlTG9jYXRpb246IGZhbHNlLFxuICAvLyBXaGVuIGB0cnVlYCwgdGhlIGNhbGN1bGF0aW9uIGZvciB0aGUgcmVsZXZhbmNlIHNjb3JlICh1c2VkIGZvciBzb3J0aW5nKSB3aWxsXG4gIC8vIGlnbm9yZSB0aGUgZmllbGQtbGVuZ3RoIG5vcm0uXG4gIC8vIE1vcmUgaW5mbzogaHR0cHM6Ly9mdXNlanMuaW8vY29uY2VwdHMvc2NvcmluZy10aGVvcnkuaHRtbCNmaWVsZC1sZW5ndGgtbm9ybVxuICBpZ25vcmVGaWVsZE5vcm06IGZhbHNlLFxuICAvLyBUaGUgd2VpZ2h0IHRvIGRldGVybWluZSBob3cgbXVjaCBmaWVsZCBsZW5ndGggbm9ybSBlZmZlY3RzIHNjb3JpbmcuXG4gIGZpZWxkTm9ybVdlaWdodDogMVxufTtcblxudmFyIENvbmZpZyA9IHtcbiAgLi4uQmFzaWNPcHRpb25zLFxuICAuLi5NYXRjaE9wdGlvbnMsXG4gIC4uLkZ1enp5T3B0aW9ucyxcbiAgLi4uQWR2YW5jZWRPcHRpb25zXG59O1xuXG5jb25zdCBTUEFDRSA9IC9bXiBdKy9nO1xuXG4vLyBGaWVsZC1sZW5ndGggbm9ybTogdGhlIHNob3J0ZXIgdGhlIGZpZWxkLCB0aGUgaGlnaGVyIHRoZSB3ZWlnaHQuXG4vLyBTZXQgdG8gMyBkZWNpbWFscyB0byByZWR1Y2UgaW5kZXggc2l6ZS5cbmZ1bmN0aW9uIG5vcm0od2VpZ2h0ID0gMSwgbWFudGlzc2EgPSAzKSB7XG4gIGNvbnN0IGNhY2hlID0gbmV3IE1hcCgpO1xuICBjb25zdCBtID0gTWF0aC5wb3coMTAsIG1hbnRpc3NhKTtcblxuICByZXR1cm4ge1xuICAgIGdldCh2YWx1ZSkge1xuICAgICAgY29uc3QgbnVtVG9rZW5zID0gdmFsdWUubWF0Y2goU1BBQ0UpLmxlbmd0aDtcblxuICAgICAgaWYgKGNhY2hlLmhhcyhudW1Ub2tlbnMpKSB7XG4gICAgICAgIHJldHVybiBjYWNoZS5nZXQobnVtVG9rZW5zKVxuICAgICAgfVxuXG4gICAgICAvLyBEZWZhdWx0IGZ1bmN0aW9uIGlzIDEvc3FydCh4KSwgd2VpZ2h0IG1ha2VzIHRoYXQgdmFyaWFibGVcbiAgICAgIGNvbnN0IG5vcm0gPSAxIC8gTWF0aC5wb3cobnVtVG9rZW5zLCAwLjUgKiB3ZWlnaHQpO1xuXG4gICAgICAvLyBJbiBwbGFjZSBvZiBgdG9GaXhlZChtYW50aXNzYSlgLCBmb3IgZmFzdGVyIGNvbXB1dGF0aW9uXG4gICAgICBjb25zdCBuID0gcGFyc2VGbG9hdChNYXRoLnJvdW5kKG5vcm0gKiBtKSAvIG0pO1xuXG4gICAgICBjYWNoZS5zZXQobnVtVG9rZW5zLCBuKTtcblxuICAgICAgcmV0dXJuIG5cbiAgICB9LFxuICAgIGNsZWFyKCkge1xuICAgICAgY2FjaGUuY2xlYXIoKTtcbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgRnVzZUluZGV4IHtcbiAgY29uc3RydWN0b3Ioe1xuICAgIGdldEZuID0gQ29uZmlnLmdldEZuLFxuICAgIGZpZWxkTm9ybVdlaWdodCA9IENvbmZpZy5maWVsZE5vcm1XZWlnaHRcbiAgfSA9IHt9KSB7XG4gICAgdGhpcy5ub3JtID0gbm9ybShmaWVsZE5vcm1XZWlnaHQsIDMpO1xuICAgIHRoaXMuZ2V0Rm4gPSBnZXRGbjtcbiAgICB0aGlzLmlzQ3JlYXRlZCA9IGZhbHNlO1xuXG4gICAgdGhpcy5zZXRJbmRleFJlY29yZHMoKTtcbiAgfVxuICBzZXRTb3VyY2VzKGRvY3MgPSBbXSkge1xuICAgIHRoaXMuZG9jcyA9IGRvY3M7XG4gIH1cbiAgc2V0SW5kZXhSZWNvcmRzKHJlY29yZHMgPSBbXSkge1xuICAgIHRoaXMucmVjb3JkcyA9IHJlY29yZHM7XG4gIH1cbiAgc2V0S2V5cyhrZXlzID0gW10pIHtcbiAgICB0aGlzLmtleXMgPSBrZXlzO1xuICAgIHRoaXMuX2tleXNNYXAgPSB7fTtcbiAgICBrZXlzLmZvckVhY2goKGtleSwgaWR4KSA9PiB7XG4gICAgICB0aGlzLl9rZXlzTWFwW2tleS5pZF0gPSBpZHg7XG4gICAgfSk7XG4gIH1cbiAgY3JlYXRlKCkge1xuICAgIGlmICh0aGlzLmlzQ3JlYXRlZCB8fCAhdGhpcy5kb2NzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdGhpcy5pc0NyZWF0ZWQgPSB0cnVlO1xuXG4gICAgLy8gTGlzdCBpcyBBcnJheTxTdHJpbmc+XG4gICAgaWYgKGlzU3RyaW5nKHRoaXMuZG9jc1swXSkpIHtcbiAgICAgIHRoaXMuZG9jcy5mb3JFYWNoKChkb2MsIGRvY0luZGV4KSA9PiB7XG4gICAgICAgIHRoaXMuX2FkZFN0cmluZyhkb2MsIGRvY0luZGV4KTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBMaXN0IGlzIEFycmF5PE9iamVjdD5cbiAgICAgIHRoaXMuZG9jcy5mb3JFYWNoKChkb2MsIGRvY0luZGV4KSA9PiB7XG4gICAgICAgIHRoaXMuX2FkZE9iamVjdChkb2MsIGRvY0luZGV4KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMubm9ybS5jbGVhcigpO1xuICB9XG4gIC8vIEFkZHMgYSBkb2MgdG8gdGhlIGVuZCBvZiB0aGUgaW5kZXhcbiAgYWRkKGRvYykge1xuICAgIGNvbnN0IGlkeCA9IHRoaXMuc2l6ZSgpO1xuXG4gICAgaWYgKGlzU3RyaW5nKGRvYykpIHtcbiAgICAgIHRoaXMuX2FkZFN0cmluZyhkb2MsIGlkeCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2FkZE9iamVjdChkb2MsIGlkeCk7XG4gICAgfVxuICB9XG4gIC8vIFJlbW92ZXMgdGhlIGRvYyBhdCB0aGUgc3BlY2lmaWVkIGluZGV4IG9mIHRoZSBpbmRleFxuICByZW1vdmVBdChpZHgpIHtcbiAgICB0aGlzLnJlY29yZHMuc3BsaWNlKGlkeCwgMSk7XG5cbiAgICAvLyBDaGFuZ2UgcmVmIGluZGV4IG9mIGV2ZXJ5IHN1YnNxdWVudCBkb2NcbiAgICBmb3IgKGxldCBpID0gaWR4LCBsZW4gPSB0aGlzLnNpemUoKTsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgICB0aGlzLnJlY29yZHNbaV0uaSAtPSAxO1xuICAgIH1cbiAgfVxuICBnZXRWYWx1ZUZvckl0ZW1BdEtleUlkKGl0ZW0sIGtleUlkKSB7XG4gICAgcmV0dXJuIGl0ZW1bdGhpcy5fa2V5c01hcFtrZXlJZF1dXG4gIH1cbiAgc2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWNvcmRzLmxlbmd0aFxuICB9XG4gIF9hZGRTdHJpbmcoZG9jLCBkb2NJbmRleCkge1xuICAgIGlmICghaXNEZWZpbmVkKGRvYykgfHwgaXNCbGFuayhkb2MpKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBsZXQgcmVjb3JkID0ge1xuICAgICAgdjogZG9jLFxuICAgICAgaTogZG9jSW5kZXgsXG4gICAgICBuOiB0aGlzLm5vcm0uZ2V0KGRvYylcbiAgICB9O1xuXG4gICAgdGhpcy5yZWNvcmRzLnB1c2gocmVjb3JkKTtcbiAgfVxuICBfYWRkT2JqZWN0KGRvYywgZG9jSW5kZXgpIHtcbiAgICBsZXQgcmVjb3JkID0geyBpOiBkb2NJbmRleCwgJDoge30gfTtcblxuICAgIC8vIEl0ZXJhdGUgb3ZlciBldmVyeSBrZXkgKGkuZSwgcGF0aCksIGFuZCBmZXRjaCB0aGUgdmFsdWUgYXQgdGhhdCBrZXlcbiAgICB0aGlzLmtleXMuZm9yRWFjaCgoa2V5LCBrZXlJbmRleCkgPT4ge1xuICAgICAgbGV0IHZhbHVlID0ga2V5LmdldEZuID8ga2V5LmdldEZuKGRvYykgOiB0aGlzLmdldEZuKGRvYywga2V5LnBhdGgpO1xuXG4gICAgICBpZiAoIWlzRGVmaW5lZCh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICBsZXQgc3ViUmVjb3JkcyA9IFtdO1xuICAgICAgICBjb25zdCBzdGFjayA9IFt7IG5lc3RlZEFyckluZGV4OiAtMSwgdmFsdWUgfV07XG5cbiAgICAgICAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnN0IHsgbmVzdGVkQXJySW5kZXgsIHZhbHVlIH0gPSBzdGFjay5wb3AoKTtcblxuICAgICAgICAgIGlmICghaXNEZWZpbmVkKHZhbHVlKSkge1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoaXNTdHJpbmcodmFsdWUpICYmICFpc0JsYW5rKHZhbHVlKSkge1xuICAgICAgICAgICAgbGV0IHN1YlJlY29yZCA9IHtcbiAgICAgICAgICAgICAgdjogdmFsdWUsXG4gICAgICAgICAgICAgIGk6IG5lc3RlZEFyckluZGV4LFxuICAgICAgICAgICAgICBuOiB0aGlzLm5vcm0uZ2V0KHZhbHVlKVxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc3ViUmVjb3Jkcy5wdXNoKHN1YlJlY29yZCk7XG4gICAgICAgICAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgICAgICAgdmFsdWUuZm9yRWFjaCgoaXRlbSwgaykgPT4ge1xuICAgICAgICAgICAgICBzdGFjay5wdXNoKHtcbiAgICAgICAgICAgICAgICBuZXN0ZWRBcnJJbmRleDogayxcbiAgICAgICAgICAgICAgICB2YWx1ZTogaXRlbVxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0gZWxzZSA7XG4gICAgICAgIH1cbiAgICAgICAgcmVjb3JkLiRba2V5SW5kZXhdID0gc3ViUmVjb3JkcztcbiAgICAgIH0gZWxzZSBpZiAoaXNTdHJpbmcodmFsdWUpICYmICFpc0JsYW5rKHZhbHVlKSkge1xuICAgICAgICBsZXQgc3ViUmVjb3JkID0ge1xuICAgICAgICAgIHY6IHZhbHVlLFxuICAgICAgICAgIG46IHRoaXMubm9ybS5nZXQodmFsdWUpXG4gICAgICAgIH07XG5cbiAgICAgICAgcmVjb3JkLiRba2V5SW5kZXhdID0gc3ViUmVjb3JkO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5yZWNvcmRzLnB1c2gocmVjb3JkKTtcbiAgfVxuICB0b0pTT04oKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGtleXM6IHRoaXMua2V5cyxcbiAgICAgIHJlY29yZHM6IHRoaXMucmVjb3Jkc1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjcmVhdGVJbmRleChcbiAga2V5cyxcbiAgZG9jcyxcbiAgeyBnZXRGbiA9IENvbmZpZy5nZXRGbiwgZmllbGROb3JtV2VpZ2h0ID0gQ29uZmlnLmZpZWxkTm9ybVdlaWdodCB9ID0ge31cbikge1xuICBjb25zdCBteUluZGV4ID0gbmV3IEZ1c2VJbmRleCh7IGdldEZuLCBmaWVsZE5vcm1XZWlnaHQgfSk7XG4gIG15SW5kZXguc2V0S2V5cyhrZXlzLm1hcChjcmVhdGVLZXkpKTtcbiAgbXlJbmRleC5zZXRTb3VyY2VzKGRvY3MpO1xuICBteUluZGV4LmNyZWF0ZSgpO1xuICByZXR1cm4gbXlJbmRleFxufVxuXG5mdW5jdGlvbiBwYXJzZUluZGV4KFxuICBkYXRhLFxuICB7IGdldEZuID0gQ29uZmlnLmdldEZuLCBmaWVsZE5vcm1XZWlnaHQgPSBDb25maWcuZmllbGROb3JtV2VpZ2h0IH0gPSB7fVxuKSB7XG4gIGNvbnN0IHsga2V5cywgcmVjb3JkcyB9ID0gZGF0YTtcbiAgY29uc3QgbXlJbmRleCA9IG5ldyBGdXNlSW5kZXgoeyBnZXRGbiwgZmllbGROb3JtV2VpZ2h0IH0pO1xuICBteUluZGV4LnNldEtleXMoa2V5cyk7XG4gIG15SW5kZXguc2V0SW5kZXhSZWNvcmRzKHJlY29yZHMpO1xuICByZXR1cm4gbXlJbmRleFxufVxuXG5mdW5jdGlvbiBjb21wdXRlU2NvcmUkMShcbiAgcGF0dGVybixcbiAge1xuICAgIGVycm9ycyA9IDAsXG4gICAgY3VycmVudExvY2F0aW9uID0gMCxcbiAgICBleHBlY3RlZExvY2F0aW9uID0gMCxcbiAgICBkaXN0YW5jZSA9IENvbmZpZy5kaXN0YW5jZSxcbiAgICBpZ25vcmVMb2NhdGlvbiA9IENvbmZpZy5pZ25vcmVMb2NhdGlvblxuICB9ID0ge31cbikge1xuICBjb25zdCBhY2N1cmFjeSA9IGVycm9ycyAvIHBhdHRlcm4ubGVuZ3RoO1xuXG4gIGlmIChpZ25vcmVMb2NhdGlvbikge1xuICAgIHJldHVybiBhY2N1cmFjeVxuICB9XG5cbiAgY29uc3QgcHJveGltaXR5ID0gTWF0aC5hYnMoZXhwZWN0ZWRMb2NhdGlvbiAtIGN1cnJlbnRMb2NhdGlvbik7XG5cbiAgaWYgKCFkaXN0YW5jZSkge1xuICAgIC8vIERvZGdlIGRpdmlkZSBieSB6ZXJvIGVycm9yLlxuICAgIHJldHVybiBwcm94aW1pdHkgPyAxLjAgOiBhY2N1cmFjeVxuICB9XG5cbiAgcmV0dXJuIGFjY3VyYWN5ICsgcHJveGltaXR5IC8gZGlzdGFuY2Vcbn1cblxuZnVuY3Rpb24gY29udmVydE1hc2tUb0luZGljZXMoXG4gIG1hdGNobWFzayA9IFtdLFxuICBtaW5NYXRjaENoYXJMZW5ndGggPSBDb25maWcubWluTWF0Y2hDaGFyTGVuZ3RoXG4pIHtcbiAgbGV0IGluZGljZXMgPSBbXTtcbiAgbGV0IHN0YXJ0ID0gLTE7XG4gIGxldCBlbmQgPSAtMTtcbiAgbGV0IGkgPSAwO1xuXG4gIGZvciAobGV0IGxlbiA9IG1hdGNobWFzay5sZW5ndGg7IGkgPCBsZW47IGkgKz0gMSkge1xuICAgIGxldCBtYXRjaCA9IG1hdGNobWFza1tpXTtcbiAgICBpZiAobWF0Y2ggJiYgc3RhcnQgPT09IC0xKSB7XG4gICAgICBzdGFydCA9IGk7XG4gICAgfSBlbHNlIGlmICghbWF0Y2ggJiYgc3RhcnQgIT09IC0xKSB7XG4gICAgICBlbmQgPSBpIC0gMTtcbiAgICAgIGlmIChlbmQgLSBzdGFydCArIDEgPj0gbWluTWF0Y2hDaGFyTGVuZ3RoKSB7XG4gICAgICAgIGluZGljZXMucHVzaChbc3RhcnQsIGVuZF0pO1xuICAgICAgfVxuICAgICAgc3RhcnQgPSAtMTtcbiAgICB9XG4gIH1cblxuICAvLyAoaS0xIC0gc3RhcnQpICsgMSA9PiBpIC0gc3RhcnRcbiAgaWYgKG1hdGNobWFza1tpIC0gMV0gJiYgaSAtIHN0YXJ0ID49IG1pbk1hdGNoQ2hhckxlbmd0aCkge1xuICAgIGluZGljZXMucHVzaChbc3RhcnQsIGkgLSAxXSk7XG4gIH1cblxuICByZXR1cm4gaW5kaWNlc1xufVxuXG4vLyBNYWNoaW5lIHdvcmQgc2l6ZVxuY29uc3QgTUFYX0JJVFMgPSAzMjtcblxuZnVuY3Rpb24gc2VhcmNoKFxuICB0ZXh0LFxuICBwYXR0ZXJuLFxuICBwYXR0ZXJuQWxwaGFiZXQsXG4gIHtcbiAgICBsb2NhdGlvbiA9IENvbmZpZy5sb2NhdGlvbixcbiAgICBkaXN0YW5jZSA9IENvbmZpZy5kaXN0YW5jZSxcbiAgICB0aHJlc2hvbGQgPSBDb25maWcudGhyZXNob2xkLFxuICAgIGZpbmRBbGxNYXRjaGVzID0gQ29uZmlnLmZpbmRBbGxNYXRjaGVzLFxuICAgIG1pbk1hdGNoQ2hhckxlbmd0aCA9IENvbmZpZy5taW5NYXRjaENoYXJMZW5ndGgsXG4gICAgaW5jbHVkZU1hdGNoZXMgPSBDb25maWcuaW5jbHVkZU1hdGNoZXMsXG4gICAgaWdub3JlTG9jYXRpb24gPSBDb25maWcuaWdub3JlTG9jYXRpb25cbiAgfSA9IHt9XG4pIHtcbiAgaWYgKHBhdHRlcm4ubGVuZ3RoID4gTUFYX0JJVFMpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoUEFUVEVSTl9MRU5HVEhfVE9PX0xBUkdFKE1BWF9CSVRTKSlcbiAgfVxuXG4gIGNvbnN0IHBhdHRlcm5MZW4gPSBwYXR0ZXJuLmxlbmd0aDtcbiAgLy8gU2V0IHN0YXJ0aW5nIGxvY2F0aW9uIGF0IGJlZ2lubmluZyB0ZXh0IGFuZCBpbml0aWFsaXplIHRoZSBhbHBoYWJldC5cbiAgY29uc3QgdGV4dExlbiA9IHRleHQubGVuZ3RoO1xuICAvLyBIYW5kbGUgdGhlIGNhc2Ugd2hlbiBsb2NhdGlvbiA+IHRleHQubGVuZ3RoXG4gIGNvbnN0IGV4cGVjdGVkTG9jYXRpb24gPSBNYXRoLm1heCgwLCBNYXRoLm1pbihsb2NhdGlvbiwgdGV4dExlbikpO1xuICAvLyBIaWdoZXN0IHNjb3JlIGJleW9uZCB3aGljaCB3ZSBnaXZlIHVwLlxuICBsZXQgY3VycmVudFRocmVzaG9sZCA9IHRocmVzaG9sZDtcbiAgLy8gSXMgdGhlcmUgYSBuZWFyYnkgZXhhY3QgbWF0Y2g/IChzcGVlZHVwKVxuICBsZXQgYmVzdExvY2F0aW9uID0gZXhwZWN0ZWRMb2NhdGlvbjtcblxuICAvLyBQZXJmb3JtYW5jZTogb25seSBjb21wdXRlciBtYXRjaGVzIHdoZW4gdGhlIG1pbk1hdGNoQ2hhckxlbmd0aCA+IDFcbiAgLy8gT1IgaWYgYGluY2x1ZGVNYXRjaGVzYCBpcyB0cnVlLlxuICBjb25zdCBjb21wdXRlTWF0Y2hlcyA9IG1pbk1hdGNoQ2hhckxlbmd0aCA+IDEgfHwgaW5jbHVkZU1hdGNoZXM7XG4gIC8vIEEgbWFzayBvZiB0aGUgbWF0Y2hlcywgdXNlZCBmb3IgYnVpbGRpbmcgdGhlIGluZGljZXNcbiAgY29uc3QgbWF0Y2hNYXNrID0gY29tcHV0ZU1hdGNoZXMgPyBBcnJheSh0ZXh0TGVuKSA6IFtdO1xuXG4gIGxldCBpbmRleDtcblxuICAvLyBHZXQgYWxsIGV4YWN0IG1hdGNoZXMsIGhlcmUgZm9yIHNwZWVkIHVwXG4gIHdoaWxlICgoaW5kZXggPSB0ZXh0LmluZGV4T2YocGF0dGVybiwgYmVzdExvY2F0aW9uKSkgPiAtMSkge1xuICAgIGxldCBzY29yZSA9IGNvbXB1dGVTY29yZSQxKHBhdHRlcm4sIHtcbiAgICAgIGN1cnJlbnRMb2NhdGlvbjogaW5kZXgsXG4gICAgICBleHBlY3RlZExvY2F0aW9uLFxuICAgICAgZGlzdGFuY2UsXG4gICAgICBpZ25vcmVMb2NhdGlvblxuICAgIH0pO1xuXG4gICAgY3VycmVudFRocmVzaG9sZCA9IE1hdGgubWluKHNjb3JlLCBjdXJyZW50VGhyZXNob2xkKTtcbiAgICBiZXN0TG9jYXRpb24gPSBpbmRleCArIHBhdHRlcm5MZW47XG5cbiAgICBpZiAoY29tcHV0ZU1hdGNoZXMpIHtcbiAgICAgIGxldCBpID0gMDtcbiAgICAgIHdoaWxlIChpIDwgcGF0dGVybkxlbikge1xuICAgICAgICBtYXRjaE1hc2tbaW5kZXggKyBpXSA9IDE7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBSZXNldCB0aGUgYmVzdCBsb2NhdGlvblxuICBiZXN0TG9jYXRpb24gPSAtMTtcblxuICBsZXQgbGFzdEJpdEFyciA9IFtdO1xuICBsZXQgZmluYWxTY29yZSA9IDE7XG4gIGxldCBiaW5NYXggPSBwYXR0ZXJuTGVuICsgdGV4dExlbjtcblxuICBjb25zdCBtYXNrID0gMSA8PCAocGF0dGVybkxlbiAtIDEpO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgcGF0dGVybkxlbjsgaSArPSAxKSB7XG4gICAgLy8gU2NhbiBmb3IgdGhlIGJlc3QgbWF0Y2g7IGVhY2ggaXRlcmF0aW9uIGFsbG93cyBmb3Igb25lIG1vcmUgZXJyb3IuXG4gICAgLy8gUnVuIGEgYmluYXJ5IHNlYXJjaCB0byBkZXRlcm1pbmUgaG93IGZhciBmcm9tIHRoZSBtYXRjaCBsb2NhdGlvbiB3ZSBjYW4gc3RyYXlcbiAgICAvLyBhdCB0aGlzIGVycm9yIGxldmVsLlxuICAgIGxldCBiaW5NaW4gPSAwO1xuICAgIGxldCBiaW5NaWQgPSBiaW5NYXg7XG5cbiAgICB3aGlsZSAoYmluTWluIDwgYmluTWlkKSB7XG4gICAgICBjb25zdCBzY29yZSA9IGNvbXB1dGVTY29yZSQxKHBhdHRlcm4sIHtcbiAgICAgICAgZXJyb3JzOiBpLFxuICAgICAgICBjdXJyZW50TG9jYXRpb246IGV4cGVjdGVkTG9jYXRpb24gKyBiaW5NaWQsXG4gICAgICAgIGV4cGVjdGVkTG9jYXRpb24sXG4gICAgICAgIGRpc3RhbmNlLFxuICAgICAgICBpZ25vcmVMb2NhdGlvblxuICAgICAgfSk7XG5cbiAgICAgIGlmIChzY29yZSA8PSBjdXJyZW50VGhyZXNob2xkKSB7XG4gICAgICAgIGJpbk1pbiA9IGJpbk1pZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJpbk1heCA9IGJpbk1pZDtcbiAgICAgIH1cblxuICAgICAgYmluTWlkID0gTWF0aC5mbG9vcigoYmluTWF4IC0gYmluTWluKSAvIDIgKyBiaW5NaW4pO1xuICAgIH1cblxuICAgIC8vIFVzZSB0aGUgcmVzdWx0IGZyb20gdGhpcyBpdGVyYXRpb24gYXMgdGhlIG1heGltdW0gZm9yIHRoZSBuZXh0LlxuICAgIGJpbk1heCA9IGJpbk1pZDtcblxuICAgIGxldCBzdGFydCA9IE1hdGgubWF4KDEsIGV4cGVjdGVkTG9jYXRpb24gLSBiaW5NaWQgKyAxKTtcbiAgICBsZXQgZmluaXNoID0gZmluZEFsbE1hdGNoZXNcbiAgICAgID8gdGV4dExlblxuICAgICAgOiBNYXRoLm1pbihleHBlY3RlZExvY2F0aW9uICsgYmluTWlkLCB0ZXh0TGVuKSArIHBhdHRlcm5MZW47XG5cbiAgICAvLyBJbml0aWFsaXplIHRoZSBiaXQgYXJyYXlcbiAgICBsZXQgYml0QXJyID0gQXJyYXkoZmluaXNoICsgMik7XG5cbiAgICBiaXRBcnJbZmluaXNoICsgMV0gPSAoMSA8PCBpKSAtIDE7XG5cbiAgICBmb3IgKGxldCBqID0gZmluaXNoOyBqID49IHN0YXJ0OyBqIC09IDEpIHtcbiAgICAgIGxldCBjdXJyZW50TG9jYXRpb24gPSBqIC0gMTtcbiAgICAgIGxldCBjaGFyTWF0Y2ggPSBwYXR0ZXJuQWxwaGFiZXRbdGV4dC5jaGFyQXQoY3VycmVudExvY2F0aW9uKV07XG5cbiAgICAgIGlmIChjb21wdXRlTWF0Y2hlcykge1xuICAgICAgICAvLyBTcGVlZCB1cDogcXVpY2sgYm9vbCB0byBpbnQgY29udmVyc2lvbiAoaS5lLCBgY2hhck1hdGNoID8gMSA6IDBgKVxuICAgICAgICBtYXRjaE1hc2tbY3VycmVudExvY2F0aW9uXSA9ICshIWNoYXJNYXRjaDtcbiAgICAgIH1cblxuICAgICAgLy8gRmlyc3QgcGFzczogZXhhY3QgbWF0Y2hcbiAgICAgIGJpdEFycltqXSA9ICgoYml0QXJyW2ogKyAxXSA8PCAxKSB8IDEpICYgY2hhck1hdGNoO1xuXG4gICAgICAvLyBTdWJzZXF1ZW50IHBhc3NlczogZnV6enkgbWF0Y2hcbiAgICAgIGlmIChpKSB7XG4gICAgICAgIGJpdEFycltqXSB8PVxuICAgICAgICAgICgobGFzdEJpdEFycltqICsgMV0gfCBsYXN0Qml0QXJyW2pdKSA8PCAxKSB8IDEgfCBsYXN0Qml0QXJyW2ogKyAxXTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJpdEFycltqXSAmIG1hc2spIHtcbiAgICAgICAgZmluYWxTY29yZSA9IGNvbXB1dGVTY29yZSQxKHBhdHRlcm4sIHtcbiAgICAgICAgICBlcnJvcnM6IGksXG4gICAgICAgICAgY3VycmVudExvY2F0aW9uLFxuICAgICAgICAgIGV4cGVjdGVkTG9jYXRpb24sXG4gICAgICAgICAgZGlzdGFuY2UsXG4gICAgICAgICAgaWdub3JlTG9jYXRpb25cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gVGhpcyBtYXRjaCB3aWxsIGFsbW9zdCBjZXJ0YWlubHkgYmUgYmV0dGVyIHRoYW4gYW55IGV4aXN0aW5nIG1hdGNoLlxuICAgICAgICAvLyBCdXQgY2hlY2sgYW55d2F5LlxuICAgICAgICBpZiAoZmluYWxTY29yZSA8PSBjdXJyZW50VGhyZXNob2xkKSB7XG4gICAgICAgICAgLy8gSW5kZWVkIGl0IGlzXG4gICAgICAgICAgY3VycmVudFRocmVzaG9sZCA9IGZpbmFsU2NvcmU7XG4gICAgICAgICAgYmVzdExvY2F0aW9uID0gY3VycmVudExvY2F0aW9uO1xuXG4gICAgICAgICAgLy8gQWxyZWFkeSBwYXNzZWQgYGxvY2AsIGRvd25oaWxsIGZyb20gaGVyZSBvbiBpbi5cbiAgICAgICAgICBpZiAoYmVzdExvY2F0aW9uIDw9IGV4cGVjdGVkTG9jYXRpb24pIHtcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gV2hlbiBwYXNzaW5nIGBiZXN0TG9jYXRpb25gLCBkb24ndCBleGNlZWQgb3VyIGN1cnJlbnQgZGlzdGFuY2UgZnJvbSBgZXhwZWN0ZWRMb2NhdGlvbmAuXG4gICAgICAgICAgc3RhcnQgPSBNYXRoLm1heCgxLCAyICogZXhwZWN0ZWRMb2NhdGlvbiAtIGJlc3RMb2NhdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBObyBob3BlIGZvciBhIChiZXR0ZXIpIG1hdGNoIGF0IGdyZWF0ZXIgZXJyb3IgbGV2ZWxzLlxuICAgIGNvbnN0IHNjb3JlID0gY29tcHV0ZVNjb3JlJDEocGF0dGVybiwge1xuICAgICAgZXJyb3JzOiBpICsgMSxcbiAgICAgIGN1cnJlbnRMb2NhdGlvbjogZXhwZWN0ZWRMb2NhdGlvbixcbiAgICAgIGV4cGVjdGVkTG9jYXRpb24sXG4gICAgICBkaXN0YW5jZSxcbiAgICAgIGlnbm9yZUxvY2F0aW9uXG4gICAgfSk7XG5cbiAgICBpZiAoc2NvcmUgPiBjdXJyZW50VGhyZXNob2xkKSB7XG4gICAgICBicmVha1xuICAgIH1cblxuICAgIGxhc3RCaXRBcnIgPSBiaXRBcnI7XG4gIH1cblxuICBjb25zdCByZXN1bHQgPSB7XG4gICAgaXNNYXRjaDogYmVzdExvY2F0aW9uID49IDAsXG4gICAgLy8gQ291bnQgZXhhY3QgbWF0Y2hlcyAodGhvc2Ugd2l0aCBhIHNjb3JlIG9mIDApIHRvIGJlIFwiYWxtb3N0XCIgZXhhY3RcbiAgICBzY29yZTogTWF0aC5tYXgoMC4wMDEsIGZpbmFsU2NvcmUpXG4gIH07XG5cbiAgaWYgKGNvbXB1dGVNYXRjaGVzKSB7XG4gICAgY29uc3QgaW5kaWNlcyA9IGNvbnZlcnRNYXNrVG9JbmRpY2VzKG1hdGNoTWFzaywgbWluTWF0Y2hDaGFyTGVuZ3RoKTtcbiAgICBpZiAoIWluZGljZXMubGVuZ3RoKSB7XG4gICAgICByZXN1bHQuaXNNYXRjaCA9IGZhbHNlO1xuICAgIH0gZWxzZSBpZiAoaW5jbHVkZU1hdGNoZXMpIHtcbiAgICAgIHJlc3VsdC5pbmRpY2VzID0gaW5kaWNlcztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVBhdHRlcm5BbHBoYWJldChwYXR0ZXJuKSB7XG4gIGxldCBtYXNrID0ge307XG5cbiAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHBhdHRlcm4ubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICBjb25zdCBjaGFyID0gcGF0dGVybi5jaGFyQXQoaSk7XG4gICAgbWFza1tjaGFyXSA9IChtYXNrW2NoYXJdIHx8IDApIHwgKDEgPDwgKGxlbiAtIGkgLSAxKSk7XG4gIH1cblxuICByZXR1cm4gbWFza1xufVxuXG5jbGFzcyBCaXRhcFNlYXJjaCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHBhdHRlcm4sXG4gICAge1xuICAgICAgbG9jYXRpb24gPSBDb25maWcubG9jYXRpb24sXG4gICAgICB0aHJlc2hvbGQgPSBDb25maWcudGhyZXNob2xkLFxuICAgICAgZGlzdGFuY2UgPSBDb25maWcuZGlzdGFuY2UsXG4gICAgICBpbmNsdWRlTWF0Y2hlcyA9IENvbmZpZy5pbmNsdWRlTWF0Y2hlcyxcbiAgICAgIGZpbmRBbGxNYXRjaGVzID0gQ29uZmlnLmZpbmRBbGxNYXRjaGVzLFxuICAgICAgbWluTWF0Y2hDaGFyTGVuZ3RoID0gQ29uZmlnLm1pbk1hdGNoQ2hhckxlbmd0aCxcbiAgICAgIGlzQ2FzZVNlbnNpdGl2ZSA9IENvbmZpZy5pc0Nhc2VTZW5zaXRpdmUsXG4gICAgICBpZ25vcmVMb2NhdGlvbiA9IENvbmZpZy5pZ25vcmVMb2NhdGlvblxuICAgIH0gPSB7fVxuICApIHtcbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICBsb2NhdGlvbixcbiAgICAgIHRocmVzaG9sZCxcbiAgICAgIGRpc3RhbmNlLFxuICAgICAgaW5jbHVkZU1hdGNoZXMsXG4gICAgICBmaW5kQWxsTWF0Y2hlcyxcbiAgICAgIG1pbk1hdGNoQ2hhckxlbmd0aCxcbiAgICAgIGlzQ2FzZVNlbnNpdGl2ZSxcbiAgICAgIGlnbm9yZUxvY2F0aW9uXG4gICAgfTtcblxuICAgIHRoaXMucGF0dGVybiA9IGlzQ2FzZVNlbnNpdGl2ZSA/IHBhdHRlcm4gOiBwYXR0ZXJuLnRvTG93ZXJDYXNlKCk7XG5cbiAgICB0aGlzLmNodW5rcyA9IFtdO1xuXG4gICAgaWYgKCF0aGlzLnBhdHRlcm4ubGVuZ3RoKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBhZGRDaHVuayA9IChwYXR0ZXJuLCBzdGFydEluZGV4KSA9PiB7XG4gICAgICB0aGlzLmNodW5rcy5wdXNoKHtcbiAgICAgICAgcGF0dGVybixcbiAgICAgICAgYWxwaGFiZXQ6IGNyZWF0ZVBhdHRlcm5BbHBoYWJldChwYXR0ZXJuKSxcbiAgICAgICAgc3RhcnRJbmRleFxuICAgICAgfSk7XG4gICAgfTtcblxuICAgIGNvbnN0IGxlbiA9IHRoaXMucGF0dGVybi5sZW5ndGg7XG5cbiAgICBpZiAobGVuID4gTUFYX0JJVFMpIHtcbiAgICAgIGxldCBpID0gMDtcbiAgICAgIGNvbnN0IHJlbWFpbmRlciA9IGxlbiAlIE1BWF9CSVRTO1xuICAgICAgY29uc3QgZW5kID0gbGVuIC0gcmVtYWluZGVyO1xuXG4gICAgICB3aGlsZSAoaSA8IGVuZCkge1xuICAgICAgICBhZGRDaHVuayh0aGlzLnBhdHRlcm4uc3Vic3RyKGksIE1BWF9CSVRTKSwgaSk7XG4gICAgICAgIGkgKz0gTUFYX0JJVFM7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZW1haW5kZXIpIHtcbiAgICAgICAgY29uc3Qgc3RhcnRJbmRleCA9IGxlbiAtIE1BWF9CSVRTO1xuICAgICAgICBhZGRDaHVuayh0aGlzLnBhdHRlcm4uc3Vic3RyKHN0YXJ0SW5kZXgpLCBzdGFydEluZGV4KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgYWRkQ2h1bmsodGhpcy5wYXR0ZXJuLCAwKTtcbiAgICB9XG4gIH1cblxuICBzZWFyY2hJbih0ZXh0KSB7XG4gICAgY29uc3QgeyBpc0Nhc2VTZW5zaXRpdmUsIGluY2x1ZGVNYXRjaGVzIH0gPSB0aGlzLm9wdGlvbnM7XG5cbiAgICBpZiAoIWlzQ2FzZVNlbnNpdGl2ZSkge1xuICAgICAgdGV4dCA9IHRleHQudG9Mb3dlckNhc2UoKTtcbiAgICB9XG5cbiAgICAvLyBFeGFjdCBtYXRjaFxuICAgIGlmICh0aGlzLnBhdHRlcm4gPT09IHRleHQpIHtcbiAgICAgIGxldCByZXN1bHQgPSB7XG4gICAgICAgIGlzTWF0Y2g6IHRydWUsXG4gICAgICAgIHNjb3JlOiAwXG4gICAgICB9O1xuXG4gICAgICBpZiAoaW5jbHVkZU1hdGNoZXMpIHtcbiAgICAgICAgcmVzdWx0LmluZGljZXMgPSBbWzAsIHRleHQubGVuZ3RoIC0gMV1dO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gcmVzdWx0XG4gICAgfVxuXG4gICAgLy8gT3RoZXJ3aXNlLCB1c2UgQml0YXAgYWxnb3JpdGhtXG4gICAgY29uc3Qge1xuICAgICAgbG9jYXRpb24sXG4gICAgICBkaXN0YW5jZSxcbiAgICAgIHRocmVzaG9sZCxcbiAgICAgIGZpbmRBbGxNYXRjaGVzLFxuICAgICAgbWluTWF0Y2hDaGFyTGVuZ3RoLFxuICAgICAgaWdub3JlTG9jYXRpb25cbiAgICB9ID0gdGhpcy5vcHRpb25zO1xuXG4gICAgbGV0IGFsbEluZGljZXMgPSBbXTtcbiAgICBsZXQgdG90YWxTY29yZSA9IDA7XG4gICAgbGV0IGhhc01hdGNoZXMgPSBmYWxzZTtcblxuICAgIHRoaXMuY2h1bmtzLmZvckVhY2goKHsgcGF0dGVybiwgYWxwaGFiZXQsIHN0YXJ0SW5kZXggfSkgPT4ge1xuICAgICAgY29uc3QgeyBpc01hdGNoLCBzY29yZSwgaW5kaWNlcyB9ID0gc2VhcmNoKHRleHQsIHBhdHRlcm4sIGFscGhhYmV0LCB7XG4gICAgICAgIGxvY2F0aW9uOiBsb2NhdGlvbiArIHN0YXJ0SW5kZXgsXG4gICAgICAgIGRpc3RhbmNlLFxuICAgICAgICB0aHJlc2hvbGQsXG4gICAgICAgIGZpbmRBbGxNYXRjaGVzLFxuICAgICAgICBtaW5NYXRjaENoYXJMZW5ndGgsXG4gICAgICAgIGluY2x1ZGVNYXRjaGVzLFxuICAgICAgICBpZ25vcmVMb2NhdGlvblxuICAgICAgfSk7XG5cbiAgICAgIGlmIChpc01hdGNoKSB7XG4gICAgICAgIGhhc01hdGNoZXMgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICB0b3RhbFNjb3JlICs9IHNjb3JlO1xuXG4gICAgICBpZiAoaXNNYXRjaCAmJiBpbmRpY2VzKSB7XG4gICAgICAgIGFsbEluZGljZXMgPSBbLi4uYWxsSW5kaWNlcywgLi4uaW5kaWNlc107XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgaXNNYXRjaDogaGFzTWF0Y2hlcyxcbiAgICAgIHNjb3JlOiBoYXNNYXRjaGVzID8gdG90YWxTY29yZSAvIHRoaXMuY2h1bmtzLmxlbmd0aCA6IDFcbiAgICB9O1xuXG4gICAgaWYgKGhhc01hdGNoZXMgJiYgaW5jbHVkZU1hdGNoZXMpIHtcbiAgICAgIHJlc3VsdC5pbmRpY2VzID0gYWxsSW5kaWNlcztcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0XG4gIH1cbn1cblxuY2xhc3MgQmFzZU1hdGNoIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHRoaXMucGF0dGVybiA9IHBhdHRlcm47XG4gIH1cbiAgc3RhdGljIGlzTXVsdGlNYXRjaChwYXR0ZXJuKSB7XG4gICAgcmV0dXJuIGdldE1hdGNoKHBhdHRlcm4sIHRoaXMubXVsdGlSZWdleClcbiAgfVxuICBzdGF0aWMgaXNTaW5nbGVNYXRjaChwYXR0ZXJuKSB7XG4gICAgcmV0dXJuIGdldE1hdGNoKHBhdHRlcm4sIHRoaXMuc2luZ2xlUmVnZXgpXG4gIH1cbiAgc2VhcmNoKC8qdGV4dCovKSB7fVxufVxuXG5mdW5jdGlvbiBnZXRNYXRjaChwYXR0ZXJuLCBleHApIHtcbiAgY29uc3QgbWF0Y2hlcyA9IHBhdHRlcm4ubWF0Y2goZXhwKTtcbiAgcmV0dXJuIG1hdGNoZXMgPyBtYXRjaGVzWzFdIDogbnVsbFxufVxuXG4vLyBUb2tlbjogJ2ZpbGVcblxuY2xhc3MgRXhhY3RNYXRjaCBleHRlbmRzIEJhc2VNYXRjaCB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICBzdXBlcihwYXR0ZXJuKTtcbiAgfVxuICBzdGF0aWMgZ2V0IHR5cGUoKSB7XG4gICAgcmV0dXJuICdleGFjdCdcbiAgfVxuICBzdGF0aWMgZ2V0IG11bHRpUmVnZXgoKSB7XG4gICAgcmV0dXJuIC9ePVwiKC4qKVwiJC9cbiAgfVxuICBzdGF0aWMgZ2V0IHNpbmdsZVJlZ2V4KCkge1xuICAgIHJldHVybiAvXj0oLiopJC9cbiAgfVxuICBzZWFyY2godGV4dCkge1xuICAgIGNvbnN0IGlzTWF0Y2ggPSB0ZXh0ID09PSB0aGlzLnBhdHRlcm47XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNNYXRjaCxcbiAgICAgIHNjb3JlOiBpc01hdGNoID8gMCA6IDEsXG4gICAgICBpbmRpY2VzOiBbMCwgdGhpcy5wYXR0ZXJuLmxlbmd0aCAtIDFdXG4gICAgfVxuICB9XG59XG5cbi8vIFRva2VuOiAhZmlyZVxuXG5jbGFzcyBJbnZlcnNlRXhhY3RNYXRjaCBleHRlbmRzIEJhc2VNYXRjaCB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICBzdXBlcihwYXR0ZXJuKTtcbiAgfVxuICBzdGF0aWMgZ2V0IHR5cGUoKSB7XG4gICAgcmV0dXJuICdpbnZlcnNlLWV4YWN0J1xuICB9XG4gIHN0YXRpYyBnZXQgbXVsdGlSZWdleCgpIHtcbiAgICByZXR1cm4gL14hXCIoLiopXCIkL1xuICB9XG4gIHN0YXRpYyBnZXQgc2luZ2xlUmVnZXgoKSB7XG4gICAgcmV0dXJuIC9eISguKikkL1xuICB9XG4gIHNlYXJjaCh0ZXh0KSB7XG4gICAgY29uc3QgaW5kZXggPSB0ZXh0LmluZGV4T2YodGhpcy5wYXR0ZXJuKTtcbiAgICBjb25zdCBpc01hdGNoID0gaW5kZXggPT09IC0xO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlzTWF0Y2gsXG4gICAgICBzY29yZTogaXNNYXRjaCA/IDAgOiAxLFxuICAgICAgaW5kaWNlczogWzAsIHRleHQubGVuZ3RoIC0gMV1cbiAgICB9XG4gIH1cbn1cblxuLy8gVG9rZW46IF5maWxlXG5cbmNsYXNzIFByZWZpeEV4YWN0TWF0Y2ggZXh0ZW5kcyBCYXNlTWF0Y2gge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgc3VwZXIocGF0dGVybik7XG4gIH1cbiAgc3RhdGljIGdldCB0eXBlKCkge1xuICAgIHJldHVybiAncHJlZml4LWV4YWN0J1xuICB9XG4gIHN0YXRpYyBnZXQgbXVsdGlSZWdleCgpIHtcbiAgICByZXR1cm4gL15cXF5cIiguKilcIiQvXG4gIH1cbiAgc3RhdGljIGdldCBzaW5nbGVSZWdleCgpIHtcbiAgICByZXR1cm4gL15cXF4oLiopJC9cbiAgfVxuICBzZWFyY2godGV4dCkge1xuICAgIGNvbnN0IGlzTWF0Y2ggPSB0ZXh0LnN0YXJ0c1dpdGgodGhpcy5wYXR0ZXJuKTtcblxuICAgIHJldHVybiB7XG4gICAgICBpc01hdGNoLFxuICAgICAgc2NvcmU6IGlzTWF0Y2ggPyAwIDogMSxcbiAgICAgIGluZGljZXM6IFswLCB0aGlzLnBhdHRlcm4ubGVuZ3RoIC0gMV1cbiAgICB9XG4gIH1cbn1cblxuLy8gVG9rZW46ICFeZmlyZVxuXG5jbGFzcyBJbnZlcnNlUHJlZml4RXhhY3RNYXRjaCBleHRlbmRzIEJhc2VNYXRjaCB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICBzdXBlcihwYXR0ZXJuKTtcbiAgfVxuICBzdGF0aWMgZ2V0IHR5cGUoKSB7XG4gICAgcmV0dXJuICdpbnZlcnNlLXByZWZpeC1leGFjdCdcbiAgfVxuICBzdGF0aWMgZ2V0IG11bHRpUmVnZXgoKSB7XG4gICAgcmV0dXJuIC9eIVxcXlwiKC4qKVwiJC9cbiAgfVxuICBzdGF0aWMgZ2V0IHNpbmdsZVJlZ2V4KCkge1xuICAgIHJldHVybiAvXiFcXF4oLiopJC9cbiAgfVxuICBzZWFyY2godGV4dCkge1xuICAgIGNvbnN0IGlzTWF0Y2ggPSAhdGV4dC5zdGFydHNXaXRoKHRoaXMucGF0dGVybik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNNYXRjaCxcbiAgICAgIHNjb3JlOiBpc01hdGNoID8gMCA6IDEsXG4gICAgICBpbmRpY2VzOiBbMCwgdGV4dC5sZW5ndGggLSAxXVxuICAgIH1cbiAgfVxufVxuXG4vLyBUb2tlbjogLmZpbGUkXG5cbmNsYXNzIFN1ZmZpeEV4YWN0TWF0Y2ggZXh0ZW5kcyBCYXNlTWF0Y2gge1xuICBjb25zdHJ1Y3RvcihwYXR0ZXJuKSB7XG4gICAgc3VwZXIocGF0dGVybik7XG4gIH1cbiAgc3RhdGljIGdldCB0eXBlKCkge1xuICAgIHJldHVybiAnc3VmZml4LWV4YWN0J1xuICB9XG4gIHN0YXRpYyBnZXQgbXVsdGlSZWdleCgpIHtcbiAgICByZXR1cm4gL15cIiguKilcIlxcJCQvXG4gIH1cbiAgc3RhdGljIGdldCBzaW5nbGVSZWdleCgpIHtcbiAgICByZXR1cm4gL14oLiopXFwkJC9cbiAgfVxuICBzZWFyY2godGV4dCkge1xuICAgIGNvbnN0IGlzTWF0Y2ggPSB0ZXh0LmVuZHNXaXRoKHRoaXMucGF0dGVybik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaXNNYXRjaCxcbiAgICAgIHNjb3JlOiBpc01hdGNoID8gMCA6IDEsXG4gICAgICBpbmRpY2VzOiBbdGV4dC5sZW5ndGggLSB0aGlzLnBhdHRlcm4ubGVuZ3RoLCB0ZXh0Lmxlbmd0aCAtIDFdXG4gICAgfVxuICB9XG59XG5cbi8vIFRva2VuOiAhLmZpbGUkXG5cbmNsYXNzIEludmVyc2VTdWZmaXhFeGFjdE1hdGNoIGV4dGVuZHMgQmFzZU1hdGNoIHtcbiAgY29uc3RydWN0b3IocGF0dGVybikge1xuICAgIHN1cGVyKHBhdHRlcm4pO1xuICB9XG4gIHN0YXRpYyBnZXQgdHlwZSgpIHtcbiAgICByZXR1cm4gJ2ludmVyc2Utc3VmZml4LWV4YWN0J1xuICB9XG4gIHN0YXRpYyBnZXQgbXVsdGlSZWdleCgpIHtcbiAgICByZXR1cm4gL14hXCIoLiopXCJcXCQkL1xuICB9XG4gIHN0YXRpYyBnZXQgc2luZ2xlUmVnZXgoKSB7XG4gICAgcmV0dXJuIC9eISguKilcXCQkL1xuICB9XG4gIHNlYXJjaCh0ZXh0KSB7XG4gICAgY29uc3QgaXNNYXRjaCA9ICF0ZXh0LmVuZHNXaXRoKHRoaXMucGF0dGVybik7XG4gICAgcmV0dXJuIHtcbiAgICAgIGlzTWF0Y2gsXG4gICAgICBzY29yZTogaXNNYXRjaCA/IDAgOiAxLFxuICAgICAgaW5kaWNlczogWzAsIHRleHQubGVuZ3RoIC0gMV1cbiAgICB9XG4gIH1cbn1cblxuY2xhc3MgRnV6enlNYXRjaCBleHRlbmRzIEJhc2VNYXRjaCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHBhdHRlcm4sXG4gICAge1xuICAgICAgbG9jYXRpb24gPSBDb25maWcubG9jYXRpb24sXG4gICAgICB0aHJlc2hvbGQgPSBDb25maWcudGhyZXNob2xkLFxuICAgICAgZGlzdGFuY2UgPSBDb25maWcuZGlzdGFuY2UsXG4gICAgICBpbmNsdWRlTWF0Y2hlcyA9IENvbmZpZy5pbmNsdWRlTWF0Y2hlcyxcbiAgICAgIGZpbmRBbGxNYXRjaGVzID0gQ29uZmlnLmZpbmRBbGxNYXRjaGVzLFxuICAgICAgbWluTWF0Y2hDaGFyTGVuZ3RoID0gQ29uZmlnLm1pbk1hdGNoQ2hhckxlbmd0aCxcbiAgICAgIGlzQ2FzZVNlbnNpdGl2ZSA9IENvbmZpZy5pc0Nhc2VTZW5zaXRpdmUsXG4gICAgICBpZ25vcmVMb2NhdGlvbiA9IENvbmZpZy5pZ25vcmVMb2NhdGlvblxuICAgIH0gPSB7fVxuICApIHtcbiAgICBzdXBlcihwYXR0ZXJuKTtcbiAgICB0aGlzLl9iaXRhcFNlYXJjaCA9IG5ldyBCaXRhcFNlYXJjaChwYXR0ZXJuLCB7XG4gICAgICBsb2NhdGlvbixcbiAgICAgIHRocmVzaG9sZCxcbiAgICAgIGRpc3RhbmNlLFxuICAgICAgaW5jbHVkZU1hdGNoZXMsXG4gICAgICBmaW5kQWxsTWF0Y2hlcyxcbiAgICAgIG1pbk1hdGNoQ2hhckxlbmd0aCxcbiAgICAgIGlzQ2FzZVNlbnNpdGl2ZSxcbiAgICAgIGlnbm9yZUxvY2F0aW9uXG4gICAgfSk7XG4gIH1cbiAgc3RhdGljIGdldCB0eXBlKCkge1xuICAgIHJldHVybiAnZnV6enknXG4gIH1cbiAgc3RhdGljIGdldCBtdWx0aVJlZ2V4KCkge1xuICAgIHJldHVybiAvXlwiKC4qKVwiJC9cbiAgfVxuICBzdGF0aWMgZ2V0IHNpbmdsZVJlZ2V4KCkge1xuICAgIHJldHVybiAvXiguKikkL1xuICB9XG4gIHNlYXJjaCh0ZXh0KSB7XG4gICAgcmV0dXJuIHRoaXMuX2JpdGFwU2VhcmNoLnNlYXJjaEluKHRleHQpXG4gIH1cbn1cblxuLy8gVG9rZW46ICdmaWxlXG5cbmNsYXNzIEluY2x1ZGVNYXRjaCBleHRlbmRzIEJhc2VNYXRjaCB7XG4gIGNvbnN0cnVjdG9yKHBhdHRlcm4pIHtcbiAgICBzdXBlcihwYXR0ZXJuKTtcbiAgfVxuICBzdGF0aWMgZ2V0IHR5cGUoKSB7XG4gICAgcmV0dXJuICdpbmNsdWRlJ1xuICB9XG4gIHN0YXRpYyBnZXQgbXVsdGlSZWdleCgpIHtcbiAgICByZXR1cm4gL14nXCIoLiopXCIkL1xuICB9XG4gIHN0YXRpYyBnZXQgc2luZ2xlUmVnZXgoKSB7XG4gICAgcmV0dXJuIC9eJyguKikkL1xuICB9XG4gIHNlYXJjaCh0ZXh0KSB7XG4gICAgbGV0IGxvY2F0aW9uID0gMDtcbiAgICBsZXQgaW5kZXg7XG5cbiAgICBjb25zdCBpbmRpY2VzID0gW107XG4gICAgY29uc3QgcGF0dGVybkxlbiA9IHRoaXMucGF0dGVybi5sZW5ndGg7XG5cbiAgICAvLyBHZXQgYWxsIGV4YWN0IG1hdGNoZXNcbiAgICB3aGlsZSAoKGluZGV4ID0gdGV4dC5pbmRleE9mKHRoaXMucGF0dGVybiwgbG9jYXRpb24pKSA+IC0xKSB7XG4gICAgICBsb2NhdGlvbiA9IGluZGV4ICsgcGF0dGVybkxlbjtcbiAgICAgIGluZGljZXMucHVzaChbaW5kZXgsIGxvY2F0aW9uIC0gMV0pO1xuICAgIH1cblxuICAgIGNvbnN0IGlzTWF0Y2ggPSAhIWluZGljZXMubGVuZ3RoO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlzTWF0Y2gsXG4gICAgICBzY29yZTogaXNNYXRjaCA/IDAgOiAxLFxuICAgICAgaW5kaWNlc1xuICAgIH1cbiAgfVxufVxuXG4vLyDinZdPcmRlciBpcyBpbXBvcnRhbnQuIERPIE5PVCBDSEFOR0UuXG5jb25zdCBzZWFyY2hlcnMgPSBbXG4gIEV4YWN0TWF0Y2gsXG4gIEluY2x1ZGVNYXRjaCxcbiAgUHJlZml4RXhhY3RNYXRjaCxcbiAgSW52ZXJzZVByZWZpeEV4YWN0TWF0Y2gsXG4gIEludmVyc2VTdWZmaXhFeGFjdE1hdGNoLFxuICBTdWZmaXhFeGFjdE1hdGNoLFxuICBJbnZlcnNlRXhhY3RNYXRjaCxcbiAgRnV6enlNYXRjaFxuXTtcblxuY29uc3Qgc2VhcmNoZXJzTGVuID0gc2VhcmNoZXJzLmxlbmd0aDtcblxuLy8gUmVnZXggdG8gc3BsaXQgYnkgc3BhY2VzLCBidXQga2VlcCBhbnl0aGluZyBpbiBxdW90ZXMgdG9nZXRoZXJcbmNvbnN0IFNQQUNFX1JFID0gLyArKD89KD86W15cXFwiXSpcXFwiW15cXFwiXSpcXFwiKSpbXlxcXCJdKiQpLztcbmNvbnN0IE9SX1RPS0VOID0gJ3wnO1xuXG4vLyBSZXR1cm4gYSAyRCBhcnJheSByZXByZXNlbnRhdGlvbiBvZiB0aGUgcXVlcnksIGZvciBzaW1wbGVyIHBhcnNpbmcuXG4vLyBFeGFtcGxlOlxuLy8gXCJeY29yZSBnbyQgfCByYiQgfCBweSQgeHkkXCIgPT4gW1tcIl5jb3JlXCIsIFwiZ28kXCJdLCBbXCJyYiRcIl0sIFtcInB5JFwiLCBcInh5JFwiXV1cbmZ1bmN0aW9uIHBhcnNlUXVlcnkocGF0dGVybiwgb3B0aW9ucyA9IHt9KSB7XG4gIHJldHVybiBwYXR0ZXJuLnNwbGl0KE9SX1RPS0VOKS5tYXAoKGl0ZW0pID0+IHtcbiAgICBsZXQgcXVlcnkgPSBpdGVtXG4gICAgICAudHJpbSgpXG4gICAgICAuc3BsaXQoU1BBQ0VfUkUpXG4gICAgICAuZmlsdGVyKChpdGVtKSA9PiBpdGVtICYmICEhaXRlbS50cmltKCkpO1xuXG4gICAgbGV0IHJlc3VsdHMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMCwgbGVuID0gcXVlcnkubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICAgIGNvbnN0IHF1ZXJ5SXRlbSA9IHF1ZXJ5W2ldO1xuXG4gICAgICAvLyAxLiBIYW5kbGUgbXVsdGlwbGUgcXVlcnkgbWF0Y2ggKGkuZSwgb25jZSB0aGF0IGFyZSBxdW90ZWQsIGxpa2UgYFwiaGVsbG8gd29ybGRcImApXG4gICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgIGxldCBpZHggPSAtMTtcbiAgICAgIHdoaWxlICghZm91bmQgJiYgKytpZHggPCBzZWFyY2hlcnNMZW4pIHtcbiAgICAgICAgY29uc3Qgc2VhcmNoZXIgPSBzZWFyY2hlcnNbaWR4XTtcbiAgICAgICAgbGV0IHRva2VuID0gc2VhcmNoZXIuaXNNdWx0aU1hdGNoKHF1ZXJ5SXRlbSk7XG4gICAgICAgIGlmICh0b2tlbikge1xuICAgICAgICAgIHJlc3VsdHMucHVzaChuZXcgc2VhcmNoZXIodG9rZW4sIG9wdGlvbnMpKTtcbiAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGZvdW5kKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIuIEhhbmRsZSBzaW5nbGUgcXVlcnkgbWF0Y2hlcyAoaS5lLCBvbmNlIHRoYXQgYXJlICpub3QqIHF1b3RlZClcbiAgICAgIGlkeCA9IC0xO1xuICAgICAgd2hpbGUgKCsraWR4IDwgc2VhcmNoZXJzTGVuKSB7XG4gICAgICAgIGNvbnN0IHNlYXJjaGVyID0gc2VhcmNoZXJzW2lkeF07XG4gICAgICAgIGxldCB0b2tlbiA9IHNlYXJjaGVyLmlzU2luZ2xlTWF0Y2gocXVlcnlJdGVtKTtcbiAgICAgICAgaWYgKHRva2VuKSB7XG4gICAgICAgICAgcmVzdWx0cy5wdXNoKG5ldyBzZWFyY2hlcih0b2tlbiwgb3B0aW9ucykpO1xuICAgICAgICAgIGJyZWFrXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0c1xuICB9KVxufVxuXG4vLyBUaGVzZSBleHRlbmRlZCBtYXRjaGVycyBjYW4gcmV0dXJuIGFuIGFycmF5IG9mIG1hdGNoZXMsIGFzIG9wcG9zZWRcbi8vIHRvIGEgc2luZ2wgbWF0Y2hcbmNvbnN0IE11bHRpTWF0Y2hTZXQgPSBuZXcgU2V0KFtGdXp6eU1hdGNoLnR5cGUsIEluY2x1ZGVNYXRjaC50eXBlXSk7XG5cbi8qKlxuICogQ29tbWFuZC1saWtlIHNlYXJjaGluZ1xuICogPT09PT09PT09PT09PT09PT09PT09PVxuICpcbiAqIEdpdmVuIG11bHRpcGxlIHNlYXJjaCB0ZXJtcyBkZWxpbWl0ZWQgYnkgc3BhY2VzLmUuZy4gYF5qc2NyaXB0IC5weXRob24kIHJ1YnkgIWphdmFgLFxuICogc2VhcmNoIGluIGEgZ2l2ZW4gdGV4dC5cbiAqXG4gKiBTZWFyY2ggc3ludGF4OlxuICpcbiAqIHwgVG9rZW4gICAgICAgfCBNYXRjaCB0eXBlICAgICAgICAgICAgICAgICB8IERlc2NyaXB0aW9uICAgICAgICAgICAgICAgICAgICAgICAgICAgIHxcbiAqIHwgLS0tLS0tLS0tLS0gfCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSB8IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHxcbiAqIHwgYGpzY3JpcHRgICAgfCBmdXp6eS1tYXRjaCAgICAgICAgICAgICAgICB8IEl0ZW1zIHRoYXQgZnV6enkgbWF0Y2ggYGpzY3JpcHRgICAgICAgIHxcbiAqIHwgYD1zY2hlbWVgICAgfCBleGFjdC1tYXRjaCAgICAgICAgICAgICAgICB8IEl0ZW1zIHRoYXQgYXJlIGBzY2hlbWVgICAgICAgICAgICAgICAgIHxcbiAqIHwgYCdweXRob25gICAgfCBpbmNsdWRlLW1hdGNoICAgICAgICAgICAgICB8IEl0ZW1zIHRoYXQgaW5jbHVkZSBgcHl0aG9uYCAgICAgICAgICAgIHxcbiAqIHwgYCFydWJ5YCAgICAgfCBpbnZlcnNlLWV4YWN0LW1hdGNoICAgICAgICB8IEl0ZW1zIHRoYXQgZG8gbm90IGluY2x1ZGUgYHJ1YnlgICAgICAgIHxcbiAqIHwgYF5qYXZhYCAgICAgfCBwcmVmaXgtZXhhY3QtbWF0Y2ggICAgICAgICB8IEl0ZW1zIHRoYXQgc3RhcnQgd2l0aCBgamF2YWAgICAgICAgICAgIHxcbiAqIHwgYCFeZWFybGFuZ2AgfCBpbnZlcnNlLXByZWZpeC1leGFjdC1tYXRjaCB8IEl0ZW1zIHRoYXQgZG8gbm90IHN0YXJ0IHdpdGggYGVhcmxhbmdgIHxcbiAqIHwgYC5qcyRgICAgICAgfCBzdWZmaXgtZXhhY3QtbWF0Y2ggICAgICAgICB8IEl0ZW1zIHRoYXQgZW5kIHdpdGggYC5qc2AgICAgICAgICAgICAgIHxcbiAqIHwgYCEuZ28kYCAgICAgfCBpbnZlcnNlLXN1ZmZpeC1leGFjdC1tYXRjaCB8IEl0ZW1zIHRoYXQgZG8gbm90IGVuZCB3aXRoIGAuZ29gICAgICAgIHxcbiAqXG4gKiBBIHNpbmdsZSBwaXBlIGNoYXJhY3RlciBhY3RzIGFzIGFuIE9SIG9wZXJhdG9yLiBGb3IgZXhhbXBsZSwgdGhlIGZvbGxvd2luZ1xuICogcXVlcnkgbWF0Y2hlcyBlbnRyaWVzIHRoYXQgc3RhcnQgd2l0aCBgY29yZWAgYW5kIGVuZCB3aXRoIGVpdGhlcmBnb2AsIGByYmAsXG4gKiBvcmBweWAuXG4gKlxuICogYGBgXG4gKiBeY29yZSBnbyQgfCByYiQgfCBweSRcbiAqIGBgYFxuICovXG5jbGFzcyBFeHRlbmRlZFNlYXJjaCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHBhdHRlcm4sXG4gICAge1xuICAgICAgaXNDYXNlU2Vuc2l0aXZlID0gQ29uZmlnLmlzQ2FzZVNlbnNpdGl2ZSxcbiAgICAgIGluY2x1ZGVNYXRjaGVzID0gQ29uZmlnLmluY2x1ZGVNYXRjaGVzLFxuICAgICAgbWluTWF0Y2hDaGFyTGVuZ3RoID0gQ29uZmlnLm1pbk1hdGNoQ2hhckxlbmd0aCxcbiAgICAgIGlnbm9yZUxvY2F0aW9uID0gQ29uZmlnLmlnbm9yZUxvY2F0aW9uLFxuICAgICAgZmluZEFsbE1hdGNoZXMgPSBDb25maWcuZmluZEFsbE1hdGNoZXMsXG4gICAgICBsb2NhdGlvbiA9IENvbmZpZy5sb2NhdGlvbixcbiAgICAgIHRocmVzaG9sZCA9IENvbmZpZy50aHJlc2hvbGQsXG4gICAgICBkaXN0YW5jZSA9IENvbmZpZy5kaXN0YW5jZVxuICAgIH0gPSB7fVxuICApIHtcbiAgICB0aGlzLnF1ZXJ5ID0gbnVsbDtcbiAgICB0aGlzLm9wdGlvbnMgPSB7XG4gICAgICBpc0Nhc2VTZW5zaXRpdmUsXG4gICAgICBpbmNsdWRlTWF0Y2hlcyxcbiAgICAgIG1pbk1hdGNoQ2hhckxlbmd0aCxcbiAgICAgIGZpbmRBbGxNYXRjaGVzLFxuICAgICAgaWdub3JlTG9jYXRpb24sXG4gICAgICBsb2NhdGlvbixcbiAgICAgIHRocmVzaG9sZCxcbiAgICAgIGRpc3RhbmNlXG4gICAgfTtcblxuICAgIHRoaXMucGF0dGVybiA9IGlzQ2FzZVNlbnNpdGl2ZSA/IHBhdHRlcm4gOiBwYXR0ZXJuLnRvTG93ZXJDYXNlKCk7XG4gICAgdGhpcy5xdWVyeSA9IHBhcnNlUXVlcnkodGhpcy5wYXR0ZXJuLCB0aGlzLm9wdGlvbnMpO1xuICB9XG5cbiAgc3RhdGljIGNvbmRpdGlvbihfLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIG9wdGlvbnMudXNlRXh0ZW5kZWRTZWFyY2hcbiAgfVxuXG4gIHNlYXJjaEluKHRleHQpIHtcbiAgICBjb25zdCBxdWVyeSA9IHRoaXMucXVlcnk7XG5cbiAgICBpZiAoIXF1ZXJ5KSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBpc01hdGNoOiBmYWxzZSxcbiAgICAgICAgc2NvcmU6IDFcbiAgICAgIH1cbiAgICB9XG5cbiAgICBjb25zdCB7IGluY2x1ZGVNYXRjaGVzLCBpc0Nhc2VTZW5zaXRpdmUgfSA9IHRoaXMub3B0aW9ucztcblxuICAgIHRleHQgPSBpc0Nhc2VTZW5zaXRpdmUgPyB0ZXh0IDogdGV4dC50b0xvd2VyQ2FzZSgpO1xuXG4gICAgbGV0IG51bU1hdGNoZXMgPSAwO1xuICAgIGxldCBhbGxJbmRpY2VzID0gW107XG4gICAgbGV0IHRvdGFsU2NvcmUgPSAwO1xuXG4gICAgLy8gT1JzXG4gICAgZm9yIChsZXQgaSA9IDAsIHFMZW4gPSBxdWVyeS5sZW5ndGg7IGkgPCBxTGVuOyBpICs9IDEpIHtcbiAgICAgIGNvbnN0IHNlYXJjaGVycyA9IHF1ZXJ5W2ldO1xuXG4gICAgICAvLyBSZXNldCBpbmRpY2VzXG4gICAgICBhbGxJbmRpY2VzLmxlbmd0aCA9IDA7XG4gICAgICBudW1NYXRjaGVzID0gMDtcblxuICAgICAgLy8gQU5Ec1xuICAgICAgZm9yIChsZXQgaiA9IDAsIHBMZW4gPSBzZWFyY2hlcnMubGVuZ3RoOyBqIDwgcExlbjsgaiArPSAxKSB7XG4gICAgICAgIGNvbnN0IHNlYXJjaGVyID0gc2VhcmNoZXJzW2pdO1xuICAgICAgICBjb25zdCB7IGlzTWF0Y2gsIGluZGljZXMsIHNjb3JlIH0gPSBzZWFyY2hlci5zZWFyY2godGV4dCk7XG5cbiAgICAgICAgaWYgKGlzTWF0Y2gpIHtcbiAgICAgICAgICBudW1NYXRjaGVzICs9IDE7XG4gICAgICAgICAgdG90YWxTY29yZSArPSBzY29yZTtcbiAgICAgICAgICBpZiAoaW5jbHVkZU1hdGNoZXMpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBzZWFyY2hlci5jb25zdHJ1Y3Rvci50eXBlO1xuICAgICAgICAgICAgaWYgKE11bHRpTWF0Y2hTZXQuaGFzKHR5cGUpKSB7XG4gICAgICAgICAgICAgIGFsbEluZGljZXMgPSBbLi4uYWxsSW5kaWNlcywgLi4uaW5kaWNlc107XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBhbGxJbmRpY2VzLnB1c2goaW5kaWNlcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRvdGFsU2NvcmUgPSAwO1xuICAgICAgICAgIG51bU1hdGNoZXMgPSAwO1xuICAgICAgICAgIGFsbEluZGljZXMubGVuZ3RoID0gMDtcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIE9SIGNvbmRpdGlvbiwgc28gaWYgVFJVRSwgcmV0dXJuXG4gICAgICBpZiAobnVtTWF0Y2hlcykge1xuICAgICAgICBsZXQgcmVzdWx0ID0ge1xuICAgICAgICAgIGlzTWF0Y2g6IHRydWUsXG4gICAgICAgICAgc2NvcmU6IHRvdGFsU2NvcmUgLyBudW1NYXRjaGVzXG4gICAgICAgIH07XG5cbiAgICAgICAgaWYgKGluY2x1ZGVNYXRjaGVzKSB7XG4gICAgICAgICAgcmVzdWx0LmluZGljZXMgPSBhbGxJbmRpY2VzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdFxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIE5vdGhpbmcgd2FzIG1hdGNoZWRcbiAgICByZXR1cm4ge1xuICAgICAgaXNNYXRjaDogZmFsc2UsXG4gICAgICBzY29yZTogMVxuICAgIH1cbiAgfVxufVxuXG5jb25zdCByZWdpc3RlcmVkU2VhcmNoZXJzID0gW107XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyKC4uLmFyZ3MpIHtcbiAgcmVnaXN0ZXJlZFNlYXJjaGVycy5wdXNoKC4uLmFyZ3MpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTZWFyY2hlcihwYXR0ZXJuLCBvcHRpb25zKSB7XG4gIGZvciAobGV0IGkgPSAwLCBsZW4gPSByZWdpc3RlcmVkU2VhcmNoZXJzLmxlbmd0aDsgaSA8IGxlbjsgaSArPSAxKSB7XG4gICAgbGV0IHNlYXJjaGVyQ2xhc3MgPSByZWdpc3RlcmVkU2VhcmNoZXJzW2ldO1xuICAgIGlmIChzZWFyY2hlckNsYXNzLmNvbmRpdGlvbihwYXR0ZXJuLCBvcHRpb25zKSkge1xuICAgICAgcmV0dXJuIG5ldyBzZWFyY2hlckNsYXNzKHBhdHRlcm4sIG9wdGlvbnMpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG5ldyBCaXRhcFNlYXJjaChwYXR0ZXJuLCBvcHRpb25zKVxufVxuXG5jb25zdCBMb2dpY2FsT3BlcmF0b3IgPSB7XG4gIEFORDogJyRhbmQnLFxuICBPUjogJyRvcidcbn07XG5cbmNvbnN0IEtleVR5cGUgPSB7XG4gIFBBVEg6ICckcGF0aCcsXG4gIFBBVFRFUk46ICckdmFsJ1xufTtcblxuY29uc3QgaXNFeHByZXNzaW9uID0gKHF1ZXJ5KSA9PlxuICAhIShxdWVyeVtMb2dpY2FsT3BlcmF0b3IuQU5EXSB8fCBxdWVyeVtMb2dpY2FsT3BlcmF0b3IuT1JdKTtcblxuY29uc3QgaXNQYXRoID0gKHF1ZXJ5KSA9PiAhIXF1ZXJ5W0tleVR5cGUuUEFUSF07XG5cbmNvbnN0IGlzTGVhZiA9IChxdWVyeSkgPT5cbiAgIWlzQXJyYXkocXVlcnkpICYmIGlzT2JqZWN0KHF1ZXJ5KSAmJiAhaXNFeHByZXNzaW9uKHF1ZXJ5KTtcblxuY29uc3QgY29udmVydFRvRXhwbGljaXQgPSAocXVlcnkpID0+ICh7XG4gIFtMb2dpY2FsT3BlcmF0b3IuQU5EXTogT2JqZWN0LmtleXMocXVlcnkpLm1hcCgoa2V5KSA9PiAoe1xuICAgIFtrZXldOiBxdWVyeVtrZXldXG4gIH0pKVxufSk7XG5cbi8vIFdoZW4gYGF1dG9gIGlzIGB0cnVlYCwgdGhlIHBhcnNlIGZ1bmN0aW9uIHdpbGwgaW5mZXIgYW5kIGluaXRpYWxpemUgYW5kIGFkZFxuLy8gdGhlIGFwcHJvcHJpYXRlIGBTZWFyY2hlcmAgaW5zdGFuY2VcbmZ1bmN0aW9uIHBhcnNlKHF1ZXJ5LCBvcHRpb25zLCB7IGF1dG8gPSB0cnVlIH0gPSB7fSkge1xuICBjb25zdCBuZXh0ID0gKHF1ZXJ5KSA9PiB7XG4gICAgbGV0IGtleXMgPSBPYmplY3Qua2V5cyhxdWVyeSk7XG5cbiAgICBjb25zdCBpc1F1ZXJ5UGF0aCA9IGlzUGF0aChxdWVyeSk7XG5cbiAgICBpZiAoIWlzUXVlcnlQYXRoICYmIGtleXMubGVuZ3RoID4gMSAmJiAhaXNFeHByZXNzaW9uKHF1ZXJ5KSkge1xuICAgICAgcmV0dXJuIG5leHQoY29udmVydFRvRXhwbGljaXQocXVlcnkpKVxuICAgIH1cblxuICAgIGlmIChpc0xlYWYocXVlcnkpKSB7XG4gICAgICBjb25zdCBrZXkgPSBpc1F1ZXJ5UGF0aCA/IHF1ZXJ5W0tleVR5cGUuUEFUSF0gOiBrZXlzWzBdO1xuXG4gICAgICBjb25zdCBwYXR0ZXJuID0gaXNRdWVyeVBhdGggPyBxdWVyeVtLZXlUeXBlLlBBVFRFUk5dIDogcXVlcnlba2V5XTtcblxuICAgICAgaWYgKCFpc1N0cmluZyhwYXR0ZXJuKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoTE9HSUNBTF9TRUFSQ0hfSU5WQUxJRF9RVUVSWV9GT1JfS0VZKGtleSkpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9iaiA9IHtcbiAgICAgICAga2V5SWQ6IGNyZWF0ZUtleUlkKGtleSksXG4gICAgICAgIHBhdHRlcm5cbiAgICAgIH07XG5cbiAgICAgIGlmIChhdXRvKSB7XG4gICAgICAgIG9iai5zZWFyY2hlciA9IGNyZWF0ZVNlYXJjaGVyKHBhdHRlcm4sIG9wdGlvbnMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gb2JqXG4gICAgfVxuXG4gICAgbGV0IG5vZGUgPSB7XG4gICAgICBjaGlsZHJlbjogW10sXG4gICAgICBvcGVyYXRvcjoga2V5c1swXVxuICAgIH07XG5cbiAgICBrZXlzLmZvckVhY2goKGtleSkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBxdWVyeVtrZXldO1xuXG4gICAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgICAgdmFsdWUuZm9yRWFjaCgoaXRlbSkgPT4ge1xuICAgICAgICAgIG5vZGUuY2hpbGRyZW4ucHVzaChuZXh0KGl0ZW0pKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbm9kZVxuICB9O1xuXG4gIGlmICghaXNFeHByZXNzaW9uKHF1ZXJ5KSkge1xuICAgIHF1ZXJ5ID0gY29udmVydFRvRXhwbGljaXQocXVlcnkpO1xuICB9XG5cbiAgcmV0dXJuIG5leHQocXVlcnkpXG59XG5cbi8vIFByYWN0aWNhbCBzY29yaW5nIGZ1bmN0aW9uXG5mdW5jdGlvbiBjb21wdXRlU2NvcmUoXG4gIHJlc3VsdHMsXG4gIHsgaWdub3JlRmllbGROb3JtID0gQ29uZmlnLmlnbm9yZUZpZWxkTm9ybSB9XG4pIHtcbiAgcmVzdWx0cy5mb3JFYWNoKChyZXN1bHQpID0+IHtcbiAgICBsZXQgdG90YWxTY29yZSA9IDE7XG5cbiAgICByZXN1bHQubWF0Y2hlcy5mb3JFYWNoKCh7IGtleSwgbm9ybSwgc2NvcmUgfSkgPT4ge1xuICAgICAgY29uc3Qgd2VpZ2h0ID0ga2V5ID8ga2V5LndlaWdodCA6IG51bGw7XG5cbiAgICAgIHRvdGFsU2NvcmUgKj0gTWF0aC5wb3coXG4gICAgICAgIHNjb3JlID09PSAwICYmIHdlaWdodCA/IE51bWJlci5FUFNJTE9OIDogc2NvcmUsXG4gICAgICAgICh3ZWlnaHQgfHwgMSkgKiAoaWdub3JlRmllbGROb3JtID8gMSA6IG5vcm0pXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgcmVzdWx0LnNjb3JlID0gdG90YWxTY29yZTtcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIHRyYW5zZm9ybU1hdGNoZXMocmVzdWx0LCBkYXRhKSB7XG4gIGNvbnN0IG1hdGNoZXMgPSByZXN1bHQubWF0Y2hlcztcbiAgZGF0YS5tYXRjaGVzID0gW107XG5cbiAgaWYgKCFpc0RlZmluZWQobWF0Y2hlcykpIHtcbiAgICByZXR1cm5cbiAgfVxuXG4gIG1hdGNoZXMuZm9yRWFjaCgobWF0Y2gpID0+IHtcbiAgICBpZiAoIWlzRGVmaW5lZChtYXRjaC5pbmRpY2VzKSB8fCAhbWF0Y2guaW5kaWNlcy5sZW5ndGgpIHtcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGNvbnN0IHsgaW5kaWNlcywgdmFsdWUgfSA9IG1hdGNoO1xuXG4gICAgbGV0IG9iaiA9IHtcbiAgICAgIGluZGljZXMsXG4gICAgICB2YWx1ZVxuICAgIH07XG5cbiAgICBpZiAobWF0Y2gua2V5KSB7XG4gICAgICBvYmoua2V5ID0gbWF0Y2gua2V5LnNyYztcbiAgICB9XG5cbiAgICBpZiAobWF0Y2guaWR4ID4gLTEpIHtcbiAgICAgIG9iai5yZWZJbmRleCA9IG1hdGNoLmlkeDtcbiAgICB9XG5cbiAgICBkYXRhLm1hdGNoZXMucHVzaChvYmopO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtU2NvcmUocmVzdWx0LCBkYXRhKSB7XG4gIGRhdGEuc2NvcmUgPSByZXN1bHQuc2NvcmU7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdChcbiAgcmVzdWx0cyxcbiAgZG9jcyxcbiAge1xuICAgIGluY2x1ZGVNYXRjaGVzID0gQ29uZmlnLmluY2x1ZGVNYXRjaGVzLFxuICAgIGluY2x1ZGVTY29yZSA9IENvbmZpZy5pbmNsdWRlU2NvcmVcbiAgfSA9IHt9XG4pIHtcbiAgY29uc3QgdHJhbnNmb3JtZXJzID0gW107XG5cbiAgaWYgKGluY2x1ZGVNYXRjaGVzKSB0cmFuc2Zvcm1lcnMucHVzaCh0cmFuc2Zvcm1NYXRjaGVzKTtcbiAgaWYgKGluY2x1ZGVTY29yZSkgdHJhbnNmb3JtZXJzLnB1c2godHJhbnNmb3JtU2NvcmUpO1xuXG4gIHJldHVybiByZXN1bHRzLm1hcCgocmVzdWx0KSA9PiB7XG4gICAgY29uc3QgeyBpZHggfSA9IHJlc3VsdDtcblxuICAgIGNvbnN0IGRhdGEgPSB7XG4gICAgICBpdGVtOiBkb2NzW2lkeF0sXG4gICAgICByZWZJbmRleDogaWR4XG4gICAgfTtcblxuICAgIGlmICh0cmFuc2Zvcm1lcnMubGVuZ3RoKSB7XG4gICAgICB0cmFuc2Zvcm1lcnMuZm9yRWFjaCgodHJhbnNmb3JtZXIpID0+IHtcbiAgICAgICAgdHJhbnNmb3JtZXIocmVzdWx0LCBkYXRhKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHJldHVybiBkYXRhXG4gIH0pXG59XG5cbmNsYXNzIEZ1c2Uge1xuICBjb25zdHJ1Y3Rvcihkb2NzLCBvcHRpb25zID0ge30sIGluZGV4KSB7XG4gICAgdGhpcy5vcHRpb25zID0geyAuLi5Db25maWcsIC4uLm9wdGlvbnMgfTtcblxuICAgIGlmIChcbiAgICAgIHRoaXMub3B0aW9ucy51c2VFeHRlbmRlZFNlYXJjaCAmJlxuICAgICAgIXRydWVcbiAgICApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihFWFRFTkRFRF9TRUFSQ0hfVU5BVkFJTEFCTEUpXG4gICAgfVxuXG4gICAgdGhpcy5fa2V5U3RvcmUgPSBuZXcgS2V5U3RvcmUodGhpcy5vcHRpb25zLmtleXMpO1xuXG4gICAgdGhpcy5zZXRDb2xsZWN0aW9uKGRvY3MsIGluZGV4KTtcbiAgfVxuXG4gIHNldENvbGxlY3Rpb24oZG9jcywgaW5kZXgpIHtcbiAgICB0aGlzLl9kb2NzID0gZG9jcztcblxuICAgIGlmIChpbmRleCAmJiAhKGluZGV4IGluc3RhbmNlb2YgRnVzZUluZGV4KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKElOQ09SUkVDVF9JTkRFWF9UWVBFKVxuICAgIH1cblxuICAgIHRoaXMuX215SW5kZXggPVxuICAgICAgaW5kZXggfHxcbiAgICAgIGNyZWF0ZUluZGV4KHRoaXMub3B0aW9ucy5rZXlzLCB0aGlzLl9kb2NzLCB7XG4gICAgICAgIGdldEZuOiB0aGlzLm9wdGlvbnMuZ2V0Rm4sXG4gICAgICAgIGZpZWxkTm9ybVdlaWdodDogdGhpcy5vcHRpb25zLmZpZWxkTm9ybVdlaWdodFxuICAgICAgfSk7XG4gIH1cblxuICBhZGQoZG9jKSB7XG4gICAgaWYgKCFpc0RlZmluZWQoZG9jKSkge1xuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdGhpcy5fZG9jcy5wdXNoKGRvYyk7XG4gICAgdGhpcy5fbXlJbmRleC5hZGQoZG9jKTtcbiAgfVxuXG4gIHJlbW92ZShwcmVkaWNhdGUgPSAoLyogZG9jLCBpZHggKi8pID0+IGZhbHNlKSB7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IHRoaXMuX2RvY3MubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICAgIGNvbnN0IGRvYyA9IHRoaXMuX2RvY3NbaV07XG4gICAgICBpZiAocHJlZGljYXRlKGRvYywgaSkpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVBdChpKTtcbiAgICAgICAgaSAtPSAxO1xuICAgICAgICBsZW4gLT0gMTtcblxuICAgICAgICByZXN1bHRzLnB1c2goZG9jKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0c1xuICB9XG5cbiAgcmVtb3ZlQXQoaWR4KSB7XG4gICAgdGhpcy5fZG9jcy5zcGxpY2UoaWR4LCAxKTtcbiAgICB0aGlzLl9teUluZGV4LnJlbW92ZUF0KGlkeCk7XG4gIH1cblxuICBnZXRJbmRleCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbXlJbmRleFxuICB9XG5cbiAgc2VhcmNoKHF1ZXJ5LCB7IGxpbWl0ID0gLTEgfSA9IHt9KSB7XG4gICAgY29uc3Qge1xuICAgICAgaW5jbHVkZU1hdGNoZXMsXG4gICAgICBpbmNsdWRlU2NvcmUsXG4gICAgICBzaG91bGRTb3J0LFxuICAgICAgc29ydEZuLFxuICAgICAgaWdub3JlRmllbGROb3JtXG4gICAgfSA9IHRoaXMub3B0aW9ucztcblxuICAgIGxldCByZXN1bHRzID0gaXNTdHJpbmcocXVlcnkpXG4gICAgICA/IGlzU3RyaW5nKHRoaXMuX2RvY3NbMF0pXG4gICAgICAgID8gdGhpcy5fc2VhcmNoU3RyaW5nTGlzdChxdWVyeSlcbiAgICAgICAgOiB0aGlzLl9zZWFyY2hPYmplY3RMaXN0KHF1ZXJ5KVxuICAgICAgOiB0aGlzLl9zZWFyY2hMb2dpY2FsKHF1ZXJ5KTtcblxuICAgIGNvbXB1dGVTY29yZShyZXN1bHRzLCB7IGlnbm9yZUZpZWxkTm9ybSB9KTtcblxuICAgIGlmIChzaG91bGRTb3J0KSB7XG4gICAgICByZXN1bHRzLnNvcnQoc29ydEZuKTtcbiAgICB9XG5cbiAgICBpZiAoaXNOdW1iZXIobGltaXQpICYmIGxpbWl0ID4gLTEpIHtcbiAgICAgIHJlc3VsdHMgPSByZXN1bHRzLnNsaWNlKDAsIGxpbWl0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gZm9ybWF0KHJlc3VsdHMsIHRoaXMuX2RvY3MsIHtcbiAgICAgIGluY2x1ZGVNYXRjaGVzLFxuICAgICAgaW5jbHVkZVNjb3JlXG4gICAgfSlcbiAgfVxuXG4gIF9zZWFyY2hTdHJpbmdMaXN0KHF1ZXJ5KSB7XG4gICAgY29uc3Qgc2VhcmNoZXIgPSBjcmVhdGVTZWFyY2hlcihxdWVyeSwgdGhpcy5vcHRpb25zKTtcbiAgICBjb25zdCB7IHJlY29yZHMgfSA9IHRoaXMuX215SW5kZXg7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgLy8gSXRlcmF0ZSBvdmVyIGV2ZXJ5IHN0cmluZyBpbiB0aGUgaW5kZXhcbiAgICByZWNvcmRzLmZvckVhY2goKHsgdjogdGV4dCwgaTogaWR4LCBuOiBub3JtIH0pID0+IHtcbiAgICAgIGlmICghaXNEZWZpbmVkKHRleHQpKSB7XG4gICAgICAgIHJldHVyblxuICAgICAgfVxuXG4gICAgICBjb25zdCB7IGlzTWF0Y2gsIHNjb3JlLCBpbmRpY2VzIH0gPSBzZWFyY2hlci5zZWFyY2hJbih0ZXh0KTtcblxuICAgICAgaWYgKGlzTWF0Y2gpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKHtcbiAgICAgICAgICBpdGVtOiB0ZXh0LFxuICAgICAgICAgIGlkeCxcbiAgICAgICAgICBtYXRjaGVzOiBbeyBzY29yZSwgdmFsdWU6IHRleHQsIG5vcm0sIGluZGljZXMgfV1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gcmVzdWx0c1xuICB9XG5cbiAgX3NlYXJjaExvZ2ljYWwocXVlcnkpIHtcblxuICAgIGNvbnN0IGV4cHJlc3Npb24gPSBwYXJzZShxdWVyeSwgdGhpcy5vcHRpb25zKTtcblxuICAgIGNvbnN0IGV2YWx1YXRlID0gKG5vZGUsIGl0ZW0sIGlkeCkgPT4ge1xuICAgICAgaWYgKCFub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgIGNvbnN0IHsga2V5SWQsIHNlYXJjaGVyIH0gPSBub2RlO1xuXG4gICAgICAgIGNvbnN0IG1hdGNoZXMgPSB0aGlzLl9maW5kTWF0Y2hlcyh7XG4gICAgICAgICAga2V5OiB0aGlzLl9rZXlTdG9yZS5nZXQoa2V5SWQpLFxuICAgICAgICAgIHZhbHVlOiB0aGlzLl9teUluZGV4LmdldFZhbHVlRm9ySXRlbUF0S2V5SWQoaXRlbSwga2V5SWQpLFxuICAgICAgICAgIHNlYXJjaGVyXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChtYXRjaGVzICYmIG1hdGNoZXMubGVuZ3RoKSB7XG4gICAgICAgICAgcmV0dXJuIFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgaWR4LFxuICAgICAgICAgICAgICBpdGVtLFxuICAgICAgICAgICAgICBtYXRjaGVzXG4gICAgICAgICAgICB9XG4gICAgICAgICAgXVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFtdXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlcyA9IFtdO1xuICAgICAgZm9yIChsZXQgaSA9IDAsIGxlbiA9IG5vZGUuY2hpbGRyZW4ubGVuZ3RoOyBpIDwgbGVuOyBpICs9IDEpIHtcbiAgICAgICAgY29uc3QgY2hpbGQgPSBub2RlLmNoaWxkcmVuW2ldO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBldmFsdWF0ZShjaGlsZCwgaXRlbSwgaWR4KTtcbiAgICAgICAgaWYgKHJlc3VsdC5sZW5ndGgpIHtcbiAgICAgICAgICByZXMucHVzaCguLi5yZXN1bHQpO1xuICAgICAgICB9IGVsc2UgaWYgKG5vZGUub3BlcmF0b3IgPT09IExvZ2ljYWxPcGVyYXRvci5BTkQpIHtcbiAgICAgICAgICByZXR1cm4gW11cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc1xuICAgIH07XG5cbiAgICBjb25zdCByZWNvcmRzID0gdGhpcy5fbXlJbmRleC5yZWNvcmRzO1xuICAgIGNvbnN0IHJlc3VsdE1hcCA9IHt9O1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcblxuICAgIHJlY29yZHMuZm9yRWFjaCgoeyAkOiBpdGVtLCBpOiBpZHggfSkgPT4ge1xuICAgICAgaWYgKGlzRGVmaW5lZChpdGVtKSkge1xuICAgICAgICBsZXQgZXhwUmVzdWx0cyA9IGV2YWx1YXRlKGV4cHJlc3Npb24sIGl0ZW0sIGlkeCk7XG5cbiAgICAgICAgaWYgKGV4cFJlc3VsdHMubGVuZ3RoKSB7XG4gICAgICAgICAgLy8gRGVkdXBlIHdoZW4gYWRkaW5nXG4gICAgICAgICAgaWYgKCFyZXN1bHRNYXBbaWR4XSkge1xuICAgICAgICAgICAgcmVzdWx0TWFwW2lkeF0gPSB7IGlkeCwgaXRlbSwgbWF0Y2hlczogW10gfTtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChyZXN1bHRNYXBbaWR4XSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGV4cFJlc3VsdHMuZm9yRWFjaCgoeyBtYXRjaGVzIH0pID0+IHtcbiAgICAgICAgICAgIHJlc3VsdE1hcFtpZHhdLm1hdGNoZXMucHVzaCguLi5tYXRjaGVzKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdHNcbiAgfVxuXG4gIF9zZWFyY2hPYmplY3RMaXN0KHF1ZXJ5KSB7XG4gICAgY29uc3Qgc2VhcmNoZXIgPSBjcmVhdGVTZWFyY2hlcihxdWVyeSwgdGhpcy5vcHRpb25zKTtcbiAgICBjb25zdCB7IGtleXMsIHJlY29yZHMgfSA9IHRoaXMuX215SW5kZXg7XG4gICAgY29uc3QgcmVzdWx0cyA9IFtdO1xuXG4gICAgLy8gTGlzdCBpcyBBcnJheTxPYmplY3Q+XG4gICAgcmVjb3Jkcy5mb3JFYWNoKCh7ICQ6IGl0ZW0sIGk6IGlkeCB9KSA9PiB7XG4gICAgICBpZiAoIWlzRGVmaW5lZChpdGVtKSkge1xuICAgICAgICByZXR1cm5cbiAgICAgIH1cblxuICAgICAgbGV0IG1hdGNoZXMgPSBbXTtcblxuICAgICAgLy8gSXRlcmF0ZSBvdmVyIGV2ZXJ5IGtleSAoaS5lLCBwYXRoKSwgYW5kIGZldGNoIHRoZSB2YWx1ZSBhdCB0aGF0IGtleVxuICAgICAga2V5cy5mb3JFYWNoKChrZXksIGtleUluZGV4KSA9PiB7XG4gICAgICAgIG1hdGNoZXMucHVzaChcbiAgICAgICAgICAuLi50aGlzLl9maW5kTWF0Y2hlcyh7XG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICB2YWx1ZTogaXRlbVtrZXlJbmRleF0sXG4gICAgICAgICAgICBzZWFyY2hlclxuICAgICAgICAgIH0pXG4gICAgICAgICk7XG4gICAgICB9KTtcblxuICAgICAgaWYgKG1hdGNoZXMubGVuZ3RoKSB7XG4gICAgICAgIHJlc3VsdHMucHVzaCh7XG4gICAgICAgICAgaWR4LFxuICAgICAgICAgIGl0ZW0sXG4gICAgICAgICAgbWF0Y2hlc1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHRzXG4gIH1cbiAgX2ZpbmRNYXRjaGVzKHsga2V5LCB2YWx1ZSwgc2VhcmNoZXIgfSkge1xuICAgIGlmICghaXNEZWZpbmVkKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIFtdXG4gICAgfVxuXG4gICAgbGV0IG1hdGNoZXMgPSBbXTtcblxuICAgIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgdmFsdWUuZm9yRWFjaCgoeyB2OiB0ZXh0LCBpOiBpZHgsIG46IG5vcm0gfSkgPT4ge1xuICAgICAgICBpZiAoIWlzRGVmaW5lZCh0ZXh0KSkge1xuICAgICAgICAgIHJldHVyblxuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgeyBpc01hdGNoLCBzY29yZSwgaW5kaWNlcyB9ID0gc2VhcmNoZXIuc2VhcmNoSW4odGV4dCk7XG5cbiAgICAgICAgaWYgKGlzTWF0Y2gpIHtcbiAgICAgICAgICBtYXRjaGVzLnB1c2goe1xuICAgICAgICAgICAgc2NvcmUsXG4gICAgICAgICAgICBrZXksXG4gICAgICAgICAgICB2YWx1ZTogdGV4dCxcbiAgICAgICAgICAgIGlkeCxcbiAgICAgICAgICAgIG5vcm0sXG4gICAgICAgICAgICBpbmRpY2VzXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCB7IHY6IHRleHQsIG46IG5vcm0gfSA9IHZhbHVlO1xuXG4gICAgICBjb25zdCB7IGlzTWF0Y2gsIHNjb3JlLCBpbmRpY2VzIH0gPSBzZWFyY2hlci5zZWFyY2hJbih0ZXh0KTtcblxuICAgICAgaWYgKGlzTWF0Y2gpIHtcbiAgICAgICAgbWF0Y2hlcy5wdXNoKHsgc2NvcmUsIGtleSwgdmFsdWU6IHRleHQsIG5vcm0sIGluZGljZXMgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGNoZXNcbiAgfVxufVxuXG5GdXNlLnZlcnNpb24gPSAnNi42LjInO1xuRnVzZS5jcmVhdGVJbmRleCA9IGNyZWF0ZUluZGV4O1xuRnVzZS5wYXJzZUluZGV4ID0gcGFyc2VJbmRleDtcbkZ1c2UuY29uZmlnID0gQ29uZmlnO1xuXG57XG4gIEZ1c2UucGFyc2VRdWVyeSA9IHBhcnNlO1xufVxuXG57XG4gIHJlZ2lzdGVyKEV4dGVuZGVkU2VhcmNoKTtcbn1cblxuZXhwb3J0IHsgRnVzZSBhcyBkZWZhdWx0IH07XG4iLCIvKipcclxuICogSGFuZ3VsLmpzXHJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9lLS9IYW5ndWwuanNcclxuICpcclxuICogQ29weXJpZ2h0IDIwMTcsIEphZW1pbiBKb1xyXG4gKiB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXHJcbiAqL1xyXG5cclxuKGZ1bmN0aW9uICgpIHtcclxuICAgICd1c2Ugc3RyaWN0JztcclxuICAgIHZhciBDSE8gPSBbXHJcbiAgICAgICAgJ+OEsScsICfjhLInLCAn44S0JywgJ+OEtycsICfjhLgnLFxyXG4gICAgICAgICfjhLknLCAn44WBJywgJ+OFgicsICfjhYMnLCAn44WFJywgJ+OFhicsXHJcbiAgICAgICAgJ+OFhycsICfjhYgnLCAn44WJJywgJ+OFiicsICfjhYsnLCAn44WMJyxcclxuICAgICAgICAn44WNJywgJ+OFjidcclxuICAgIF0sXHJcbiAgICAgICAgSlVORyA9IFtcclxuICAgICAgICAgICAgJ+OFjycsICfjhZAnLCAn44WRJywgJ+OFkicsICfjhZMnLFxyXG4gICAgICAgICAgICAn44WUJywgJ+OFlScsICfjhZYnLCAn44WXJywgWyfjhZcnLCAn44WPJ10sIFsn44WXJywgJ+OFkCddLFxyXG4gICAgICAgICAgICBbJ+OFlycsICfjhaMnXSwgJ+OFmycsICfjhZwnLCBbJ+OFnCcsICfjhZMnXSwgWyfjhZwnLCAn44WUJ10sIFsn44WcJywgJ+OFoyddLFxyXG4gICAgICAgICAgICAn44WgJywgJ+OFoScsIFsn44WhJywgJ+OFoyddLCAn44WjJ1xyXG4gICAgICAgIF0sXHJcbiAgICAgICAgSk9ORyA9IFtcclxuICAgICAgICAgICAgJycsICfjhLEnLCAn44SyJywgWyfjhLEnLCAn44WFJ10sICfjhLQnLCBbJ+OEtCcsICfjhYgnXSwgWyfjhLQnLCAn44WOJ10sICfjhLcnLCAn44S5JyxcclxuICAgICAgICAgICAgWyfjhLknLCAn44SxJ10sIFsn44S5JywgJ+OFgSddLCBbJ+OEuScsICfjhYInXSwgWyfjhLknLCAn44WFJ10sIFsn44S5JywgJ+OFjCddLCBbJ+OEuScsICfjhY0nXSwgWyfjhLknLCAn44WOJ10sICfjhYEnLFxyXG4gICAgICAgICAgICAn44WCJywgWyfjhYInLCAn44WFJ10sICfjhYUnLCAn44WGJywgJ+OFhycsICfjhYgnLCAn44WKJywgJ+OFiycsICfjhYwnLCAn44WNJywgJ+OFjidcclxuICAgICAgICBdLFxyXG4gICAgICAgIEhBTkdVTF9PRkZTRVQgPSAweEFDMDAsXHJcbiAgICAgICAgQ09OU09OQU5UUyA9IFtcclxuICAgICAgICAgICAgJ+OEsScsICfjhLInLCAn44SzJywgJ+OEtCcsICfjhLUnLCAn44S2JywgJ+OEtycsICfjhLgnLFxyXG4gICAgICAgICAgICAn44S5JywgJ+OEuicsICfjhLsnLCAn44S8JywgJ+OEvScsICfjhL4nLCAn44S/JywgJ+OFgCcsXHJcbiAgICAgICAgICAgICfjhYEnLCAn44WCJywgJ+OFgycsICfjhYQnLCAn44WFJywgJ+OFhicsICfjhYcnLCAn44WIJyxcclxuICAgICAgICAgICAgJ+OFiScsICfjhYonLCAn44WLJywgJ+OFjCcsICfjhY0nLCAn44WOJ1xyXG4gICAgICAgIF0sXHJcbiAgICAgICAgQ09NUExFVEVfQ0hPID0gW1xyXG4gICAgICAgICAgICAn44SxJywgJ+OEsicsICfjhLQnLCAn44S3JywgJ+OEuCcsXHJcbiAgICAgICAgICAgICfjhLknLCAn44WBJywgJ+OFgicsICfjhYMnLCAn44WFJywgJ+OFhicsXHJcbiAgICAgICAgICAgICfjhYcnLCAn44WIJywgJ+OFiScsICfjhYonLCAn44WLJywgJ+OFjCcsICfjhY0nLCAn44WOJ1xyXG4gICAgICAgIF0sXHJcbiAgICAgICAgQ09NUExFVEVfSlVORyA9IFtcclxuICAgICAgICAgICAgJ+OFjycsICfjhZAnLCAn44WRJywgJ+OFkicsICfjhZMnLFxyXG4gICAgICAgICAgICAn44WUJywgJ+OFlScsICfjhZYnLCAn44WXJywgJ+OFmCcsICfjhZknLFxyXG4gICAgICAgICAgICAn44WaJywgJ+OFmycsICfjhZwnLCAn44WdJywgJ+OFnicsICfjhZ8nLFxyXG4gICAgICAgICAgICAn44WgJywgJ+OFoScsICfjhaInLCAn44WjJ1xyXG4gICAgICAgIF0sXHJcbiAgICAgICAgQ09NUExFVEVfSk9ORyA9IFtcclxuICAgICAgICAgICAgJycsICfjhLEnLCAn44SyJywgJ+OEsycsICfjhLQnLCAn44S1JywgJ+OEticsICfjhLcnLCAn44S5JyxcclxuICAgICAgICAgICAgJ+OEuicsICfjhLsnLCAn44S8JywgJ+OEvScsICfjhL4nLCAn44S/JywgJ+OFgCcsICfjhYEnLFxyXG4gICAgICAgICAgICAn44WCJywgJ+OFhCcsICfjhYUnLCAn44WGJywgJ+OFhycsICfjhYgnLCAn44WKJywgJ+OFiycsICfjhYwnLCAn44WNJywgJ+OFjidcclxuICAgICAgICBdLFxyXG4gICAgICAgIENPTVBMRVhfQ09OU09OQU5UUyA9IFtcclxuICAgICAgICAgICAgWyfjhLEnLCAn44WFJywgJ+OEsyddLFxyXG4gICAgICAgICAgICBbJ+OEtCcsICfjhYgnLCAn44S1J10sXHJcbiAgICAgICAgICAgIFsn44S0JywgJ+OFjicsICfjhLYnXSxcclxuICAgICAgICAgICAgWyfjhLknLCAn44SxJywgJ+OEuiddLFxyXG4gICAgICAgICAgICBbJ+OEuScsICfjhYEnLCAn44S7J10sXHJcbiAgICAgICAgICAgIFsn44S5JywgJ+OFgicsICfjhLwnXSxcclxuICAgICAgICAgICAgWyfjhLknLCAn44WFJywgJ+OEvSddLFxyXG4gICAgICAgICAgICBbJ+OEuScsICfjhYwnLCAn44S+J10sXHJcbiAgICAgICAgICAgIFsn44S5JywgJ+OFjScsICfjhL8nXSxcclxuICAgICAgICAgICAgWyfjhLknLCAn44WOJywgJ+OFgCddLFxyXG4gICAgICAgICAgICBbJ+OFgicsICfjhYUnLCAn44WEJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIENPTVBMRVhfVk9XRUxTID0gW1xyXG4gICAgICAgICAgICBbJ+OFlycsICfjhY8nLCAn44WYJ10sXHJcbiAgICAgICAgICAgIFsn44WXJywgJ+OFkCcsICfjhZknXSxcclxuICAgICAgICAgICAgWyfjhZcnLCAn44WjJywgJ+OFmiddLFxyXG4gICAgICAgICAgICBbJ+OFnCcsICfjhZMnLCAn44WdJ10sXHJcbiAgICAgICAgICAgIFsn44WcJywgJ+OFlCcsICfjhZ4nXSxcclxuICAgICAgICAgICAgWyfjhZwnLCAn44WjJywgJ+OFnyddLFxyXG4gICAgICAgICAgICBbJ+OFoScsICfjhaMnLCAn44WiJ11cclxuICAgICAgICBdLFxyXG4gICAgICAgIENPTlNPTkFOVFNfSEFTSCxcclxuICAgICAgICBDSE9fSEFTSCxcclxuICAgICAgICBKVU5HX0hBU0gsXHJcbiAgICAgICAgSk9OR19IQVNILFxyXG4gICAgICAgIENPTVBMRVhfQ09OU09OQU5UU19IQVNILFxyXG4gICAgICAgIENPTVBMRVhfVk9XRUxTX0hBU0hcclxuICAgICAgICA7XHJcblxyXG4gICAgZnVuY3Rpb24gX21ha2VIYXNoKGFycmF5KSB7XHJcbiAgICAgICAgdmFyIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcclxuICAgICAgICAgICAgaGFzaCA9IHsgMDogMCB9XHJcbiAgICAgICAgICAgIDtcclxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChhcnJheVtpXSlcclxuICAgICAgICAgICAgICAgIGhhc2hbYXJyYXlbaV0uY2hhckNvZGVBdCgwKV0gPSBpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gaGFzaDtcclxuICAgIH1cclxuXHJcbiAgICBDT05TT05BTlRTX0hBU0ggPSBfbWFrZUhhc2goQ09OU09OQU5UUyk7XHJcbiAgICBDSE9fSEFTSCA9IF9tYWtlSGFzaChDT01QTEVURV9DSE8pO1xyXG4gICAgSlVOR19IQVNIID0gX21ha2VIYXNoKENPTVBMRVRFX0pVTkcpO1xyXG4gICAgSk9OR19IQVNIID0gX21ha2VIYXNoKENPTVBMRVRFX0pPTkcpO1xyXG5cclxuICAgIGZ1bmN0aW9uIF9tYWtlQ29tcGxleEhhc2goYXJyYXkpIHtcclxuICAgICAgICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoLFxyXG4gICAgICAgICAgICBoYXNoID0ge30sXHJcbiAgICAgICAgICAgIGNvZGUxLFxyXG4gICAgICAgICAgICBjb2RlMlxyXG4gICAgICAgICAgICA7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb2RlMSA9IGFycmF5W2ldWzBdLmNoYXJDb2RlQXQoMCk7XHJcbiAgICAgICAgICAgIGNvZGUyID0gYXJyYXlbaV1bMV0uY2hhckNvZGVBdCgwKTtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBoYXNoW2NvZGUxXSA9PT0gJ3VuZGVmaW5lZCcpIHtcclxuICAgICAgICAgICAgICAgIGhhc2hbY29kZTFdID0ge307XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaGFzaFtjb2RlMV1bY29kZTJdID0gYXJyYXlbaV1bMl0uY2hhckNvZGVBdCgwKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGhhc2g7XHJcbiAgICB9XHJcblxyXG4gICAgQ09NUExFWF9DT05TT05BTlRTX0hBU0ggPSBfbWFrZUNvbXBsZXhIYXNoKENPTVBMRVhfQ09OU09OQU5UUyk7XHJcbiAgICBDT01QTEVYX1ZPV0VMU19IQVNIID0gX21ha2VDb21wbGV4SGFzaChDT01QTEVYX1ZPV0VMUyk7XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzQ29uc29uYW50KGMpIHtcclxuICAgICAgICByZXR1cm4gdHlwZW9mIENPTlNPTkFOVFNfSEFTSFtjXSAhPT0gJ3VuZGVmaW5lZCc7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzQ2hvKGMpIHtcclxuICAgICAgICByZXR1cm4gdHlwZW9mIENIT19IQVNIW2NdICE9PSAndW5kZWZpbmVkJztcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBfaXNKdW5nKGMpIHtcclxuICAgICAgICByZXR1cm4gdHlwZW9mIEpVTkdfSEFTSFtjXSAhPT0gJ3VuZGVmaW5lZCc7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gX2lzSm9uZyhjKSB7XHJcbiAgICAgICAgcmV0dXJuIHR5cGVvZiBKT05HX0hBU0hbY10gIT09ICd1bmRlZmluZWQnO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0hhbmd1bChjIC8qIGNvZGUgbnVtYmVyICovKSB7XHJcbiAgICAgICAgcmV0dXJuIDB4QUMwMCA8PSBjICYmIGMgPD0gMHhkN2EzO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0p1bmdKb2luYWJsZShhLCBiKSB7XHJcbiAgICAgICAgcmV0dXJuIChDT01QTEVYX1ZPV0VMU19IQVNIW2FdICYmIENPTVBMRVhfVk9XRUxTX0hBU0hbYV1bYl0pID8gQ09NUExFWF9WT1dFTFNfSEFTSFthXVtiXSA6IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIF9pc0pvbmdKb2luYWJsZShhLCBiKSB7XHJcbiAgICAgICAgcmV0dXJuIENPTVBMRVhfQ09OU09OQU5UU19IQVNIW2FdICYmIENPTVBMRVhfQ09OU09OQU5UU19IQVNIW2FdW2JdID8gQ09NUExFWF9DT05TT05BTlRTX0hBU0hbYV1bYl0gOiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICB2YXIgZGlzYXNzZW1ibGUgPSBmdW5jdGlvbiAoc3RyaW5nLCBncm91cGVkKSB7XHJcbiAgICAgICAgaWYgKHN0cmluZyA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0FyZ3VtZW50cyBjYW5ub3QgYmUgbnVsbCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHR5cGVvZiBzdHJpbmcgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgIHN0cmluZyA9IHN0cmluZy5qb2luKCcnKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciByZXN1bHQgPSBbXSxcclxuICAgICAgICAgICAgbGVuZ3RoID0gc3RyaW5nLmxlbmd0aCxcclxuICAgICAgICAgICAgY2hvLFxyXG4gICAgICAgICAgICBqdW5nLFxyXG4gICAgICAgICAgICBqb25nLFxyXG4gICAgICAgICAgICBjb2RlLFxyXG4gICAgICAgICAgICByXHJcbiAgICAgICAgICAgIDtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgdGVtcCA9IFtdO1xyXG5cclxuICAgICAgICAgICAgY29kZSA9IHN0cmluZy5jaGFyQ29kZUF0KGkpO1xyXG4gICAgICAgICAgICBpZiAoX2lzSGFuZ3VsKGNvZGUpKSB7IC8vIOyZhOyEseuQnCDtlZzquIDsnbTrqbRcclxuICAgICAgICAgICAgICAgIGNvZGUgLT0gSEFOR1VMX09GRlNFVDtcclxuICAgICAgICAgICAgICAgIGpvbmcgPSBjb2RlICUgMjg7XHJcbiAgICAgICAgICAgICAgICBqdW5nID0gKGNvZGUgLSBqb25nKSAvIDI4ICUgMjE7XHJcbiAgICAgICAgICAgICAgICBjaG8gPSBwYXJzZUludCgoY29kZSAtIGpvbmcpIC8gMjggLyAyMSk7XHJcbiAgICAgICAgICAgICAgICB0ZW1wLnB1c2goQ0hPW2Nob10pO1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBKVU5HW2p1bmddID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXAgPSB0ZW1wLmNvbmNhdChKVU5HW2p1bmddKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGVtcC5wdXNoKEpVTkdbanVuZ10pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKGpvbmcgPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBKT05HW2pvbmddID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0ZW1wID0gdGVtcC5jb25jYXQoSk9OR1tqb25nXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGVtcC5wdXNoKEpPTkdbam9uZ10pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIGlmIChfaXNDb25zb25hbnQoY29kZSkpIHsgLy/snpDsnYzsnbTrqbRcclxuICAgICAgICAgICAgICAgIGlmIChfaXNDaG8oY29kZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICByID0gQ0hPW0NIT19IQVNIW2NvZGVdXTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgciA9IEpPTkdbSk9OR19IQVNIW2NvZGVdXTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgciA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICAgICB0ZW1wLnB1c2gocik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXAgPSB0ZW1wLmNvbmNhdChyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIGlmIChfaXNKdW5nKGNvZGUpKSB7XHJcbiAgICAgICAgICAgICAgICByID0gSlVOR1tKVU5HX0hBU0hbY29kZV1dO1xyXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiByID09PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRlbXAucHVzaChyKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGVtcCA9IHRlbXAuY29uY2F0KHIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGVtcC5wdXNoKHN0cmluZy5jaGFyQXQoaSkpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoZ3JvdXBlZCkgcmVzdWx0LnB1c2godGVtcCk7XHJcbiAgICAgICAgICAgIGVsc2UgcmVzdWx0ID0gcmVzdWx0LmNvbmNhdCh0ZW1wKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBkaXNhc3NlbWJsZVRvU3RyaW5nID0gZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykge1xyXG4gICAgICAgICAgICByZXR1cm4gJyc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHN0ciA9IGRpc2Fzc2VtYmxlKHN0cik7XHJcbiAgICAgICAgcmV0dXJuIHN0ci5qb2luKCcnKTtcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGFzc2VtYmxlID0gZnVuY3Rpb24gKGFycmF5KSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBhcnJheSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgYXJyYXkgPSBkaXNhc3NlbWJsZShhcnJheSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgcmVzdWx0ID0gW10sXHJcbiAgICAgICAgICAgIGxlbmd0aCA9IGFycmF5Lmxlbmd0aCxcclxuICAgICAgICAgICAgY29kZSxcclxuICAgICAgICAgICAgc3RhZ2UgPSAwLFxyXG4gICAgICAgICAgICBjb21wbGV0ZV9pbmRleCA9IC0xLCAvL+yZhOyEseuQnCDqs7PsnZgg7J24642x7IqkXHJcbiAgICAgICAgICAgIHByZXZpb3VzX2NvZGUsXHJcbiAgICAgICAgICAgIGpvbmdfam9pbmVkID0gZmFsc2VcclxuICAgICAgICAgICAgO1xyXG5cclxuICAgICAgICBmdW5jdGlvbiBfbWFrZUhhbmd1bChpbmRleCkgeyAvLyBjb21wbGV0ZV9pbmRleCArIDHrtoDthLAgaW5kZXjquYzsp4DrpbwgZ3JlZWR57ZWY6rKMIO2VnOq4gOuhnCDrp4zrk6Dri6QuXHJcbiAgICAgICAgICAgIHZhciBjb2RlLFxyXG4gICAgICAgICAgICAgICAgY2hvLFxyXG4gICAgICAgICAgICAgICAganVuZzEsXHJcbiAgICAgICAgICAgICAgICBqdW5nMixcclxuICAgICAgICAgICAgICAgIGpvbmcxID0gMCxcclxuICAgICAgICAgICAgICAgIGpvbmcyLFxyXG4gICAgICAgICAgICAgICAgaGFuZ3VsID0gJydcclxuICAgICAgICAgICAgICAgIDtcclxuXHJcbiAgICAgICAgICAgIGpvbmdfam9pbmVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGlmIChjb21wbGV0ZV9pbmRleCArIDEgPiBpbmRleCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZvciAodmFyIHN0ZXAgPSAxOyA7IHN0ZXArKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHN0ZXAgPT09IDEpIHtcclxuICAgICAgICAgICAgICAgICAgICBjaG8gPSBhcnJheVtjb21wbGV0ZV9pbmRleCArIHN0ZXBdLmNoYXJDb2RlQXQoMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKF9pc0p1bmcoY2hvKSkgeyAvLyDssqvrsojsp7gg6rKD7J20IOuqqOydjOydtOuptCAxKSDjhY/qsJnsnYAg6rK97Jqw7J206rGw64KYIDIpIOOFmeqwmeydgCDqsr3smrDsnbTri6RcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbXBsZXRlX2luZGV4ICsgc3RlcCArIDEgPD0gaW5kZXggJiYgX2lzSnVuZyhqdW5nMSA9IGFycmF5W2NvbXBsZXRlX2luZGV4ICsgc3RlcCArIDFdLmNoYXJDb2RlQXQoMCkpKSB7IC8v64uk7J2M6rKD7J20IOyeiOqzoCDrqqjsnYzsnbTrqbRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUoX2lzSnVuZ0pvaW5hYmxlKGNobywganVuZzEpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZV9pbmRleCA9IGluZGV4O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goYXJyYXlbY29tcGxldGVfaW5kZXggKyBzdGVwXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZV9pbmRleCA9IGluZGV4O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICghX2lzQ2hvKGNobykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goYXJyYXlbY29tcGxldGVfaW5kZXggKyBzdGVwXSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbXBsZXRlX2luZGV4ID0gaW5kZXg7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaGFuZ3VsID0gYXJyYXlbY29tcGxldGVfaW5kZXggKyBzdGVwXTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RlcCA9PT0gMikge1xyXG4gICAgICAgICAgICAgICAgICAgIGp1bmcxID0gYXJyYXlbY29tcGxldGVfaW5kZXggKyBzdGVwXS5jaGFyQ29kZUF0KDApO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChfaXNDaG8oanVuZzEpKSB7IC8v65GQ67KI7Ke4IOuYkCDsnpDsnYzsnbQg7Jik66m0IOOEsyDsl5DshJwg44WF6rCZ7J2AIOqyveyasOydtOuLpFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjaG8gPSBfaXNKb25nSm9pbmFibGUoY2hvLCBqdW5nMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmd1bCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoY2hvKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goaGFuZ3VsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tcGxldGVfaW5kZXggPSBpbmRleDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhbmd1bCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoKENIT19IQVNIW2Nob10gKiAyMSArIEpVTkdfSEFTSFtqdW5nMV0pICogMjggKyBIQU5HVUxfT0ZGU0VUKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHN0ZXAgPT09IDMpIHtcclxuICAgICAgICAgICAgICAgICAgICBqdW5nMiA9IGFycmF5W2NvbXBsZXRlX2luZGV4ICsgc3RlcF0uY2hhckNvZGVBdCgwKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoX2lzSnVuZ0pvaW5hYmxlKGp1bmcxLCBqdW5nMikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAganVuZzEgPSBfaXNKdW5nSm9pbmFibGUoanVuZzEsIGp1bmcyKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBqb25nMSA9IGp1bmcyO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBoYW5ndWwgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKChDSE9fSEFTSFtjaG9dICogMjEgKyBKVU5HX0hBU0hbanVuZzFdKSAqIDI4ICsgSk9OR19IQVNIW2pvbmcxXSArIEhBTkdVTF9PRkZTRVQpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChzdGVwID09PSA0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgam9uZzIgPSBhcnJheVtjb21wbGV0ZV9pbmRleCArIHN0ZXBdLmNoYXJDb2RlQXQoMCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKF9pc0pvbmdKb2luYWJsZShqb25nMSwgam9uZzIpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvbmcxID0gX2lzSm9uZ0pvaW5hYmxlKGpvbmcxLCBqb25nMik7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgam9uZzEgPSBqb25nMjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgaGFuZ3VsID0gU3RyaW5nLmZyb21DaGFyQ29kZSgoQ0hPX0hBU0hbY2hvXSAqIDIxICsgSlVOR19IQVNIW2p1bmcxXSkgKiAyOCArIEpPTkdfSEFTSFtqb25nMV0gKyBIQU5HVUxfT0ZGU0VUKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RlcCA9PT0gNSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGpvbmcyID0gYXJyYXlbY29tcGxldGVfaW5kZXggKyBzdGVwXS5jaGFyQ29kZUF0KDApO1xyXG4gICAgICAgICAgICAgICAgICAgIGpvbmcxID0gX2lzSm9uZ0pvaW5hYmxlKGpvbmcxLCBqb25nMik7XHJcbiAgICAgICAgICAgICAgICAgICAgaGFuZ3VsID0gU3RyaW5nLmZyb21DaGFyQ29kZSgoQ0hPX0hBU0hbY2hvXSAqIDIxICsgSlVOR19IQVNIW2p1bmcxXSkgKiAyOCArIEpPTkdfSEFTSFtqb25nMV0gKyBIQU5HVUxfT0ZGU0VUKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoY29tcGxldGVfaW5kZXggKyBzdGVwID49IGluZGV4KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goaGFuZ3VsKTtcclxuICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZV9pbmRleCA9IGluZGV4O1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb2RlID0gYXJyYXlbaV0uY2hhckNvZGVBdCgwKTtcclxuICAgICAgICAgICAgaWYgKCFfaXNDaG8oY29kZSkgJiYgIV9pc0p1bmcoY29kZSkgJiYgIV9pc0pvbmcoY29kZSkpIHsgLy/stIgsIOykkSwg7KKF7ISxIOuLpCDslYTri4jrqbRcclxuICAgICAgICAgICAgICAgIF9tYWtlSGFuZ3VsKGkgLSAxKTtcclxuICAgICAgICAgICAgICAgIF9tYWtlSGFuZ3VsKGkpO1xyXG4gICAgICAgICAgICAgICAgc3RhZ2UgPSAwO1xyXG4gICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy9jb25zb2xlLmxvZyhzdGFnZSwgYXJyYXlbaV0pO1xyXG4gICAgICAgICAgICBpZiAoc3RhZ2UgPT09IDApIHsgLy8g7LSI7ISx7J20IOyYrCDssKjroYBcclxuICAgICAgICAgICAgICAgIGlmIChfaXNDaG8oY29kZSkpIHsgLy8g7LSI7ISx7J20IOyYpOuptCDslYTrrLQg66y47KCcIOyXhuuLpC5cclxuICAgICAgICAgICAgICAgICAgICBzdGFnZSA9IDE7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKF9pc0p1bmcoY29kZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDspJHshLHsnbTsmKTrqbQg44WQIOuYkOuKlCDjhZgg7J246rKD7J2064ukLiDrsJTroZwg6rWs67aE7J2EIOuqu+2VnOuLpC4g65Sw65287IScIO2KueyImO2VnCBzdGFnZeyduCBzdGFnZTTroZwg7J2064+ZXHJcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2UgPSA0O1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0YWdlID09IDEpIHsgLy/spJHshLHsnbQg7JisIOywqOuhgFxyXG4gICAgICAgICAgICAgICAgaWYgKF9pc0p1bmcoY29kZSkpIHsgLy/spJHshLHsnbQg7Jik66m0IOusuOygnOyXhuydjCDsp4TtlokuXHJcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2UgPSAyO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHsgLy/slYTri4jqs6Ag7J6Q7J2M7J207Jik66m0IOOEu+qwmeydgCDqsr3smrDqsIAg7J6I6rOgIOOEueOFi+qwmeydgCDqsr3smrDqsIAg7J6I64ukLlxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChfaXNKb25nSm9pbmFibGUocHJldmlvdXNfY29kZSwgY29kZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g7ZWp7LOQ7KeIIOyImCDsnojri6TrqbQg44S7IOqwmeydgCDqsr3smrDsnbjrjbAg7J20IOuSpOyXkCDrqqjsnYzsnbQg7JmA7IScIOOEueuniCDqsIAg65Cg7IiY64+EIOyeiOqzoCDstIjshLHsnbQg7JisIOyImOuPhCDsnojri6QuIOuUsOudvOyEnCDshKPrtojrpqwg7JmE7ISx7ZWgIOyImCDsl4bri6QuIOydtOuVkCBzdGFnZTXroZwg6rCE64ukLlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFnZSA9IDU7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy/tlanss5Dsp4gg7IiYIOyXhuuLpOuptCDslZ4g6riA7J6QIOyZhOyEsSDtm4Qg7Jes7KCE7Z6IIOykkeyEseydtCDsmKwg7LCo66GAXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF9tYWtlSGFuZ3VsKGkgLSAxKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhZ2UgPT0gMikgeyAvL+yiheyEseydtCDsmKwg7LCo66GAXHJcbiAgICAgICAgICAgICAgICBpZiAoX2lzSm9uZyhjb2RlKSkgeyAvL+yiheyEseydtCDsmKTrqbQg64uk7J2M7JeUIOyekOydjCDrmJDripQg66qo7J2M7J20IOyYqOuLpC5cclxuICAgICAgICAgICAgICAgICAgICBzdGFnZSA9IDM7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKF9pc0p1bmcoY29kZSkpIHsgLy/qt7jrn7DrjbAg7KSR7ISx7J20IOyYpOuptCDslZ7snZgg66qo7J2M6rO8IO2Vqey5oCDsiJgg7J6I64qU7KeAIOuzuOuLpC5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoX2lzSnVuZ0pvaW5hYmxlKHByZXZpb3VzX2NvZGUsIGNvZGUpKSB7IC8v7ZWp7LmgIOyImCDsnojsnLzrqbQg7Jes7KCE7Z6IIOyiheyEseydtCDsmKwg7LCo66GA6rOgIOq3uOuMgOuhnCDsp4TtlolcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyDtlansuaAg7IiYIOyXhuuLpOuptCDsmKTtg4DqsIAg7IOd6ri0IOqyveyasFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBfbWFrZUhhbmd1bChpIC0gMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YWdlID0gNDtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgeyAvLyDrsJvsuajsnbQg7JWI65CY64qUIOyekOydjOydtCDsmKTrqbQg44S4IOqwmeydgCDsnbTsoITquYzsp4Ag7JmE7ISx7ZWY6rOgIOuLpOyLnOyLnOyekVxyXG4gICAgICAgICAgICAgICAgICAgIF9tYWtlSGFuZ3VsKGkgLSAxKTtcclxuICAgICAgICAgICAgICAgICAgICBzdGFnZSA9IDE7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoc3RhZ2UgPT0gMykgeyAvLyDsooXshLHsnbQg7ZWY64KYIOyYqCDsg4Htg5wuXHJcbiAgICAgICAgICAgICAgICBpZiAoX2lzSm9uZyhjb2RlKSkgeyAvLyDrmJAg7KKF7ISx7J2066m0IO2Vqey5oOyImCDsnojripTsp4Ag67O464ukLlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICgham9uZ19qb2luZWQgJiYgX2lzSm9uZ0pvaW5hYmxlKHByZXZpb3VzX2NvZGUsIGNvZGUpKSB7IC8v7ZWp7LmgIOyImCDsnojsnLzrqbQg6rOE7IaNIOynhO2WiS4g7Jmc64OQ7ZWY66m0IOydtOuyiOyXkCDsmKgg7J6Q7J2M7J20IOuLpOydjCDquIDsnpDsnZgg7LSI7ISx7J20IOuQoCDsiJjrj4Qg7J6I6riwIOuVjOusuC4g64yA7IugIOydtCDquLDtmozripQg7ZWc67KI66eMXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGpvbmdfam9pbmVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgeyAvL+yXhuycvOuptCDtlZzquIDsnpAg7JmE7ISxXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF9tYWtlSGFuZ3VsKGkgLSAxKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhZ2UgPSAxOyAvLyDsnbQg7KKF7ISx7J20IOy0iOyEseydtCDrkJjqs6Ag7KSR7ISx67aA7YSwIOyLnOyekVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoX2lzQ2hvKGNvZGUpKSB7IC8vIOy0iOyEseydtOuptCDtlZzquIDsnpAg7JmE7ISxLlxyXG4gICAgICAgICAgICAgICAgICAgIF9tYWtlSGFuZ3VsKGkgLSAxKTtcclxuICAgICAgICAgICAgICAgICAgICBzdGFnZSA9IDE7IC8v7J20IOq4gOyekOqwgCDstIjshLHsnbTrkJjrr4DroZwg7KSR7ISx67aA7YSwIOyLnOyekVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChfaXNKdW5nKGNvZGUpKSB7IC8vIOykkeyEseydtOuptCDsnbTsoIQg7KKF7ISx7J2AIOydtCDspJHshLHqs7wg7ZWp7LOQ7KeA6rOgIOyVniDquIDsnpDripQg67Cb7Lmo7J20IOyXhuuLpC5cclxuICAgICAgICAgICAgICAgICAgICBfbWFrZUhhbmd1bChpIC0gMik7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2UgPSAyO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0YWdlID09IDQpIHsgLy8g7KSR7ISx7J20IO2VmOuCmCDsmKgg7IOB7YOcXHJcbiAgICAgICAgICAgICAgICBpZiAoX2lzSnVuZyhjb2RlKSkgeyAvL+ykkeyEseydtCDsmKgg6rK97JqwXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKF9pc0p1bmdKb2luYWJsZShwcmV2aW91c19jb2RlLCBjb2RlKSkgeyAvL+ydtOyghCDspJHshLHqs7wg7ZWp7LOQ7KeIIOyImCDsnojripQg6rK97JqwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIF9tYWtlSGFuZ3VsKGkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBzdGFnZSA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHsgLy/spJHshLHsnbQg7JmU7KeA66eMIOuqu+2Vqey5mOuKlCDqsr3smrAuIOOFkuOFlyDqsJnsnYBcclxuICAgICAgICAgICAgICAgICAgICAgICAgX21ha2VIYW5ndWwoaSAtIDEpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7IC8vIOyVhOuLiOuptCDsnpDsnYzsnbQg7JioIOqyveyasC5cclxuICAgICAgICAgICAgICAgICAgICBfbWFrZUhhbmd1bChpIC0gMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2UgPSAxO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN0YWdlID09IDUpIHsgLy8g7LSI7ISx7J20IOyXsOyGje2VtOyEnCDrkZDqsJwg7JioIOyDge2DnCDjhLpcclxuICAgICAgICAgICAgICAgIGlmIChfaXNKdW5nKGNvZGUpKSB7IC8v7J2067KI7JeQIOykkeyEseydtOuptCDjhLnqsIBcclxuICAgICAgICAgICAgICAgICAgICBfbWFrZUhhbmd1bChpIC0gMik7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2UgPSAyO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBfbWFrZUhhbmd1bChpIC0gMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhZ2UgPSAxO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHByZXZpb3VzX2NvZGUgPSBjb2RlO1xyXG4gICAgICAgIH1cclxuICAgICAgICBfbWFrZUhhbmd1bChpIC0gMSk7XHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5qb2luKCcnKTtcclxuICAgIH07XHJcblxyXG4gICAgdmFyIHNlYXJjaCA9IGZ1bmN0aW9uIChhLCBiKSB7XHJcbiAgICAgICAgdmFyIGFkID0gZGlzYXNzZW1ibGUoYSkuam9pbignJyksXHJcbiAgICAgICAgICAgIGJkID0gZGlzYXNzZW1ibGUoYikuam9pbignJylcclxuICAgICAgICAgICAgO1xyXG5cclxuICAgICAgICByZXR1cm4gYWQuaW5kZXhPZihiZCk7XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciByYW5nZVNlYXJjaCA9IGZ1bmN0aW9uIChoYXlzdGFjaywgbmVlZGxlKSB7XHJcbiAgICAgICAgdmFyIGhleCA9IGRpc2Fzc2VtYmxlKGhheXN0YWNrKS5qb2luKCcnKSxcclxuICAgICAgICAgICAgbmV4ID0gZGlzYXNzZW1ibGUobmVlZGxlKS5qb2luKCcnKSxcclxuICAgICAgICAgICAgZ3JvdXBlZCA9IGRpc2Fzc2VtYmxlKGhheXN0YWNrLCB0cnVlKSxcclxuICAgICAgICAgICAgcmUgPSBuZXcgUmVnRXhwKG5leCwgJ2dpJyksXHJcbiAgICAgICAgICAgIGluZGljZXMgPSBbXSxcclxuICAgICAgICAgICAgcmVzdWx0O1xyXG5cclxuICAgICAgICBpZiAoIW5lZWRsZS5sZW5ndGgpIHJldHVybiBbXTtcclxuXHJcbiAgICAgICAgd2hpbGUgKChyZXN1bHQgPSByZS5leGVjKGhleCkpKSB7XHJcbiAgICAgICAgICAgIGluZGljZXMucHVzaChyZXN1bHQuaW5kZXgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gZmluZFN0YXJ0KGluZGV4KSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSAwOyBpIDwgZ3JvdXBlZC5sZW5ndGg7ICsraSkge1xyXG4gICAgICAgICAgICAgICAgbGVuZ3RoICs9IGdyb3VwZWRbaV0ubGVuZ3RoO1xyXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4IDwgbGVuZ3RoKSByZXR1cm4gaTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZnVuY3Rpb24gZmluZEVuZChpbmRleCkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMCwgbGVuZ3RoID0gMDsgaSA8IGdyb3VwZWQubGVuZ3RoOyArK2kpIHtcclxuICAgICAgICAgICAgICAgIGxlbmd0aCArPSBncm91cGVkW2ldLmxlbmd0aDtcclxuICAgICAgICAgICAgICAgIGlmIChpbmRleCArIG5leC5sZW5ndGggPD0gbGVuZ3RoKSByZXR1cm4gaTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGluZGljZXMubWFwKGZ1bmN0aW9uIChpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBbZmluZFN0YXJ0KGkpLCBmaW5kRW5kKGkpXTtcclxuICAgICAgICB9KTtcclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gU2VhcmNoZXIoc3RyaW5nKSB7XHJcbiAgICAgICAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XHJcbiAgICAgICAgdGhpcy5kaXNhc3NlbWJsZWQgPSBkaXNhc3NlbWJsZShzdHJpbmcpLmpvaW4oJycpO1xyXG4gICAgfVxyXG5cclxuICAgIFNlYXJjaGVyLnByb3RvdHlwZS5zZWFyY2ggPSBmdW5jdGlvbiAoc3RyaW5nKSB7XHJcbiAgICAgICAgcmV0dXJuIGRpc2Fzc2VtYmxlKHN0cmluZykuam9pbignJykuaW5kZXhPZih0aGlzLmRpc2Fzc2VtYmxlZCk7XHJcbiAgICB9O1xyXG4gICAgdmFyIGVuZHNXaXRoQ29uc29uYW50ID0gZnVuY3Rpb24gKHN0cmluZykge1xyXG4gICAgICAgIGlmICh0eXBlb2Ygc3RyaW5nID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICBzdHJpbmcgPSBzdHJpbmcuam9pbignJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY29kZSA9IHN0cmluZy5jaGFyQ29kZUF0KHN0cmluZy5sZW5ndGggLSAxKTtcclxuXHJcbiAgICAgICAgaWYgKF9pc0hhbmd1bChjb2RlKSkgeyAvLyDsmYTshLHrkJwg7ZWc6riA7J2066m0XHJcbiAgICAgICAgICAgIGNvZGUgLT0gSEFOR1VMX09GRlNFVDtcclxuICAgICAgICAgICAgdmFyIGpvbmcgPSBjb2RlICUgMjg7XHJcbiAgICAgICAgICAgIGlmIChqb25nID4gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgaWYgKF9pc0NvbnNvbmFudChjb2RlKSkgeyAvL+yekOydjOydtOuptFxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgZW5kc1dpdGggPSBmdW5jdGlvbiAoc3RyaW5nLCB0YXJnZXQpIHtcclxuICAgICAgICByZXR1cm4gZGlzYXNzZW1ibGUoc3RyaW5nKS5wb3AoKSA9PT0gdGFyZ2V0O1xyXG4gICAgfTtcclxuXHJcblxyXG4gICAgdmFyIGhhbmd1bCA9IHtcclxuICAgICAgICBkaXNhc3NlbWJsZTogZGlzYXNzZW1ibGUsXHJcbiAgICAgICAgZDogZGlzYXNzZW1ibGUsIC8vIGFsaWFzIGZvciBkaXNhc3NlbWJsZVxyXG4gICAgICAgIGRpc2Fzc2VtYmxlVG9TdHJpbmc6IGRpc2Fzc2VtYmxlVG9TdHJpbmcsXHJcbiAgICAgICAgZHM6IGRpc2Fzc2VtYmxlVG9TdHJpbmcsIC8vIGFsaWFzIGZvciBkaXNhc3NlbWJsZVRvU3RyaW5nXHJcbiAgICAgICAgYXNzZW1ibGU6IGFzc2VtYmxlLFxyXG4gICAgICAgIGE6IGFzc2VtYmxlLCAvLyBhbGlhcyBmb3IgYXNzZW1ibGVcclxuICAgICAgICBzZWFyY2g6IHNlYXJjaCxcclxuICAgICAgICByYW5nZVNlYXJjaDogcmFuZ2VTZWFyY2gsXHJcbiAgICAgICAgU2VhcmNoZXI6IFNlYXJjaGVyLFxyXG4gICAgICAgIGVuZHNXaXRoQ29uc29uYW50OiBlbmRzV2l0aENvbnNvbmFudCxcclxuICAgICAgICBlbmRzV2l0aDogZW5kc1dpdGgsXHJcbiAgICAgICAgaXNIYW5ndWw6IGZ1bmN0aW9uIChjKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycpXHJcbiAgICAgICAgICAgICAgICBjID0gYy5jaGFyQ29kZUF0KDApO1xyXG4gICAgICAgICAgICByZXR1cm4gX2lzSGFuZ3VsKGMpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNDb21wbGV0ZTogZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJylcclxuICAgICAgICAgICAgICAgIGMgPSBjLmNoYXJDb2RlQXQoMCk7XHJcbiAgICAgICAgICAgIHJldHVybiBfaXNIYW5ndWwoYyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0NvbnNvbmFudDogZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJylcclxuICAgICAgICAgICAgICAgIGMgPSBjLmNoYXJDb2RlQXQoMCk7XHJcbiAgICAgICAgICAgIHJldHVybiBfaXNDb25zb25hbnQoYyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc1Zvd2VsOiBmdW5jdGlvbiAoYykge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGMgPT09ICdzdHJpbmcnKVxyXG4gICAgICAgICAgICAgICAgYyA9IGMuY2hhckNvZGVBdCgwKTtcclxuICAgICAgICAgICAgcmV0dXJuIF9pc0p1bmcoYyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0NobzogZnVuY3Rpb24gKGMpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjID09PSAnc3RyaW5nJylcclxuICAgICAgICAgICAgICAgIGMgPSBjLmNoYXJDb2RlQXQoMCk7XHJcbiAgICAgICAgICAgIHJldHVybiBfaXNDaG8oYyk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0pvbmc6IGZ1bmN0aW9uIChjKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgYyA9PT0gJ3N0cmluZycpXHJcbiAgICAgICAgICAgICAgICBjID0gYy5jaGFyQ29kZUF0KDApO1xyXG4gICAgICAgICAgICByZXR1cm4gX2lzSm9uZyhjKTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzSGFuZ3VsQWxsOiBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFfaXNIYW5ndWwoc3RyLmNoYXJDb2RlQXQoaSkpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0NvbXBsZXRlQWxsOiBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFfaXNIYW5ndWwoc3RyLmNoYXJDb2RlQXQoaSkpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0NvbnNvbmFudEFsbDogZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmICghX2lzQ29uc29uYW50KHN0ci5jaGFyQ29kZUF0KGkpKSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgaXNWb3dlbEFsbDogZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIHN0ciAhPT0gJ3N0cmluZycpIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmICghX2lzSnVuZyhzdHIuY2hhckNvZGVBdChpKSkpIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIGlzQ2hvQWxsOiBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc3RyICE9PSAnc3RyaW5nJykgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFfaXNDaG8oc3RyLmNoYXJDb2RlQXQoaSkpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBpc0pvbmdBbGw6IGZ1bmN0aW9uIChzdHIpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzdHIgIT09ICdzdHJpbmcnKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIV9pc0pvbmcoc3RyLmNoYXJDb2RlQXQoaSkpKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcclxuICAgICAgICBkZWZpbmUoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gaGFuZ3VsO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJykge1xyXG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gaGFuZ3VsO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICB3aW5kb3cuSGFuZ3VsID0gaGFuZ3VsO1xyXG4gICAgfVxyXG59KSgpO1xyXG5cclxuIiwiaW1wb3J0IHtcbiAgICBBcHAsXG4gICAgRWRpdG9yLFxuICAgIEVkaXRvclBvc2l0aW9uLFxuICAgIEZ1enp5U3VnZ2VzdE1vZGFsLFxuICAgIFBsdWdpbixcbiAgICBQbHVnaW5TZXR0aW5nVGFiLFxuICAgIFRGaWxlLFxuICAgIEVkaXRvclN1Z2dlc3QsXG4gICAgRWRpdG9yU3VnZ2VzdENvbnRleHQsXG4gICAgfSBmcm9tICdvYnNpZGlhbic7XG4gIFxuICBpbXBvcnQgRnVzZSBmcm9tICdmdXNlLmpzJztcbiAgaW1wb3J0IEhhbmd1bCBmcm9tICdoYW5ndWwtanMnO1xuICBcbiAgLyogLS0tLS0tLS0tLSDsgqzsmqnsnpAg7ISk7KCVIC0tLS0tLS0tLS0gKi9cbiAgaW50ZXJmYWNlIEhhbmd1bFNlYXJjaFNldHRpbmdzIHtcbiAgICBmdXp6eVRocmVzaG9sZDogbnVtYmVyOyAgICAgICAvLyAwICjsl4TqsqkpIOKGlCAxICjripDsiqgpXG4gICAgb3ZlcnJpZGVRdWlja1N3aXRjaGVyOiBib29sZWFuO1xuICB9XG4gIFxuICBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBIYW5ndWxTZWFyY2hTZXR0aW5ncyA9IHtcbiAgICBmdXp6eVRocmVzaG9sZDogMC40LFxuICAgIG92ZXJyaWRlUXVpY2tTd2l0Y2hlcjogdHJ1ZSxcbiAgfTtcbiAgXG4gIC8qIC0tLS0tLS0tLS0g7IOJ7J24IC0tLS0tLS0tLS0gKi9cbiAgaW50ZXJmYWNlIEluZGV4RW50cnkge1xuICAgIGRpc3BsYXk6IHN0cmluZzsgICAvLyDrs7Tsl6zspIQg7J2066aEXG4gICAgamFtbzogc3RyaW5nOyAgICAgIC8vIOu2hO2VtOuQnCDsnpDrqqhcbiAgICBwYXRoOiBzdHJpbmc7ICAgICAgLy8g7YyM7J28IOqyveuhnFxuICB9XG4gIFxuICBjbGFzcyBIYW5ndWxJbmRleCB7XG4gICAgcHJpdmF0ZSBlbnRyaWVzOiBJbmRleEVudHJ5W10gPSBbXTtcbiAgICBwcml2YXRlIGZ1c2UhOiBGdXNlPEluZGV4RW50cnk+O1xuICBcbiAgICBjb25zdHJ1Y3Rvcihwcml2YXRlIHBsdWdpbjogSGFuZ3VsU2VhcmNoUGx1Z2luKSB7fVxuICBcbiAgICAvKiog67O87Yq4IOyghOyytCDstIjquLAg7IOJ7J24ICovXG4gICAgYXN5bmMgYnVpbGQoKSB7XG4gICAgICBjb25zdCBmaWxlcyA9IHRoaXMucGx1Z2luLmFwcC52YXVsdC5nZXRNYXJrZG93bkZpbGVzKCk7XG4gICAgICB0aGlzLmVudHJpZXMgPSBmaWxlcy5tYXAoKGYpID0+IHRoaXMudG9FbnRyeShmKSk7XG4gICAgICB0aGlzLnJlYnVpbGRGdXNlKCk7XG4gICAgfVxuICBcbiAgICAvKiog7YyM7J28IOydtOumhOydtCDrsJTrgJQg65WM66eI64ukIOyXheuNsOydtO2KuCAqL1xuICAgIHVwZGF0ZU9uUmVuYW1lKGZpbGU6IFRGaWxlLCBvbGRQYXRoOiBzdHJpbmcpIHtcbiAgICAgIGNvbnN0IGkgPSB0aGlzLmVudHJpZXMuZmluZEluZGV4KChlKSA9PiBlLnBhdGggPT09IG9sZFBhdGgpO1xuICAgICAgaWYgKGkgPiAtMSkgdGhpcy5lbnRyaWVzLnNwbGljZShpLCAxLCB0aGlzLnRvRW50cnkoZmlsZSkpO1xuICAgICAgZWxzZSB0aGlzLmVudHJpZXMucHVzaCh0aGlzLnRvRW50cnkoZmlsZSkpO1xuICAgICAgdGhpcy5yZWJ1aWxkRnVzZSgpO1xuICAgIH1cbiAgXG4gICAgLyoqIOqygOyDiSAqL1xuICAgIHNlYXJjaChxOiBzdHJpbmcpOiBJbmRleEVudHJ5W10ge1xuICAgICAgY29uc3QgamFtbyA9IEhhbmd1bC5kaXNhc3NlbWJsZShxKS5qb2luKCcnKTtcbiAgICAgIHJldHVybiB0aGlzLmZ1c2Uuc2VhcmNoKGphbW8pLm1hcCgocikgPT4gci5pdGVtKTtcbiAgICB9XG4gIFxuICAgIC8qIC0tLS0tLS0tLS0g64K067aAIC0tLS0tLS0tLS0gKi9cbiAgICBwcml2YXRlIHRvRW50cnkoZmlsZTogVEZpbGUpOiBJbmRleEVudHJ5IHtcbiAgICAgIGNvbnN0IGRpc3BsYXkgPSBmaWxlLmJhc2VuYW1lO1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgZGlzcGxheSxcbiAgICAgICAgamFtbzogSGFuZ3VsLmRpc2Fzc2VtYmxlKGRpc3BsYXkpLmpvaW4oJycpLFxuICAgICAgICBwYXRoOiBmaWxlLnBhdGgsXG4gICAgICB9O1xuICAgIH1cbiAgXG4gICAgcHJpdmF0ZSByZWJ1aWxkRnVzZSgpIHtcbiAgICAgIHRoaXMuZnVzZSA9IG5ldyBGdXNlKHRoaXMuZW50cmllcywge1xuICAgICAgICB0aHJlc2hvbGQ6IHRoaXMucGx1Z2luLnNldHRpbmdzLmZ1enp5VGhyZXNob2xkLFxuICAgICAgICBrZXlzOiBbJ2phbW8nLCAnZGlzcGxheSddLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIFxuICAvKiAtLS0tLS0tLS0tIFF1aWNrIFN3aXRjaGVyIOuqqOuLrCAtLS0tLS0tLS0tICovXG4gIGNsYXNzIEhhbmd1bFN3aXRjaGVyIGV4dGVuZHMgRnV6enlTdWdnZXN0TW9kYWw8SW5kZXhFbnRyeT4ge1xuICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIGluZGV4OiBIYW5ndWxJbmRleCkge1xuICAgICAgc3VwZXIoYXBwKTtcbiAgICB9XG4gICAgZ2V0SXRlbXMoKSAgICAgICAgICAgIHsgcmV0dXJuIHRoaXMuaW5kZXguc2VhcmNoKHRoaXMuaW5wdXRFbC52YWx1ZSB8fCAnJyk7IH1cbiAgICBnZXRJdGVtVGV4dChpdGVtOiBJbmRleEVudHJ5KSAgICAgeyByZXR1cm4gaXRlbS5kaXNwbGF5OyB9XG4gICAgb25DaG9vc2VJdGVtKGl0ZW06IEluZGV4RW50cnkpICAgIHsgdGhpcy5hcHAud29ya3NwYWNlLm9wZW5MaW5rVGV4dChpdGVtLnBhdGgsICcnLCBmYWxzZSk7IH1cbiAgfVxuICBcbiAgLyogLS0tLS0tLS0tLSBbWyDrp4Htgawg7J6Q64+Z7JmE7ISxIC0tLS0tLS0tLS0gKi9cbiAgY2xhc3MgSGFuZ3VsTGlua1N1Z2dlc3QgZXh0ZW5kcyBFZGl0b3JTdWdnZXN0PEluZGV4RW50cnk+IHtcbiAgICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcHJpdmF0ZSBpbmRleDogSGFuZ3VsSW5kZXgpIHtcbiAgICAgIHN1cGVyKGFwcCk7XG4gICAgfVxuICBcbiAgICBvblRyaWdnZXIoY3Vyc29yOiBFZGl0b3JQb3NpdGlvbiwgZWRpdG9yOiBFZGl0b3IpOiBFZGl0b3JTdWdnZXN0Q29udGV4dCB8IG51bGwge1xuICAgICAgY29uc3QgdHJpZ2dlciA9IGVkaXRvci5nZXRSYW5nZSh7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogY3Vyc29yLmNoIC0gMiB9LCBjdXJzb3IpO1xuICAgICAgaWYgKHRyaWdnZXIgPT09ICdbWycpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG4gICAgICAgIGlmICghZmlsZSkgcmV0dXJuIG51bGw7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBjb250ZXh0ID0geyBcbiAgICAgICAgICBzdGFydDogY3Vyc29yLCBcbiAgICAgICAgICBlbmQ6IGN1cnNvciwgXG4gICAgICAgICAgcXVlcnk6ICcnLFxuICAgICAgICAgIGVkaXRvcjogZWRpdG9yLFxuICAgICAgICAgIGZpbGU6IGZpbGVcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIGNvbnRleHQ7XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIFxuICAgIGdldFN1Z2dlc3Rpb25zKGN0eDogRWRpdG9yU3VnZ2VzdENvbnRleHQpIHtcbiAgICAgIHJldHVybiB0aGlzLmluZGV4LnNlYXJjaChjdHgucXVlcnkpO1xuICAgIH1cbiAgICByZW5kZXJTdWdnZXN0aW9uKGl0ZW06IEluZGV4RW50cnksIGVsOiBIVE1MRWxlbWVudCkge1xuICAgICAgZWwudGV4dENvbnRlbnQgPSBpdGVtLmRpc3BsYXk7XG4gICAgfVxuICAgIHNlbGVjdFN1Z2dlc3Rpb24oaXRlbTogSW5kZXhFbnRyeSwgZXZ0OiBNb3VzZUV2ZW50IHwgS2V5Ym9hcmRFdmVudCkge1xuICAgICAgY29uc3QgYWN0aXZlTGVhZiA9IHRoaXMuYXBwLndvcmtzcGFjZS5hY3RpdmVMZWFmO1xuICAgICAgaWYgKGFjdGl2ZUxlYWY/LnZpZXcuZ2V0Vmlld1R5cGUoKSA9PT0gJ21hcmtkb3duJykge1xuICAgICAgICBjb25zdCBlZGl0b3IgPSAoYWN0aXZlTGVhZi52aWV3IGFzIGFueSkuZWRpdG9yO1xuICAgICAgICBpZiAoZWRpdG9yKSB7XG4gICAgICAgICAgY29uc3QgY3Vyc29yID0gZWRpdG9yLmdldEN1cnNvcigpO1xuICAgICAgICAgIGNvbnN0IGxpbmVUZXh0ID0gZWRpdG9yLmdldExpbmUoY3Vyc29yLmxpbmUpO1xuICAgICAgICAgIGNvbnN0IGJlZm9yZUN1cnNvciA9IGxpbmVUZXh0LnN1YnN0cmluZygwLCBjdXJzb3IuY2gpO1xuICAgICAgICAgIGNvbnN0IGxpbmtTdGFydCA9IGJlZm9yZUN1cnNvci5sYXN0SW5kZXhPZignW1snKTtcbiAgICAgICAgICBcbiAgICAgICAgICBpZiAobGlua1N0YXJ0ICE9PSAtMSkge1xuICAgICAgICAgICAgY29uc3Qgc3RhcnQgPSB7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogbGlua1N0YXJ0ICsgMiB9O1xuICAgICAgICAgICAgY29uc3QgZW5kID0gY3Vyc29yO1xuICAgICAgICAgICAgZWRpdG9yLnJlcGxhY2VSYW5nZShpdGVtLmRpc3BsYXkgKyAnXV0nLCBzdGFydCwgZW5kKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgXG4gIC8qIC0tLS0tLS0tLS0g7ZSM65+s6re47J24IOuzuOyytCAtLS0tLS0tLS0tICovXG4gIGV4cG9ydCBkZWZhdWx0IGNsYXNzIEhhbmd1bFNlYXJjaFBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gICAgc2V0dGluZ3MhOiBIYW5ndWxTZWFyY2hTZXR0aW5ncztcbiAgICBpbmRleCE6IEhhbmd1bEluZGV4O1xuICBcbiAgICBhc3luYyBvbmxvYWQoKSB7XG4gICAgICAvKiAxKSDshKTsoJUg66Gc65OcICovXG4gICAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICBcbiAgICAgIC8qIDIpIOyDieyduCDruYzrk5wgKi9cbiAgICAgIHRoaXMuaW5kZXggPSBuZXcgSGFuZ3VsSW5kZXgodGhpcyk7XG4gICAgICBhd2FpdCB0aGlzLmluZGV4LmJ1aWxkKCk7XG4gIFxuICAgICAgLyogMykg67O87Yq4IOydtOuypO2KuCDqsJDsi5wgKi9cbiAgICAgIHRoaXMucmVnaXN0ZXJFdmVudChcbiAgICAgICAgdGhpcy5hcHAudmF1bHQub24oJ3JlbmFtZScsIChmaWxlLCBvbGRQYXRoKSA9PiB7XG4gICAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkgdGhpcy5pbmRleC51cGRhdGVPblJlbmFtZShmaWxlLCBvbGRQYXRoKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICBcbiAgICAgIC8qIDQpIFF1aWNrIFN3aXRjaGVyIOuMgOyytCAqL1xuICAgICAgaWYgKHRoaXMuc2V0dGluZ3Mub3ZlcnJpZGVRdWlja1N3aXRjaGVyKSB7XG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICAgICAgaWQ6ICdoYW5ndWwtcXVpY2stc3dpdGNoZXInLFxuICAgICAgICAgIG5hbWU6ICdIYW5ndWwgUXVpY2sgU3dpdGNoZXInLFxuICAgICAgICAgIGhvdGtleXM6IFt7IG1vZGlmaWVyczogWydNb2QnXSwga2V5OiAnbycgfV0sIC8vIOKMmE9cbiAgICAgICAgICBjYWxsYmFjazogKCkgPT4gbmV3IEhhbmd1bFN3aXRjaGVyKHRoaXMuYXBwLCB0aGlzLmluZGV4KS5vcGVuKCksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICBcbiAgICAgIC8qIDUpIOunge2BrCDsnpDrj5nsmYTshLEgKi9cbiAgICAgIHRoaXMucmVnaXN0ZXJFZGl0b3JTdWdnZXN0KG5ldyBIYW5ndWxMaW5rU3VnZ2VzdCh0aGlzLmFwcCwgdGhpcy5pbmRleCkpO1xuICBcbiAgICAgIC8qIDYpICjshKDtg50pIOyEpOyglSDtg60gKi9cbiAgICAgIHRoaXMuYWRkU2V0dGluZ1RhYihcbiAgICAgICAgbmV3IChjbGFzcyBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICAgICAgICAgIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwcml2YXRlIHBsdWdpbjogSGFuZ3VsU2VhcmNoUGx1Z2luKSB7XG4gICAgICAgICAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGRpc3BsYXkoKSB7XG4gICAgICAgICAgICBjb25zdCB7IGNvbnRhaW5lckVsIH0gPSB0aGlzO1xuICAgICAgICAgICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICAgICAgICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKCdoMicsIHsgdGV4dDogJ0hhbmd1bCBGdXp6eSBTZWFyY2ggU2V0dGluZ3MnIH0pO1xuICAgICAgICAgICAgLy8gVE9ETzogdGhyZXNob2xkIOyKrOudvOydtOuNlCDrk7Eg7LaU6rCAXG4gICAgICAgICAgfVxuICAgICAgICB9KSh0aGlzLmFwcCwgdGhpcyksXG4gICAgICApO1xuICAgIH1cbiAgXG4gICAgLyogLS0tLS0tLS0tLSDshKTsoJUgbG9hZC9zYXZlIC0tLS0tLS0tLS0gKi9cbiAgICBhc3luYyBsb2FkU2V0dGluZ3MoKSB7XG4gICAgICB0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgYXdhaXQgdGhpcy5sb2FkRGF0YSgpKTtcbiAgICB9XG4gICAgYXN5bmMgc2F2ZVNldHRpbmdzKCkgeyBhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpOyB9XG4gIH0iXSwibmFtZXMiOlsiRnV6enlTdWdnZXN0TW9kYWwiLCJFZGl0b3JTdWdnZXN0IiwiUGx1Z2luIiwiVEZpbGUiLCJQbHVnaW5TZXR0aW5nVGFiIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FB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QUFHO0FBQ25DLGNBQVksR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztjQUMxQyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQztjQUN4RCxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUc7V0FDNUI7QUFDVCxVQUFRLElBQUksR0FBRztBQUNmLGNBQVksRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHO0FBQzNFLGNBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRztjQUN2RixHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO1dBQy9EO1VBQ0QsYUFBYSxHQUFHLE1BQU07QUFDOUIsVUFBUSxVQUFVLEdBQUc7QUFDckIsY0FBWSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztBQUNsRCxjQUFZLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO0FBQ2xELGNBQVksR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7Y0FDdEMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO1dBQy9CO0FBQ1QsVUFBUSxZQUFZLEdBQUc7Y0FDWCxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztjQUN2QixHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7QUFDeEMsY0FBWSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztXQUN6QztBQUNULFVBQVEsYUFBYSxHQUFHO2NBQ1osR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7Y0FDdkIsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO2NBQzVCLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztBQUN4QyxjQUFZLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUc7V0FDckI7QUFDVCxVQUFRLGFBQWEsR0FBRztBQUN4QixjQUFZLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztBQUN0RCxjQUFZLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO2NBQ3RDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHO1dBQ3hEO0FBQ1QsVUFBUSxrQkFBa0IsR0FBRztBQUM3QixjQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7QUFDM0IsY0FBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO0FBQzNCLGNBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUMzQixjQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7QUFDM0IsY0FBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO0FBQzNCLGNBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUMzQixjQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7QUFDM0IsY0FBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO0FBQzNCLGNBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUMzQixjQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7QUFDM0IsY0FBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO1dBQ2xCO0FBQ1QsVUFBUSxjQUFjLEdBQUc7QUFDekIsY0FBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO0FBQzNCLGNBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUMzQixjQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7QUFDM0IsY0FBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO0FBQzNCLGNBQVksQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQztBQUMzQixjQUFZLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7QUFDM0IsY0FBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDO1dBQ2xCO0FBQ1QsVUFBUSxlQUFlO0FBQ3ZCLFVBQVEsUUFBUTtBQUNoQixVQUFRLFNBQVM7QUFDakIsVUFBUSxTQUFTO0FBQ2pCLFVBQVEsdUJBQXVCO0FBQy9CLFVBQVEsbUJBQW1CO1dBQ2xCO0FBQ1Q7QUFDQSxNQUFJLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRTtBQUM5QixVQUFRLElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNO0FBQ2pDLGNBQVksSUFBSSxHQUFHLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRTtlQUNkO0FBQ2IsVUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3pDLGNBQVksSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3hCLGtCQUFnQixJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztXQUN4QztVQUNELE9BQU8sSUFBSSxDQUFDO09BQ2Y7QUFDTDtBQUNBLE1BQUksZUFBZSxHQUFHLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUM1QyxNQUFJLFFBQVEsR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDdkMsTUFBSSxTQUFTLEdBQUcsU0FBUyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0FBQ3pDLE1BQUksU0FBUyxHQUFHLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN6QztBQUNBLE1BQUksU0FBUyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUU7QUFDckMsVUFBUSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTTtjQUNyQixJQUFJLEdBQUcsRUFBRTtBQUNyQixjQUFZLEtBQUs7QUFDakIsY0FBWSxLQUFLO2VBQ0o7QUFDYixVQUFRLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDekMsY0FBWSxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QyxjQUFZLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO2NBQ2xDLElBQUksT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssV0FBVyxFQUFFO0FBQ3BELGtCQUFnQixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO2VBQ3BCO2NBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7V0FDbEQ7VUFDRCxPQUFPLElBQUksQ0FBQztPQUNmO0FBQ0w7QUFDQSxNQUFJLHVCQUF1QixHQUFHLGdCQUFnQixDQUFDLGtCQUFrQixDQUFDLENBQUM7QUFDbkUsTUFBSSxtQkFBbUIsR0FBRyxnQkFBZ0IsQ0FBQyxjQUFjLENBQUMsQ0FBQztBQUMzRDtBQUNBLE1BQUksU0FBUyxZQUFZLENBQUMsQ0FBQyxFQUFFO1VBQ3JCLE9BQU8sT0FBTyxlQUFlLENBQUMsQ0FBQyxDQUFDLEtBQUssV0FBVyxDQUFDO09BQ3BEO0FBQ0w7QUFDQSxNQUFJLFNBQVMsTUFBTSxDQUFDLENBQUMsRUFBRTtVQUNmLE9BQU8sT0FBTyxRQUFRLENBQUMsQ0FBQyxDQUFDLEtBQUssV0FBVyxDQUFDO09BQzdDO0FBQ0w7QUFDQSxNQUFJLFNBQVMsT0FBTyxDQUFDLENBQUMsRUFBRTtVQUNoQixPQUFPLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLFdBQVcsQ0FBQztPQUM5QztBQUNMO0FBQ0EsTUFBSSxTQUFTLE9BQU8sQ0FBQyxDQUFDLEVBQUU7VUFDaEIsT0FBTyxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsS0FBSyxXQUFXLENBQUM7T0FDOUM7QUFDTDtBQUNBLE1BQUksU0FBUyxTQUFTLENBQUMsQ0FBQyxvQkFBb0I7VUFDcEMsT0FBTyxNQUFNLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUM7T0FDckM7QUFDTDtBQUNBLE1BQUksU0FBUyxlQUFlLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRTtVQUMzQixPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLElBQUksbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO09BQ3BHO0FBQ0w7QUFDQSxNQUFJLFNBQVMsZUFBZSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFDM0IsT0FBTyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsSUFBSSx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7T0FDOUc7QUFDTDtBQUNBLE1BQUksSUFBSSxXQUFXLEdBQUcsVUFBVSxNQUFNLEVBQUUsT0FBTyxFQUFFO0FBQ2pELFVBQVEsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFO0FBQzdCLGNBQVksTUFBTSxJQUFJLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1dBQy9DO0FBQ1Q7QUFDQSxVQUFRLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO2NBQzVCLE1BQU0sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1dBQzVCO0FBQ1Q7VUFDUSxJQUFJLE1BQU0sR0FBRyxFQUFFO0FBQ3ZCLGNBQVksTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNO0FBQ2xDLGNBQVksR0FBRztBQUNmLGNBQVksSUFBSTtBQUNoQixjQUFZLElBQUk7QUFDaEIsY0FBWSxJQUFJO0FBQ2hCLGNBQVksQ0FBQztlQUNBO0FBQ2I7QUFDQSxVQUFRLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDekMsY0FBWSxJQUFJLElBQUksR0FBRyxFQUFFLENBQUM7QUFDMUI7Y0FDWSxJQUFJLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4QyxjQUFZLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO2tCQUNqQixJQUFJLElBQUksYUFBYSxDQUFDO0FBQ3RDLGtCQUFnQixJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztrQkFDakIsSUFBSSxHQUFHLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQy9DLGtCQUFnQixHQUFHLEdBQUcsUUFBUSxDQUFDLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7a0JBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7a0JBQ3BCLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFO3NCQUNoQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNuRCxtQkFBaUIsTUFBTTtzQkFDSCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO21CQUN6QjtBQUNqQixrQkFBZ0IsSUFBSSxJQUFJLEdBQUcsQ0FBQyxFQUFFO3NCQUNWLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssUUFBUSxFQUFFOzBCQUNoQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN2RCx1QkFBcUIsTUFBTTswQkFDSCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO3VCQUN6QjttQkFDSjtBQUNqQixlQUFhLE1BQU0sSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDM0Msa0JBQWdCLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO3NCQUNkLENBQUMsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDNUMsbUJBQWlCLE1BQU07c0JBQ0gsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQzttQkFDN0I7QUFDakIsa0JBQWdCLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO0FBQzNDLHNCQUFvQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLG1CQUFpQixNQUFNO3NCQUNILElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO21CQUN6QjtBQUNqQixlQUFhLE1BQU0sSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7a0JBQ3RCLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDMUMsa0JBQWdCLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUSxFQUFFO0FBQzNDLHNCQUFvQixJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2pDLG1CQUFpQixNQUFNO3NCQUNILElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO21CQUN6QjtBQUNqQixlQUFhLE1BQU07a0JBQ0gsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7ZUFDL0I7QUFDYjtjQUNZLElBQUksT0FBTyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7bUJBQzFCLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1dBQ3JDO0FBQ1Q7VUFDUSxPQUFPLE1BQU0sQ0FBQztBQUN0QixPQUFLLENBQUM7QUFDTjtBQUNBLE1BQUksSUFBSSxtQkFBbUIsR0FBRyxVQUFVLEdBQUcsRUFBRTtBQUM3QyxVQUFRLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFO2NBQ3pCLE9BQU8sRUFBRSxDQUFDO1dBQ2I7QUFDVCxVQUFRLEdBQUcsR0FBRyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDL0IsVUFBUSxPQUFPLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDNUIsT0FBSyxDQUFDO0FBQ047QUFDQSxNQUFJLElBQUksUUFBUSxHQUFHLFVBQVUsS0FBSyxFQUFFO0FBQ3BDLFVBQVEsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLEVBQUU7QUFDdkMsY0FBWSxLQUFLLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO1dBQzlCO0FBQ1Q7VUFDUSxJQUFJLE1BQU0sR0FBRyxFQUFFO0FBQ3ZCLGNBQVksTUFBTSxHQUFHLEtBQUssQ0FBQyxNQUFNO0FBQ2pDLGNBQVksSUFBSTtjQUNKLEtBQUssR0FBRyxDQUFDO2NBQ1QsY0FBYyxHQUFHLENBQUMsQ0FBQztBQUMvQixjQUFZLGFBQWE7Y0FDYixXQUFXLEdBQUcsS0FBSztlQUNsQjtBQUNiO0FBQ0EsVUFBUSxTQUFTLFdBQVcsQ0FBQyxLQUFLLEVBQUU7QUFDcEMsa0JBQ2dCLEdBQUcsQ0FBQTtBQUNuQixrQkFBZ0IsS0FBSyxDQUFBO0FBQ3JCLGtCQUFnQixLQUFLLENBQUE7a0JBQ0wsS0FBSyxHQUFHLENBQUMsQ0FBQTtBQUN6QixrQkFBZ0IsS0FBSyxDQUFBO2tCQUNMLE1BQU0sR0FBRyxFQUFFO21CQUNWO0FBQ2pCO2NBQ1ksV0FBVyxHQUFHLEtBQUssQ0FBQztBQUNoQyxjQUFZLElBQUksY0FBYyxHQUFHLENBQUMsR0FBRyxLQUFLLEVBQUU7QUFDNUMsa0JBQWdCLE9BQU87ZUFDVjtjQUNELEtBQUssSUFBSSxJQUFJLEdBQUcsQ0FBQyxJQUFJLElBQUksRUFBRSxFQUFFO0FBQ3pDLGtCQUFnQixJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7QUFDaEMsc0JBQW9CLEdBQUcsR0FBRyxLQUFLLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNyRSxzQkFBb0IsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLEVBQUU7MEJBQ2QsSUFBSSxjQUFjLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLElBQUksT0FBTyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsY0FBYyxHQUFHLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNuSSw4QkFBNEIsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDOzhCQUM5RCxjQUFjLEdBQUcsS0FBSyxDQUFDO0FBQ25ELDhCQUE0QixPQUFPO0FBQ25DLDJCQUF5QixNQUFNOzhCQUNILE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDOzhCQUMxQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0FBQ25ELDhCQUE0QixPQUFPOzJCQUNWO0FBQ3pCLHVCQUFxQixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUU7MEJBQ3JCLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDOzBCQUMxQyxjQUFjLEdBQUcsS0FBSyxDQUFDO0FBQy9DLDBCQUF3QixPQUFPO3VCQUNWO3NCQUNELE1BQU0sR0FBRyxLQUFLLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxDQUFDO0FBQzFELG1CQUFpQixNQUFNLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtBQUN2QyxzQkFBb0IsS0FBSyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZFLHNCQUFvQixJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsRUFBRTswQkFDZixHQUFHLEdBQUcsZUFBZSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQzswQkFDbEMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDMUQsMEJBQXdCLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7MEJBQ3BCLGNBQWMsR0FBRyxLQUFLLENBQUM7QUFDL0MsMEJBQXdCLE9BQU87QUFDL0IsdUJBQXFCLE1BQU07MEJBQ0gsTUFBTSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsYUFBYSxDQUFDLENBQUM7dUJBQzlGO0FBQ3JCLG1CQUFpQixNQUFNLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtBQUN2QyxzQkFBb0IsS0FBSyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZFLHNCQUFvQixJQUFJLGVBQWUsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLEVBQUU7MEJBQy9CLEtBQUssR0FBRyxlQUFlLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQzlELHVCQUFxQixNQUFNOzBCQUNILEtBQUssR0FBRyxLQUFLLENBQUM7dUJBQ2pCO0FBQ3JCLHNCQUFvQixNQUFNLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLEdBQUcsYUFBYSxDQUFDLENBQUM7QUFDbEk7QUFDQSxtQkFBaUIsTUFBTSxJQUFJLElBQUksS0FBSyxDQUFDLEVBQUU7QUFDdkMsc0JBQW9CLEtBQUssR0FBRyxLQUFLLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN2RSxzQkFBb0IsSUFBSSxlQUFlLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxFQUFFOzBCQUMvQixLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUM5RCx1QkFBcUIsTUFBTTswQkFDSCxLQUFLLEdBQUcsS0FBSyxDQUFDO3VCQUNqQjtBQUNyQixzQkFBb0IsTUFBTSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLGFBQWEsQ0FBQyxDQUFDO0FBQ2xJLG1CQUFpQixNQUFNLElBQUksSUFBSSxLQUFLLENBQUMsRUFBRTtBQUN2QyxzQkFBb0IsS0FBSyxHQUFHLEtBQUssQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO3NCQUNuRCxLQUFLLEdBQUcsZUFBZSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUMxRCxzQkFBb0IsTUFBTSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLGFBQWEsQ0FBQyxDQUFDO21CQUNqSDtBQUNqQjtBQUNBLGtCQUFnQixJQUFJLGNBQWMsR0FBRyxJQUFJLElBQUksS0FBSyxFQUFFO0FBQ3BELHNCQUFvQixNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO3NCQUNwQixjQUFjLEdBQUcsS0FBSyxDQUFDO0FBQzNDLHNCQUFvQixPQUFPO21CQUNWO2VBQ0o7V0FDSjtBQUNUO0FBQ0EsVUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO2NBQzdCLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzFDLGNBQVksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtBQUNuRSxrQkFBZ0IsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNuQyxrQkFBZ0IsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO2tCQUNmLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDMUIsa0JBQWdCLFNBQVM7ZUFDWjtBQUNiO0FBQ0EsY0FBWSxJQUFJLEtBQUssS0FBSyxDQUFDLEVBQUU7QUFDN0Isa0JBQWdCLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO3NCQUNkLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDOUIsbUJBQWlCLE1BQU0sSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDMUM7c0JBQ29CLEtBQUssR0FBRyxDQUFDLENBQUM7bUJBQ2I7QUFDakIsZUFBYSxNQUFNLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRTtBQUNuQyxrQkFBZ0IsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7c0JBQ2YsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUM5QixtQkFBaUIsTUFBTTtBQUN2QixzQkFBb0IsSUFBSSxlQUFlLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxFQUFFO0FBQzlEOzBCQUN3QixLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLHVCQUFxQixNQUFNO0FBQzNCLDBCQUF3QixXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3VCQUN0QjttQkFDSjtBQUNqQixlQUFhLE1BQU0sSUFBSSxLQUFLLElBQUksQ0FBQyxFQUFFO0FBQ25DLGtCQUFnQixJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtzQkFDZixLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQzlCLG1CQUFpQixNQUFNLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzFDLHNCQUFvQixJQUFJLGVBQWUsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FDekMsTUFBTTtBQUMzQiwwQkFBd0IsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzswQkFDbkIsS0FBSyxHQUFHLENBQUMsQ0FBQzt1QkFDYjtBQUNyQixtQkFBaUIsTUFBTTtBQUN2QixzQkFBb0IsV0FBVyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztzQkFDbkIsS0FBSyxHQUFHLENBQUMsQ0FBQzttQkFDYjtBQUNqQixlQUFhLE1BQU0sSUFBSSxLQUFLLElBQUksQ0FBQyxFQUFFO0FBQ25DLGtCQUFnQixJQUFJLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtzQkFDZixJQUFJLENBQUMsV0FBVyxJQUFJLGVBQWUsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLEVBQUU7MEJBQ3RELFdBQVcsR0FBRyxJQUFJLENBQUM7QUFDM0MsdUJBQXFCLE1BQU07QUFDM0IsMEJBQXdCLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7MEJBQ25CLEtBQUssR0FBRyxDQUFDLENBQUM7dUJBQ2I7QUFDckIsbUJBQWlCLE1BQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDekMsc0JBQW9CLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7c0JBQ25CLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDOUIsbUJBQWlCLE1BQU0sSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDMUMsc0JBQW9CLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7c0JBQ25CLEtBQUssR0FBRyxDQUFDLENBQUM7bUJBQ2I7QUFDakIsZUFBYSxNQUFNLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRTtBQUNuQyxrQkFBZ0IsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDbkMsc0JBQW9CLElBQUksZUFBZSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsRUFBRTtBQUM5RCwwQkFBd0IsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDOzBCQUNmLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDbEMsdUJBQXFCLE1BQU07QUFDM0IsMEJBQXdCLFdBQVcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7dUJBQ3RCO0FBQ3JCLG1CQUFpQixNQUFNO0FBQ3ZCLHNCQUFvQixXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3NCQUNuQixLQUFLLEdBQUcsQ0FBQyxDQUFDO21CQUNiO0FBQ2pCLGVBQWEsTUFBTSxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFDbkMsa0JBQWdCLElBQUksT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ25DLHNCQUFvQixXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3NCQUNuQixLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQzlCLG1CQUFpQixNQUFNO0FBQ3ZCLHNCQUFvQixXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO3NCQUNuQixLQUFLLEdBQUcsQ0FBQyxDQUFDO21CQUNiO2VBQ0o7Y0FDRCxhQUFhLEdBQUcsSUFBSSxDQUFDO1dBQ3hCO0FBQ1QsVUFBUSxXQUFXLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzNCLFVBQVEsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQy9CLE9BQUssQ0FBQztBQUNOO0FBQ0EsTUFBSSxJQUFJLE1BQU0sR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFDLEVBQUU7VUFDekIsSUFBSSxFQUFFLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7Y0FDNUIsRUFBRSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2VBQzNCO0FBQ2I7QUFDQSxVQUFRLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM5QixPQUFLLENBQUM7QUFDTjtBQUNBLE1BQUksSUFBSSxXQUFXLEdBQUcsVUFBVSxRQUFRLEVBQUUsTUFBTSxFQUFFO1VBQzFDLElBQUksR0FBRyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2NBQ3BDLEdBQUcsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztBQUM5QyxjQUFZLE9BQU8sR0FBRyxXQUFXLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztjQUNyQyxFQUFFLEdBQUcsSUFBSSxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQztjQUMxQixPQUFPLEdBQUcsRUFBRTtBQUN4QixjQUFZLE1BQU0sQ0FBQztBQUNuQjtVQUNRLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxDQUFDO0FBQ3RDO1VBQ1EsUUFBUSxNQUFNLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRztjQUM1QixPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztXQUM5QjtBQUNUO0FBQ0EsVUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUU7QUFDbEMsY0FBWSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO2tCQUNqRCxNQUFNLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztBQUM1QyxrQkFBZ0IsSUFBSSxLQUFLLEdBQUcsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2VBQ2hDO1dBQ0o7QUFDVDtBQUNBLFVBQVEsU0FBUyxPQUFPLENBQUMsS0FBSyxFQUFFO0FBQ2hDLGNBQVksS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtrQkFDakQsTUFBTSxJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7a0JBQzVCLElBQUksS0FBSyxHQUFHLEdBQUcsQ0FBQyxNQUFNLElBQUksTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDO2VBQzlDO1dBQ0o7QUFDVDtBQUNBLFVBQVEsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO0FBQ3hDLGNBQVksT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QyxXQUFTLENBQUMsQ0FBQztBQUNYLE9BQUssQ0FBQztBQUNOO0FBQ0EsTUFBSSxTQUFTLFFBQVEsQ0FBQyxNQUFNLEVBQUU7QUFDOUIsVUFBUSxJQUFJLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQztBQUM3QixVQUFRLElBQUksQ0FBQyxZQUFZLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztPQUNwRDtBQUNMO01BQ0ksUUFBUSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBVSxNQUFNLEVBQUU7QUFDbEQsVUFBUSxPQUFPLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN2RSxPQUFLLENBQUM7QUFDTixNQUFJLElBQUksaUJBQWlCLEdBQUcsVUFBVSxNQUFNLEVBQUU7QUFDOUMsVUFBUSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtjQUM1QixNQUFNLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztXQUM1QjtBQUNUO0FBQ0EsVUFBUSxJQUFJLElBQUksR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDeEQ7QUFDQSxVQUFRLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxFQUFFO2NBQ2pCLElBQUksSUFBSSxhQUFhLENBQUM7QUFDbEMsY0FBWSxJQUFJLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ2pDLGNBQVksSUFBSSxJQUFJLEdBQUcsQ0FBQyxFQUFFO2tCQUNWLE9BQU8sSUFBSSxDQUFDO2VBQ2Y7QUFDYixXQUFTLE1BQU0sSUFBSSxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUU7Y0FDM0IsT0FBTyxJQUFJLENBQUM7V0FDZjtVQUNELE9BQU8sS0FBSyxDQUFDO0FBQ3JCLE9BQUssQ0FBQztBQUNOO0FBQ0EsTUFBSSxJQUFJLFFBQVEsR0FBRyxVQUFVLE1BQU0sRUFBRSxNQUFNLEVBQUU7VUFDckMsT0FBTyxXQUFXLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssTUFBTSxDQUFDO0FBQ3BELE9BQUssQ0FBQztBQUNOO0FBQ0E7TUFDSSxJQUFJLE1BQU0sR0FBRztVQUNULFdBQVcsRUFBRSxXQUFXO1VBQ3hCLENBQUMsRUFBRSxXQUFXO1VBQ2QsbUJBQW1CLEVBQUUsbUJBQW1CO1VBQ3hDLEVBQUUsRUFBRSxtQkFBbUI7VUFDdkIsUUFBUSxFQUFFLFFBQVE7VUFDbEIsQ0FBQyxFQUFFLFFBQVE7VUFDWCxNQUFNLEVBQUUsTUFBTTtVQUNkLFdBQVcsRUFBRSxXQUFXO1VBQ3hCLFFBQVEsRUFBRSxRQUFRO1VBQ2xCLGlCQUFpQixFQUFFLGlCQUFpQjtVQUNwQyxRQUFRLEVBQUUsUUFBUTtBQUMxQixVQUFRLFFBQVEsRUFBRSxVQUFVLENBQUMsRUFBRTtBQUMvQixjQUFZLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUTtrQkFDckIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEMsY0FBWSxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztXQUN2QjtBQUNULFVBQVEsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFO0FBQ2pDLGNBQVksSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRO2tCQUNyQixDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQyxjQUFZLE9BQU8sU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1dBQ3ZCO0FBQ1QsVUFBUSxXQUFXLEVBQUUsVUFBVSxDQUFDLEVBQUU7QUFDbEMsY0FBWSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVE7a0JBQ3JCLENBQUMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLGNBQVksT0FBTyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7V0FDMUI7QUFDVCxVQUFRLE9BQU8sRUFBRSxVQUFVLENBQUMsRUFBRTtBQUM5QixjQUFZLElBQUksT0FBTyxDQUFDLEtBQUssUUFBUTtrQkFDckIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDcEMsY0FBWSxPQUFPLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztXQUNyQjtBQUNULFVBQVEsS0FBSyxFQUFFLFVBQVUsQ0FBQyxFQUFFO0FBQzVCLGNBQVksSUFBSSxPQUFPLENBQUMsS0FBSyxRQUFRO2tCQUNyQixDQUFDLEdBQUcsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwQyxjQUFZLE9BQU8sTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1dBQ3BCO0FBQ1QsVUFBUSxNQUFNLEVBQUUsVUFBVSxDQUFDLEVBQUU7QUFDN0IsY0FBWSxJQUFJLE9BQU8sQ0FBQyxLQUFLLFFBQVE7a0JBQ3JCLENBQUMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3BDLGNBQVksT0FBTyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7V0FDckI7QUFDVCxVQUFRLFdBQVcsRUFBRSxVQUFVLEdBQUcsRUFBRTtjQUN4QixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUN0RCxjQUFZLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pELGtCQUFnQixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQztlQUNuRDtjQUNELE9BQU8sSUFBSSxDQUFDO1dBQ2Y7QUFDVCxVQUFRLGFBQWEsRUFBRSxVQUFVLEdBQUcsRUFBRTtjQUMxQixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUN0RCxjQUFZLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pELGtCQUFnQixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQztlQUNuRDtjQUNELE9BQU8sSUFBSSxDQUFDO1dBQ2Y7QUFDVCxVQUFRLGNBQWMsRUFBRSxVQUFVLEdBQUcsRUFBRTtjQUMzQixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUN0RCxjQUFZLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pELGtCQUFnQixJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQztlQUN0RDtjQUNELE9BQU8sSUFBSSxDQUFDO1dBQ2Y7QUFDVCxVQUFRLFVBQVUsRUFBRSxVQUFVLEdBQUcsRUFBRTtjQUN2QixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUN0RCxjQUFZLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pELGtCQUFnQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQztlQUNqRDtjQUNELE9BQU8sSUFBSSxDQUFDO1dBQ2Y7QUFDVCxVQUFRLFFBQVEsRUFBRSxVQUFVLEdBQUcsRUFBRTtjQUNyQixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUN0RCxjQUFZLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pELGtCQUFnQixJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQztlQUNoRDtjQUNELE9BQU8sSUFBSSxDQUFDO1dBQ2Y7QUFDVCxVQUFRLFNBQVMsRUFBRSxVQUFVLEdBQUcsRUFBRTtjQUN0QixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxPQUFPLEtBQUssQ0FBQztBQUN0RCxjQUFZLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pELGtCQUFnQixJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxPQUFPLEtBQUssQ0FBQztlQUNqRDtjQUNELE9BQU8sSUFBSSxDQUFDO1dBQ2Y7QUFDVCxPQUFLLENBQUM7QUFDTjtNQUs4QztVQUN0QyxNQUFBLENBQUEsT0FBQSxHQUFpQixNQUFNLENBQUM7QUFDaEMsT0FFSztBQUNMLEdBQUMsR0FBRyxDQUFBOzs7Ozs7OztBQzNoQkYsTUFBTSxnQkFBZ0IsR0FBeUI7QUFDN0MsSUFBQSxjQUFjLEVBQUUsR0FBRztBQUNuQixJQUFBLHFCQUFxQixFQUFFLElBQUk7Q0FDNUIsQ0FBQztBQVNGLE1BQU0sV0FBVyxDQUFBO0FBSWYsSUFBQSxXQUFBLENBQW9CLE1BQTBCLEVBQUE7UUFBMUIsSUFBTSxDQUFBLE1BQUEsR0FBTixNQUFNLENBQW9CO1FBSHRDLElBQU8sQ0FBQSxPQUFBLEdBQWlCLEVBQUUsQ0FBQztLQUdlOztBQUdsRCxJQUFBLE1BQU0sS0FBSyxHQUFBO0FBQ1QsUUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztBQUN2RCxRQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO0tBQ3BCOztJQUdELGNBQWMsQ0FBQyxJQUFXLEVBQUUsT0FBZSxFQUFBO0FBQ3pDLFFBQUEsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxPQUFPLENBQUMsQ0FBQztRQUM1RCxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFBRSxZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDOztBQUNyRCxZQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUMzQyxJQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7S0FDcEI7O0FBR0QsSUFBQSxNQUFNLENBQUMsQ0FBUyxFQUFBO0FBQ2QsUUFBQSxNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM1QyxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDbEQ7O0FBR08sSUFBQSxPQUFPLENBQUMsSUFBVyxFQUFBO0FBQ3pCLFFBQUEsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUM5QixPQUFPO1lBQ0wsT0FBTztZQUNQLElBQUksRUFBRSxNQUFNLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDMUMsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO1NBQ2hCLENBQUM7S0FDSDtJQUVPLFdBQVcsR0FBQTtRQUNqQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDakMsWUFBQSxTQUFTLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsY0FBYztBQUM5QyxZQUFBLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxTQUFTLENBQUM7QUFDMUIsU0FBQSxDQUFDLENBQUM7S0FDSjtBQUNGLENBQUE7QUFFRDtBQUNBLE1BQU0sY0FBZSxTQUFRQSwwQkFBNkIsQ0FBQTtJQUN4RCxXQUFZLENBQUEsR0FBUSxFQUFVLEtBQWtCLEVBQUE7UUFDOUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRGlCLElBQUssQ0FBQSxLQUFBLEdBQUwsS0FBSyxDQUFhO0tBRS9DO0FBQ0QsSUFBQSxRQUFRLEtBQWdCLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksRUFBRSxDQUFDLENBQUMsRUFBRTtJQUM3RSxXQUFXLENBQUMsSUFBZ0IsRUFBUSxFQUFBLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO0lBQzFELFlBQVksQ0FBQyxJQUFnQixFQUFPLEVBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDLEVBQUU7QUFDN0YsQ0FBQTtBQUVEO0FBQ0EsTUFBTSxpQkFBa0IsU0FBUUMsc0JBQXlCLENBQUE7SUFDdkQsV0FBWSxDQUFBLEdBQVEsRUFBVSxLQUFrQixFQUFBO1FBQzlDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztRQURpQixJQUFLLENBQUEsS0FBQSxHQUFMLEtBQUssQ0FBYTtLQUUvQztJQUVELFNBQVMsQ0FBQyxNQUFzQixFQUFFLE1BQWMsRUFBQTtRQUM5QyxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDbEYsUUFBQSxJQUFJLE9BQU8sS0FBSyxJQUFJLEVBQUU7WUFDcEIsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsYUFBYSxFQUFFLENBQUM7QUFDaEQsWUFBQSxJQUFJLENBQUMsSUFBSTtBQUFFLGdCQUFBLE9BQU8sSUFBSSxDQUFDO0FBRXZCLFlBQUEsTUFBTSxPQUFPLEdBQUc7QUFDZCxnQkFBQSxLQUFLLEVBQUUsTUFBTTtBQUNiLGdCQUFBLEdBQUcsRUFBRSxNQUFNO0FBQ1gsZ0JBQUEsS0FBSyxFQUFFLEVBQUU7QUFDVCxnQkFBQSxNQUFNLEVBQUUsTUFBTTtBQUNkLGdCQUFBLElBQUksRUFBRSxJQUFJO2FBQ1gsQ0FBQztBQUNGLFlBQUEsT0FBTyxPQUFPLENBQUM7U0FDaEI7QUFDRCxRQUFBLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFFRCxJQUFBLGNBQWMsQ0FBQyxHQUF5QixFQUFBO1FBQ3RDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ3JDO0lBQ0QsZ0JBQWdCLENBQUMsSUFBZ0IsRUFBRSxFQUFlLEVBQUE7QUFDaEQsUUFBQSxFQUFFLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7S0FDL0I7SUFDRCxnQkFBZ0IsQ0FBQyxJQUFnQixFQUFFLEdBQStCLEVBQUE7UUFDaEUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDO1FBQ2pELElBQUksVUFBVSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsS0FBSyxVQUFVLEVBQUU7QUFDakQsWUFBQSxNQUFNLE1BQU0sR0FBSSxVQUFVLENBQUMsSUFBWSxDQUFDLE1BQU0sQ0FBQztZQUMvQyxJQUFJLE1BQU0sRUFBRTtBQUNWLGdCQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDbEMsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDN0MsZ0JBQUEsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUN0RCxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBRWpELGdCQUFBLElBQUksU0FBUyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ3BCLG9CQUFBLE1BQU0sS0FBSyxHQUFHLEVBQUUsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLFNBQVMsR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDdkQsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDO0FBQ25CLG9CQUFBLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2lCQUN0RDthQUNGO1NBQ0Y7S0FDRjtBQUNGLENBQUE7QUFFRDtBQUNxQixNQUFBLGtCQUFtQixTQUFRQyxlQUFNLENBQUE7QUFJcEQsSUFBQSxNQUFNLE1BQU0sR0FBQTs7QUFFVixRQUFBLE1BQU0sSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDOztRQUcxQixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ25DLFFBQUEsTUFBTSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDOztBQUd6QixRQUFBLElBQUksQ0FBQyxhQUFhLENBQ2hCLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxJQUFJLEVBQUUsT0FBTyxLQUFJO1lBQzVDLElBQUksSUFBSSxZQUFZQyxjQUFLO2dCQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztTQUNyRSxDQUFDLENBQ0gsQ0FBQzs7QUFHRixRQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsRUFBRTtZQUN2QyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ2QsZ0JBQUEsRUFBRSxFQUFFLHVCQUF1QjtBQUMzQixnQkFBQSxJQUFJLEVBQUUsdUJBQXVCO0FBQzdCLGdCQUFBLE9BQU8sRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQzNDLGdCQUFBLFFBQVEsRUFBRSxNQUFNLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksRUFBRTtBQUNoRSxhQUFBLENBQUMsQ0FBQztTQUNKOztBQUdELFFBQUEsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQzs7QUFHeEUsUUFBQSxJQUFJLENBQUMsYUFBYSxDQUNoQixLQUFLLGNBQWNDLHlCQUFnQixDQUFBO1lBQ2pDLFdBQVksQ0FBQSxHQUFRLEVBQVUsTUFBMEIsRUFBQTtBQUN0RCxnQkFBQSxLQUFLLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQURTLElBQU0sQ0FBQSxNQUFBLEdBQU4sTUFBTSxDQUFvQjthQUV2RDtZQUNELE9BQU8sR0FBQTtBQUNMLGdCQUFBLE1BQU0sRUFBRSxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUM7Z0JBQzdCLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDcEIsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsOEJBQThCLEVBQUUsQ0FBQyxDQUFDOzthQUV0RTtTQUNGLEVBQUUsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FDbkIsQ0FBQztLQUNIOztBQUdELElBQUEsTUFBTSxZQUFZLEdBQUE7QUFDaEIsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRSxFQUFFLGdCQUFnQixFQUFFLE1BQU0sSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7S0FDNUU7QUFDRCxJQUFBLE1BQU0sWUFBWSxHQUFLLEVBQUEsTUFBTSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQzdEOzs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDFdfQ==
