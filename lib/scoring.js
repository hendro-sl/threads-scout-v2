function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function median(values) {
  const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}

function rawPerformance(post) {
  const views = numberOrNull(post.views);
  const likes = numberOrNull(post.likes);
  const replies = numberOrNull(post.replies);
  const reposts = numberOrNull(post.reposts);
  const quotes = numberOrNull(post.quotes);

  const metrics = [views, likes, replies, reposts, quotes];
  if (metrics.every((value) => value === null)) return null;

  return (
    Math.log1p(views || 0) * 0.25 +
    Math.log1p(likes || 0) * 0.2 +
    Math.log1p(replies || 0) * 0.25 +
    Math.log1p(reposts || 0) * 0.2 +
    Math.log1p(quotes || 0) * 0.1
  );
}

export function scorePosts(posts = []) {
  const prepared = posts.map((post) => {
    const metrics = {
      views: numberOrNull(post.views),
      likes: numberOrNull(post.likes),
      replies: numberOrNull(post.replies),
      reposts: numberOrNull(post.reposts),
      quotes: numberOrNull(post.quotes),
    };

    const hasMetrics = Object.values(metrics).some((value) => value !== null);
    const engagement = hasMetrics
      ? (metrics.likes || 0) +
        (metrics.replies || 0) +
        (metrics.reposts || 0) +
        (metrics.quotes || 0)
      : null;

    return {
      ...post,
      ...metrics,
      engagement,
      hasMetrics,
      _rawPerformance: rawPerformance({ ...post, ...metrics }),
    };
  });

  const baseline = median(prepared.map((post) => post._rawPerformance));

  return prepared.map(({ _rawPerformance, ...post }) => {
    const viralIndex =
      _rawPerformance !== null && baseline && baseline > 0
        ? Number((_rawPerformance / baseline).toFixed(2))
        : null;

    return {
      ...post,
      viralIndex,
      isOutlier: viralIndex !== null ? viralIndex >= 2 : false,
    };
  });
}
