const Parser = require('rss-parser');
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  timeout: 10000,
});

// Simple in-memory cache: { url: { data: feed, timestamp: Date.now() } }
const rssCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_STALE_TTL = 60 * 60 * 1000; // 1 hour max stale

async function rssRoutes(fastify, options) {
  fastify.get('/rss/proxy', async (request, reply) => {
    const { url } = request.query;
    if (!url) {
      return reply.code(400).send({ error: 'URL is required' });
    }

    // Force no-cache headers
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    reply.header('Expires', '0');

    // Check cache
    const cached = rssCache.get(url);
    const now = Date.now();
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      fastify.log.info(`RSS Cache Hit: ${url}`);
      return { status: 'ok', items: cached.data.items };
    }

    try {
      fastify.log.info(`RSS Fetching: ${url}`);
      const feed = await parser.parseURL(url);
      
      // Basic formatting to match rss2json expectations
      const simplifiedItems = feed.items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        content: item.content || item.contentSnippet || '',
        author: item.creator || item.author || '',
        thumbnail: item.enclosure?.url || ''
      }));

      // Update cache
      rssCache.set(url, {
        data: { items: simplifiedItems },
        timestamp: now
      });

      return { status: 'ok', items: simplifiedItems };
    } catch (err) {
      fastify.log.error('RSS Proxy Error: %s', err.message);
      
      // Fallback to stale only if less than 1 hour old
      if (cached && (now - cached.timestamp < MAX_STALE_TTL)) {
        fastify.log.warn(`RSS Proxy fallback to stale cache (<1h) for: ${url}`);
        return { status: 'ok', items: cached.data.items, stale: true };
      }
      
      return reply.code(500).send({ 
        status: 'error', 
        message: 'Failed to fetch or parse RSS feed' 
      });
    }
  });
}

module.exports = rssRoutes;
