const DEFAULT_READ_TIME = '0 min read';
const WORDS_PER_MINUTE = 200;

const cleanMarkdown = (content) => {
  if (!content) return '';
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const countReadableUnits = (text) => {
  if (!text) return 0;
  const latinWords = text.match(/[A-Za-z0-9]+/g) || [];
  const cjkChars = text.match(/[\u4e00-\u9fff]/g) || [];
  return latinWords.length + cjkChars.length;
};

export const getPostWordCount = (content) => {
  if (!content) return 0;
  const plainText = cleanMarkdown(content);
  return countReadableUnits(plainText);
};

export const calculatePostReadTime = (content) => {
  if (!content) return DEFAULT_READ_TIME;
  const count = getPostWordCount(content);
  if (count <= 0) return DEFAULT_READ_TIME;
  const minutes = Math.max(1, Math.ceil(count / WORDS_PER_MINUTE));
  return `${minutes} min read`;
};

export const ensurePostReadTime = (post) => {
  if (!post || typeof post !== 'object') return post;
  const source = post.content || post.summary || '';
  const computed = calculatePostReadTime(source);
  const existing = (post.readTime ?? '').toString().trim();
  if (!existing) {
    return {
      ...post,
      readTime: computed,
    };
  }
  const existingMinutes = Number.parseInt(existing, 10);
  const computedMinutes = Number.parseInt(computed, 10);
  if (Number.isFinite(existingMinutes) && Number.isFinite(computedMinutes)) {
    if (existingMinutes === computedMinutes) return post;
  } else if (existing === computed) {
    return post;
  }
  return {
    ...post,
    readTime: computed,
  };
};
