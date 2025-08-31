# Sdui Integration Implementation

This document describes how the Sdui news integration was implemented in Untis Pro.

## Overview

The implementation adds a second tab to the Untis Pro interface that displays news from Sdui using the same credentials as Untis login. Users can switch between their timetable and Sdui news seamlessly.

## Architecture

### Backend Components

1. **SduiApiClient** (`services/sduiService.ts`)
   - Implements the Sdui API client based on the DAS DUI documentation
   - Handles authentication using the same Untis credentials
   - Manages news fetching with pagination support
   - Caches client instances per user for performance

2. **Sdui Routes** (`routes/sdui.ts`)
   - `/api/sdui/news` - Get paginated news list
   - `/api/sdui/news/:newsId` - Get specific news item
   - Includes proper authentication middleware
   - Error handling for various failure scenarios

### Frontend Components

1. **TabNavigation** (`components/TabNavigation.tsx`)
   - Desktop: Left sidebar navigation with calendar and news icons
   - Mobile: Bottom bar navigation optimized for touch
   - Responsive design that adapts to screen size

2. **SduiNewsList** (`components/SduiNewsList.tsx`)
   - News article listing with infinite scroll
   - Article preview cards with title, content, author, and date
   - Full-screen modal for detailed news viewing
   - Attachment support with download links

3. **Dashboard Integration** (`pages/Dashboard.tsx`)
   - Modified to support tab-based navigation
   - Conditional rendering of timetable vs news content
   - Maintains all existing functionality

## Features

### News Display
- **Card-based Layout**: Modern card design with hover effects
- **Content Preview**: Truncated content with "read more" functionality
- **Rich Content**: Full HTML rendering in detail modal
- **Attachments**: PDF and file downloads with size/type information
- **Infinite Scroll**: Automatic loading of more news as user scrolls

### Navigation
- **Desktop**: Professional left sidebar with clear section separation
- **Mobile**: Bottom navigation bar with safe area support
- **Responsive**: Seamless transition between layouts
- **Accessibility**: Proper ARIA labels and keyboard navigation

### Error Handling
- **Authentication Errors**: Clear messaging for credential issues
- **Network Errors**: Retry functionality with user feedback
- **Empty States**: Helpful messages when no news is available
- **Loading States**: Smooth loading indicators throughout

## Configuration

### Environment Variables
The Sdui API base URL can be configured, though it defaults to the standard Sdui API endpoint.

### School Configuration
The system uses the user's school setting as the Sdui school link (slink parameter).

## Security Considerations

1. **Credential Handling**: Uses the same encrypted credential storage as Untis
2. **Authentication**: All requests require valid JWT tokens
3. **CORS**: Backend acts as proxy to avoid cross-origin issues
4. **Rate Limiting**: Inherits existing rate limiting from Untis integration

## Future Enhancements

1. **Push Notifications**: Could be extended to notify users of new news
2. **Caching**: News could be cached for better performance
3. **Search**: Add search functionality within news
4. **Categories**: Support for news categories if available in API
5. **Offline Support**: Cache recent news for offline viewing

## Testing

The implementation includes:
- TypeScript type safety throughout
- ESLint compliance for code quality
- Responsive design testing
- Error boundary handling
- Loading state management

## API Compatibility

Based on the DAS DUI documentation from:
https://github.com/Florian325/das-dui/blob/main/packages/api-client/DOCS.md

The implementation follows the documented API patterns for:
- Authentication (`login`)
- News retrieval (`getNewsByPage`, `getNewsById`)
- Error handling and response structure