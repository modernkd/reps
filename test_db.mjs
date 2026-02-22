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

async function run() {
  try {
    const data = await fetchJson('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json');
    if (data && data.length > 0) {
       console.log(`Fetched ${data.length} exercises from free-exercise-db`);
       console.log('Sample:', data[0].name, data[0].images);
    } else {
       console.log('Could not fetch free-exercise-db');
    }
  } catch (err) {
    console.error(err);
  }
}

run();
