const fs = require('fs');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const API_URL = 'http://localhost:3001/api';
const s3 = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'pxRTd63ZyWA1r0qX86vU',
    secretAccessKey: '4l4hUSS3nhhr5H9rKX0eSe4Kpu7tsqOTTSuBxUI5'
  },
  forcePathStyle: true
});

async function run() {
  try {
    // 1. Create a dummy test video
    const { execSync } = require('child_process');
    execSync('ffmpeg -f lavfi -i color=c=blue:s=320x240:d=1 -f mp4 -y test.movie.123.mp4');

    // 2. Upload it
    const form = new FormData();
    form.append('type', 'VIDEO');
    form.append('duration', '10');
    const buffer = fs.readFileSync('test.movie.123.mp4');
    form.append('file', new File([buffer], 'test.movie.123.mp4', { type: 'video/mp4' }));
    
    console.log('--- Uploading ---');
    const uploadRes = await fetch(`${API_URL}/assets`, {
      method: 'POST',
      body: form
    });
    if (!uploadRes.ok) throw new Error(`Upload fail. Status: ${uploadRes.status}`);
    const asset = await uploadRes.json();
    console.log('Uploaded asset:', asset);

    // 3. List MinIO before delete
    console.log('\n--- MinIO List (Before Delete) ---');
    let beforeList = await s3.send(new ListObjectsV2Command({ Bucket: 'omniscreen-assets' }));
    let filesBefore = beforeList.Contents?.map(c => c.Key) || [];
    const mainFoundBefore = filesBefore.some(k => k.includes('.mp4') && k.includes('test.movie.123'));
    const thumbFoundBefore = filesBefore.some(k => k.startsWith('thumbnails/thumb-') && k.includes('test'));
    console.log(`Main file found: ${mainFoundBefore}, Thumb found: ${thumbFoundBefore}`);
    
    // 4. Delete it
    console.log('\n--- Deleting ---');
    const delRes = await fetch(`${API_URL}/assets/${asset.id}`, { method: 'DELETE' });
    if (!delRes.ok) throw new Error(`Delete fail: ${delRes.status}`);
    console.log('Deleted successfully from DB');

    // 5. List MinIO after delete
    console.log('\n--- MinIO List (After Delete) ---');
    let afterList = await s3.send(new ListObjectsV2Command({ Bucket: 'omniscreen-assets' }));
    let filesAfter = afterList.Contents?.map(c => c.Key) || [];
    const mainFoundAfter = filesAfter.some(k => k.includes('.mp4') && k.includes('test.movie.123'));
    const thumbFoundAfter = filesAfter.some(k => k.startsWith('thumbnails/thumb-') && k.includes('test'));

    if (mainFoundAfter || thumbFoundAfter) {
      console.log(`⚠️ BUG DETECTED: Main: ${mainFoundAfter}, Thumb: ${thumbFoundAfter}`);
      console.log('Orphaned thumb keys:', filesAfter.filter(k => k.startsWith('thumbnails/thumb-') && k.includes('test')));
    } else {
      console.log('File successfully removed from MinIO ✅');
    }

  } catch (err) {
    console.error('Test failed:', err.message);
    if(err.response) console.error(err.response.data);
  } finally {
    if (fs.existsSync('test.movie.123.mp4')) fs.unlinkSync('test.movie.123.mp4');
  }
}

run();
