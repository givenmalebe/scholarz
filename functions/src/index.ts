import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from env/.env
// __dirname in compiled JS will be functions/lib, so we need to go up two levels
// Try multiple possible paths in order of preference
const possiblePaths = [
  path.join(process.cwd(), 'env', '.env'), // From project root -> env/.env (highest priority)
  path.join(__dirname, '..', '..', 'env', '.env'), // From functions/lib -> env/.env
  path.join(__dirname, '..', '.env'), // From functions/lib -> functions/.env
  path.join(process.cwd(), 'functions', '.env'), // From project root -> functions/.env
  path.join(process.cwd(), '..', 'env', '.env'), // One level up from cwd
];

let envLoaded = false;
let loadedPath = '';
for (const envPath of possiblePaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      loadedPath = envPath;
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  // Fallback to default .env location (current directory)
  const result = dotenv.config();
  if (result.error) {
    console.warn('Failed to load .env file:', result.error);
  }
}

// Log what was loaded (for debugging, but don't expose secrets)
if (envLoaded && loadedPath) {
  console.log(`✓ Loaded environment variables from ${loadedPath}`);
} else {
  console.warn('⚠ No .env file found in expected locations');
}

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// Function to get PayPal credentials dynamically (called each time to ensure fresh values)
const getPaypalCredentials = () => {
  // Try to reload .env file in case it wasn't loaded at module init
  if (!process.env.PAYPAL_CLIENT_ID && !process.env.VITE_PAYPAL_CLIENT_ID) {
    // Try loading .env again
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: false });
    }
  }

  const clientId =
    process.env.PAYPAL_CLIENT_ID ||
    process.env.VITE_PAYPAL_CLIENT_ID ||
    functions.config().paypal?.client_id ||
    '';
  
  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET ||
    process.env.VITE_PAYPAL_CLIENT_SECRET ||
    functions.config().paypal?.client_secret ||
    '';
  
  const env = (process.env.PAYPAL_ENV || process.env.VITE_PAYPAL_ENV || functions.config().paypal?.env || 'sandbox').toLowerCase();
  
  return {
    clientId,
    clientSecret,
    env,
    apiBase: env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  };
};


