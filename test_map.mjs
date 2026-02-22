import https from 'https';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      let isRedirect = res.statusCode >= 300 && res.statusCode < 400 && res.headers.location;
      if (isRedirect) {
        resolve(fetchJson(res.headers.location));
        return;
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(null); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

const map = {
  ex_biceps_curl: 'Barbell Curl',
  ex_triceps_pushdown: 'Triceps Pushdown',
}

async function run() {
  const data = await fetchJson('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json');
  console.log('Total exercises:', data.length);
  
  for (const [id, search] of Object.entries(map)) {
    // try to find partial match
    let matches = data.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || search.toLowerCase().includes(e.name.toLowerCase()));
    
    if (matches.length > 0) {
      console.log(`[OK] ${id} -> ${matches[0].name} -> ${matches[0].images[0]}`);
    } else {
      console.log(`[!!] ${id} -> NOT FOUND for search: ${search}`);
      // grab some suggestions
      let words = search.split(' ');
      let suggestions = data.filter(e => e.name.toLowerCase().includes(words[0].toLowerCase()));
      console.log('  Suggestions:', suggestions.slice(0, 3).map(e => e.name).join(', '));
    }
  }
}

run();
