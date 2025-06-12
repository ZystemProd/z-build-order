# Security Guidance

This document provides an overview of recommended practices for securing the Z-Build Order website and backend services.

## Recommended Actions

- **Enable HTTPS**: Ensure the site is served over HTTPS to protect traffic from interception and tampering.
- **Keep Dependencies Updated**: Regularly run `npm audit` and `npm update` to address known vulnerabilities. A recent audit revealed a low severity issue with `brace-expansion`; run `npm audit fix` to resolve it.
- **Content Security Policy (CSP)**: A basic CSP has been added in `index.html` to restrict resources to the same origin. Adjust this policy as needed for additional third-party resources.
- **Sanitize User Input**: Continue using libraries like DOMPurify in the client and validate data on the server to prevent XSS and injection attacks.
- **HTTP Security Headers**: Consider using middleware such as `helmet` in the Flask or Node environment to set headers like `Strict-Transport-Security`, `X-Frame-Options`, and `X-Content-Type-Options`.
- **Authentication and Authorization**: Use strong authentication (e.g., Firebase Auth) and implement role-based access controls in Firestore and storage rules.
- **Regular Backups and Monitoring**: Maintain backups of important data and monitor logs for suspicious activity.

For additional security topics, see [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/).
