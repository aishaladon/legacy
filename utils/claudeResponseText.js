// Every call site in this app assumed response.content[0] is always the
// text block and read response.content[0].text directly. Confirmed live
// (via the Claude Assistant chat) that this isn't reliable — a request can
// succeed (200) with the first content block not being text (e.g. a
// thinking block), leaving content[0].text undefined while the actual
// answer sits in a later block. That produced messages that silently
// rendered as empty with no error, which read as "Claude doesn't work at
// all." This pulls out every text block instead of trusting the index.
function extractResponseText(response) {
  const blocks = (response.content || []).filter(b => b.type === 'text' && b.text);
  if (blocks.length === 0) {
    throw new Error('Claude returned no text content — try rephrasing your message.');
  }
  return blocks.map(b => b.text).join('\n\n');
}

module.exports = { extractResponseText };
