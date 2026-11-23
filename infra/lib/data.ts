import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

/**
 * Single DynamoDB table for all entities + bucket for logos and question images, served through
 * CloudFront (the bucket stays private) and uploaded by the web server with presigned URLs.
 */
export class ChacotaData extends Construct {
  readonly table: dynamodb.TableV2;
  readonly mediaBucket: s3.Bucket;
  readonly mediaDistribution: cloudfront.Distribution;
  /** Attach to the web server's role (Amplify SSR compute role) so it can sign uploads. */
  readonly webServerPolicy: iam.ManagedPolicy;

  constructor(scope: Construct, id: string, props: { allowedOrigins: string[]; protect: boolean }) {
    super(scope, id);

    this.table = new dynamodb.TableV2(this, 'Table', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: 'ttl',
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: props.protect,
      removalPolicy: props.protect ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      globalSecondaryIndexes: [
        {
          indexName: 'gsi1',
          partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
        },
      ],
    });

    this.mediaBucket = new s3.Bucket(this, 'Media', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: props.protect ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.protect,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: props.allowedOrigins,
          allowedHeaders: ['content-type'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [
        // Presigned uploads that never got attached to an entity.
        { prefix: 'tmp/', expiration: Duration.days(1) },
        { abortIncompleteMultipartUploadAfter: Duration.days(1) },
      ],
    });

    // Keys are never reused (orgs/<orgId>/media/<uuid>.<ext>), so they can be cached for good.
    this.mediaDistribution = new cloudfront.Distribution(this, 'MediaCdn', {
      comment: 'Chacota media (logos and question images)',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.mediaBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    this.webServerPolicy = new iam.ManagedPolicy(this, 'WebServerPolicy', {
      description: 'Lets the Chacota web server sign uploads of organization media',
      statements: [new iam.PolicyStatement({ actions: ['s3:PutObject'], resources: [this.mediaBucket.arnForObjects('orgs/*')] })],
    });
  }
}

