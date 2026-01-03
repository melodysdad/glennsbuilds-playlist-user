import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2Authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as apigatewayv2Integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface PlaylistUserStackProps extends cdk.StackProps {
  stage: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
  domainName?: string;
  googleClientId?: string;
  googleClientSecret?: string;
}

export class PlaylistUserStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly httpApi: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: PlaylistUserStackProps) {
    super(scope, id, props);

    const { stage, hostedZoneId, hostedZoneName, domainName, googleClientId, googleClientSecret } = props;

    // ============================================
    // KMS Key for encrypting sensitive user data
    // ============================================
    const userDataEncryptionKey = new kms.Key(this, 'UserDataEncryptionKey', {
      description: 'KMS key for encrypting sensitive user data (OAuth tokens)',
      enableKeyRotation: true,
      alias: `glennsbuilds-playlist-user-data-${stage}`,
    });

    // ============================================
    // DynamoDB Tables
    // ============================================

    // Playlists Table
    const playlistsTable = new dynamodb.Table(this, 'PlaylistsTable', {
      tableName: `glennsbuilds-playlist-user-playlists-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'playlistId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for status queries
    playlistsTable.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'playlistId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // User Profiles Table
    const userProfilesTable = new dynamodb.Table(this, 'UserProfilesTable', {
      tableName: `glennsbuilds-playlist-user-profiles-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Suppressions Table
    const suppressionsTable = new dynamodb.Table(this, 'SuppressionsTable', {
      tableName: `glennsbuilds-playlist-user-suppressions-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'suppressionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Service Credentials Table (encrypted)
    const serviceCredentialsTable = new dynamodb.Table(this, 'ServiceCredentialsTable', {
      tableName: `glennsbuilds-playlist-user-service-credentials-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'service', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: userDataEncryptionKey,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // ============================================
    // Cognito User Pool
    // ============================================
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `playlist-users-${stage}`,
      signInAliases: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      autoVerify: {
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Cognito User Pool Domain
    const userPoolDomain = this.userPool.addDomain('UserPoolDomain', {
      cognitoDomain: {
        domainPrefix: `glennsbuilds-playlist-user-${stage}-${this.account}`,
      },
    });

    // Cognito User Pool Client
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `playlist-user-web-client-${stage}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          domainName ? `https://${domainName}/callback` : 'http://localhost:3000/callback',
        ],
        logoutUrls: [
          domainName ? `https://${domainName}/logout` : 'http://localhost:3000/logout',
        ],
      },
      accessTokenValidity: cdk.Duration.minutes(60),
      idTokenValidity: cdk.Duration.minutes(60),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
        emailVerified: true,
      }),
      writeAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
      }),
    });

    // Google Identity Provider (optional)
    if (googleClientId && googleClientSecret && googleClientId !== 'placeholder-google-client-id') {
      const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
        userPool: this.userPool,
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        scopes: ['email', 'openid', 'profile'],
        attributeMapping: {
          email: cognito.ProviderAttribute.GOOGLE_EMAIL,
          givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
          familyName: cognito.ProviderAttribute.GOOGLE_FAMILY_NAME,
          profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
        },
      });

      this.userPoolClient.node.addDependency(googleProvider);
    }

    // ============================================
    // Lambda Functions
    // ============================================

    // Common Lambda environment variables
    const commonEnvironment = {
      PLAYLISTS_TABLE: playlistsTable.tableName,
      USER_PROFILES_TABLE: userProfilesTable.tableName,
      SUPPRESSIONS_TABLE: suppressionsTable.tableName,
      SERVICE_CREDENTIALS_TABLE: serviceCredentialsTable.tableName,
      PLAYLIST_SERVICE_PREVIEW_FUNCTION: `playlist-generation-service-${stage}-preview`,
      PLAYLIST_SERVICE_COMPLETE_FUNCTION: `playlist-generation-service-${stage}-complete`,
      PLAYLIST_SERVICE_GET_FUNCTION: `playlist-generation-service-${stage}-getPlaylist`,
      NODE_ENV: stage,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      USER_POOL_ID: this.userPool.userPoolId,
      USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId,
    };

    // Common Lambda properties
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset(path.join(__dirname, '../build')),
      environment: commonEnvironment,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
    };

    // User Preferences Functions
    const getUserPreferencesFunction = new lambda.Function(this, 'GetUserPreferencesFunction', {
      ...commonLambdaProps,
      functionName: `playlist-user-${stage}-getUserPreferences`,
      handler: 'lambda/user/get-preferences.handler',
      description: 'Get user preferences',
    });

    const updateUserPreferencesFunction = new lambda.Function(this, 'UpdateUserPreferencesFunction', {
      ...commonLambdaProps,
      functionName: `playlist-user-${stage}-updateUserPreferences`,
      handler: 'lambda/user/update-preferences.handler',
      description: 'Update user preferences',
    });

    const addSuppressionFunction = new lambda.Function(this, 'AddSuppressionFunction', {
      ...commonLambdaProps,
      functionName: `playlist-user-${stage}-addSuppression`,
      handler: 'lambda/user/add-suppression.handler',
      description: 'Add a genre/artist suppression',
    });

    const getPlaylistHistoryFunction = new lambda.Function(this, 'GetPlaylistHistoryFunction', {
      ...commonLambdaProps,
      functionName: `playlist-user-${stage}-getPlaylistHistory`,
      handler: 'lambda/user/get-playlist-history.handler',
      description: 'Get user playlist generation history',
    });

    // Playlist Generation Functions
    const playlistPreviewFunction = new lambda.Function(this, 'PlaylistPreviewFunction', {
      ...commonLambdaProps,
      functionName: `playlist-user-${stage}-playlistPreview`,
      handler: 'lambda/user/playlist-preview.handler',
      description: 'Generate 10-track preview playlist',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    const playlistCompleteFunction = new lambda.Function(this, 'PlaylistCompleteFunction', {
      ...commonLambdaProps,
      functionName: `playlist-user-${stage}-playlistComplete`,
      handler: 'lambda/user/playlist-complete.handler',
      description: 'Start full 50-track playlist generation',
    });

    const playlistGetFunction = new lambda.Function(this, 'PlaylistGetFunction', {
      ...commonLambdaProps,
      functionName: `playlist-user-${stage}-playlistGet`,
      handler: 'lambda/user/playlist-get.handler',
      description: 'Get playlist status and tracks',
    });

    // Grant DynamoDB permissions
    const lambdaFunctions = [
      getUserPreferencesFunction,
      updateUserPreferencesFunction,
      addSuppressionFunction,
      getPlaylistHistoryFunction,
      playlistPreviewFunction,
      playlistCompleteFunction,
      playlistGetFunction,
    ];

    lambdaFunctions.forEach((fn) => {
      playlistsTable.grantReadWriteData(fn);
      userProfilesTable.grantReadWriteData(fn);
      suppressionsTable.grantReadWriteData(fn);
      serviceCredentialsTable.grantReadWriteData(fn);
      userDataEncryptionKey.grantEncryptDecrypt(fn);

      // Grant permission to invoke playlist generation service
      fn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [
            `arn:aws:lambda:${this.region}:${this.account}:function:playlist-generation-service-${stage}-preview`,
            `arn:aws:lambda:${this.region}:${this.account}:function:playlist-generation-service-${stage}-complete`,
            `arn:aws:lambda:${this.region}:${this.account}:function:playlist-generation-service-${stage}-getPlaylist`,
          ],
        })
      );
    });

    // ============================================
    // HTTP API Gateway with Cognito Authorizer
    // ============================================

    // JWT Authorizer
    const authorizer = new apigatewayv2Authorizers.HttpUserPoolAuthorizer(
      'CognitoAuthorizer',
      this.userPool,
      {
        userPoolClients: [this.userPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    // HTTP API
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `playlist-user-api-${stage}`,
      description: 'User management and playlist service API',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['*'],
      },
    });

    // Define routes
    const routes = [
      { path: '/user/preferences', method: apigatewayv2.HttpMethod.GET, function: getUserPreferencesFunction },
      { path: '/user/preferences', method: apigatewayv2.HttpMethod.POST, function: updateUserPreferencesFunction },
      { path: '/user/suppression', method: apigatewayv2.HttpMethod.POST, function: addSuppressionFunction },
      { path: '/user/history', method: apigatewayv2.HttpMethod.GET, function: getPlaylistHistoryFunction },
      { path: '/user/{userId}/playlist/preview', method: apigatewayv2.HttpMethod.POST, function: playlistPreviewFunction },
      { path: '/user/{userId}/playlist/{playlistId}/complete', method: apigatewayv2.HttpMethod.POST, function: playlistCompleteFunction },
      { path: '/user/{userId}/playlist/{playlistId}', method: apigatewayv2.HttpMethod.GET, function: playlistGetFunction },
    ];

    routes.forEach((route, index) => {
      new apigatewayv2.HttpRoute(this, `Route${index}`, {
        httpApi: this.httpApi,
        routeKey: apigatewayv2.HttpRouteKey.with(route.path, route.method),
        integration: new apigatewayv2Integrations.HttpLambdaIntegration(`Integration${index}`, route.function),
        authorizer,
      });
    });

    // ============================================
    // Custom Domain (Optional)
    // ============================================
    if (hostedZoneId && hostedZoneName && domainName) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: hostedZoneName,
      });

      const certificate = new acm.Certificate(this, 'Certificate', {
        domainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      const customDomain = new apigatewayv2.DomainName(this, 'CustomDomain', {
        domainName,
        certificate,
      });

      new apigatewayv2.ApiMapping(this, 'ApiMapping', {
        api: this.httpApi,
        domainName: customDomain,
        stage: this.httpApi.defaultStage,
      });

      new route53.ARecord(this, 'DomainARecord', {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayv2DomainProperties(
            customDomain.regionalDomainName,
            customDomain.regionalHostedZoneId
          )
        ),
      });
    }

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `${stage}-UserPoolId`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `${stage}-UserPoolClientId`,
    });

    new cdk.CfnOutput(this, 'CognitoHostedUIUrl', {
      value: `https://${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: 'Cognito Hosted UI URL for login',
    });

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.url || '',
      description: 'HTTP API endpoint URL',
    });

    new cdk.CfnOutput(this, 'PlaylistsTableName', {
      value: playlistsTable.tableName,
      description: 'DynamoDB table for playlist persistence',
    });

    if (domainName) {
      new cdk.CfnOutput(this, 'CustomDomainUrl', {
        value: `https://${domainName}`,
        description: 'Custom domain URL for the API',
      });
    }
  }
}
