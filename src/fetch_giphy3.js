const fetchGiphy = async () => {
  try {
    const res = await fetch('https://media.giphy.com/media/6HwEvs7F0blBi/100.gif', {
      headers: { 'Referer': '' }
    });
    console.log(res.status, res.headers.get('content-type'));
  } catch (e) {
    console.error(e);
  }
};
fetchGiphy();
