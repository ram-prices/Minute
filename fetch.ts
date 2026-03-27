import https from 'https';

https.get('https://www.reddit.com/r/nvidia/comments/1s41wka.json', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const comments = json[1].data.children;
      const mediaComments = comments.filter((c: any) => c.data && c.data.media_metadata);
      if (mediaComments.length > 0) {
        console.log('Found comments with media_metadata:');
        mediaComments.slice(0, 2).forEach((c: any) => {
          console.log('Body:', c.data.body);
          console.log('Media Metadata:', JSON.stringify(c.data.media_metadata, null, 2));
        });
      } else {
        console.log('No media_metadata found in top comments. Looking for tenor links in body...');
        const tenorComments = comments.filter((c: any) => c.data && c.data.body && c.data.body.toLowerCase().includes('tenor'));
        tenorComments.slice(0, 2).forEach((c: any) => console.log('Body:', c.data.body));
      }
    } catch (e: any) {
      console.error('Error parsing JSON:', e.message);
    }
  });
}).on('error', e => console.error(e));
