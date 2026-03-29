import https from 'https';

https.get('https://www.reddit.com/r/funny/comments/1908x2w.json?limit=10', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const comments = json[1].data.children;
      for (const c of comments) {
        if (c.data.media_metadata) {
          console.log(JSON.stringify(c.data.media_metadata, null, 2));
          break;
        }
      }
    } catch (e) {
      console.error('Error parsing JSON', e.message);
      console.log(data.substring(0, 500));
    }
  });
}).on('error', (e) => {
  console.error(e);
});
