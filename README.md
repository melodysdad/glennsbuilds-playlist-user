# Glennsbuilds Playlist User Service

User management and playlist service for the Glennsbuilds playlist application.

## Overview

This service handles all user-related functionality including:
- User preferences management
- Artist/genre/tag suppressions
- Playlist generation history
- Playlist preview and completion workflows
- Integration with the playlist generation microservice

## Architecture

This service is a TypeScript-based AWS Lambda application deployed using AWS CDK. It provides RESTful HTTP API endpoints secured with AWS Cognito authentication.

### Key Components

- **Lambda Handlers** (`src/lambda/user/`): HTTP API endpoints for user operations
- **Storage Layer** (`src/storage/`): DynamoDB data access layer
- **Business Logic** (`src/tools/`): Preference and suppression management
- **Services** (`src/services/`): Playlist generation service client
- **Shared Utilities** (`src/lambda/shared/`): Authentication, response formatting, error handling
- **Infrastructure** (`lib/`, `bin/`): AWS CDK infrastructure as code

## API Endpoints

All endpoints require Cognito JWT authentication.

### User Preferences
- `GET /user/preferences` - Get user preferences
- `POST /user/preferences` - Update user preferences

### Suppressions
- `POST /user/suppression` - Add a genre/artist/tag suppression

### Playlist History
- `GET /user/history` - Get user's playlist generation history

### Playlist Generation
- `POST /user/{userId}/playlist/preview` - Generate 10-track preview playlist
- `POST /user/{userId}/playlist/{playlistId}/complete` - Start full 50-track playlist generation
- `GET /user/{userId}/playlist/{playlistId}` - Get playlist status and tracks

## AWS Resources

### DynamoDB Tables
- **PlaylistsTable**: Stores playlist metadata and tracks
- **UserProfilesTable**: Stores user profiles and preferences
- **SuppressionsTable**: Stores user suppressions (genres, artists, tags)
- **ServiceCredentialsTable**: Stores encrypted OAuth tokens (KMS encrypted)

### Cognito
- **User Pool**: Manages user authentication
- **User Pool Client**: OAuth client configuration
- **Hosted UI**: Provides login/signup interface

### KMS
- **UserDataEncryptionKey**: Encrypts sensitive user data (OAuth tokens)

### API Gateway
- **HTTP API**: RESTful API with Cognito JWT authorizer
- **Custom Domain** (optional): Custom domain name with ACM certificate

## Development

### Prerequisites
- Node.js 20.x
- AWS CLI configured with appropriate credentials
- AWS CDK CLI (`npm install -g aws-cdk`)

### Setup
```bash
# Install dependencies
npm install

# Build the application
npm run build
```

### Test
```bash
npm test                # Run all tests
npm run test:unit      # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:coverage  # Run with coverage report
```

### Build and Watch
```bash
npm run build:watch    # Build and watch for changes
```

## Deployment

### Initial Setup

1. **Bootstrap CDK** (one-time per account/region):
```bash
npm run cdk:bootstrap
```

2. **Configure Environment** (optional):
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Deploy

#### Deploy to Development
```bash
npm run cdk:deploy:dev
```

#### Deploy to Production
```bash
npm run cdk:deploy:prod
```

#### Deploy with Custom Context
```bash
cdk deploy --all --context stage=dev --context hostedZoneId=Z1234567890ABC
```

### View Changes Before Deploy
```bash
npm run cdk:diff
```

### Synthesize CloudFormation Template
```bash
npm run cdk:synth
```

### Destroy Stack
```bash
npm run cdk:destroy
```

## Environment Variables

### Build Time (CDK Context)
Set via CDK context or environment variables:
- `STAGE`: Deployment stage (dev, staging, prod)
- `HOSTED_ZONE_ID`: Route53 hosted zone ID for custom domain (optional)
- `HOSTED_ZONE_NAME`: Route53 hosted zone name (default: glennsbuilds.com)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret (optional)

### Runtime (Lambda Functions)
Automatically configured by CDK:
- `PLAYLISTS_TABLE`: DynamoDB table for playlists
- `USER_PROFILES_TABLE`: DynamoDB table for user profiles
- `SUPPRESSIONS_TABLE`: DynamoDB table for suppressions
- `SERVICE_CREDENTIALS_TABLE`: DynamoDB table for OAuth credentials
- `PLAYLIST_SERVICE_PREVIEW_FUNCTION`: Lambda function for preview generation
- `PLAYLIST_SERVICE_COMPLETE_FUNCTION`: Lambda function for complete generation
- `PLAYLIST_SERVICE_GET_FUNCTION`: Lambda function for getting playlists
- `USER_POOL_ID`: Cognito User Pool ID
- `USER_POOL_CLIENT_ID`: Cognito User Pool Client ID

## Custom Domain Setup

To use a custom domain:

1. Set environment variables:
```bash
export HOSTED_ZONE_ID=Z1234567890ABC
export HOSTED_ZONE_NAME=glennsbuilds.com
export STAGE=dev
```

2. Deploy:
```bash
npm run cdk:deploy:dev
```

The custom domain will be:
- Development: `dev.playlist-user.glennsbuilds.com`
- Production: `playlist-user.glennsbuilds.com`

## Google OAuth Setup

To enable Google OAuth:

1. Create OAuth credentials in Google Cloud Console
2. Set environment variables:
```bash
export GOOGLE_CLIENT_ID=your-client-id
export GOOGLE_CLIENT_SECRET=your-client-secret
```

3. Deploy:
```bash
npm run cdk:deploy:dev
```

4. Configure the redirect URI in Google Cloud Console:
   - The redirect URI will be output after deployment
   - Format: `https://[domain].auth.[region].amazoncognito.com/oauth2/idpresponse`

## CDK Commands

- `npm run cdk:synth` - Synthesize CloudFormation template
- `npm run cdk:deploy` - Deploy all stacks
- `npm run cdk:deploy:dev` - Deploy with dev stage
- `npm run cdk:deploy:prod` - Deploy with prod stage
- `npm run cdk:diff` - View differences before deployment
- `npm run cdk:destroy` - Remove all deployed resources
- `npm run cdk:bootstrap` - Bootstrap CDK (one-time setup)

## Project Structure

```
.
├── bin/
│   └── app.ts              # CDK app entry point
├── lib/
│   └── playlist-user-stack.ts  # CDK stack definition
├── src/
│   ├── lambda/             # Lambda function handlers
│   ├── storage/            # DynamoDB repositories
│   ├── tools/              # Business logic
│   ├── services/           # External service clients
│   └── types.ts            # TypeScript type definitions
├── tests/                  # Test suite
├── cdk.json                # CDK configuration
├── package.json            # Dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

## License

MIT
