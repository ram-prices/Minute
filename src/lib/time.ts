export const formatTimestamp = (utc: number) => {
  const now = Date.now();
  const postedAt = utc * 1000;
  const diffInSeconds = Math.floor((now - postedAt) / 1000);
  const diffInDays = diffInSeconds / (24 * 3600);

  if (diffInDays < 2) {
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } else {
    const date = new Date(postedAt);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};
