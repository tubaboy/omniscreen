const { S3Client, ListObjectsV2Command, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const prisma = new PrismaClient();
const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const bucketName = process.env.MINIO_BUCKET_NAME || 'omniscreen-assets';
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function recover() {
  console.log('--- Starting Asset Recovery ---');
  
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'assets/',
    });
    
    const response = await s3.send(listCommand);
    const objects = response.Contents || [];
    
    console.log(`Found ${objects.length} objects in assets/`);
    
    for (const obj of objects) {
      const key = obj.Key;
      if (key === 'assets/') continue;
      
      const filename = key.replace('assets/', '');
      const assetUrl = `${baseUrl}/assets/file/${filename}`;
      
      // Determine type by extension
      const ext = path.extname(filename).toLowerCase();
      const isVideo = ['.mp4', '.mov', '.avi', '.wmv'].includes(ext);
      const type = isVideo ? 'VIDEO' : 'IMAGE';
      const mimeType = isVideo ? 'video/mp4' : 'image/jpeg'; // Fallback approximation
      
      // Check for thumbnail
      const thumbFilename = `thumb-${filename.split('.')[0]}.jpg`;
      const thumbKey = `thumbnails/${thumbFilename}`;
      let thumbnailUrl = null;
      
      try {
        await s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: thumbKey }));
        thumbnailUrl = `${baseUrl}/assets/file/${filename}?thumb=true`;
        console.log(`[PASS] Found thumbnail for ${filename}`);
      } catch (e) {
        console.log(`[WARN] No thumbnail for ${filename}`);
      }
      
      // Check if already exists (parity check)
      const existing = await prisma.asset.findFirst({
        where: { url: assetUrl }
      });
      
      if (existing) {
        console.log(`[SKIP] Asset ${filename} already in DB`);
        continue;
      }
      
      // Create record
      await prisma.asset.create({
        data: {
          name: filename.split('-').slice(1).join('-') || filename, // Try to recover original name
          type: type,
          url: assetUrl,
          thumbnailUrl: thumbnailUrl,
          size: BigInt(obj.Size || 0),
          mimeType: mimeType,
          orientation: 'LANDSCAPE', // Default
          duration: type === 'IMAGE' ? 10 : undefined,
        }
      });
      
      console.log(`[DONE] Recovered ${filename} as ${type}`);
    }
    
    console.log('--- Recovery Completed ---');
  } catch (err) {
    console.error('Recovery failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

recover();
