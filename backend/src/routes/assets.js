const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
const { fixAssetUrls } = require('../utils/url');

// Set FFmpeg paths dynamically for development and production environments
const ffmpegPath = process.env.FFMPEG_PATH || (os.platform() === 'win32' 
  ? (fs.existsSync(path.join(os.homedir(), 'scoop', 'shims', 'ffmpeg.exe')) 
      ? path.join(os.homedir(), 'scoop', 'shims', 'ffmpeg.exe') 
      : 'ffmpeg') 
  : 'ffmpeg');

const ffprobePath = process.env.FFPROBE_PATH || (os.platform() === 'win32' 
  ? (fs.existsSync(path.join(os.homedir(), 'scoop', 'shims', 'ffprobe.exe')) 
      ? path.join(os.homedir(), 'scoop', 'shims', 'ffprobe.exe') 
      : 'ffprobe') 
  : 'ffprobe');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const probeMetadata = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (videoStream) {
        const { width, height, rotation } = videoStream;
        // Handle rotation (e.g. smartphone videos)
        let actualWidth = width;
        let actualHeight = height;
        if (rotation === '90' || rotation === '270' || rotation === 90 || rotation === 270) {
          actualWidth = height;
          actualHeight = width;
        }
        resolve({
          width: actualWidth,
          height: actualHeight,
          orientation: actualWidth >= actualHeight ? 'LANDSCAPE' : 'PORTRAIT'
        });
      } else {
        resolve({ width: 0, height: 0, orientation: 'LANDSCAPE' });
      }
    });
  });
};

