import fetch from 'node-fetch';

async function run() {
  const res = await fetch('https://www.reddit.com/r/funny/comments/1908x2w.json?limit=10');
  const json = await res.json();
  const comments = json[1].data.children;
  for (const c of comments) {
    if (c.data.media_metadata) {
      console.log(JSON.stringify(c.data.media_metadata, null, 2));
      break;
    }
  }
}
run();