// Cache credentials for logging (but always get fresh ones when needed)
const cachedCreds = getPaypalCredentials();
if (!cachedCreds.clientId || !cachedCreds.clientSecret) {
  console.error('❌ PayPal credentials not configured at module load!');
  console.error(`PAYPAL_CLIENT_ID: ${cachedCreds.clientId ? 'SET' : 'NOT SET'}`);
  console.error(`PAYPAL_CLIENT_SECRET: ${cachedCreds.clientSecret ? 'SET' : 'NOT SET'}`);
  console.error(`VITE_PAYPAL_CLIENT_ID: ${process.env.VITE_PAYPAL_CLIENT_ID ? 'SET (' + process.env.VITE_PAYPAL_CLIENT_ID.substring(0, 10) + '...)' : 'NOT SET'}`);
  console.error(`VITE_PAYPAL_CLIENT_SECRET: ${process.env.VITE_PAYPAL_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);
  console.error(`PAYPAL_CLIENT_ID (direct): ${process.env.PAYPAL_CLIENT_ID ? 'SET' : 'NOT SET'}`);
  console.error(`PAYPAL_CLIENT_SECRET (direct): ${process.env.PAYPAL_CLIENT_SECRET ? 'SET' : 'NOT SET'}`);
  console.error(`Current working directory: ${process.cwd()}`);
  console.error(`__dirname: ${__dirname}`);
  console.error(`All env vars starting with PAYPAL:`, Object.keys(process.env).filter(k => k.includes('PAYPAL')));
  functions.logger.error('PayPal credentials not configured. Check environment variables and .env file.');
} else {
  console.log(`✓ PayPal configured for ${cachedCreds.env} environment`);
  console.log(`✓ PayPal Client ID: ${cachedCreds.clientId.substring(0, 10)}...`);
  functions.logger.info(`PayPal configured for ${cachedCreds.env} environment`);
}

// Configure email transporter
// For production, use environment variables or a service like SendGrid
const createTransporter = () => {
  // Check if email credentials are configured
  const emailUser = functions.config().email?.user || process.env.EMAIL_USER;
  const emailPass = functions.config().email?.password || process.env.EMAIL_PASSWORD;
  const emailHost = functions.config().email?.host || process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = functions.config().email?.port || process.env.EMAIL_PORT || 587;

  if (!emailUser || !emailPass) {
    console.warn('Email credentials not configured. Email notifications will be skipped.');
    return null;
  }

  return nodemailer.createTransport({
    host: emailHost,
    port: parseInt(emailPort.toString()),
    secure: false, // true for 465, false for other ports
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

// Helper function to format email HTML
const formatEmailHTML = (notification: any, userName: string): string => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'engagement': return '📋';
      case 'message': return '💬';
      case 'payment': return '💰';
      case 'rating': return '⭐';
      case 'document': return '📄';
      case 'system': return '🔔';
      case 'rejection': return '❌';
      case 'verification': return '✅';
      default: return '🔔';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'engagement': return '#6366f1';
      case 'message': return '#3b82f6';
      case 'payment': return '#10b981';
      case 'rating': return '#f59e0b';
      case 'document': return '#8b5cf6';
      case 'system': return '#6b7280';
      case 'rejection': return '#ef4444';
      case 'verification': return '#10b981';
      default: return '#6b7280';
    }
  };

  const typeColor = getTypeColor(notification.type);
  const typeIcon = getTypeIcon(notification.type);
  const dashboardUrl = notification.link 
    ? `https://link-my-skills.web.app${notification.link}` 
    : 'https://link-my-skills.web.app';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${notification.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 30px 20px; background: linear-gradient(135deg, ${typeColor} 0%, ${typeColor}dd 100%); border-radius: 8px 8px 0 0;">
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                      <span style="font-size: 32px;">${typeIcon}</span>
                      <span>Scholarz</span>
                    </h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                    Hello ${userName},
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid ${typeColor}; padding: 20px; margin: 20px 0; border-radius: 4px;">
                <h2 style="margin: 0 0 10px; color: #111827; font-size: 20px; font-weight: 600;">
                  ${notification.title}
                </h2>
                <p style="margin: 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                  ${notification.message}
                </p>
              </div>
              
              ${notification.link ? `
              <table role="presentation" style="width: 100%; margin: 30px 0; border-collapse: collapse;">
                <tr>
                  <td align="center">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: ${typeColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      View Details
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                This is an automated notification from Scholarz. You can manage your notification preferences in your dashboard settings.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center; line-height: 1.6;">
                © ${new Date().getFullYear()} Scholarz. All rights reserved.<br>
                <a href="https://link-my-skills.web.app" style="color: ${typeColor}; text-decoration: none;">Visit Dashboard</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const ensurePaypalConfigured = (creds: { clientId: string; clientSecret: string }) => {
  if (!creds.clientId || !creds.clientSecret) {
    // Try one more time to load from .env
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override: true });
      const retryCreds = getPaypalCredentials();
      if (retryCreds.clientId && retryCreds.clientSecret) {
        return retryCreds;
      }
    }
    
    functions.logger.error('PayPal credentials check failed', {
      hasClientId: !!creds.clientId,
      hasClientSecret: !!creds.clientSecret,
      envPath,
      envExists: fs.existsSync(envPath),
      allPaypalVars: Object.keys(process.env).filter(k => k.includes('PAYPAL'))
    });
    
    throw new functions.https.HttpsError(
      'failed-precondition',
      'PayPal credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env file or Firebase config.'
    );
  }
  return creds;
};

const getPaypalAccessToken = async (): Promise<string> => {
  const creds = getPaypalCredentials();
  ensurePaypalConfigured(creds);
  const authHeader = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
  const response = await fetch(`${creds.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PayPal token error: ${errorText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
};

// Helper function to convert ZAR to USD for sandbox testing
// Using manual mapping for common amounts to ensure accuracy
// Exchange rate: 1 USD = 18 ZAR
const convertZarToUsd = (zarAmount: number): number => {
  // Validate input
  if (isNaN(zarAmount) || !isFinite(zarAmount) || zarAmount < 0) {
    functions.logger.error('Invalid ZAR amount for conversion', { zarAmount });
    throw new Error(`Invalid ZAR amount: ${zarAmount}`);
  }
  
  // Manual mapping for common plan amounts (using 18:1 exchange rate)
  // This ensures exact conversion without rounding errors
  const manualMapping: Record<number, number> = {
    0: 0,
    99: 5.50,    // R99 / 18 = $5.50
    149: 8.28,   // R149 / 18 = $8.28
    999: 55.50,  // R999 / 18 = $55.50
    2499: 138.83 // R2499 / 18 = $138.83
  };
  
  // Use manual mapping if available, otherwise calculate
  let usdAmount: number;
  if (manualMapping[zarAmount] !== undefined) {
    usdAmount = manualMapping[zarAmount];
    functions.logger.info('Using manual ZAR to USD mapping', {
      zarAmount,
      usdAmount,
      source: 'manual_mapping'
    });
  } else {
    // Fallback to calculation if amount not in mapping
    const exchangeRate = 18;
    usdAmount = zarAmount / exchangeRate;
    // Round to 2 decimal places
    usdAmount = Math.round(usdAmount * 100) / 100;
    functions.logger.info('Calculated ZAR to USD conversion', {
      zarAmount,
      exchangeRate,
      usdAmount,
      source: 'calculated'
    });
  }
  
  // Ensure minimum $0.01 for PayPal
  return usdAmount < 0.01 ? 0.01 : usdAmount;
};

// Create or get PayPal plan dynamically
const createOrGetPaypalPlan = async (payload: PaypalInitRequest): Promise<string> => {
  const creds = getPaypalCredentials();
  ensurePaypalConfigured(creds);
  const accessToken = await getPaypalAccessToken();
  
  // Map our plan IDs to PayPal plan structure
  const isTrial = payload.billingType === 'trial';
  const isAnnual = payload.planId.includes('annual');
  
  // Use USD for sandbox (PayPal sandbox doesn't support ZAR), ZAR for production
  // Always override ZAR with USD in sandbox mode, even if frontend sends ZAR
  const requestedCurrency = payload.currency || 'ZAR';
  // Check both env string and API base URL to determine sandbox mode
  const isSandbox = creds.env === 'sandbox' || creds.apiBase.includes('sandbox');
  // Force USD for sandbox if ZAR is requested or not specified
  const currency = (isSandbox && (requestedCurrency === 'ZAR' || !requestedCurrency || requestedCurrency === '')) ? 'USD' : requestedCurrency;
  
  // Convert amount to USD if in sandbox mode and we're using USD
  let amount: number;
  if (isSandbox && currency === 'USD') {
    functions.logger.info('Converting ZAR to USD', {
      originalZarAmount: payload.amount,
      exchangeRate: '18 (manual mapping for common amounts)'
    });
    amount = convertZarToUsd(payload.amount);
    functions.logger.info('Conversion result', {
      zarAmount: payload.amount,
      usdAmount: amount,
      calculation: `${payload.amount} / 18 = ${amount} (using manual mapping)`
    });
  } else {
    amount = payload.amount;
  }
  
  // Ensure minimum amount for PayPal (minimum $0.01 USD or equivalent)
  // For free trials, amount can be 0, but for regular plans, ensure minimum
  if (!isTrial && amount < 0.01) {
    functions.logger.warn('Amount too small, setting to minimum', { 
      original: payload.amount, 
      converted: amount,
      adjusted: 0.01
    });
    amount = 0.01; // PayPal minimum
  }
  
  // Validate amount is a valid number
  if (isNaN(amount) || !isFinite(amount)) {
    functions.logger.error('Invalid amount after conversion', {
      original: payload.amount,
      converted: amount,
      isSandbox,
      currency
    });
    throw new Error(`Invalid amount: ${payload.amount} (converted to ${amount})`);
  }
  
  // Helper function to format amounts (defined here so it's available everywhere in this function)
  const formatAmount = (amt: number) => {
    const formatted = amt.toFixed(2);
    // Ensure it's at least 0.01 for non-zero amounts
    if (amt > 0 && parseFloat(formatted) < 0.01) {
      return '0.01';
    }
    return formatted;
  };
  
  // Log currency conversion for debugging
  functions.logger.info('PayPal currency conversion summary', {
    requestedCurrency,
    environment: creds.env,
    isSandbox,
    finalCurrency: currency,
    originalAmount: payload.amount,
    convertedAmount: amount,
    formattedAmount: formatAmount(amount),
    isTrial,
    planId: payload.planId
  });
  
  // For trials, we need a plan with trial period that charges 0 for 30 days, then the regular amount
  // For regular subscriptions, create a plan with the billing cycle
  
  // Include currency and amount in plan name to ensure we don't reuse plans with wrong amount
  // Also include original ZAR amount to make it unique
  // Limit plan name to 127 characters (PayPal limit)
  const amountStr = formatAmount(amount);
  const planNameBase = `Scholarz ${payload.role.toUpperCase()} ${payload.planId.replace(`${payload.role}-`, '').replace('-', ' ')} ${currency} ${amountStr} (ZAR${payload.amount})`;
  const planName = planNameBase.length > 127 ? planNameBase.substring(0, 124) + '...' : planNameBase;
  const planDescription = (payload.metadata?.planLabel || planName).substring(0, 127);
  
  functions.logger.info('Plan name generated', {
    planName,
    originalZarAmount: payload.amount,
    convertedUsdAmount: amount,
    formattedAmount: amountStr,
    currency
  });
  
  // Create or get product first (PayPal requires a product for plans)
  let productId: string | undefined;
  const productName = `Scholarz ${payload.role.toUpperCase()} Plans`;
  
  try {
    // Try to find existing product first
    const searchResponse = await fetch(`${creds.apiBase}/v1/catalogs/products?page_size=20`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    if (searchResponse.ok) {
      const searchData: any = await searchResponse.json();
      const existingProduct = searchData.products?.find((p: any) => 
        p.name === productName || p.name?.includes('Scholarz')
      );
      if (existingProduct) {
        productId = existingProduct.id;
        functions.logger.info(`Using existing product: ${productId}`);
      }
    }
    
    // If no existing product, create one
    if (!productId) {
      const productResponse = await fetch(`${creds.apiBase}/v1/catalogs/products`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          name: productName,
          description: `Subscription plans for ${payload.role.toUpperCase()} users on Scholarz platform`,
          type: 'SERVICE',
          category: 'SOFTWARE'
        })
      });
      
      if (productResponse.ok) {
        const productData: any = await productResponse.json();
        productId = productData.id;
        functions.logger.info(`Created new product: ${productId}`);
      } else {
        const errorData: any = await productResponse.json();
        throw new Error(`Failed to create product: ${errorData.message || 'Unknown error'}`);
      }
    }
    
    if (!productId) {
      throw new Error('Failed to create or retrieve PayPal product');
    }
  } catch (error: any) {
    functions.logger.error('Product creation/retrieval failed', error);
    throw new Error(`Failed to set up PayPal product: ${error.message || error}`);
  }

  // Create plan payload - PayPal requires specific structure
  // Reference: https://developer.paypal.com/docs/api/subscriptions/v1/
  const planPayload: any = {
    product_id: productId!,
    name: planName,
    description: planDescription,
    status: 'ACTIVE',
    billing_cycles: [],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee: {
        value: '0.00',
        currency_code: currency
      },
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    }
  };

  if (isTrial) {
    // Trial plan: 30 days free, then charge the regular amount
    // For free trials, we still need to set up billing for after trial ends
    // Use the actual plan amount from the payload (which represents the post-trial amount)
    // The frontend should send the post-trial amount in the payload.amount field
    let postTrialAmount: number;
    if (payload.metadata?.postTrialAmount) {
      // If explicitly provided in metadata, use that
      postTrialAmount = payload.metadata.postTrialAmount;
    } else {
      // Otherwise, use the amount from payload (which should be the post-trial amount for trials)
      // For free trials, payload.amount should be 0, so we need to determine the post-trial amount
      // based on the plan ID (monthly vs annual)
      if (payload.amount === 0) {
        // Free trial - determine post-trial amount from plan ID
        if (isAnnual) {
          postTrialAmount = payload.role === 'sdp' ? 2499 : 999;
        } else {
          // Monthly plan
          postTrialAmount = payload.role === 'sdp' ? 149 : 99;
        }
      } else {
        // If amount is provided, use it as the post-trial amount
        postTrialAmount = payload.amount;
      }
    }
    
    // Convert to USD if in sandbox mode (always convert if using USD)
    if (isSandbox && currency === 'USD') {
      postTrialAmount = convertZarToUsd(postTrialAmount);
    }
    
    // Ensure minimum amount for post-trial (PayPal minimum $0.01)
    if (postTrialAmount < 0.01) {
      postTrialAmount = 0.01;
      functions.logger.warn('Post-trial amount too small, setting to minimum', { adjusted: postTrialAmount });
    }
    
    // Validate post-trial amount
    if (isNaN(postTrialAmount) || !isFinite(postTrialAmount)) {
      throw new Error(`Invalid post-trial amount: ${postTrialAmount}`);
    }
    
    // Format amounts with 2 decimal places for PayPal
    const formatAmount = (amt: number) => {
      const formatted = amt.toFixed(2);
      // Ensure it's at least 0.01 for non-zero amounts
      if (amt > 0 && parseFloat(formatted) < 0.01) {
        return '0.01';
      }
      return formatted;
    };
    
    // PayPal requires trial periods to use WEEK or MONTH, not DAY
    // For 30 days, we'll use 1 month (which is approximately 30 days)
    planPayload.billing_cycles = [
      {
        frequency: {
          interval_unit: 'MONTH',
          interval_count: 1
        },
        tenure_type: 'TRIAL',
        sequence: 1,
        total_cycles: 1,
        pricing_scheme: {
          fixed_price: {
            value: '0.00',
            currency_code: currency
          }
        }
      },
      {
        frequency: {
          interval_unit: isAnnual ? 'YEAR' : 'MONTH',
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 2,
        total_cycles: 0, // 0 means infinite
        pricing_scheme: {
          fixed_price: {
            value: formatAmount(postTrialAmount),
            currency_code: currency
          }
        }
      }
    ];
  } else {
    // Regular subscription plan (not trial)
    // Use the amount from payload (already converted if needed)
    // Format amount with 2 decimal places for PayPal
    const formatAmount = (amt: number) => {
      const formatted = amt.toFixed(2);
      return formatted;
    };
    
    // Log the amount being used for the subscription - CRITICAL for debugging
    functions.logger.info('Creating regular subscription plan', {
      originalAmount: payload.amount,
      convertedAmount: amount,
      formattedAmount: formatAmount(amount),
      currency,
      planId: payload.planId,
      role: payload.role,
      isSandbox,
      exchangeRate: isSandbox && currency === 'USD' ? 18 : 'N/A'
    });
    
    // Validate amount before creating plan
    if (amount <= 0) {
      throw new Error(`Invalid subscription amount: ${amount} (original: ${payload.amount})`);
    }
    
    const formattedAmount = formatAmount(amount);
    functions.logger.info('Plan billing cycle amount', {
      numericAmount: amount,
      formattedAmount,
      willBeSentToPayPal: formattedAmount
    });
    
    planPayload.billing_cycles = [
      {
        frequency: {
          interval_unit: isAnnual ? 'YEAR' : 'MONTH',
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0, // 0 means infinite
        pricing_scheme: {
          fixed_price: {
            value: formattedAmount,
            currency_code: currency
          }
        }
      }
    ];
  }

  // Create the plan
  functions.logger.info('Creating PayPal plan', {
    planName,
    productId,
    billingCyclesCount: planPayload.billing_cycles.length,
    isTrial,
    billingCycles: planPayload.billing_cycles.map((cycle: any) => ({
      sequence: cycle.sequence,
      tenure_type: cycle.tenure_type,
      amount: cycle.pricing_scheme?.fixed_price?.value,
      currency: cycle.pricing_scheme?.fixed_price?.currency_code,
      frequency: cycle.frequency
    })),
    originalPayloadAmount: payload.amount,
    convertedAmount: amount,
    currency
  });
  functions.logger.debug('PayPal plan payload:', JSON.stringify(planPayload, null, 2));
  
  // ALWAYS search for existing plans FIRST to check if one with wrong amount exists
  // This prevents reusing old plans with incorrect amounts
  functions.logger.info('Searching for existing plans before creation', {
    planName,
    originalZarAmount: payload.amount,
    convertedUsdAmount: amount,
    currency
  });
  
  const searchResponse = await fetch(`${creds.apiBase}/v1/billing/plans?product_id=${productId}&page_size=50`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  
  let shouldCreateNewPlan = true;
  let existingPlanId: string | null = null;
  
  if (searchResponse.ok) {
    const searchData: any = await searchResponse.json();
    const allPlans = searchData.plans || [];
    
    functions.logger.info('Searching through all plans', {
      totalPlans: allPlans.length,
      requestedPlanName: planName,
      originalZarAmount: payload.amount,
      expectedUsdAmount: formatAmount(amount),
      currency
    });
    
    // Find plan by exact name match (which includes currency and amount)
    const existingPlan = allPlans.find((p: any) => p.name === planName);
    
    if (existingPlan) {
      // Verify the plan has the correct currency AND amount
      const planCurrency = existingPlan.billing_cycles?.[0]?.pricing_scheme?.fixed_price?.currency_code ||
                          existingPlan.payment_preferences?.setup_fee?.currency_code;
      const planAmount = isTrial 
        ? (existingPlan.billing_cycles?.[1]?.pricing_scheme?.fixed_price?.value || '0.00')
        : (existingPlan.billing_cycles?.[0]?.pricing_scheme?.fixed_price?.value || '0.00');
      
      // Calculate expected amount based on plan type
      let expectedAmount: string;
      if (isTrial) {
        expectedAmount = planAmount; // Will be validated later
      } else {
        expectedAmount = formatAmount(amount);
      }
      
      functions.logger.info('Found existing plan with matching name', {
        planId: existingPlan.id,
        planName: existingPlan.name,
        planCurrency,
        planAmount,
        expectedCurrency: currency,
        expectedAmount: !isTrial ? expectedAmount : 'N/A (trial)',
        originalZarAmount: payload.amount,
        convertedUsdAmount: amount
      });
      
      // CRITICAL: Only reuse if currency AND amount match exactly
      if (planCurrency === currency) {
        if (!isTrial) {
          const planAmountNum = parseFloat(planAmount);
          const expectedAmountNum = parseFloat(expectedAmount);
          const amountDiff = Math.abs(planAmountNum - expectedAmountNum);
          
          if (amountDiff < 0.01) { // Allow tiny rounding differences
            functions.logger.info(`Reusing existing plan with correct amount: ${existingPlan.id} (${planCurrency}, ${planAmount})`);
            shouldCreateNewPlan = false;
            existingPlanId = existingPlan.id;
          } else {
            functions.logger.error(`EXISTING PLAN HAS WRONG AMOUNT! Creating new plan.`, {
              existingPlanId: existingPlan.id,
              existingPlanName: existingPlan.name,
              existingAmount: planAmount,
              expectedAmount: expectedAmount,
              difference: amountDiff,
              originalZarAmount: payload.amount,
              convertedUsdAmount: amount
            });
            // Force new plan creation with unique name - NEVER reuse wrong amount
            const timestamp = Date.now();
            planPayload.name = `${planName.substring(0, 90)} ${timestamp}`.substring(0, 127);
            shouldCreateNewPlan = true;
            existingPlanId = null;
          }
        } else {
          // For trials, just check currency
          functions.logger.info(`Reusing existing trial plan: ${existingPlan.id} (${planCurrency})`);
          shouldCreateNewPlan = false;
          existingPlanId = existingPlan.id;
        }
      } else {
        functions.logger.warn(`Existing plan has wrong currency (${planCurrency} vs ${currency}), will create new plan`);
        // Force new plan creation with unique name
        const timestamp = Date.now();
        planPayload.name = `${planName.substring(0, 90)} ${timestamp}`.substring(0, 127);
        shouldCreateNewPlan = true;
        existingPlanId = null;
      }
    } else {
      // Log all plans to help debug
      functions.logger.info('No existing plan found with matching name, will create new plan', {
        requestedPlanName: planName,
        totalPlansFound: allPlans.length,
        samplePlans: allPlans.slice(0, 5).map((p: any) => ({
          id: p.id,
          name: p.name,
          amount: p.billing_cycles?.[0]?.pricing_scheme?.fixed_price?.value || 'N/A',
          currency: p.billing_cycles?.[0]?.pricing_scheme?.fixed_price?.currency_code || 'N/A'
        }))
      });
    }
  } else {
    functions.logger.warn('Failed to search for existing plans, will create new plan', {
      status: searchResponse.status
    });
  }
  
  // If we found a valid existing plan, return it
  if (!shouldCreateNewPlan && existingPlanId) {
    return existingPlanId;
  }
  
  // Otherwise, create a new plan
  functions.logger.info('Creating new PayPal plan', {
    planName: planPayload.name,
    amount,
    currency,
    originalZarAmount: payload.amount
  });
  
  const planResponse = await fetch(`${creds.apiBase}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(planPayload)
  });

  const planResult: any = await planResponse.json();
  
  if (!planResponse.ok) {
    functions.logger.error('PayPal plan creation failed', {
      status: planResponse.status,
      statusText: planResponse.statusText,
      error: planResult,
      requestPayload: JSON.stringify(planPayload, null, 2)
    });
    
    // If plan creation failed due to duplicate, we already checked above
    // Just throw the error with details
    if (planResult.name === 'RESOURCE_ALREADY_EXISTS' || planResponse.status === 409 || planResult.error === 'RESOURCE_ALREADY_EXISTS') {
      functions.logger.error('Plan creation failed - resource already exists (this should not happen after pre-check)', {
        planName: planPayload.name,
        originalPlanName: planName
      });
      
      // Try one more time with a completely unique name
      const uniquePlanName = `${planName.substring(0, 90)} ${Date.now()}`.substring(0, 127);
      planPayload.name = uniquePlanName;
      
      const retryResponse = await fetch(`${creds.apiBase}/v1/billing/plans`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(planPayload)
      });
      
      const retryResult: any = await retryResponse.json();
      
      if (retryResponse.ok && retryResult.id) {
        functions.logger.info('Successfully created plan with unique name after conflict', {
          planId: retryResult.id,
          planName: uniquePlanName
        });
        return retryResult.id;
      }
    }
    
    // Provide detailed error message from PayPal
    let errorMessage = 'Unable to create PayPal plan';
    let errorDetails = '';
    
    if (planResult.details && Array.isArray(planResult.details) && planResult.details.length > 0) {
      const detail = planResult.details[0];
      errorMessage = detail.description || detail.issue || planResult.message || errorMessage;
      errorDetails = detail.field ? ` (field: ${detail.field}, location: ${detail.location || 'N/A'})` : '';
    } else if (planResult.message) {
      errorMessage = planResult.message;
    } else if (planResult.error_description) {
      errorMessage = planResult.error_description;
    } else if (planResult.name) {
      errorMessage = planResult.name;
    }
    
    // Log full error for debugging
    functions.logger.error('Full PayPal error response:', JSON.stringify(planResult, null, 2));
    
    throw new Error(`PayPal plan creation failed: ${errorMessage}${errorDetails}`);
  }

  return planResult.id;
};

const createPaypalSubscription = async (payload: PaypalInitRequest) => {
  const creds = getPaypalCredentials();
  ensurePaypalConfigured(creds);
  const accessToken = await getPaypalAccessToken();
  
  // Create or get the PayPal plan ID
  let planId: string;
  try {
    planId = await createOrGetPaypalPlan(payload);
    functions.logger.info(`Using PayPal plan ID: ${planId} for ${payload.planId}`);
  } catch (error: any) {
    functions.logger.error('Failed to create/get PayPal plan', error);
    throw new Error(`Failed to set up PayPal plan: ${error.message || error}`);
  }
  
  // Build subscription payload according to PayPal API schema
  // Reference: https://developer.paypal.com/docs/api/subscriptions/v1/
  const subscriptionPayload: any = {
    plan_id: planId
  };
  
  // Add custom_id only if provided (optional field)
  if (payload.metadata?.customId) {
    subscriptionPayload.custom_id = payload.metadata.customId;
  }
  
  // Add subscriber information if email is provided and valid
  // PayPal requires email_address to be a valid email format (no whitespace, valid format)
  if (payload.customer?.email) {
    // Validate and sanitize email address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let sanitizedEmail = payload.customer.email.trim();
    
    // Remove any whitespace and convert to lowercase
    sanitizedEmail = sanitizedEmail.replace(/\s+/g, '').toLowerCase();
    
    // Validate email format
    if (!sanitizedEmail || sanitizedEmail.length === 0 || !emailRegex.test(sanitizedEmail)) {
      functions.logger.error('Invalid email address provided', {
        original: payload.customer.email,
        sanitized: sanitizedEmail,
        length: sanitizedEmail.length
      });
      throw new Error(`Invalid email address format: ${payload.customer.email}`);
    }
    
    // PayPal requires email_address to be a valid email string (no whitespace, proper format)
    subscriptionPayload.subscriber = {
      email_address: sanitizedEmail
    };
    
    // Add name only if we have a complete name (both given_name and surname)
    // PayPal requires both or neither - partial names can cause schema errors
    if (payload.customer.name && payload.customer.name.trim()) {
      const nameParts = payload.customer.name.trim().split(/\s+/).filter(p => p.length > 0);
      if (nameParts.length >= 2) {
        // Only add name if we have at least first and last name
        subscriptionPayload.subscriber.name = {
          given_name: nameParts[0],
          surname: nameParts.slice(1).join(' ')
        };
      }
      // If only one name part, don't include name object (PayPal schema requirement)
    }
    
    functions.logger.info('Subscriber email validated', {
      original: payload.customer.email,
      sanitized: sanitizedEmail
    });
  } else {
    // Subscriber is optional in PayPal API, but if provided, email must be valid
    functions.logger.warn('No customer email provided for subscription', {
      hasCustomer: !!payload.customer,
      hasEmail: !!payload.customer?.email
    });
  }
  
  // Add application context (required by PayPal)
  // Setting landing_page to BILLING to direct users to card entry page
  // Since we're providing subscriber email, PayPal should pre-fill it
  subscriptionPayload.application_context = {
    brand_name: 'Scholarz',
    user_action: 'SUBSCRIBE_NOW',
    landing_page: 'BILLING', // Direct users to billing/card entry page
    return_url: payload.returnUrl || 'https://link-my-skills.web.app/payments/success',
    cancel_url: payload.cancelUrl || 'https://link-my-skills.web.app/payments/cancelled'
  };
  
  // Note: PayPal subscriptions API will show the checkout page
  // With landing_page: 'BILLING' and subscriber email provided, it should:
  // 1. Pre-fill the email (user can click Continue immediately)
  // 2. Go directly to card entry page
  
  // Log subscription payload for debugging
  functions.logger.info('Creating PayPal subscription', {
    planId,
    hasSubscriber: !!subscriptionPayload.subscriber,
    subscriberEmail: subscriptionPayload.subscriber?.email_address || 'NOT PROVIDED',
    hasSubscriberName: !!subscriptionPayload.subscriber?.name,
    returnUrl: subscriptionPayload.application_context.return_url
  });
  functions.logger.debug('PayPal subscription payload:', JSON.stringify(subscriptionPayload, null, 2));
  
  // Note: PayPal subscriptions API will show the email entry page for guest checkout
  // However, if subscriber.email_address is provided, it should be pre-filled
  // Users can immediately click "Continue to Payment" without re-entering email
  
  const response = await fetch(`${creds.apiBase}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(subscriptionPayload)
  });

  const result: any = await response.json();
  if (!response.ok) {
    // Log detailed error information
    functions.logger.error('PayPal subscription creation failed', {
      status: response.status,
      statusText: response.statusText,
      error: result,
      requestPayload: JSON.stringify(subscriptionPayload, null, 2)
    });
    
    // Extract detailed error message
    let errorMessage = 'Unable to create PayPal subscription';
    if (result?.details && Array.isArray(result.details) && result.details.length > 0) {
      const detail = result.details[0];
      errorMessage = detail.description || detail.issue || result.message || errorMessage;
      const errorDetails = detail.field ? ` (field: ${detail.field}, location: ${detail.location || 'N/A'})` : '';
      errorMessage += errorDetails;
    } else if (result?.message) {
      errorMessage = result.message;
    } else if (result?.name) {
      errorMessage = result.name;
    }
    
    functions.logger.error('Full PayPal subscription error response:', JSON.stringify(result, null, 2));
    throw new Error(errorMessage);
  }

  const approvalUrl = Array.isArray(result.links)
    ? result.links.find((link: any) => link.rel === 'approve')?.href
    : null;

  if (!approvalUrl) {
    functions.logger.warn('No approval URL in PayPal response', result);
  }

  return {
    id: result.id as string,
    status: result.status as string,
    approvalUrl
  };
};

const fetchPaypalSubscription = async (subscriptionId: string) => {
  const creds = getPaypalCredentials();
  ensurePaypalConfigured(creds);
  const accessToken = await getPaypalAccessToken();
  const response = await fetch(`${creds.apiBase}/v1/billing/subscriptions/${subscriptionId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch PayPal subscription: ${errorText}`);
  }

  return (response.json() as Promise<any>);
};

const addPlanDuration = (planType: string, start = new Date()) => {
  const next = new Date(start);
  if (planType === 'annual') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setDate(next.getDate() + 30);
  }
  return next.toISOString();
};

const markPlanDue = (ref: admin.firestore.DocumentReference, reason: string) => {
  return ref.update({
    'profile.planStatus': 'payment_due',
    'profile.planRequiresPayment': true,
    'profile.planExpiredAt': new Date().toISOString(),
    'profile.planIssue': reason
  });
};

const handlePaidPlanRenewal = async (ref: admin.firestore.DocumentReference, profile: any) => {
  const subscriptionId =
    profile.planReference ||
    profile.billingProfile?.paypalSubscriptionId ||
    profile.billingProfile?.paypalSubscription?.id;

  if (!subscriptionId) {
    await markPlanDue(ref, 'missing_subscription');
    return;
  }

  try {
    const subscription: any = await fetchPaypalSubscription(subscriptionId);
    const status = subscription.status as string;
    const billingInfo = subscription.billing_info;
    const nextBilling = billingInfo?.next_billing_time;

    if (status === 'ACTIVE') {
      await ref.update({
        'profile.planStatus': 'active',
        'profile.planExpiresAt':
          nextBilling || addPlanDuration(profile.planType || 'monthly', new Date()),
        'profile.planRequiresPayment': false,
        'profile.billingProfile.paypalSubscriptionStatus': status,
        'profile.billingProfile.paypalSubscriptionId': subscription.id
      });
    } else if (status === 'APPROVAL_PENDING') {
      await ref.update({
        'profile.planStatus': 'pending',
        'profile.planRequiresPayment': true,
        'profile.billingProfile.paypalSubscriptionStatus': status,
        'profile.billingProfile.paypalSubscriptionId': subscription.id
      });
    } else {
      await ref.update({
        'profile.planStatus': 'payment_due',
        'profile.planRequiresPayment': true,
        'profile.billingProfile.paypalSubscriptionStatus': status,
        'profile.billingProfile.paypalSubscriptionId': subscription.id
      });
    }
  } catch (error: any) {
    functions.logger.error('Failed to sync PayPal subscription', error);
    await markPlanDue(ref, 'paypal_sync_failed');
  }
};

// Interface for demo user data
interface DemoUser {
  email: string;
  password: string;
  role: 'SME' | 'SDP' | 'Admin';
  profile: any;
  verified: boolean;
}

// Demo users data
const demoUsers: DemoUser[] = [
  {
    email: 'thabo.mthembu@email.com',
    password: 'demo123',
    role: 'SME',
    verified: true,
    profile: {
      id: 'sme-001',
      name: 'Dr. Thabo Mthembu',
      email: 'thabo.mthembu@email.com',
      role: 'Senior Facilitator & Assessor',
      specializations: ['Business Management', 'Leadership Development', 'Project Management'],
      sectors: ['Manufacturing', 'Services', 'Mining'],
      location: 'Johannesburg, Gauteng',
      experience: '15+ years',
      qualifications: [
        'PhD in Business Administration',
        'ETDP SETA Registered Facilitator',
        'PMP Certified Project Manager',
        'NQF Level 8 Qualification'
      ],
      rates: {
        facilitation: 'R1,500/day',
        assessment: 'R800/day',
        consultation: 'R1,200/day',
        moderation: 'R1,000/day'
      },
      availability: 'Available',
      rating: 0.0,
      reviews: 0,
      verified: true,
      profileImage: '/images/profile-1.jpg',
      aboutMe: 'Experienced facilitator with a passion for developing leadership capabilities in emerging managers.'
    }
  },
  {
    email: 'admin@sdi.co.za',
    password: 'demo123',
    role: 'SDP',
    verified: true,
    profile: {
      id: 'sdp-001',
      name: 'Skills Development Institute',
      email: 'admin@sdi.co.za',
      type: 'Private Training Provider',
      accreditation: 'ETDP SETA Accredited',
      sectors: ['Business', 'Management', 'Leadership'],
      location: 'Johannesburg, Gauteng',
      establishedYear: '2015',
      learners: '2,500+ annually',
      verified: true,
      assessmentCentre: true,
      aboutUs: 'Leading provider of business and management skills development programs.',
      services: ['Learnerships', 'Skills Programmes', 'Short Courses', 'Assessment Services']
    }
  },
  {
    email: 'admin@edulinker.co.za',
    password: 'demo123',
    role: 'Admin',
    verified: true,
    profile: {
      id: 'admin-001',
      name: 'Admin User',
      email: 'admin@edulinker.co.za',
      role: 'Administrator',
      specializations: ['Platform Management', 'User Support'],
      sectors: ['Administration'],
      location: 'Head Office',
      experience: 'Admin',
      qualifications: ['Platform Administrator'],
      rates: {},
      availability: 'Available',
      rating: 0.0,
      reviews: 0,
      verified: true,
      profileImage: '/images/profile-admin.jpg',
      aboutMe: 'Platform administrator for Scholarz'
    }
  }
];

/**
 * Initialize demo users - creates Firebase Auth users and Firestore documents
 * This function should be called once to set up the demo accounts
 */
export const initializeDemoUsers = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to initialize demo users'
    );
  }

  // Check if user is admin (you can add more sophisticated admin check)
  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();
  
  if (userData?.role !== 'Admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admin users can initialize demo users'
    );
  }

  const results = [];

  for (const demoUser of demoUsers) {
    try {
      // Check if user already exists
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(demoUser.email);
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          // User doesn't exist, create it
          userRecord = await auth.createUser({
            email: demoUser.email,
            password: demoUser.password,
            emailVerified: true,
            displayName: demoUser.profile.name
          });
        } else {
          throw error;
        }
      }

      // Update password if user exists (in case it was changed)
      await auth.updateUser(userRecord.uid, {
        password: demoUser.password
      });

      // Set custom claims for role-based access
      await auth.setCustomUserClaims(userRecord.uid, {
        role: demoUser.role,
        verified: demoUser.verified
      });

      // Create or update user document in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        id: userRecord.uid,
        email: demoUser.email,
        role: demoUser.role,
        profile: demoUser.profile,
        verified: demoUser.verified,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'success',
        uid: userRecord.uid
      });
    } catch (error: any) {
      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'error',
        error: error.message
      });
    }
  }

  return {
    message: 'Demo users initialization completed',
    results
  };
});

