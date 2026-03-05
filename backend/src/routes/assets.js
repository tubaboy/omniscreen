const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

// Set FFmpeg paths dynamically for development and production environments
const ffmpegPath = process.env.FFMPEG_PATH || (os.platform() === 'win32' ? path.join(os.homedir(), 'scoop', 'shims', 'ffmpeg.exe') : 'ffmpeg');
const ffprobePath = process.env.FFPROBE_PATH || (os.platform() === 'win32' ? path.join(os.homedir(), 'scoop', 'shims', 'ffprobe.exe') : 'ffprobe');
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
    });

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    return assets.map(asset => {
      let finalUrl = asset.url;
      let finalThumbUrl = asset.thumbnailUrl;

      // Fix mixed content / CORS for older assets saved with localhost
      if (finalUrl && finalUrl.includes('localhost:3001/api')) {
        finalUrl = finalUrl.replace('http://localhost:3001/api', baseUrl);
      }
      if (finalThumbUrl && finalThumbUrl.includes('localhost:3001/api')) {
        finalThumbUrl = finalThumbUrl.replace('http://localhost:3001/api', baseUrl);
      }

      return {
        ...asset,
        size: asset.size.toString(),
        url: finalUrl,
        thumbnailUrl: finalThumbUrl,
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
      const thumbnailFilename = `thumb-${filename.split('.')[0]}.jpg`;
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

    // URL calculation using our local proxy
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

  // DELETE Asset
  fastify.delete('/assets/:id', async (request, reply) => {
    const { id } = request.params;

    // Fetch asset details before deletion
    const asset = await fastify.prisma.asset.findUnique({ where: { id } });
    if (!asset) return reply.code(404).send({ message: 'Asset not found' });

    // Helper to extract bucket key from URL
    const getS3Key = (url, isThumb = false) => {
      if (!url) return null;
      // New URL format: http://localhost:3001/api/assets/file/uuid-filename.ext?thumb=true
      // Or old URL format: http://localhost:9000/omniscreen-assets/assets/uuid-filename.ext
      const match = url.match(/\/([^/]+\.[a-zA-Z0-9]+)(?:\?|$)/);
      if (match && match[1]) {
        return isThumb ? `thumbnails/${match[1]}` : `assets/${match[1]}`;
      }
      return null;
    };

    const mainKey = getS3Key(asset.url, false);
    const thumbKey = getS3Key(asset.thumbnailUrl, true);

    try {
      // Delete main file from MinIO
      if (mainKey) {
        await fastify.s3.send(new DeleteObjectCommand({
          Bucket: fastify.bucketName,
          Key: mainKey,
        }));
      }

      // Delete thumbnail if exists
      if (thumbKey) {
        await fastify.s3.send(new DeleteObjectCommand({
          Bucket: fastify.bucketName,
          Key: thumbKey,
        }));
      }
    } catch (err) {
      fastify.log.error('Failed to delete files from MinIO:', err);
      // We continue with DB deletion even if S3 fails, or we could error out.
      // Usually, DB consistency is prioritized, but here we'll proceed.
    }

    // Delete DB records
    // Delete related playlist items first to avoid foreign key constraint errors
    await fastify.prisma.playlistItem.deleteMany({ where: { assetId: id } });
    await fastify.prisma.asset.delete({ where: { id } });

    return { success: true };
  });

  // PATCH Asset (Update tags / name / validity dates)
  fastify.patch('/assets/:id', async (request, reply) => {
    const { id } = request.params;
    const { tags, name, validFrom, validUntil } = request.body || {};
    const asset = await fastify.prisma.asset.update({
      where: { id },
      data: {
        ...(tags !== undefined ? { tags } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(validFrom !== undefined ? { validFrom: validFrom ? new Date(validFrom) : null } : {}),
        ...(validUntil !== undefined ? { validUntil: validUntil ? new Date(validUntil) : null } : {}),
      },
    });
    return { ...asset, size: asset.size.toString() };
  });

  // GET Asset File (Proxy to avoid CORS and caching issues)
  const { GetObjectCommand } = require('@aws-sdk/client-s3');


  fastify.get('/assets/file/*', async (request, reply) => {
    const filename = request.params['*'];
    if (!filename) return reply.code(400).send({ error: 'Filename is required' });

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
      fastify.log.error('Proxy file failed:', err);
      return reply.code(404).send({ error: 'File not found' });
    }
  });
}

module.exports = assetRoutes;
