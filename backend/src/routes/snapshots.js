const { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

async function snapshotRoutes(fastify, opts) {
  // POST /screens/:id/snapshot - Player uploads a screenshot
  // This endpoint is behind playerAuth, so it uses X-Screen-Id header
  fastify.post('/screens/:id/snapshot', async (request, reply) => {
    const { id } = request.params;

    // Enforce playerAuth screen ID match
    if (request.playerScreenId && request.playerScreenId !== id) {
      return reply.code(403).send({ error: 'Screen ID mismatch' });
    }

    const { image } = request.body || {};
    if (!image) return reply.code(400).send({ error: 'No image data provided' });

    const base64Parts = image.split('base64,');
    if (base64Parts.length < 2) {
      return reply.code(400).send({ error: 'Invalid image format: ' + image.substring(0, 50) });
    }

    // Determine extension from the prefix (e.g., data:image/jpeg;charset=utf-8)
    let ext = 'jpg';
    if (base64Parts[0].includes('image/png')) ext = 'png';
    else if (base64Parts[0].includes('image/webp')) ext = 'webp';

    const buffer = Buffer.from(base64Parts[1], 'base64');
    const timestamp = Date.now();
    const key = `snapshots/${id}/${timestamp}.${ext}`;

    // Upload to MinIO
    await fastify.s3.send(new PutObjectCommand({
      Bucket: fastify.bucketName,
      Key: key,
      Body: buffer,
      ContentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    }));

    // Build the proxied URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const snapshotUrl = `${baseUrl}/snapshots/file/${id}/${timestamp}.${ext}`;

    // Update screen record
    await fastify.prisma.screen.update({
      where: { id },
      data: {
        lastSnapshotUrl: snapshotUrl,
        snapshotAt: new Date(),
      },
    });

    // Auto-cleanup: keep only the latest 3 snapshots per screen to save VPS space
    await cleanupOldSnapshots(fastify, id, 3);

    return { success: true, url: snapshotUrl };
  });
}

// Cleanup old snapshots - keep only `maxKeep` most recent per screen
async function cleanupOldSnapshots(fastify, screenId, maxKeep) {
  try {
    const prefix = `snapshots/${screenId}/`;
    const listResult = await fastify.s3.send(new ListObjectsV2Command({
      Bucket: fastify.bucketName,
      Prefix: prefix,
    }));

    const objects = listResult.Contents || [];
    if (objects.length <= maxKeep) return;

    // Sort by LastModified descending, delete everything after maxKeep
    objects.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
    const toDelete = objects.slice(maxKeep);

    for (const obj of toDelete) {
      await fastify.s3.send(new DeleteObjectCommand({
        Bucket: fastify.bucketName,
        Key: obj.Key,
      }));
      fastify.log.info(`Cleaned up old snapshot: ${obj.Key}`);
    }
  } catch (err) {
    fastify.log.error('Snapshot cleanup failed:', err);
  }
}

module.exports = snapshotRoutes;
