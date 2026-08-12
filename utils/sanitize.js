const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const ALLOWED_EMBED_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'substackcdn.com',
  'substack.com',
  'www.instagram.com',
  'open.spotify.com',
  'embed.spotify.com',
  'w.soundcloud.com',
];

function isSafeIframeSrc(src) {
  try {
    const url = new URL(src);
    return ALLOWED_EMBED_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['target', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'title'],
  ALLOW_DATA_ATTR: false,
};

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (node.nodeName === 'IFRAME' && data.attrName === 'src' && data.attrValue) {
    if (!isSafeIframeSrc(data.attrValue)) {
      data.keepAttr = false;
    }
  }
});

function sanitizeHtml(dirtyHtml) {
  if (typeof dirtyHtml !== 'string' || !dirtyHtml) return '';
  return DOMPurify.sanitize(dirtyHtml, SANITIZE_CONFIG);
}

module.exports = { sanitizeHtml, isSafeIframeSrc };