async function assetRoutes(fastify, opts) {
  const { v4: uuidv4 } = await import('uuid');
  // GET Assets
  fastify.get('/assets', async (request, reply) => {
    const assets = await fastify.prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        playlists: {
          select: {
            schedule: {
              select: { name: true }
            }
          }
        }
      }
    });

    return assets.map(asset => {
      const fixed = fixAssetUrls(asset, request);

      // Extract distinct schedule names and count
      const scheduleNames = Array.from(new Set(
        (asset.playlists || [])
          .map(p => p.schedule?.name)
          .filter(Boolean)
      ));

      return {
        ...fixed,
        size: asset.size.toString(),
        usageCount: scheduleNames.length,
        schedules: scheduleNames,
      };
    });
  });

  // POST Asset (Upload)
  fastify.post('/assets', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'No file uploaded' });

    const filename = `${uuidv4()}-${data.filename}`;
    const key = `assets/${filename}`;
    const buffer = await data.toBuffer();

    // Determine type
    const mimeType = data.mimetype;
    const type = mimeType.startsWith('video') ? 'VIDEO' : 'IMAGE';

    // Upload main file to MinIO
    await fastify.s3.send(new PutObjectCommand({
      Bucket: fastify.bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'no-cache, no-store, must-revalidate',
    }));

    let thumbnailUrl = null;
    let orientation = 'LANDSCAPE';

    if (type === 'VIDEO') {
      const tempVideoPath = path.join(os.tmpdir(), filename);
      const thumbnailFilename = `thumb-${filename.substring(0, filename.lastIndexOf('.')) || filename}.jpg`;
      const tempThumbPath = path.join(os.tmpdir(), thumbnailFilename);
      const thumbKey = `thumbnails/${thumbnailFilename}`;

      try {
        fs.writeFileSync(tempVideoPath, buffer);

        // Probe metadata
        const metadata = await probeMetadata(tempVideoPath);
        orientation = metadata.orientation;
        fastify.log.info(`Detected orientation: ${orientation} for ${filename}`);

        // Generate thumbnail using fluent-ffmpeg
        await new Promise((resolve, reject) => {
          ffmpeg(tempVideoPath)
            .screenshots({
              timestamps: ['1'],
              filename: thumbnailFilename,
              folder: os.tmpdir(),
              size: '640x?'
            })
            .on('start', (commandLine) => {
              fastify.log.info('FFmpeg started: ' + commandLine);
            })
            .on('end', () => {
              fastify.log.info('FFmpeg finished capturing screenshot');
              resolve();
            })
            .on('error', (err) => {
              fastify.log.error('FFmpeg error: ' + err.message);
              reject(err);
            });
        });

        if (!fs.existsSync(tempThumbPath)) {
          throw new Error('Thumbnail file was not created by FFmpeg');
        }

        // Upload thumbnail to MinIO
        const thumbBuffer = fs.readFileSync(tempThumbPath);
        await fastify.s3.send(new PutObjectCommand({
          Bucket: fastify.bucketName,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: 'image/jpeg',
          CacheControl: 'no-cache, no-store, must-revalidate',
        }));

        thumbnailUrl = `${process.env.MINIO_ENDPOINT}/${fastify.bucketName}/${thumbKey}`;
        fastify.log.info('Thumbnail uploaded successfully: ' + thumbnailUrl);

        // Cleanup
        fs.unlinkSync(tempVideoPath);
        fs.unlinkSync(tempThumbPath);
      } catch (err) {
        fastify.log.error('Thumbnail generation failed:', err);
        // Clean up even if it fails
        if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
        if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath);
      }
    } else if (type === 'IMAGE') {
      const tempImagePath = path.join(os.tmpdir(), `tmp-${filename}`);
      try {
        fs.writeFileSync(tempImagePath, buffer);
        const metadata = await probeMetadata(tempImagePath);
        orientation = metadata.orientation;
        fastify.log.info(`Detected image orientation: ${orientation} for ${filename}`);
        fs.unlinkSync(tempImagePath);
      } catch (err) {
        fastify.log.error('Image probing failed:', err);
        if (fs.existsSync(tempImagePath)) fs.unlinkSync(tempImagePath);
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const url = `${baseUrl}/assets/file/${filename}`;
    if (type === 'VIDEO') {
      thumbnailUrl = `${baseUrl}/assets/file/${filename}?thumb=true`;
    }

    // Create record in DB
    const asset = await fastify.prisma.asset.create({
      data: {
        name: data.filename,
        type: type,
        url: url,
        thumbnailUrl: thumbnailUrl,
        size: BigInt(buffer.length),
        mimeType: mimeType,
        orientation: orientation,
        duration: type === 'IMAGE' ? 10 : undefined,
      },
    });

    // Handle BigInt serialization
    return {
      ...asset,
      size: asset.size.toString(),
      url: asset.url,
      thumbnailUrl: asset.thumbnailUrl,
    };
  });
  // POST Asset (Raw Upload without creating DB Asset record)
  fastify.post('/assets/upload-raw', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'No file uploaded' });

    // Use uuidv4 from outer scope (already imported as ESM)
    const filename = `raw-${uuidv4()}-${data.filename}`;
    const key = `assets/${filename}`;
    const buffer = await data.toBuffer();
    
    await fastify.s3.send(new PutObjectCommand({
      Bucket: fastify.bucketName,
      Key: key,
      Body: buffer,
      ContentType: data.mimetype,
      CacheControl: 'public, max-age=31536000',
    }));

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const url = `${baseUrl}/assets/file/${filename}`;
    
    return reply.send({ url });
  });

  // DELETE Asset
  fastify.delete('/assets/:id', async (request, reply) => {
    const { id } = request.params;

    // Fetch asset details and its relations before deletion
    const asset = await fastify.prisma.asset.findUnique({ 
      where: { id },
      include: {
        playlists: { select: { id: true } }
      }
    });
    if (!asset) return reply.code(404).send({ message: 'Asset not found' });

    // Prevent deletion if the asset is in use
    if (asset.playlists && asset.playlists.length > 0) {
      return reply.code(409).send({ error: '此素材正在排程中被使用，無法直接刪除' });
    }

    // Helper to extract bucket key from URL, handling potential encoding and complex filenames
    const getS3Key = (url, isThumb = false) => {
      if (!url) return null;
      try {
        // Use regex to get the segment after the last slash but before any query params
        const match = url.match(/\/([^/?#]+)(?:\?|$)/);
        if (match && match[1]) {
          // IMPORTANT: Decode URL encoding (e.g. %20 -> space) to match S3 literal keys
          const filename = decodeURIComponent(match[1]);
          
          if (isThumb) {
            // Get basename before the LAST dot (consistent with POST /assets)
            const lastDotIndex = filename.lastIndexOf('.');
            const baseNameWithoutExt = lastDotIndex !== -1 ? filename.substring(0, lastDotIndex) : filename;
            return `thumbnails/thumb-${baseNameWithoutExt}.jpg`;
          }
          
          // For regular assets or widget backgrounds
          return `assets/${filename}`;
        }
      } catch (e) {
        console.error('Error parsing S3 URL:', e);
      }
      return null;
    };

    const keysToDelete = [];
    const mainKey = getS3Key(asset.url, false);
    if (mainKey) keysToDelete.push(mainKey);

    const thumbKey = getS3Key(asset.thumbnailUrl, true);
    if (thumbKey) keysToDelete.push(thumbKey);

    // If it's a WIDGET or MARQUEE, check if it has a custom background image pointing to our S3
    if ((asset.type === 'WIDGET' || asset.type === 'MARQUEE') && asset.url) {
      try {
        const parsed = JSON.parse(asset.url);
        const bgUrl = asset.type === 'MARQUEE' ? parsed?.bgImageUrl : parsed.config?.bgImageUrl;
        if (bgUrl && bgUrl.includes('/assets/file/raw-')) {
          const bgKey = getS3Key(bgUrl);
          if (bgKey) keysToDelete.push(bgKey);
        }
      } catch (e) {}
    }

    try {
      // Delete all identified files from MinIO
      for (const key of keysToDelete) {
        await fastify.s3.send(new DeleteObjectCommand({
          Bucket: fastify.bucketName,
          Key: key,
        }));
        fastify.log.info(`[Cleanup] Deleted from S3: ${key}`);
      }
    } catch (err) {
      fastify.log.error('Failed to delete files from MinIO:', err);
      // We continue with DB deletion even if S3 fails
    }

    // Delete DB records
    // Delete related playlist items first to avoid foreign key constraint errors
    await fastify.prisma.playlistItem.deleteMany({ where: { assetId: id } });
    await fastify.prisma.asset.delete({ where: { id } });

    return { success: true };
  });

  // POST Widget Asset (no file upload)
  fastify.post('/assets/widget', async (request, reply) => {
    const { name, widgetType, config } = request.body || {};
    if (!name || !widgetType) return reply.code(400).send({ error: 'name and widgetType required' });

    const widgetConfig = { widgetType, config: config || {} };
    const asset = await fastify.prisma.asset.create({
      data: {
        name,
        type: 'WIDGET',
        url: JSON.stringify(widgetConfig),
        thumbnailUrl: null,
        size: BigInt(0),
        mimeType: 'application/json',
        orientation: 'LANDSCAPE',
        duration: (config && config.duration) ? config.duration : 120,
      },
    });
    return { ...asset, size: asset.size.toString() };
  });

  // POST YouTube Asset (no file upload)
  fastify.post('/assets/youtube', async (request, reply) => {
    const { name, url } = request.body || {};
    if (!name || !url) return reply.code(400).send({ error: 'name and url required' });

    // Parse YouTube video ID from various URL formats
    const extractYouTubeId = (rawUrl) => {
      try {
        const patterns = [
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
          /^([a-zA-Z0-9_-]{11})$/, // bare video ID
        ];
        for (const pattern of patterns) {
          const match = rawUrl.match(pattern);
          if (match) return match[1];
        }
      } catch {}
      return null;
    };

    const videoId = extractYouTubeId(url);
    if (!videoId) return reply.code(400).send({ error: '無法解析 YouTube 影片 ID，請確認輸入的網址是否正確' });

    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    const asset = await fastify.prisma.asset.create({
      data: {
        name,
        type: 'YOUTUBE',
        url: videoId, // Store only the Video ID; player constructs the embed URL
        thumbnailUrl,
        size: BigInt(0),
        mimeType: 'video/youtube',
        orientation: 'LANDSCAPE',
        duration: 120,
        fixedDuration: request.body.fixedDuration !== undefined ? request.body.fixedDuration : true,
      },
    });
    return { ...asset, size: asset.size.toString() };
  });

  // POST URL Asset (no file upload)
  fastify.post('/assets/url', async (request, reply) => {
    const { name, url } = request.body || {};
    if (!name || !url) return reply.code(400).send({ error: 'name and url required' });

    const asset = await fastify.prisma.asset.create({
      data: {
        name,
        type: 'WEB',
        url: url,
        thumbnailUrl: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`, // Simple favicon as thumbnail
        size: BigInt(0),
        mimeType: 'text/html',
        orientation: 'LANDSCAPE',
        duration: 120,
      },
    });
    return { ...asset, size: asset.size.toString() };
  });

  // POST Marquee Asset (no file upload)
  fastify.post('/assets/marquee', async (request, reply) => {
    const { name, config } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });

    const marqueeConfig = config || {};
    const asset = await fastify.prisma.asset.create({
      data: {
        name,
        type: 'MARQUEE',
        url: JSON.stringify(marqueeConfig),
        thumbnailUrl: null,
        size: BigInt(0),
        mimeType: 'application/json',
        orientation: 'LANDSCAPE',
        duration: 0, // Marquee doesn't have a playback duration
      },
    });
    return { ...asset, size: asset.size.toString() };
  });

  // POST Campaign Asset (Composite Frame + Video/YouTube)
  fastify.post('/assets/campaign', async (request, reply) => {
    const { name, config } = request.body || {};
    if (!name || !config) return reply.code(400).send({ error: 'name and config required' });

    const asset = await fastify.prisma.asset.create({
      data: {
        name,
        type: 'CAMPAIGN',
        url: JSON.stringify(config),
        thumbnailUrl: config.frameUrl || null,
        size: BigInt(0),
        mimeType: 'application/json',
        orientation: 'LANDSCAPE',
        duration: config.duration || 30, // Default to 30 or provided duration
        fixedDuration: config.fixedDuration !== undefined ? config.fixedDuration : true,
      },
    });
    return { ...asset, size: asset.size.toString() };
  });

  // PATCH Asset (Update tags / name / validity dates / widget config)
  fastify.patch('/assets/:id', async (request, reply) => {
    const { id } = request.params;
    const { tags, name, validFrom, validUntil, widgetType, config, duration, url } = request.body || {};

    const current = await fastify.prisma.asset.findUnique({ where: { id } });
    if (!current) return reply.code(404).send({ error: 'Asset not found' });

    let urlUpdate = {};
    if (url !== undefined) {
      if (current.type === 'YOUTUBE') {
        const extractYouTubeId = (rawUrl) => {
          try {
            const patterns = [
              /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
              /^([a-zA-Z0-9_-]{11})$/,
            ];
            for (const pattern of patterns) {
              const match = rawUrl.match(pattern);
              if (match) return match[1];
            }
          } catch {}
          return null;
        };
        const videoId = extractYouTubeId(url);
        if (videoId) {
          urlUpdate = {
            url: videoId,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          };
        } else {
          urlUpdate = { url }; // Fallback
        }
      } else {
        try {
          const parsedUrl = new URL(url);
          urlUpdate = { 
            url,
            thumbnailUrl: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=128`
          };
        } catch (e) {
          urlUpdate = { url }; // Not a valid absolute URL, just update the string
        }
      }
    } else if (widgetType !== undefined || config !== undefined) {
      let currentConfig = { config: {} };
      try { currentConfig = JSON.parse(current.url || '{}'); } catch {}
      
      // Cleanup old background if it changed (both WIDGET and MARQUEE use bgImageUrl)
      const oldBgUrl = current.type === 'MARQUEE' 
        ? currentConfig?.bgImageUrl 
        : currentConfig.config?.bgImageUrl;
      const newBgUrl = current.type === 'MARQUEE' 
        ? config?.bgImageUrl 
        : config?.bgImageUrl;
      
      if (oldBgUrl && oldBgUrl !== newBgUrl && oldBgUrl.includes('/assets/file/raw-')) {
        const match = oldBgUrl.match(/\/([^/]+\.[a-zA-Z0-9]+)(?:\?|$)/);
        if (match && match[1]) {
          const oldKey = `assets/${match[1]}`;
          try {
            await fastify.s3.send(new DeleteObjectCommand({
              Bucket: fastify.bucketName,
              Key: oldKey,
            }));
            fastify.log.info(`[Cleanup] Background image replaced. Deleted old file: ${oldKey}`);
          } catch (e) {
            fastify.log.error(`[Cleanup] Failed to delete old background: ${oldKey}`, e);
          }
        }
      }

      if (current.type === 'MARQUEE' || current.type === 'CAMPAIGN') {
        // MARQUEE and CAMPAIGN store config directly (flat JSON)
        urlUpdate = { url: JSON.stringify(config || currentConfig) };
      } else {
        const merged = {
          widgetType: widgetType ?? currentConfig.widgetType,
          config: config ?? currentConfig.config,
        };
        urlUpdate = { url: JSON.stringify(merged) };
      }
    }

    const asset = await fastify.prisma.asset.update({
      where: { id },
      data: {
        ...(tags !== undefined ? { tags } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(duration !== undefined ? { duration } : {}),
        ...(validFrom !== undefined ? { validFrom: validFrom ? new Date(validFrom) : null } : {}),
        ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
        ...(request.body.fixedDuration !== undefined ? { fixedDuration: request.body.fixedDuration } : 
           (config && config.fixedDuration !== undefined ? { fixedDuration: config.fixedDuration } : {})),
        ...urlUpdate,
      },
    });
    return { ...asset, size: asset.size.toString() };
  });

  // GET Asset File (Proxy to avoid CORS and caching issues)
  const { GetObjectCommand } = require('@aws-sdk/client-s3');


  fastify.get('/assets/file/*', async (request, reply) => {
    const filename = request.params['*'];
    if (!filename) return reply.code(400).send({ error: 'Filename is required' });

    console.log('[DEBUG Proxy] Requested filename:', filename, 'isThumb:', request.query.thumb);

    const isThumb = request.query.thumb === 'true';

    let key;
    if (isThumb) {
      // 假設原 basename (包含 uuid)，縮圖的存放規則是 `thumbnails/thumb-{basename}.jpg`
      const baseNameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename;
      key = `thumbnails/thumb-${baseNameWithoutExt}.jpg`;
    } else {
      key = `assets/${filename}`;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: fastify.bucketName,
        Key: key,
      });

      const response = await fastify.s3.send(command);

      reply.header('Content-Type', response.ContentType);
      reply.header('Cache-Control', 'public, max-age=31536000'); // 允許前端快取拿到的乾淨圖
      if (response.ContentLength) {
        reply.header('Content-Length', response.ContentLength);
      }

      return reply.send(response.Body);
    } catch (err) {
      fastify.log.error('Proxy file failed: %s (key=%s)', err.message, key);
      return reply.code(404).send({ error: 'File not found' });
    }
  });
}

module.exports = assetRoutes;
