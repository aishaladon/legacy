// Claude is asked for raw JSON but occasionally wraps it in a ```json
// fence or adds a stray sentence before/after despite instructions not to —
// this strips fences and, failing a direct parse, extracts the first
// balanced {...} block before giving up.
function parseJsonLoose(text) {
  if (!text) throw new Error('Empty response');
  let cleaned = text.trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) cleaned = fenced[1].trim();

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('Could not find valid JSON in response');
  }
}

module.exports = { parseJsonLoose };
