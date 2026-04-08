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
  const bucketName = process.env.MINIO_BUCKET_NAME || 'omniscreen-assets';
  fastify.decorate('bucketName', bucketName);

  // Auto-create bucket if it doesn't exist
  fastify.addHook('onReady', async () => {
    try {
      const { HeadBucketCommand, CreateBucketCommand } = require('@aws-sdk/client-s3');

      try {
        await client.send(new HeadBucketCommand({ Bucket: bucketName }));
        fastify.log.info(`Bucket "${bucketName}" already exists.`);
      } catch (error) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
          fastify.log.info(`Bucket "${bucketName}" not found. Creating...`);
          await client.send(new CreateBucketCommand({ Bucket: bucketName }));
          fastify.log.info(`Bucket "${bucketName}" created successfully.`);
        } else {
          throw error;
        }
      }

      // Always ensure bucket policy is set to public read-only
      const { PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicRead',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };

      await client.send(
        new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(policy),
        })
      );
      fastify.log.info(`Bucket "${bucketName}" policy set to Public Read-Only.`);
    } catch (err) {
      fastify.log.error('Failed to initialize MinIO bucket:', err);
    }
  });
}

module.exports = fp(s3Plugin);
