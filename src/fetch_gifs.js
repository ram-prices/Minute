import https from 'https';

const fetchGifs = async () => {
  try {
    const res = await fetch('https://www.reddit.com/r/gifs/comments/1.json?limit=100', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const text = await res.text();
    console.log(text.substring(0, 100));
  } catch (e) {
    console.error(e);
  }
};
fetchGifs();
