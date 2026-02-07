const FOLLOW_KEY = 'aw_follow_graph';

const readGraph = () => {
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const writeGraph = (graph) => {
  try {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(graph));
  } catch (error) {
    console.error('Failed to save follow graph:', error);
  }
};

const normalizeId = (value) => (value ?? '').toString().trim();

export const getFollowerCount = (targetId) => {
  const safeTarget = normalizeId(targetId);
  if (!safeTarget) return 0;
  const graph = readGraph();
  const list = graph[safeTarget] || [];
  return Array.isArray(list) ? list.length : 0;
};

export const isFollowingUser = (followerId, targetId) => {
  const safeFollower = normalizeId(followerId);
  const safeTarget = normalizeId(targetId);
  if (!safeFollower || !safeTarget) return false;
  const graph = readGraph();
  const list = graph[safeTarget] || [];
  return Array.isArray(list) ? list.includes(safeFollower) : false;
};

export const toggleFollowUser = (followerId, targetId) => {
  const safeFollower = normalizeId(followerId);
  const safeTarget = normalizeId(targetId);
  if (!safeFollower || !safeTarget || safeFollower === safeTarget) {
    return { isFollowing: false, count: getFollowerCount(safeTarget) };
  }

  const graph = readGraph();
  const list = Array.isArray(graph[safeTarget]) ? [...graph[safeTarget]] : [];
  const index = list.indexOf(safeFollower);

  if (index >= 0) {
    list.splice(index, 1);
  } else {
    list.push(safeFollower);
  }

  graph[safeTarget] = list;
  writeGraph(graph);

  return { isFollowing: list.includes(safeFollower), count: list.length };
};

export const removeFollowRelation = (viewerId, targetId) => {
  const safeViewer = normalizeId(viewerId);
  const safeTarget = normalizeId(targetId);
  if (!safeViewer || !safeTarget || safeViewer === safeTarget) return;
  const graph = readGraph();
  const targetFollowers = Array.isArray(graph[safeTarget]) ? [...graph[safeTarget]] : [];
  const viewerFollowers = Array.isArray(graph[safeViewer]) ? [...graph[safeViewer]] : [];
  graph[safeTarget] = targetFollowers.filter((id) => id !== safeViewer);
  graph[safeViewer] = viewerFollowers.filter((id) => id !== safeTarget);
  writeGraph(graph);
};
