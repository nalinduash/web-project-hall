# Security hardening summary

This branch focuses on reducing common OWASP risk areas in the application.

## Changes made
- Restricted CORS to trusted origins and enabled secure HTTP headers.
- Applied rate limiting and payload size limits to API routes.
- Hardened authentication logic with normalized email validation and stronger password requirements.
- Enforced stricter upload validation for project thumbnails.
- Removed browser-side token persistence from frontend callback handling.
- Upgraded the dependency tree to patched versions and removed known audit issues.

## Notes
- Production deployment should still move secrets to environment-specific secret management.
- Use a real TLS termination layer and strict secret rotation policies in deployment.
