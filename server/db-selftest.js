// Quick MySQL connectivity + data check.
// Usage:  DB_DRIVER=mysql npm run db:test
// Reads MYSQL_* from .env. Prints connection status, row counts, and one profile.
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), override: true });

const db = require('./db-mysql');
const { TABLES } = db;

(async () => {
  try {
    console.log('Connecting to MySQL:',
      `${process.env.MYSQL_USER}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE}`);
    const ok = await db.ping();
    console.log('  ping:', ok ? 'OK' : 'FAILED');

    const counts = await db.getDashboardCounts();
    console.log('\nDashboard counts:', counts.ancestorsCount, 'people |',
      counts.questionsCount, 'questions |', counts.archivesCount, 'archives+collections |',
      counts.dnaCount, 'dna');

    console.log('\nRow counts per table:');
    const all = await Promise.all([
      db.getAllAncestors(), db.getAllQuestions(), db.getAllSources(),
      db.getAllArchives(), db.getAllCollections(), db.getAllDonors(),
      db.getAllStorage(), db.getAllDNATesting(), db.getAllDNAMatches(),
      db.getAllResearchLog(),
    ]);
    const labels = ['People','Questions','Sources','Archives','Collections','Donors','Storage','DNA Testing','DNA Matches','Research Log'];
    all.forEach((rows, i) => console.log(`  ${labels[i].padEnd(14)} ${rows.length}`));

    // Profile smoke test on the first ancestor
    const people = all[0];
    if (people.length) {
      const p = people[0];
      console.log(`\nProfile smoke test for: ${p['Full Name ★']} (${p.id})`);
      const prof = await db.getAncestorProfile(p.id);
      console.log('  linked ->',
        `questions:${prof.questions.length}`, `sources:${prof.sources.length}`,
        `evidence:${prof.evidence.length}`, `dnaTests:${prof.dnaTests.length}`,
        `dnaMatches:${prof.dnaMatches.length}`, `archives:${prof.archives.length}`,
        `collections:${prof.collections.length}`, `researchLog:${prof.researchLog.length}`);
    }
    console.log('\n✅ Self-test complete.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Self-test failed:', err.message);
    process.exit(1);
  }
})();
