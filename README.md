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

This service is a TypeScript-based AWS Lambda application deployed using the Serverless Framework. It provides RESTful HTTP API endpoints secured with AWS Cognito authentication.

### Key Components

- **Lambda Handlers** (`src/lambda/user/`): HTTP API endpoints for user operations
- **Storage Layer** (`src/storage/`): DynamoDB data access layer
- **Business Logic** (`src/tools/`): Preference and suppression management
- **Services** (`src/services/`): Playlist generation service client
- **Shared Utilities** (`src/lambda/shared/`): Authentication, response formatting, error handling

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

## Development

### Prerequisites
- Node.js 20.x
- AWS CLI configured with appropriate credentials
- Serverless Framework

### Setup
```bash
npm install
```

### Build
```bash
npm run build
```

### Test
```bash
npm test                # Run all tests
npm run test:unit      # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:coverage  # Run with coverage report
```

### Deploy
```bash
npm run deploy         # Deploy to dev stage
npm run deploy:prod    # Deploy to prod stage
```

## Environment Variables

Required environment variables (set in serverless.yml):
- `PLAYLISTS_TABLE`: DynamoDB table for playlists
- `USER_PROFILES_TABLE`: DynamoDB table for user profiles
- `SUPPRESSIONS_TABLE`: DynamoDB table for suppressions
- `SERVICE_CREDENTIALS_TABLE`: DynamoDB table for OAuth credentials
- `PLAYLIST_SERVICE_PREVIEW_FUNCTION`: Lambda function for preview generation
- `PLAYLIST_SERVICE_COMPLETE_FUNCTION`: Lambda function for complete generation
- `PLAYLIST_SERVICE_GET_FUNCTION`: Lambda function for getting playlists
- `USER_POOL_ID`: Cognito User Pool ID
- `USER_POOL_CLIENT_ID`: Cognito User Pool Client ID

Optional environment variables for custom domain and Google OAuth:
- `HOSTED_ZONE_ID`: Route53 hosted zone ID for custom domain
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

## License

MIT
