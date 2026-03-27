async function run() {
  try {
    const res = await fetch('https://www.reddit.com/r/nvidia/comments/1s41wka/nvidia_profile_inspector_version_3_gets_dark_mode/.json', {
      headers: { 'User-Agent': 'ReactApp/1.0.0' }
    });
    const json = await res.json();
    const comments = json[1].data.children;
    const tenorComments = comments.filter(c => c.data && c.data.body && c.data.body.toLowerCase().includes('tenor'));
    tenorComments.slice(0, 2).forEach(c => console.log('Tenor Body:', c.data.body));
    const giphyComments = comments.filter(c => c.data && c.data.body && c.data.body.toLowerCase().includes('giphy'));
    giphyComments.slice(0, 2).forEach(c => console.log('Giphy Body:', c.data.body));
  } catch(e) { console.error(e); }
}
run();