/**
 * Public function to initialize demo users (for first-time setup)
 * This can be called without authentication for initial setup
 * CORS is automatically handled for onCall functions
 */
export const initializeDemoUsersPublic = functions.https.onCall(async (data, context) => {
  // Only allow if no users exist yet (first-time setup)
  const usersSnapshot = await db.collection('users').limit(1).get();
  
  if (!usersSnapshot.empty) {
    throw new functions.https.HttpsError(
      'already-exists',
      'Users already exist. Use initializeDemoUsers function instead.'
    );
  }

  const results = [];

  for (const demoUser of demoUsers) {
    try {
      // Create Firebase Auth user
      const userRecord = await auth.createUser({
        email: demoUser.email,
        password: demoUser.password,
        emailVerified: true,
        displayName: demoUser.profile.name
      });

      // Set custom claims for role-based access
      await auth.setCustomUserClaims(userRecord.uid, {
        role: demoUser.role,
        verified: demoUser.verified
      });

      // Create user document in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        id: userRecord.uid,
        email: demoUser.email,
        role: demoUser.role,
        profile: demoUser.profile,
        verified: demoUser.verified,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'success',
        uid: userRecord.uid
      });
    } catch (error: any) {
      results.push({
        email: demoUser.email,
        role: demoUser.role,
        status: 'error',
        error: error.message
      });
    }
  }

  return {
    message: 'Demo users initialized successfully',
    results
  };
});

