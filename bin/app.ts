#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PlaylistUserStack } from '../lib/playlist-user-stack';

const app = new cdk.App();

// Get configuration from context or environment
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';

new PlaylistUserStack(app, `PlaylistUserStack-${stage}`, {
  stackName: `glennsbuilds-playlist-user-${stage}`,
  description: `User management service - Lambda functions and DynamoDB (${stage})`,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  stage,
  tags: {
    Project: 'glennsbuilds-playlist-user',
    Stage: stage,
    ManagedBy: 'CDK',
  },
});

app.synth();
