const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Database categories & their URLs ──────────────────────────────────────────
const DB_CATEGORIES = {
  slavery: {
    label: 'Slavery & Freedmen',
    lines: [
      '- slaveryarchive.georgetown.edu (GU272 Georgetown Slavery Archive)',
      '- enslaved.org (MSU Enslaved Peoples discovery hub)',
      '- familysearch.org Freedmen\'s Bureau records (1865–1872)',
      '- freedomonthemove.org (Cornell — runaway slave advertisements)',
      '- slavevoyages.org (Emory — trans-Atlantic & intra-American slave trade)',
      '- Afro-Louisiana History & Genealogy database (100K records)',
      '- afrigeneas.com (African ancestored genealogy)',
      '- 10millionnames.org (American Ancestors — African American name project)',
      '- Jesuit plantation records / Georgetown University archives',
    ],
  },
  census: {
    label: 'Census & Voter Lists',
    lines: [
      '- familysearch.org census records (1790–1940)',
      '- dp.la (Digital Public Library of America)',
      '- ancestry.com census collections',
      '- All US state archives census holdings',
    ],
  },
  vitals: {
    label: 'Birth, Marriage & Death',
    lines: [
      '- familysearch.org vital records',
      '- findagrave.com (grave & death records)',
      '- chroniclingamerica.loc.gov (obituaries & announcements)',
      '- State vital records offices',
    ],
  },
  military: {
    label: 'Military',
    lines: [
      '- catalog.archives.gov (NARA military service & pension records)',
      '- familysearch.org USCT (United States Colored Troops) records',
      '- fold3.com (military records)',
      '- Civil War pension index, WWI & WWII draft registrations',
    ],
  },
  newspapers: {
    label: 'Newspapers & Periodicals',
    lines: [
      '- chroniclingamerica.loc.gov (Library of Congress newspapers 1770–1963)',
      '- newspapers.com',
      '- Black press archives (Chicago Defender, Pittsburgh Courier, Crisis Magazine)',
      '- Accessible Archives African American newspapers',
    ],
  },
  immigration: {
    label: 'Immigration & Travel',
    lines: [
      '- catalog.archives.gov immigration & naturalization records',
      '- familysearch.org immigration & passenger lists',
      '- castlegarden.org / Statue of Liberty–Ellis Island Foundation',
    ],
  },
  dna: {
    label: 'DNA & Genetic Genealogy',
    lines: [
      '- gedmatch.com (GEDmatch chromosome comparison)',
      '- geni.com (Geni World Family Tree)',
      '- DNA Painter & Shared cM Project tools',
      '- AncestryDNA, 23andMe, MyHeritage DNA resources',
    ],
  },
  international: {
    label: 'International & Colonial',
    lines: [
      '- sierraleonepublicarchives.gov.sl (Sierra Leone Public Archives)',
      '- discovery.nationalarchives.gov.uk (UK National Archives)',
      '- anom.archivesnationales.culture.gouv.fr (French colonial — ANOM)',
      '- Caribbean & West Indian archives',
      '- Portuguese colonial archives (Torre do Tombo)',
    ],
  },
  state: {
    label: 'State & Regional Archives',
    lines: [
      '- Virginia Untold (virginiauntold.lva.virginia.gov)',
      '- Legacy of Slavery Maryland (msa.maryland.gov)',
      '- NC Digital Collections (digital.ncdcr.gov)',
      '- Florida Memory (floridamemory.com)',
      '- Texas Runaway Slave Project',
      '- Alabama Department of Archives & History',
      '- Georgia Archives',
    ],
  },
  university: {
    label: 'University & Specialized Projects',
    lines: [
      '- slaveryarchive.georgetown.edu (Georgetown GU272 project)',
      '- Slave Societies Digital Archive (Vanderbilt)',
      '- Digital Slavery Research Lab (UVA)',
      '- First-Person Narratives (UNC Chapel Hill)',
      '- Lowcountry Digital History Initiative',
      '- Colonial Williamsburg Foundation archives',
    ],
  },
  trees: {
    label: 'Public Trees & Collaborative',
    lines: [
      '- familysearch.org Family Tree (free)',
      '- geni.com World Family Tree',
      '- WikiTree (free collaborative tree)',
      '- Mundia & MyHeritage trees',
    ],
  },
};

