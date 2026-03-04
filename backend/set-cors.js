require('dotenv').config();
const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    region: 'us-east-1',
    endpoint: 'http://localhost:9000',
    credentials: {
        accessKeyId: 'pxRTd63ZyWA1r0qX86vU',
        secretAccessKey: '4l4hUSS3nhhr5H9rKX0eSe4Kpu7tsqOTTSuBxUI5',
    },
    forcePathStyle: true,
});

async function setCors() {
    try {
        const params = {
            Bucket: 'omniscreen-assets',
            CORSConfiguration: {
                CORSRules: [
                    {
                        AllowedHeaders: ['*'],
                        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                        AllowedOrigins: ['*'],
                        ExposeHeaders: ['ETag'],
                        MaxAgeSeconds: 3000,
                    },
                ],
            },
        };
        await s3.send(new PutBucketCorsCommand(params));
        console.log('CORS configured successfully for bucket "omniscreen".');
    } catch (error) {
        console.error('Error configuring CORS:', error);
    }
}

setCors();
