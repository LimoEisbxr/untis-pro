# Notification System Documentation

## Overview

The Untis Pro notification system provides real-time notifications for timetable changes, access requests, and other important events. It supports both browser notifications and PWA push notifications.

## Features

### Notification Types
- **Cancelled Lessons**: Notifications when lessons are cancelled
- **Irregular Lessons**: Notifications for schedule changes
- **Timetable Changes**: General timetable updates
- **Access Requests**: Notifications for user managers about new access requests

### User Interface
- **Notification Bell**: Located in the header next to settings, shows unread count
- **Notification Panel**: Slide-out panel with all notifications and management options
- **Settings Integration**: Notification preferences in the settings modal

### Permissions & Settings
- **Browser Permission**: Request notification permission when needed
- **Per-Type Control**: Enable/disable specific notification types
- **Device-Specific**: Configure different preferences per device
- **Real-time Updates**: Notifications refresh every 30 seconds

## User Guide

### Enabling Notifications
1. Click the notification bell icon in the header
2. If prompted, click "Enable" to grant browser notification permission
3. Open Settings to configure notification preferences
4. Toggle on desired notification types

### Managing Notifications
- **View**: Click notification bell to open notification panel
- **Mark as Read**: Click individual notification actions
- **Mark All Read**: Use "Mark all as read" button
- **Delete**: Remove individual notifications

### Settings Configuration
Navigate to Settings → Notification Preferences:
- **Browser Notifications**: Master toggle for all notifications
- **Cancelled Lessons**: Notifications for cancelled classes
- **Irregular Lessons**: Notifications for schedule changes
- **Timetable Changes**: General timetable updates
- **Access Requests**: For user managers only

## Setup & Configuration

### Initial Setup

1. **Generate VAPID Keys** (Required for push notifications):
   ```bash
   node generate-vapid-keys.js
   ```

2. **Configure Environment Variables**:
   Add the generated VAPID keys to your `.env` file:
   ```env
   VAPID_PUBLIC_KEY=your_generated_public_key
   VAPID_PRIVATE_KEY=your_generated_private_key
   VAPID_SUBJECT=mailto:admin@yourdomain.com
   ```

3. **Install Dependencies**:
   ```bash
   # Backend
   cd untis-pro-backend
   npm install
   
   # Frontend
   cd untis-pro-frontend
   npm install
   ```

### PWA Push Notifications

The system supports full PWA push notifications with proper iOS support:

#### Prerequisites
- **VAPID Keys**: Required for Web Push API
- **HTTPS**: Push notifications only work over HTTPS (or localhost for testing)
- **Service Worker**: Automatically registered for PWA functionality

#### iOS Support
- **iOS 16.4+**: Full Web Push support in PWA mode
- **Add to Home Screen**: Required for iOS push notifications
- **Standalone Mode**: App must be installed as PWA on iOS devices

#### Testing Push Notifications
1. Install the app as PWA (Add to Home Screen on mobile)
2. Grant notification permission when prompted
3. Enable "Push Notifications (PWA)" in settings
4. Test with admin notification tools

## Admin Configuration

### System Settings
Admins can control global notification behavior:
- **Enable Timetable Notifications**: Master switch for timetable-based notifications
- **Enable Access Request Notifications**: Control access request notifications
- **Timetable Check Interval**: How often to check for changes (5-1440 minutes)

### User Manager Features
User managers automatically receive:
- New access request notifications
- Can configure notification preferences like regular users

## Technical Implementation

### Frontend Components
- `NotificationBell`: Header bell icon with badge
- `NotificationPanel`: Slide-out notification management
- `SettingsModal`: Extended with notification preferences
- Utility functions for permission handling

### Backend Services
- `NotificationService`: Background service for checking changes
- API routes for CRUD operations (`/api/notifications`)
- Admin settings for system configuration
- Automatic triggers for access requests

### PWA Integration
- Enhanced service worker with push notification support
- Offline notification caching
- Click-to-open app functionality

## Database Schema

### Core Tables
- `Notification`: Individual notification records
- `NotificationSettings`: User preferences
- `NotificationSubscription`: Push notification endpoints
- `AdminNotificationSettings`: System-wide configuration

## API Endpoints

### User Endpoints
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notifications/settings` - Get user settings
- `PUT /api/notifications/settings` - Update user settings

### Admin Endpoints
- `GET /api/admin/notification-settings` - Get admin settings
- `PUT /api/admin/notification-settings` - Update admin settings

## Browser Compatibility

### Supported Browsers
- Chrome 42+
- Firefox 44+
- Safari 7+
- Edge 17+

### PWA Features
- Service worker push notifications
- Offline notification display
- Background sync (when implemented)

## Privacy & Security

### Data Handling
- Notifications expire automatically
- User preferences stored securely
- Push subscriptions encrypted
- No sensitive data in notification content

### Permissions
- Graceful degradation when permission denied
- Clear permission request flow
- User can revoke permissions anytime

## Troubleshooting

### Common Issues
1. **Notifications not appearing**: Check browser permissions in site settings
2. **Permission denied**: Guide user to browser settings to manually enable
3. **Notifications not updating**: Check if background service is running
4. **Push notifications not working**: 
   - Verify VAPID keys are configured correctly
   - Ensure service worker is active in DevTools
   - Check that app is installed as PWA on iOS devices
   - Verify HTTPS is being used (required for push notifications)
5. **iOS push notifications not working**:
   - Ensure iOS 16.4+ is being used
   - App must be added to Home Screen (installed as PWA)
   - Grant notification permission when prompted
   - Check that app is running in standalone mode

### Debug Information
- Check browser console for notification service logs
- Verify service worker is active in DevTools
- Check notification settings in user preferences

## Future Enhancements

### Planned Features
- ~~Push notification server (VAPID keys)~~ ✅ **Implemented**
- Email notification fallback
- Notification scheduling
- Rich notification content with images
- Sound customization
- Notification history with search

### Integration Possibilities
- Calendar app integration
- Mobile app notifications
- SMS fallback for critical alerts
- Integration with school notification systems