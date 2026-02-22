import https from 'https';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  try {
    const imagesRes = await fetchJson('https://wger.de/api/v2/exerciseimage/?is_main=True&limit=100');
    console.log(`Fetched ${imagesRes.results.length} images`);
    console.log('Sample image:', imagesRes.results[0]);
    
    // Check if we have nice svgs
    const svgs = imagesRes.results.filter(img => img.image.endsWith('.svg'));
    console.log(`Found ${svgs.length} SVGs`);
    if(svgs.length > 0) {
       console.log('Sample SVG:', svgs[0].image);
    }
  } catch (err) {
    console.error(err);
  }
}

run();