interface PaypalInitRequest {
  amount: number;
  currency?: string;
  planId: string;
  billingType: 'trial' | 'subscription' | 'once_off';
  role: 'sme' | 'sdp';
  customer?: {
    name?: string;
    email?: string;
  };
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: {
    planDurationDays?: number;
    planLabel?: string;
    customId?: string;
    postTrialAmount?: number;
  };
}

// Function to get PayPal client ID for frontend
export const getPaypalClientId = functions.https.onCall(async (data, context) => {
  const creds = getPaypalCredentials();
  return {
    clientId: creds.clientId,
    environment: creds.env
  };
});

export const initiatePaypalPayment = functions.https.onCall(async (data: PaypalInitRequest, context) => {
  if (!data || typeof data.amount !== 'number' || !data.planId || !data.billingType) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount, planId and billingType are required.');
  }

  const creds = getPaypalCredentials();
  // Use USD for sandbox (PayPal sandbox doesn't support ZAR), ZAR for production
  // Always override ZAR with USD in sandbox mode, even if frontend sends ZAR
  const requestedCurrency = data.currency || 'ZAR';
  // Check both env string and API base URL to determine sandbox mode
  const isSandbox = creds.env === 'sandbox' || creds.apiBase.includes('sandbox');
  // Force USD for sandbox if ZAR is requested or not specified
  const currency = (isSandbox && (requestedCurrency === 'ZAR' || !requestedCurrency || requestedCurrency === '')) ? 'USD' : requestedCurrency;
  // Convert amount to USD if in sandbox mode and we're using USD
  let amount: number;
  if (isSandbox && currency === 'USD') {
    functions.logger.info('Converting ZAR to USD for payment', {
      originalZarAmount: data.amount
    });
    amount = convertZarToUsd(data.amount);
    functions.logger.info('Payment conversion result', {
      zarAmount: data.amount,
      usdAmount: amount
    });
  } else {
    amount = data.amount;
  }
  
  // Log currency conversion for debugging
  functions.logger.info('PayPal payment initiation', {
    requestedCurrency: data.currency,
    environment: creds.env,
    isSandbox,
    finalCurrency: currency,
    originalAmount: data.amount,
    convertedAmount: amount,
    planId: data.planId,
    billingType: data.billingType
  });
  
  const durationDays =
    data.metadata?.planDurationDays || (data.billingType === 'subscription' ? 30 : 30);
  const expiresAt = durationDays
    ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000))
    : null;

  // Create payload with converted amount and currency
  const payloadWithCurrency = {
    ...data,
    amount,
    currency
  };

  try {
    const subscription = await createPaypalSubscription(payloadWithCurrency);
    return {
      orderId: subscription.id,
      approvalUrl: subscription.approvalUrl,
      paymentStatus: subscription.status || 'PENDING',
      amount,
      currency,
      billingType: data.billingType,
      role: data.role,
      planId: data.planId,
      customer: data.customer || null,
      expiresAt,
      message: 'Redirect the user to PayPal so they can approve the subscription.'
    };
  } catch (error: any) {
    functions.logger.error('PayPal subscription creation failed', error);
    throw new functions.https.HttpsError(
      'internal',
      `Unable to create PayPal subscription: ${error.message || error}`
    );
  }
});

export const syncPlanStatuses = functions.pubsub
  .schedule('every 24 hours')
  .timeZone('Africa/Johannesburg')
  .onRun(async () => {
    const snapshot = await db.collection('users').get();
    const now = new Date();
    const updates: Promise<unknown>[] = [];

    snapshot.forEach((doc) => {
      const userData = doc.data();
      const profile = userData?.profile || {};
      if (!profile.planType || !profile.planExpiresAt) {
        return;
      }
      const expiryDate = new Date(profile.planExpiresAt);
      if (expiryDate.getTime() > now.getTime()) {
        return;
      }
      if (profile.planType === 'free') {
        if (profile.planStatus !== 'trial_expired') {
          updates.push(
            doc.ref.update({
              'profile.planStatus': 'trial_expired',
              'profile.planRequiresPayment': true,
              'profile.planExpiredAt': now.toISOString()
            })
          );
        }
        return;
      }
      updates.push(handlePaidPlanRenewal(doc.ref, profile));
    });

    await Promise.all(updates);
    functions.logger.info(`Plan sync completed. Updated ${updates.length} records.`);
    return null;
  });

/**
 * Get user profile from Firestore
 */
export const getUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const userDoc = await db.collection('users').doc(context.auth.uid).get();
  
  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'User profile not found'
    );
  }

  return {
    id: userDoc.id,
    ...userDoc.data()
  };
});

/**
 * Set admin custom claims for a user
 * This is called when a new admin account is created via the registration form
 * Note: This function can be called without authentication during registration,
 * but requires an admin key for security
 */
export const setAdminClaims = functions.https.onCall(async (data, context) => {
  const { uid, adminKey } = data;
  
  if (!uid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID is required'
    );
  }

  // If user is authenticated, verify they're setting claims for themselves or are an admin
  if (context.auth) {
    if (context.auth.uid !== uid) {
      // Check if the caller is already an admin
      const callerDoc = await db.collection('users').doc(context.auth.uid).get();
      const callerData = callerDoc.data();
      
      if (callerData?.role !== 'Admin') {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Only admins can set claims for other users'
        );
      }
    }
  } else {
    // If not authenticated, require admin key for security
    const validAdminKey = process.env.ADMIN_REGISTRATION_KEY || 'ADMIN2024';
    if (!adminKey || adminKey !== validAdminKey) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin registration key required'
      );
    }
  }

  // Verify the target user has Admin role in Firestore
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data();
  
  if (userData?.role !== 'Admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User must have Admin role in Firestore'
    );
  }

  try {
    // Set custom claims
    await auth.setCustomUserClaims(uid, {
      role: 'Admin',
      verified: true,
      admin: true
    });

    return {
      success: true,
      message: 'Admin claims set successfully'
    };
  } catch (error: any) {
    throw new functions.https.HttpsError(
      'internal',
      `Failed to set admin claims: ${error.message}`
    );
  }
});

/**
 * Send email notification when a notification is created
 * This function triggers automatically when a new document is added to the notifications collection
 */
export const sendNotificationEmail = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    
    // Skip if email sending is disabled or credentials not configured
    const transporter = createTransporter();
    if (!transporter) {
      console.log('Email transporter not configured, skipping email notification');
      return null;
    }

    try {
      // Fetch user data to get email and name
      const userDoc = await db.collection('users').doc(notification.userId).get();
      
      if (!userDoc.exists) {
        console.error(`User ${notification.userId} not found`);
        return null;
      }

      const userData = userDoc.data();
      const userEmail = userData?.email || userData?.profile?.email;
      const userName = userData?.profile?.name || userData?.email?.split('@')[0] || 'User';

      if (!userEmail) {
        console.error(`No email found for user ${notification.userId}`);
        return null;
      }

      // Prepare email
      const emailHTML = formatEmailHTML(notification, userName);
      const dashboardUrl = notification.link 
        ? `https://link-my-skills.web.app${notification.link}` 
        : 'https://link-my-skills.web.app';

      const mailOptions = {
        from: `"Scholarz" <${functions.config().email?.user || process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: `🔔 ${notification.title}`,
        html: emailHTML,
        text: `Hello ${userName},\n\n${notification.title}\n\n${notification.message}\n\n${notification.link ? `View Details: ${dashboardUrl}` : ''}\n\nThis is an automated notification from Scholarz.`
      };

      // Send email
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${userEmail}:`, info.messageId);
      
      return null;
    } catch (error: any) {
      console.error('Error sending notification email:', error);
      // Don't throw error to prevent retries - log and continue
      return null;
    }
  });

// Blog generation with Gemini AI
interface GenerateBlogRequest {
  topic: string;
  category?: string;
  customTopic?: string;
}

export const generateBlogWithAI = functions.https.onCall(async (data: GenerateBlogRequest, context) => {
  try {
    // Verify admin access
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const tokenResult = await admin.auth().getUser(context.auth.uid);
    const customClaims = tokenResult.customClaims || {};
    if (customClaims.role !== 'Admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only admins can generate blogs');
    }

    // Get Gemini API key - try multiple sources
    // Try to reload .env if not already loaded
    if (!process.env.GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY) {
      // Try reloading from common paths
      const reloadPaths = [
        path.join(process.cwd(), 'env', '.env'),
        path.join(__dirname, '..', '..', 'env', '.env'),
        path.join(__dirname, '..', '.env'),
      ];
      for (const envPath of reloadPaths) {
        if (fs.existsSync(envPath)) {
          dotenv.config({ path: envPath, override: false });
          break;
        }
      }
    }
    
    const geminiApiKey = process.env.GEMINI_API_KEY || 
                        process.env.VITE_GEMINI_API_KEY || 
                        functions.config().gemini?.api_key || '';
    
    if (!geminiApiKey) {
      functions.logger.error('Gemini API key not found', {
        hasGEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
        hasVITE_GEMINI_API_KEY: !!process.env.VITE_GEMINI_API_KEY,
        hasConfig: !!functions.config().gemini?.api_key,
        cwd: process.cwd(),
        __dirname: __dirname
      });
      throw new functions.https.HttpsError('failed-precondition', 'Gemini API key not configured');
    }
    
    functions.logger.info('Gemini API key loaded successfully', {
      keyLength: geminiApiKey.length,
      source: process.env.GEMINI_API_KEY ? 'env' : (process.env.VITE_GEMINI_API_KEY ? 'vite_env' : 'config')
    });

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    // Define topic mapping
    const topicMap: { [key: string]: { title: string; description: string } } = {
      funding: {
        title: 'Education Funding Opportunities in South Africa',
        description: 'Explore various funding opportunities available for education and skills development in South Africa, including government grants, SETA funding, and private sector initiatives.'
      },
      facilitation: {
        title: 'Skills Development Facilitation in South Africa',
        description: 'Learn about facilitation services, how to become a facilitator, and the role of facilitators in skills development programs.'
      },
      assessors: {
        title: 'Becoming a Qualified Assessor in South Africa',
        description: 'Discover the requirements, qualifications, and career opportunities for assessors in the South African education and training sector.'
      },
      qcto: {
        title: 'QCTO Qualifications and Accreditation',
        description: 'Comprehensive guide to QCTO (Quality Council for Trades and Occupations) qualifications, accreditation processes, and how to register.'
      },
      setas: {
        title: 'Understanding SETAs in South Africa',
        description: 'Complete guide to Sector Education and Training Authorities (SETAs), their role, funding opportunities, and how to engage with them.'
      },
      government: {
        title: 'Government Education Programs and Initiatives',
        description: 'Overview of government education programs, policies, and initiatives supporting skills development in South Africa.'
      },
      bursaries: {
        title: 'Education Bursaries and Scholarships in South Africa',
        description: 'Find information about available bursaries, scholarships, and financial aid for education and training in South Africa.'
      },
      accreditations: {
        title: 'Education Accreditation in South Africa',
        description: 'Learn about accreditation processes, requirements, and how to get your institution or program accredited in South Africa.'
      },
      sme_income: {
        title: 'How to Make Money as an SME in Education',
        description: 'Practical guide for Subject Matter Experts (SMEs) on monetizing their expertise through facilitation, assessment, consultation, and other services.'
      }
    };

    // Determine the base topic for link strategy
    const baseTopic = topicMap[data.topic] ? data.topic : 'funding';
    
    // If custom topic is provided, use it as the focus; otherwise use the base topic
    const selectedTopic = data.customTopic ? data.customTopic : baseTopic;
    
    // Create topic info - use custom topic if provided, otherwise use mapped topic
    let topicInfo: { title: string; description: string };
    if (data.customTopic) {
      topicInfo = {
        title: data.customTopic,
        description: `Comprehensive guide about ${data.customTopic} in the context of South African education and skills development, with focus on ${topicMap[baseTopic]?.title || 'the selected topic'}.`
      };
    } else {
      topicInfo = topicMap[baseTopic] || topicMap.funding;
    }

    // System links to include in blogs - using relative paths for better SEO
    const systemLinks = {
      smeGateway: '/sme-gateway',
      sdpGateway: '/sdp-gateway',
      search: '/search',
      platform: '/'
    };

    // Determine which links to emphasize based on base topic (not custom topic)
    const getStrategicLinks = (topic: string, customTopic?: string) => {
      const links: string[] = [];
      const topicText = customTopic || topic;
      const topicLower = topicText.toLowerCase();
      
      // Topics that relate to making money as SME
      if (['sme_income', 'facilitation', 'assessors', 'funding', 'bursaries'].includes(topic) ||
          topicLower.includes('make money') || topicLower.includes('earn') || topicLower.includes('income') ||
          topicLower.includes('facilitator') || topicLower.includes('assessor') || topicLower.includes('monetize') ||
          topicLower.includes('sme') || topicLower.includes('subject matter expert')) {
        links.push(`<a href="${systemLinks.smeGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">become a Subject Matter Expert (SME) on Scholarz</a>`);
        links.push(`<a href="${systemLinks.smeGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">register as an SME</a>`);
        links.push(`<a href="${systemLinks.smeGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">join our SME network</a>`);
      }
      // Topics that relate to accreditation/SDP
      if (['accreditations', 'qcto', 'setas', 'government'].includes(topic) ||
          topicLower.includes('accredit') || topicLower.includes('certification') || topicLower.includes('sdp') ||
          topicLower.includes('provider') || topicLower.includes('qualification') || topicLower.includes('training provider')) {
        links.push(`<a href="${systemLinks.sdpGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">get accredited as a Skills Development Provider (SDP)</a>`);
        links.push(`<a href="${systemLinks.sdpGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">register your SDP on Scholarz</a>`);
        links.push(`<a href="${systemLinks.sdpGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">become a certified SDP</a>`);
      }
      // General links for all topics
      links.push(`<a href="${systemLinks.search}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">find qualified professionals on Scholarz</a>`);
      links.push(`<a href="${systemLinks.platform}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">visit Scholarz platform</a>`);
      return links;
    };

    const strategicLinks = getStrategicLinks(baseTopic, data.customTopic);

    // Create the prompt using a simpler structured text format instead of JSON
    const prompt = `You are an expert content writer specializing in South African education and skills development. Write a comprehensive, well-researched blog post about: ${topicInfo.title}

Topic Description: ${topicInfo.description}

CRITICAL FORMATTING REQUIREMENTS:
1. Write a professional, engaging blog post of 800-1200 words MINIMUM - this is MANDATORY
2. The content must be SUBSTANTIAL and COMPREHENSIVE - not just a few sentences
3. You MUST write at least 800 words of actual content (excluding HTML tags)
4. Format content in PROPER PARAGRAPHS using <p> tags - each paragraph should be 3-5 sentences
5. DO NOT use single long paragraphs - break content into multiple <p> tags for readability
6. You need at least 15-20 paragraphs of content to reach the word count requirement
7. Focus specifically on the South African context
8. Include current information, statistics, and relevant examples
9. Expand on each point with detailed explanations, examples, and practical advice

HTML FORMATTING REQUIREMENTS:
- Use <h2> for main section headings
- Use <h3> for subsections
- Use <p> tags for ALL paragraphs (wrap each paragraph separately)
- Use <ul> and <li> for lists
- Use <strong> for emphasis
- Use <em> for italics

STRATEGIC LEAD GENERATION LINKS (MANDATORY):
You MUST naturally incorporate 4-6 strategic links throughout the content using these exact HTML anchor tags:

${strategicLinks.map((link, i) => `${i + 1}. ${link}`).join('\n')}

LINK PLACEMENT STRATEGY:
- Place SME links when discussing earning opportunities, facilitation, assessment, or making money
- Place SDP links when discussing accreditation, certification, or becoming a provider
- Place general platform links in the introduction and conclusion
- Make links feel natural and contextually relevant
- Use varied anchor text from the list above
- Include at least one link in the introduction paragraph
- Include at least one link in the conclusion paragraph
- Include links in the middle sections where relevant

CONTENT STRUCTURE (MANDATORY - MUST FOLLOW):
1. Engaging introduction (3-4 paragraphs, ~150-200 words) - include a platform link
2. Main content sections with subheadings (h2, h3) - at least 4-5 major sections
3. Each section should have 4-6 paragraphs with detailed explanations
4. Include practical tips, actionable advice, and real examples in each section
5. Add subsections (h3) within major sections to break down topics further
6. Include lists, examples, case studies, and detailed explanations
7. Strong conclusion (3-4 paragraphs, ~150-200 words) - include a call-to-action with links

WORD COUNT ENFORCEMENT:
- You MUST write at least 800 words of actual content
- Count only the text content, not HTML tags
- If you find yourself writing less than 800 words, expand each section with more detail
- Add more examples, explanations, and practical advice
- Include more paragraphs in each section
- Do not submit content that is less than 800 words - it will be rejected

TONE:
- Professional but accessible
- Conversational and engaging
- Authoritative but not overly formal
- Include South African context and examples

RESPONSE FORMAT (Use these exact section markers):
===TITLE===
[Your blog title here]

===EXCERPT===
[Short 150-200 word summary in plain text, no HTML tags]

===CONTENT===
[Full HTML formatted content with proper <p> tags for paragraphs and strategic links]

===CATEGORY===
${data.category || 'Education'}

===TAGS===
relevant, tags, here, South Africa

IMPORTANT: 
- Every paragraph must be wrapped in <p> tags
- Content must be broken into multiple paragraphs, not one long block
- Include the strategic links naturally throughout the content
- Make sure links are clickable HTML anchor tags with proper styling
- The excerpt should be plain text (no HTML tags)
- Use the exact section markers above (===TITLE===, ===EXCERPT===, etc.)
- Do NOT include any code blocks, JSON, or programming syntax
- Return ONLY the structured text format above

FINAL REMINDERS:
- Write ONLY about the topic specified above - do not deviate
- You MUST write at least 800 words - this is not optional, it's a requirement
- The content must be comprehensive, detailed, and substantial
- Include multiple sections, subsections, examples, and detailed explanations
- Make sure the content is accurate, up-to-date, and valuable for readers interested in South African education and skills development
- If a custom topic was provided, that is your PRIMARY and ONLY focus
- Every word must contribute to explaining, discussing, or providing information about the requested topic
- Do not include filler content or generic information that doesn't relate to the specific topic requested
- Expand on each point with detailed explanations - do not write brief summaries

Remember: The user has specifically requested content about "${data.customTopic || topicInfo.title}". You must deliver exactly that with at least 800 words of comprehensive, detailed content.`;

    functions.logger.info('Generating blog with Gemini AI', { topic: selectedTopic });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the structured text format using section markers
    let blogData: any = {};
    
    try {
      // Extract title
      const titleMatch = text.match(/===TITLE===\s*\n(.*?)(?=\n===|$)/s);
      blogData.title = titleMatch ? titleMatch[1].trim() : topicInfo.title;
      
      // Extract excerpt
      const excerptMatch = text.match(/===EXCERPT===\s*\n(.*?)(?=\n===|$)/s);
      blogData.excerpt = excerptMatch ? excerptMatch[1].trim() : text.replace(/<[^>]*>/g, '').substring(0, 200) + '...';
      
      // Extract content
      const contentMatch = text.match(/===CONTENT===\s*\n([\s\S]*?)(?=\n===CATEGORY===|$)/s);
      blogData.content = contentMatch ? contentMatch[1].trim() : text;
      
      // Extract category
      const categoryMatch = text.match(/===CATEGORY===\s*\n(.*?)(?=\n===|$)/s);
      blogData.category = categoryMatch ? categoryMatch[1].trim() : (data.category || 'Education');
      
      // Extract tags
      const tagsMatch = text.match(/===TAGS===\s*\n(.*?)(?=\n===|$)/s);
      if (tagsMatch) {
        blogData.tags = tagsMatch[1].split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
      } else {
        blogData.tags = [selectedTopic, 'South Africa', 'Education'];
      }
      
      functions.logger.info('Successfully parsed structured response', {
        hasTitle: !!blogData.title,
        hasExcerpt: !!blogData.excerpt,
        hasContent: !!blogData.content,
        contentLength: blogData.content?.length || 0
      });
      
    } catch (parseError) {
      // Fallback: if structured parsing fails, try to extract from text
      functions.logger.warn('Failed to parse structured response, using fallback', { 
        error: parseError,
        textLength: text.length,
        textPreview: text.substring(0, 200)
      });
      
      // Try to find title in the text
      const titleLines = text.split('\n').filter((line: string) => line.trim().length > 0);
      const titleLine = titleLines.find((line: string) => 
        line.length > 10 && line.length < 100 && !line.includes('<')
      ) || topicInfo.title;
      
      blogData = {
        title: titleLine.trim(),
        excerpt: text.replace(/<[^>]*>/g, '').substring(0, 200) + '...',
        content: text,
        category: data.category || 'Education',
        tags: [selectedTopic, 'South Africa', 'Education']
      };
    }

    // Ensure required fields
    if (!blogData.title) blogData.title = topicInfo.title;
    if (!blogData.excerpt) blogData.excerpt = blogData.content?.replace(/<[^>]*>/g, '').substring(0, 200) + '...' || topicInfo.description;
    if (!blogData.content) blogData.content = text;
    if (!blogData.category) blogData.category = data.category || 'Education';
    if (!blogData.tags || !Array.isArray(blogData.tags)) {
      blogData.tags = [selectedTopic, 'South Africa', 'Education'];
    }

    // Post-process content to ensure proper paragraph formatting
    let processedContent = blogData.content;
    
    // If content doesn't have proper paragraph tags, format it
    if (!processedContent.includes('<p>') && !processedContent.includes('</p>')) {
      // Split by double newlines or single newlines after periods
      const paragraphs = processedContent
        .split(/\n\n+/)
        .map((para: string) => para.trim())
        .filter((para: string) => para.length > 0);
      
      processedContent = paragraphs
        .map((para: string) => {
          // If it's a heading, keep it as is
          if (para.match(/^<h[2-6]>/)) return para;
          // If it's a list, keep it as is
          if (para.match(/^<ul>|^<ol>/)) return para;
          // Otherwise wrap in paragraph tags
          if (!para.startsWith('<')) {
            return `<p>${para}</p>`;
          }
          return para;
        })
        .join('\n\n');
    }

    // Ensure strategic links are present - add them if missing
    const hasSmeLink = processedContent.includes('/sme-gateway');
    const hasSdpLink = processedContent.includes('/sdp-gateway');
    
    // Add strategic links if missing based on base topic and custom topic
    const finalTopicText = data.customTopic || baseTopic;
    const finalTopicLower = finalTopicText.toLowerCase();
    
    if (!hasSmeLink && (['sme_income', 'facilitation', 'assessors', 'funding', 'bursaries'].includes(baseTopic) ||
        finalTopicLower.includes('make money') || finalTopicLower.includes('earn') || finalTopicLower.includes('income') ||
        finalTopicLower.includes('facilitator') || finalTopicLower.includes('assessor') || finalTopicLower.includes('monetize') ||
        finalTopicLower.includes('sme') || finalTopicLower.includes('subject matter expert'))) {
      const ctaParagraph = `<p>If you're interested in monetizing your expertise and <a href="${systemLinks.smeGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">becoming a Subject Matter Expert (SME) on Scholarz</a>, you can start earning by sharing your knowledge and skills with those who need them most.</p>`;
      processedContent += '\n\n' + ctaParagraph;
    }
    
    if (!hasSdpLink && (['accreditations', 'qcto', 'setas', 'government'].includes(baseTopic) ||
        finalTopicLower.includes('accredit') || finalTopicLower.includes('certification') || finalTopicLower.includes('sdp') ||
        finalTopicLower.includes('provider') || finalTopicLower.includes('qualification') || finalTopicLower.includes('training provider'))) {
      const ctaParagraph = `<p>Ready to get your organization accredited? <a href="${systemLinks.sdpGateway}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Register as a Skills Development Provider (SDP) on Scholarz</a> and connect with learners and organizations seeking quality training.</p>`;
      processedContent += '\n\n' + ctaParagraph;
    }

    blogData.content = processedContent;

    // Validate content length - check word count
    const textContent = processedContent.replace(/<[^>]*>/g, '').trim();
    const wordCount = textContent.split(/\s+/).filter((word: string) => word.length > 0).length;
    
    functions.logger.info('Blog content validation', { 
      wordCount, 
      contentLength: processedContent.length,
      textLength: textContent.length,
      hasParagraphs: processedContent.includes('<p>'),
      paragraphCount: (processedContent.match(/<p>/g) || []).length
    });
    
    if (wordCount < 300) {
      functions.logger.error('Generated blog content is too short', { 
        wordCount, 
        topic: selectedTopic,
        customTopic: data.customTopic,
        contentPreview: textContent.substring(0, 200)
      });
      throw new functions.https.HttpsError('internal', 
        `Generated blog content is too short (${wordCount} words). Please try again with a more specific topic or contact support.`);
    }

    // Generate slug from title
    const slug = blogData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return {
      success: true,
      blog: {
        ...blogData,
        slug
      }
    };
  } catch (error: any) {
    functions.logger.error('Error generating blog with AI', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate blog: ' + error.message);
    }
  });

