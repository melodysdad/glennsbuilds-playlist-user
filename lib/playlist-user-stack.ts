import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface PlaylistUserStackProps extends cdk.StackProps {
  stage: string;
}

export class PlaylistUserStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: PlaylistUserStackProps) {
    super(scope, id, props);

    const { stage } = props;

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
    // Lambda Functions
    // ============================================

    // Common Lambda environment variables
    const commonEnvironment = {
      PLAYLISTS_TABLE: playlistsTable.tableName,
      USER_PROFILES_TABLE: userProfilesTable.tableName,
      SUPPRESSIONS_TABLE: suppressionsTable.tableName,
      SERVICE_CREDENTIALS_TABLE: serviceCredentialsTable.tableName,
      // Cloud Map service discovery
      CLOUD_MAP_NAMESPACE: `glennsbuilds-playlist-${stage}.local`,
      CLOUD_MAP_SERVICE_NAME: 'playlist-generation',
      // Fallback to hardcoded function names when Cloud Map discovery fails
      PLAYLIST_SERVICE_PREVIEW_FUNCTION: `playlist-generation-service-${stage}-preview`,
      PLAYLIST_SERVICE_COMPLETE_FUNCTION: `playlist-generation-service-${stage}-complete`,
      PLAYLIST_SERVICE_GET_FUNCTION: `playlist-generation-service-${stage}-getPlaylist`,
      NODE_ENV: stage,
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
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
        new cdk.aws_iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [
            `arn:aws:lambda:${this.region}:${this.account}:function:playlist-generation-service-${stage}-preview`,
            `arn:aws:lambda:${this.region}:${this.account}:function:playlist-generation-service-${stage}-complete`,
            `arn:aws:lambda:${this.region}:${this.account}:function:playlist-generation-service-${stage}-getPlaylist`,
          ],
        })
      );

      // Grant permission to discover services via Cloud Map
      fn.addToRolePolicy(
        new cdk.aws_iam.PolicyStatement({
          actions: [
            'servicediscovery:DiscoverInstances',
            'servicediscovery:GetService',
          ],
          resources: ['*'], // Cloud Map doesn't support resource-level permissions for DiscoverInstances
        })
      );
    });

    // ============================================
    // AWS Cloud Map Service Discovery
    // ============================================

    // Create HTTP namespace for service discovery
    const namespace = new servicediscovery.HttpNamespace(this, 'ServiceNamespace', {
      name: `glennsbuilds-playlist-${stage}.local`,
      description: `Service discovery namespace for glennsbuilds playlist services (${stage})`,
    });

    // Create service for playlist-user
    const playlistUserService = namespace.createService('PlaylistUserService', {
      name: 'playlist-user',
      description: 'User management and playlist service',
    });

    // Register this service instance with all Lambda ARNs and DynamoDB table names
    playlistUserService.registerNonIpInstance('PlaylistUserInstance', {
      instanceId: `${stage}-playlist-user-instance`,
      customAttributes: {
        // Lambda Function ARNs
        getUserPreferences: getUserPreferencesFunction.functionArn,
        updateUserPreferences: updateUserPreferencesFunction.functionArn,
        addSuppression: addSuppressionFunction.functionArn,
        getPlaylistHistory: getPlaylistHistoryFunction.functionArn,
        playlistPreview: playlistPreviewFunction.functionArn,
        playlistComplete: playlistCompleteFunction.functionArn,
        playlistGet: playlistGetFunction.functionArn,

        // DynamoDB Table Names
        playlistsTable: playlistsTable.tableName,
        userProfilesTable: userProfilesTable.tableName,
        suppressionsTable: suppressionsTable.tableName,
        serviceCredentialsTable: serviceCredentialsTable.tableName,

        // Metadata
        stage: stage,
        region: this.region,
        version: '1.0.0',
        deployedAt: new Date().toISOString(),
      },
    });

    // ============================================
    // Outputs
    // ============================================
    new cdk.CfnOutput(this, 'PlaylistsTableName', {
      value: playlistsTable.tableName,
      description: 'DynamoDB table for playlist persistence',
    });

    new cdk.CfnOutput(this, 'UserProfilesTableName', {
      value: userProfilesTable.tableName,
      description: 'DynamoDB table for user profiles',
    });

    new cdk.CfnOutput(this, 'SuppressionsTableName', {
      value: suppressionsTable.tableName,
      description: 'DynamoDB table for suppressions',
    });

    new cdk.CfnOutput(this, 'ServiceCredentialsTableName', {
      value: serviceCredentialsTable.tableName,
      description: 'DynamoDB table for service credentials',
    });

    // Export Lambda function names for API Gateway to reference
    new cdk.CfnOutput(this, 'GetUserPreferencesFunctionName', {
      value: getUserPreferencesFunction.functionName,
      exportName: `${stage}-GetUserPreferencesFunctionName`,
    });

    new cdk.CfnOutput(this, 'UpdateUserPreferencesFunctionName', {
      value: updateUserPreferencesFunction.functionName,
      exportName: `${stage}-UpdateUserPreferencesFunctionName`,
    });

    new cdk.CfnOutput(this, 'AddSuppressionFunctionName', {
      value: addSuppressionFunction.functionName,
      exportName: `${stage}-AddSuppressionFunctionName`,
    });

    new cdk.CfnOutput(this, 'GetPlaylistHistoryFunctionName', {
      value: getPlaylistHistoryFunction.functionName,
      exportName: `${stage}-GetPlaylistHistoryFunctionName`,
    });

    new cdk.CfnOutput(this, 'PlaylistPreviewFunctionName', {
      value: playlistPreviewFunction.functionName,
      exportName: `${stage}-PlaylistPreviewFunctionName`,
    });

    new cdk.CfnOutput(this, 'PlaylistCompleteFunctionName', {
      value: playlistCompleteFunction.functionName,
      exportName: `${stage}-PlaylistCompleteFunctionName`,
    });

    new cdk.CfnOutput(this, 'PlaylistGetFunctionName', {
      value: playlistGetFunction.functionName,
      exportName: `${stage}-PlaylistGetFunctionName`,
    });

    // Cloud Map outputs
    new cdk.CfnOutput(this, 'CloudMapNamespace', {
      value: namespace.namespaceName,
      description: 'Service discovery namespace for glennsbuilds playlist services',
      exportName: `${stage}-CloudMapNamespace`,
    });

    new cdk.CfnOutput(this, 'CloudMapNamespaceId', {
      value: namespace.namespaceId,
      description: 'Service discovery namespace ID',
      exportName: `${stage}-CloudMapNamespaceId`,
    });

    new cdk.CfnOutput(this, 'PlaylistUserServiceArn', {
      value: playlistUserService.serviceArn,
      description: 'Cloud Map service ARN for playlist-user',
    });
  }
}
