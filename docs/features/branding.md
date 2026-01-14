# SuperBackend Branding

## Overview
SuperBackend provides comprehensive backend middleware for Node.js applications with complete branding consistency across all user interfaces and communications.

## Branding Implementation

### Package Information
- **Package Name**: `@intranefr/superbackend`
- **Display Name**: SuperBackend
- **Version**: 1.4.3

### User Interface Branding

#### Admin Panel
All admin interface pages display "SuperBackend" branding:
- Page titles: `SuperBackend - [Feature Name]`
- Header branding: `SuperBackend (@intranefr/superbackend)`
- Framework references: `SuperBackend Framework`

#### Code Examples
Admin code snippets use the updated package name:
```javascript
const superbackend = require('@intranefr/superbackend');
const { serviceName } = superbackend.services;
```

### Communication Branding

#### Email System
Default email from address:
```
SuperBackend <no-reply@resend.dev>
```

#### Webhook User Agent
Webhook requests identify as:
```
SuperBackend-Webhook/1.0
```

### Error Tracking SDK
Browser SDK package:
```
@intranefr/superbackend-error-tracking-browser
```

Global variable attachment:
```javascript
window.superbackend = window.superbackend || {};
window.superbackend.errorTracking = createErrorTrackingClient();
```

## Configuration References

### Environment Variables
Key environment variables reference SuperBackend:
- `FRONTEND_URL` example: `https://app.superbackend.com`
- `EMAIL_FROM` example: `SuperBackend <no-reply@yourdomain.com>`

### Documentation
All inline documentation, comments, and JSDoc use "SuperBackend" naming.

## Implementation Details

### Files Updated
- **View Templates**: 13 EJS files with page titles and branding
- **Service Layer**: 4 files with email and webhook branding
- **Controllers**: 1 file with updated comments
- **Tests**: Updated string expectations to match new branding

### Backward Compatibility
- All API endpoints remain unchanged
- No breaking changes to functionality
- Cosmetic updates only
- Existing integrations continue to work

## Validation

### Branding Consistency
- ✅ All admin pages show SuperBackend branding
- ✅ Code examples use correct package name
- ✅ Email communications use SuperBackend from address
- ✅ Webhook user agent identifies as SuperBackend
- ✅ Error tracking SDK uses correct global namespace

### Functional Integrity
- ✅ No API changes introduced
- ✅ All existing features preserved
- ✅ Test suite passes with updated expectations
- ✅ No breaking changes for users

## Usage Examples

### Basic Integration
```javascript
const { middleware } = require('@intranefr/superbackend');

app.use('/api', middleware({
  mongodbUri: process.env.MONGODB_URI,
  corsOrigin: process.env.CORS_ORIGIN
}));
```

### Service Access
```javascript
const superbackend = require('@intranefr/superbackend');

// Access services
const assets = await superbackend.services.assets.getAssetById(id);
const settings = await superbackend.services.globalSettings.getSettingValue('key');
```

### Error Tracking
```html
<!-- Browser SDK -->
<script src="/api/error-tracking/browser-sdk"></script>

<script>
superbackend.errorTracking.config({
  headers: { authorization: "Bearer TOKEN" }
});
</script>
```

## Migration Notes
This branding update is cosmetic only and does not require migration steps for existing implementations. All functionality remains identical with updated visual branding.
