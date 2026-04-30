const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { hybridSearch, expandAbbreviations } = require('../services/embedding');

async function run() {
    const goldenPath = path.join(__dirname, '..', 'eval', 'golden-questions.json');
    const fs = require('fs');
    if (!fs.existsSync(goldenPath)) {
        console.error('Missing', goldenPath);
        process.exit(1);
    }

    const suite = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));
    const cases = suite.cases || [];

    console.log('=== AskMak retrieval eval (hybrid search) ===\n');

    let passed = 0;
    let failed = 0;

    for (const c of cases) {
        const query = expandAbbreviations(c.query || '');
        const { documents, retrieval } = await hybridSearch(query, { limit: 5 });
        const blob = documents
            .map(d => `${d.title || ''} ${d.content || ''}`)
            .join(' ')
            .toLowerCase();

        const must = c.must_contain || [];
        const textOk = must.length
            ? must.every(needle => blob.includes(String(needle).toLowerCase()))
            : true;

        const minS = c.min_retrieval_strength != null ? c.min_retrieval_strength : 0;
        const strengthOk = retrieval.bestStrength >= minS;

        const ok = textOk && strengthOk;
        if (ok) passed++;
        else failed++;

        console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.id}`);
        console.log(`  query: ${c.query}`);
        console.log(`  best_strength: ${retrieval.bestStrength.toFixed(3)} (min ${minS}) → ${strengthOk ? 'ok' : 'LOW'}`);
        console.log(`  must_contain [${must.join(', ')}] → ${textOk ? 'ok' : 'MISS'}`);
        if (documents[0]) {
            console.log(`  top doc: ${(documents[0].title || '').substring(0, 70)}`);
        } else {
            console.log('  top doc: (none)');
        }
        console.log('');
    }

    console.log(`--- ${passed} passed, ${failed} failed ---`);
    process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
