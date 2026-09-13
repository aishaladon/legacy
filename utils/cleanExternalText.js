// Named HTML entities beyond the handful of "structural" ones (amp/lt/gt/
// quot/apos/nbsp). Grants.gov titles come through with literal entities
// still in the text (e.g. "C&ocirc;te d&rsquo;Ivoire", "Research&ndash;
// Practice"), and the view escapes them a second time on output, so they
// need decoding before they ever reach EJS. Covers the Latin-1 letters and
// punctuation actually seen in agency/grant titles — not the full HTML5
// named-entity table.
const NAMED_ENTITIES = {
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
  sbquo: '‚', ldquo: '“', rdquo: '”', bdquo: '„',
  dagger: '†', Dagger: '‡', permil: '‰', lsaquo: '‹',
  rsaquo: '›', euro: '€', trade: '™', hellip: '…',
  bull: '•', middot: '·', copy: '©', reg: '®', deg: '°',
  agrave: 'à', aacute: 'á', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ',
  ccedil: 'ç', egrave: 'è', eacute: 'é', ecirc: 'ê', euml: 'ë',
  igrave: 'ì', iacute: 'í', icirc: 'î', iuml: 'ï',
  eth: 'ð', ntilde: 'ñ', ograve: 'ò', oacute: 'ó', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  ugrave: 'ù', uacute: 'ú', ucirc: 'û', uuml: 'ü', yacute: 'ý', thorn: 'þ', yuml: 'ÿ',
  Agrave: 'À', Aacute: 'Á', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Aring: 'Å', AElig: 'Æ',
  Ccedil: 'Ç', Egrave: 'È', Eacute: 'É', Ecirc: 'Ê', Euml: 'Ë',
  Igrave: 'Ì', Iacute: 'Í', Icirc: 'Î', Iuml: 'Ï',
  Ntilde: 'Ñ', Ograve: 'Ò', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Oslash: 'Ø',
  Ugrave: 'Ù', Uacute: 'Ú', Ucirc: 'Û', Uuml: 'Ü', Yacute: 'Ý'
};

const STRUCTURAL_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const ALL_ENTITIES = { ...STRUCTURAL_ENTITIES, ...NAMED_ENTITIES };

// Decode literal HTML entities baked into text pulled from an external feed
// (Grants.gov titles) so they don't get double-escaped when EJS renders them.
function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in ALL_ENTITIES ? ALL_ENTITIES[name] : m))
    .replace(/&#(\d+);/g, (m, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

// IMLS/USASpending award descriptions frequently contain a literal "?"
// where the source agency's original data-entry system lost an em/en-dash
// or curly quote to a bad encoding conversion long before USASpending ever
// saw it (e.g. "CALIFORNIA DIGITAL LIBRARY?IN COLLABORATION WITH"). There's
// no way to recover the original character, but a "?" wedged directly
// between two word characters (no surrounding whitespace) is never a real
// question mark — a real one is always followed by a space or the end of
// the string. Replace that specific pattern with a spaced em dash, which is
// the character most often lost this way, so the text reads cleanly instead
// of looking broken. Leave every other "?" (a real question) untouched.
function cleanExternalText(str) {
  return String(str || '').replace(/(\w)\?(\w)/g, '$1 — $2');
}

module.exports = { decodeHtmlEntities, cleanExternalText };