// ── Location context blocks ───────────────────────────────────────────────────
const LOCATION_ARCHIVE_HINTS = {
  // USA states with strong African-American genealogy holdings
  'Alabama':          'Alabama Dept of Archives & History (archives.alabama.gov); Alabama Slave Schedules 1850/1860; Freedmen\'s Bureau Alabama records',
  'Arkansas':         'Arkansas State Archives; Arkansas Freedmen\'s Bureau records; Arkansas Slave Schedules',
  'Florida':          'Florida Memory / State Archives of Florida (floridamemory.com); Florida Freedmen\'s Bureau; Spanish colonial records (1565–1821)',
  'Georgia':          'Georgia Archives (sos.ga.gov/archives); Georgia Freedmen\'s Bureau; Slave Schedules; Georgia Colonial records',
  'Kentucky':         'Kentucky Dept for Libraries & Archives; Kentucky Freedmen\'s Bureau; Transition from slavery records',
  'Louisiana':        'Louisiana State Archives; Afro-Louisiana History & Genealogy database; Notarial Archives New Orleans; French & Spanish colonial records; Freedmen\'s Bureau Louisiana',
  'Maryland':         'Maryland State Archives Legacy of Slavery (msa.maryland.gov); Maryland Freedmen\'s Bureau; Baltimore city records',
  'Mississippi':      'Mississippi Dept of Archives & History; Mississippi Freedmen\'s Bureau; Slave Schedules 1850/1860',
  'North Carolina':   'NC Digital Collections (digital.ncdcr.gov); NC Freedmen\'s Bureau; NC Manumission records',
  'South Carolina':   'SC Dept of Archives & History; Lowcountry Digital History Initiative; SC Freedmen\'s Bureau; Slave Schedules',
  'Tennessee':        'Tennessee State Library & Archives; Tennessee Freedmen\'s Bureau; Reconstruction-era records',
  'Texas':            'Texas State Library & Archives; Texas Runaway Slave Project; Texas Freedmen\'s Bureau records',
  'Virginia':         'Library of Virginia — Virginia Untold (virginiauntold.lva.virginia.gov); Virginia Freedmen\'s Bureau; Colonial Virginia records; Cohabitation registers',
  'West Virginia':    'West Virginia State Archives; WV Freedmen\'s Bureau records',
  'Washington D.C.': 'DC Archives; National Archives in DC; Freedmen\'s Bureau DC; Emancipation records',
  // Africa
  'Senegal':          'Archives nationales du Sénégal (Dakar); ANOM French colonial records; Gorée Island slave trade records',
  'Gambia':           'Gambia National Records Service; British colonial records (UK National Archives CO series)',
  'Guinea-Bissau':    'Arquivo Histórico Nacional (Bissau); Portuguese colonial records (Arquivo Histórico Ultramarino)',
  'Guinea':           'Archives nationales de Guinée; French colonial records (ANOM)',
  'Sierra Leone':     'Sierra Leone Public Archives (sierraleonepublicarchives.gov.sl); Liberated African registers; British colonial CO series',
  'Liberia':          'Liberian National Archives; American Colonization Society records; FamilySearch Liberia',
  'Ghana':            'Public Records & Archives Administration (PRAAD, Accra); British Gold Coast colonial records (UK National Archives); Basel Mission records',
  'Togo':             'German colonial records (Bundesarchiv, Koblenz); French ANOM records post-WWI',
  'Benin':            'Archives nationales du Bénin; Ouidah (Whydah) slave port records; French colonial records (ANOM)',
  'Nigeria':          'National Archives of Nigeria (Ibadan, Enugu, Kaduna); British colonial records; Lagos colonial records',
  'Ivory Coast':      'Archives nationales de Côte d\'Ivoire; French colonial records (ANOM)',
  'Cameroon':         'Archives nationales du Cameroun; German colonial records (Bundesarchiv)',
  'Gabon':            'Archives nationales du Gabon; French colonial records (ANOM)',
  'Republic of Congo': 'Archives nationales du Congo (Brazzaville); French colonial records (ANOM)',
  'DR Congo':         'Archives africaines (Brussels, Belgium); Belgian colonial records; Kongo Kingdom oral histories',
  'Angola':           'Arquivo Histórico Nacional de Angola (Luanda); Arquivo Histórico Ultramarino (Lisbon); Portuguese colonial slave records — largest single origin of enslaved people',
  'São Tomé & Príncipe': 'Arquivo Histórico de São Tomé e Príncipe; Portuguese colonial transit records (major slave-trade waypoint)',
  'Cape Verde':       'Arquivo Histórico Nacional de Cabo Verde; Portuguese colonial records (major slave-trade transit point)',
  'Mozambique':       'Arquivo Histórico de Moçambique (Maputo); Portuguese colonial records; Indian Ocean slave trade records',
  'Tanzania':         'Tanzania National Archives (Dar es Salaam); German East Africa records (Bundesarchiv); Zanzibar Arab slave trade records',
  'Kenya':            'Kenya National Archives (Nairobi); British East Africa colonial records (UK National Archives)',
  'Madagascar':       'Archives nationales de Madagascar; French colonial records (ANOM)',
  'South Africa':     'Western Cape Archives (Cape Town); National Archives of South Africa; Dutch VOC records; British colonial records',
  // Colonial Powers
  'Portugal':         'Arquivo Histórico Ultramarino (AHU, Lisbon) — Portuguese overseas colonial records; Torre do Tombo National Archive; Arquivo Nacional da Torre do Tombo; slave ship manifests, baptism records, manumission papers across Angola, Brazil, Cape Verde, São Tomé',
  'Britain / England': 'UK National Archives (discovery.nationalarchives.gov.uk) — Colonial Office (CO) series, Treasury (T) series slave compensation records, Foreign Office (FO) series; British Slave Register 1813–1834 (T 71); Abolition records',
  'France':           'Archives nationales d\'outre-mer (ANOM, Aix-en-Provence) — French colonial records covering Senegal, Martinique, Guadeloupe, Saint-Domingue/Haiti, Réunion, Louisiana; notarial acts, manumission records, plantation registers',
  'Spain':            'Archivo General de Indias (Seville) — Spanish colonial Americas records; Archivo Nacional de Cuba; Puerto Rico colonial records; baptism registers for enslaved people',
  'Netherlands':      'Nationaal Archief (The Hague) — Dutch West India Company (WIC) records; Suriname plantation registers; Dutch colonial records for Curaçao, St. Eustatius, St. Maarten',
  'Denmark-Norway':   'Danish National Archives (Rigsarkivet, Copenhagen) — Danish West Indies records (St. Croix, St. Thomas, St. John); plantation registers; baptism and manumission records',
  'Sweden':           'Swedish National Archives (Riksarkivet) — brief colonial holdings in St. Barthélemy',
  'Brandenburg-Prussia': 'Geheimes Staatsarchiv Preußischer Kulturbesitz (Berlin) — Brandenburg Africa Company records; Groß Friedrichsburg (Gold Coast)',
  'Brazil':           'Arquivo Nacional (Rio de Janeiro); Arquivo Público do Estado da Bahia (Salvador); Registro de escravos; Post-abolition records (1888+); largest receiving nation of enslaved Africans (~4.9M people)',
  'Cuba':             'Archivo Nacional de Cuba (Havana); Archivo General de Indias (Seville) for colonial era; baptism registers; Patronato slave records (1880–1886)',
  'Haiti / Saint-Domingue': 'Archives nationales d\'Haïti (Port-au-Prince); ANOM Saint-Domingue colonial records; post-independence records (1804+); indigénat registers',
  'Jamaica':          'Jamaica Archives & Records Department (Spanish Town); UK National Archives Jamaica colonial series; plantation inventories; slave registers (T 71)',
  'Barbados':         'Barbados National Archives; UK National Archives Barbados series; slave registers 1817–1834; plantation records',
  'Trinidad':         'National Archives of Trinidad & Tobago; UK National Archives Trinidad series; slave registers; post-emancipation apprenticeship records',
  'Suriname':         'Nationaal Archief Suriname (Paramaribo); Dutch Nationaal Archief — WIC plantation records; manumission registers',
};

