# Forms & Leads System

## Overview
The Forms feature provides a robust backend for capturing, managing, and integrating leads from any platform (Webflow, Framer, static HTML, or custom JS apps). It supports multi-tenancy, custom form definitions, and various integration patterns.

## Key Features
- **Custom Form Definitions**: Create and manage form schemas via Admin UI.
- **Lead Capture**: Store submissions with automatic IP, User-Agent, and Referer tracking.
- **Multi-tenancy**: Map forms to specific Organizations via `organizationId`.
- **Webhooks**: 
  - **Generic**: Global `form.submitted` events emitted via `WebhookService`.
  - **Legacy**: Per-form dedicated Webhook URLs.
- **Email Notifications**: Instant alerts when a new lead is captured.
- **Admin Dashboard**: View, filter, and delete submissions.

## Integration Patterns

### 1. Zero-JS Refresh-less (IFrame)
Best for static sites (Webflow/Framer) where you want a submission without a page refresh but don't want to write JavaScript.
```html
<iframe name="hidden_iframe" id="hidden_iframe" style="display:none;" onload="if(this.contentWindow.name=='submitted'){alert('Form Submitted!');}"></iframe>

<form action="/api/forms/submit/YOUR_FORM_ID" method="POST" target="hidden_iframe">
  <!-- fields -->
</form>
```

### 2. Standard AJAX (Fetch)
Best for modern React/Vue/Svelte apps.
```javascript
fetch('/api/forms/submit/YOUR_FORM_ID', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', message: 'Hello' })
});
```

### 3. Styled HTML (Tailwind CSS)
A production-ready snippet provided in the Admin UI with built-in Tailwind classes.

## API Reference

### Public Endpoints
- `POST /api/forms/submit/:formId`
  - Accepts JSON or URL-encoded form data.
  - Returns `201 Created` or `302 Redirect` if `successUrl` is configured.

### Admin Endpoints (Basic Auth)
- `GET /api/admin/forms` - List all submissions (paginated).
- `DELETE /api/admin/forms/:id` - Permanently delete a lead.
- `GET /api/admin/forms/definitions` - List form configurations.
- `POST /api/admin/forms/definitions` - Create/Update form configuration.
- `DELETE /api/admin/forms/definitions/:id` - Delete form configuration.

## Storage
- **Definitions**: Stored in `JsonConfig` model with slug `form-definitions`.
- **Submissions**: Stored in `FormSubmission` model.
