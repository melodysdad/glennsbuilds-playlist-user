#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PlaylistUserStack } from '../lib/playlist-user-stack';

const app = new cdk.App();

// Get configuration from context or environment
const stage = app.node.tryGetContext('stage') || process.env.STAGE || 'dev';
const hostedZoneId = app.node.tryGetContext('hostedZoneId') || process.env.HOSTED_ZONE_ID;
const hostedZoneName = app.node.tryGetContext('hostedZoneName') || process.env.HOSTED_ZONE_NAME || 'glennsbuilds.com';
const googleClientId = app.node.tryGetContext('googleClientId') || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = app.node.tryGetContext('googleClientSecret') || process.env.GOOGLE_CLIENT_SECRET;

// Determine domain name based on stage
const domainName = hostedZoneId
  ? stage === 'prod'
    ? 'playlist-user.glennsbuilds.com'
    : `${stage}.playlist-user.glennsbuilds.com`
  : undefined;

new PlaylistUserStack(app, `PlaylistUserStack-${stage}`, {
  stackName: `glennsbuilds-playlist-user-${stage}`,
  description: `User management and playlist service for glennsbuilds playlist application (${stage})`,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  stage,
  hostedZoneId,
  hostedZoneName,
  domainName,
  googleClientId,
  googleClientSecret,
  tags: {
    Project: 'glennsbuilds-playlist-user',
    Stage: stage,
    ManagedBy: 'CDK',
  },
});

app.synth();
