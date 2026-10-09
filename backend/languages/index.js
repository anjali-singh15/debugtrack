/**
 * Supported submission languages. Each module provides:
 *   buildHarness(code, tests, signature) -> { source, userStart, userEnd }
 *   starter(problem)                     -> starter code shown in the editor
 *   errorKind(type, message)             -> language-neutral error kind for the mistake engine
 * and optionally detectCompileError (Python) / crashError (C++).
 */
const LANGUAGES = {
  java: require('./java'),
  python: require('./python'),
  cpp: require('./cpp')
};

const LANGUAGE_IDS = Object.keys(LANGUAGES);

function getLanguage(id) {
  return Object.prototype.hasOwnProperty.call(LANGUAGES, id) ? LANGUAGES[id] : null;
}

function starterCodes(problem) {
  const out = {};
  LANGUAGE_IDS.forEach((id) => { out[id] = LANGUAGES[id].starter(problem); });
  return out;
}

const LANGUAGE_LIST = LANGUAGE_IDS.map((id) => ({ id, label: LANGUAGES[id].label, monaco: LANGUAGES[id].monaco }));

module.exports = { LANGUAGES, LANGUAGE_IDS, LANGUAGE_LIST, getLanguage, starterCodes };
