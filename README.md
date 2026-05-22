# Missed Calls Dental

Public repository for the Missed Calls Dental MVP website and product documentation.

## Repository map

```text
sms-dental/
  docs/            Public website published by GitHub Pages
  MVP_BUILD_DOCS/  Product, architecture, compliance and build specs
  config/          Local/runtime config examples
  mcp/             MCP configuration examples
  app/             Future SaaS app placeholder
```

## GitHub Pages setup

Use:

```text
Settings → Pages
Source: Deploy from a branch
Branch: main
Folder: /docs
Custom domain: missedcallsdental.com
```

Website domain: https://missedcallsdental.com/
Support: support@missedcallsdental.com

## Security rule

This repository is public. Do not commit real secrets.

Never commit:

```text
.env
.env.local
Twilio Auth Token
Stripe secret keys
Supabase service role key
private passwords or API keys
```

Use `.env.local.example` for placeholders only.
