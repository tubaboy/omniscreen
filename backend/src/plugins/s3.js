const fp = require('fastify-plugin');
const { S3Client } = require('@aws-sdk/client-s3');

async function s3Plugin(fastify, opts) {
  const client = new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY,
      secretAccessKey: process.env.MINIO_SECRET_KEY,
    },
    tls: process.env.MINIO_USE_SSL === 'true',
  });

  fastify.decorate('s3', client);
  fastify.decorate('bucketName', process.env.MINIO_BUCKET_NAME || 'omniscreen-assets');
}

module.exports = fp(s3Plugin);
