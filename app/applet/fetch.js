const url = 'https://www.reddit.com/r/funny/comments/1908x2w.json?limit=10';

fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
  }
})
.then(res => res.json())
.then(json => {
  const comments = json[1].data.children;
  for (const c of comments) {
    if (c.data.media_metadata) {
      console.log(JSON.stringify(c.data.media_metadata, null, 2));
      break;
    }
  }
})
.catch(e => console.error(e));
