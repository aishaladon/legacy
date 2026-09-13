const { Document, Packer, Paragraph, HeadingLevel } = require('docx');

// Shared by the Download-as-Word button and Save-as-Draft-in-Inbox — both
// need the same RFP response text turned into a .docx buffer, just handed
// to the browser (download) or attached to a mailbox draft (save) differently.
async function buildProposalDocx(title, draft) {
  const sections = [];
  const lines = (draft || '').split('\n');

  lines.forEach(line => {
    if (line.trim()) {
      // Check if line looks like a heading (all caps, short)
      if (line.match(/^[A-Z][A-Z\s]+:?$/) && line.length < 60) {
        sections.push(new Paragraph({
          text: line.trim(),
          heading: HeadingLevel.HEADING_1,
          thematicBreak: false
        }));
      } else {
        sections.push(new Paragraph({
          text: line,
          spacing: { line: 360 }
        }));
      }
    } else {
      sections.push(new Paragraph('')); // Empty line for spacing
    }
  });

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: title || 'RFP Response',
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 }
        }),
        new Paragraph({
          text: `Generated on ${new Date().toLocaleDateString()}`,
          spacing: { after: 600 }
        }),
        ...sections
      ]
    }]
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildProposalDocx };
