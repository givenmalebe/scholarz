# PayPal Credentials Setup & Deployment Instructions

## ✅ Credentials Configuration

PayPal credentials have been configured in two ways:

### 1. Firebase Functions Config (For Deployed Functions)
```bash
npx firebase functions:config:set paypal.client_id="YOUR_CLIENT_ID" paypal.client_secret="YOUR_CLIENT_SECRET" paypal.env="sandbox"
```

**Status:** ✅ Already configured

### 2. Local .env File (For Emulator/Local Development)
Location: `functions/.env`

**Status:** ✅ Already created

## 🚀 Deployment Steps

### Option 1: Deploy Only Functions
```bash
cd /Users/given/Downloads/edulinker-frontend
npx firebase deploy --only functions
```

### Option 2: Deploy Everything (Functions + Hosting)
```bash
cd /Users/given/Downloads/edulinker-frontend
npx firebase deploy
```

### Option 3: Deploy Specific Function
```bash
npx firebase deploy --only functions:initiatePaypalPayment
```

## 🧪 Local Testing (Emulator)

### Start Functions Emulator
```bash
cd functions
npm run serve
```

The emulator will:
- Load credentials from `functions/.env`
- Use Firebase Functions config as fallback
- Show logs indicating which credentials were loaded

### Verify Credentials Are Loaded
Look for these messages in the emulator logs:
```
✓ Loaded environment variables from /path/to/.env
✓ PayPal configured for sandbox environment
✓ PayPal Client ID: Ac3aS3QwXT...
```

## 🔍 Troubleshooting

### If you still get "PayPal credentials not configured" error:

1. **Check if .env file exists:**
   ```bash
   ls -la functions/.env
   ```

2. **Verify Firebase config:**
   ```bash
   npx firebase functions:config:get
   ```

3. **Check emulator logs:**
   - Look for credential loading messages
   - Check for any error messages about missing credentials

4. **Restart emulator:**
   - Stop the emulator (Ctrl+C)
   - Rebuild: `cd functions && npm run build`
   - Restart: `npm run serve`

5. **For deployed functions:**
   - Make sure you've run: `npx firebase functions:config:set ...`
   - Redeploy: `npx firebase deploy --only functions`

## 📝 Notes

- The code checks credentials in this order:
  1. `process.env.PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`
  2. `process.env.VITE_PAYPAL_CLIENT_ID` / `VITE_PAYPAL_CLIENT_SECRET`
  3. `functions.config().paypal.client_id` / `client_secret`

- For local development, use the `.env` file
- For deployed functions, use Firebase Functions config
- Both are now configured and should work!

