// Extracts plain text from an uploaded file — .txt, .pdf, and .docx.
// (Legacy .doc isn't supported — it's a binary format with no lightweight
// pure-JS reader; only the newer .docx XML format is.)
async function extractTextFromFile(file, maxChars = 15000) {
  const name = file.originalname || 'file';
  const ext = (name.split('.').pop() || '').toLowerCase();

  let text;
  if (ext === 'pdf' || file.mimetype === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const parsed = await pdfParse(file.buffer);
    text = parsed.text;
  } else if (ext === 'docx' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = require('mammoth');
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    text = parsed.value;
  } else if (ext === 'txt' || file.mimetype === 'text/plain') {
    text = file.buffer.toString('utf8');
  } else if (ext === 'doc') {
    throw new Error('.doc (older Word format) isn\'t supported — please save it as .docx or .pdf and re-upload.');
  } else {
    throw new Error(`Unsupported file type "${ext || file.mimetype}" — only .txt, .pdf, and .docx are supported.`);
  }

  text = (text || '').trim();
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n[...truncated...]';
  return text;
}

module.exports = { extractTextFromFile };
