# Deployment Guide

## Deploy to Vercel

1. Install Vercel CLI (if not already installed):

```bash
npm install -g vercel
```

2. Login to Vercel:

```bash
vercel login
```

3. Deploy:

```bash
vercel
```

## Environment Variables to Set in Vercel

After deployment, add these environment variables in Vercel dashboard:

1. Go to your project settings → Environment Variables
2. Add each of these:

```
WA_VERIFY_TOKEN=bitsoclock_webhook
WA_PHONE_NUMBER_ID=947902128414713
WA_ACCESS_TOKEN=your_whatsapp_token
RESTAURANT_WA_TO=12405647628
SUPABASE_URL=https://efaffrwhzxgagukqbaut.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ADMIN_TOKEN=your_admin_token
ADMIN_JWT_SECRET=your_jwt_secret
```

3. Redeploy after adding environment variables

## URLs after deployment

- Admin Panel: https://your-app.vercel.app/admin/login.html
- Order API: https://your-app.vercel.app/api/order
- Webhook: https://your-app.vercel.app/api/webhook