// ── Build dynamic system prompt ───────────────────────────────────────────────
function buildSystemPrompt(selectedCategories, locationFilters) {
  const useAll = !selectedCategories || selectedCategories.length === 0 ||
                 selectedCategories.includes('all');

  const activeKeys = useAll ? Object.keys(DB_CATEGORIES) : selectedCategories;
  const dbLines    = activeKeys
    .filter(k => DB_CATEGORIES[k])
    .flatMap(k => [`\n### ${DB_CATEGORIES[k].label}`, ...DB_CATEGORIES[k].lines]);

  // Build location-focus block if user selected specific locations
  let locationBlock = '';
  if (locationFilters && locationFilters.length > 0) {
    const hints = locationFilters
      .map(loc => {
        const hint = LOCATION_ARCHIVE_HINTS[loc];
        return hint ? `- **${loc}**: ${hint}` : `- **${loc}**`;
      })
      .join('\n');
    locationBlock = `

PRIORITY LOCATION FOCUS: The researcher has specified these geographic areas — prioritize records from these regions above all others:
${hints}

Search these location-specific archives FIRST before general databases. Always explain what records exist in these archives for the ancestor in question.`;
  }

  return `You are an expert genealogical researcher with 30+ years specializing in African American genealogy, West African diaspora research, Freedmen's Bureau records, USCT military research, Jesuit plantation records, GU272, and international colonial archives. Your goal is to help users replace expensive paid subscriptions like Ancestry.com by finding records in free and open databases.${locationBlock}

Search ONLY the following databases using your web search tool:
${dbLines.join('\n')}

Format your response with these ## section headers:
## Research Summary
## Records Found
## Questions Answered
## DNA & Genetic Connections
## Databases Searched
## Recommended Next Steps
## Historical Context

Return ONLY factual findings. Never invent records.

For each SOURCE or RECORD found, output a JSON block:
\`\`\`record-json
{
  "name": "Full title of the record or document",
  "sourceType": "Primary Source | Secondary Source | DNA",
  "citation": "Full URL and description",
  "database": "Name of the database"
}
\`\`\`

For each NEW PERSON identified, output:
\`\`\`person-json
{
  "name": "Full name",
  "birthYear": "year or estimated range",
  "location": "known location(s)",
  "relationship": "relationship to the ancestor being researched"
}
\`\`\`

For each RESEARCH QUESTION that was answered, output:
\`\`\`question-json
{
  "question": "The research question that was answered",
  "answer": "Summary of what was found",
  "sourceUrl": "URL of the source that answered it"
}
\`\`\`

For each DNA MATCH or genetic connection found, output:
\`\`\`dna-json
{
  "name": "Name of the match or test",
  "platform": "GEDmatch | Geni | AncestryDNA | 23andMe | Other",
  "relationship": "Estimated relationship",
  "details": "Any relevant details about the match"
}
\`\`\``;
}

