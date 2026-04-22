const Parser = require('rss-parser');
const parser = new Parser();

// Simple in-memory cache: { url: { data: feed, timestamp: Date.now() } }
const rssCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function rssRoutes(fastify, options) {
  fastify.get('/rss/proxy', async (request, reply) => {
    const { url } = request.query;
    if (!url) {
      return reply.code(400).send({ error: 'URL is required' });
    }

    // Check cache
    const cached = rssCache.get(url);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
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
        thumbnail: item.enclosure?.url || '' // Some RSS have thumbnails here
      }));

      // Update cache
      rssCache.set(url, {
        data: { items: simplifiedItems },
        timestamp: Date.now()
      });

      return { status: 'ok', items: simplifiedItems };
    } catch (err) {
      fastify.log.error('RSS Proxy Error: %s', err.message);
      
      // If error but we have stale cache, return stale cache as fallback
      if (cached) {
        fastify.log.warn(`RSS Proxy fallback to stale cache for: ${url}`);
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
