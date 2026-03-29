export function getGifUrl(post: any): { type: 'hls' | 'mp4' | 'gif', url: string } | null {
  // Case 1: v.redd.it native video (most Reddit "GIFs")
  if (post.is_video && post.media?.reddit_video) {
    const rv = post.media.reddit_video;
    if (rv.hls_url) return { type: 'hls', url: rv.hls_url };
    if (rv.fallback_url) return { type: 'mp4', url: rv.fallback_url };
  }

  // Case 2: preview.images mp4 variant (GIFs Reddit converted)
  const preview = post.preview?.images?.[0];
  if (preview?.variants?.mp4?.source?.url) {
    return { type: 'mp4', url: preview.variants.mp4.source.url.replaceAll('&amp;', '&') };
  }
  // Fallback: animated gif variant
  if (preview?.variants?.gif?.source?.url) {
    return { type: 'gif', url: preview.variants.gif.source.url.replaceAll('&amp;', '&') };
  }

  // Case 3: external .gif (giphy, tenor, imgur)
  if (post.url?.match(/\.(gif)(\?.*)?$/i)) {
    return { type: 'gif', url: post.url };
  }

  // Case 4: Giphy and Tenor links
  if (post.url?.includes('giphy.com/gifs/')) {
    const match = post.url.split('?')[0].match(/giphy\.com\/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/);
    if (match && match[1]) {
      return { type: 'gif', url: `https://media.giphy.com/media/${match[1]}/giphy.gif` };
    }
  }
  if (post.url?.includes('tenor.com/view/')) {
    const match = post.url.split('?')[0].match(/tenor\.com\/view\/(?:.*-)?([0-9]+)$/);
    if (match && match[1]) {
      return { type: 'gif', url: `https://tenor.com/view/${match[1]}.gif` };
    }
  }

  return null;
}

// No server-side proxy exists — return URLs directly.
// Reddit media (preview.redd.it, i.redd.it, v.redd.it) loads fine
// with referrerPolicy="no-referrer" directly from the browser.
export function getProxiedMediaUrl(url: string): string {
  if (!url) return url;
  return url;
}