// ── Genealogy Research (streaming) ────────────────────────────────────────────
async function runResearch({ name, birthYear, location, relatives, questions, selectedCategories, locationFilters }, onChunk) {
  const systemPrompt = buildSystemPrompt(selectedCategories, locationFilters);

  const locationFocus = locationFilters && locationFilters.length > 0
    ? `\nPriority Archive Locations: ${locationFilters.join(', ')}`
    : '';

  const userPrompt = `Research the following ancestor:

Name: ${name}
Birth Year: ${birthYear || 'Unknown'}
Known Locations: ${location || 'Unknown'}
Known Relatives: ${relatives || 'None listed'}${locationFocus}
Research Questions:
${questions || 'No specific questions — provide a comprehensive search across all available records.'}

Search every database listed in your instructions and return everything you find. For each record found output the structured JSON blocks as instructed.`;

  const stream = await client.messages.stream({
    model:      'claude-opus-4-5',
    max_tokens: 8192,
    system:     systemPrompt,
    tools: [{
      type:     'web_search_20250305',
      name:     'web_search',
      max_uses: 20,
    }],
    messages: [{ role: 'user', content: userPrompt }],
  });

  let fullText = '';
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      fullText += event.delta.text;
      if (onChunk) onChunk(event.delta.text);
    }
  }
  return fullText;
}

