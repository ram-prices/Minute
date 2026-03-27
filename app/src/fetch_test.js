const fetch = require('node-fetch');
fetch('https://www.reddit.com/r/nvidia/comments/1s41wka/nvidia_profile_inspector_version_3_gets_dark_mode/.json')
  .then(r => r.json())
  .then(d => {
    const comments = d[1].data.children;
    console.log(JSON.stringify(comments.slice(0, 3).map(c => ({
      body: c.data.body,
      media_metadata: c.data.media_metadata
    })), null, 2));
  });