// ── Follow-up Chat ────────────────────────────────────────────────────────────
async function continueChat(history, userMessage, selectedCategories) {
  const messages = [...history, { role: 'user', content: userMessage }];

  const response = await client.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 4096,
    system:     buildSystemPrompt(selectedCategories),
    tools: [{
      type:     'web_search_20250305',
      name:     'web_search',
      max_uses: 10,
    }],
    messages,
  });

  const assistantText = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  return {
    reply: assistantText,
    updatedHistory: [...messages, { role: 'assistant', content: assistantText }],
  };
}

// ── Archive Metadata via Vision ───────────────────────────────────────────────
const METADATA_STANDARDS = {
  general: `Extract detailed archival metadata and return ONLY this JSON object:
{
  "title": "Descriptive title for the item",
  "date": "Estimated or known date (YYYY, YYYY-MM-DD, or circa YYYY)",
  "creator": "Person or organization who created this",
  "description": "Detailed description of the item's content and context",
  "format": "Physical or digital format (photograph, letter, document, etc.)",
  "condition": "Excellent | Good | Fair | Poor",
  "tags": "comma-separated subject tags",
  "transcription": "Full transcription of any visible text",
  "location": "Geographic location depicted or referenced"
}`,
  dublin: `Extract Dublin Core metadata and return ONLY this JSON object:
{
  "title": "DC Title",
  "date": "DC Date (ISO 8601 if possible)",
  "creator": "DC Creator",
  "description": "DC Description",
  "format": "DC Format",
  "tags": "DC Subject (comma-separated)",
  "transcription": "Full transcription of any visible text",
  "location": "DC Coverage (geographic)"
}`,
  dacs: `Extract DACS-compliant metadata and return ONLY this JSON object:
{
  "title": "Title Statement (DACS 2.3)",
  "date": "Date (DACS 2.4) — inclusive or bulk dates",
  "creator": "Name of Creator(s) (DACS 2.6)",
  "description": "Scope and Content Note (DACS 3.1)",
  "format": "Extent and medium (DACS 2.5)",
  "condition": "Physical Access (DACS 4.2)",
  "tags": "Subject headings (comma-separated)",
  "transcription": "Full transcription of any visible text",
  "location": "Geographic coverage"
}`,
};

async function generateMetadata(base64Image, mediaType, standard = 'general') {
  const systemPrompt = METADATA_STANDARDS[standard] || METADATA_STANDARDS.general;

  const response = await client.messages.create({
    model:      'claude-opus-4-5',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        {
          type:   'image',
          source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: base64Image },
        },
        { type: 'text', text: systemPrompt },
      ],
    }],
  });

  const raw     = response.content.find(b => b.type === 'text')?.text || '{}';
  const cleaned = raw.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { description: raw };
  }
}

module.exports = { runResearch, continueChat, generateMetadata, DB_CATEGORIES };
