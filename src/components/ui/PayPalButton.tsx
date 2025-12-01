import React, { useEffect, useRef, useState } from 'react';
import { functions } from '../../firebase/config';
import { httpsCallable } from 'firebase/functions';

declare global {
  interface Window {
    paypal?: any;
  }
}

interface PayPalButtonProps {
  amount: number;
  currency?: string;
  planId: string;
  billingType: 'trial' | 'subscription' | 'once_off';
  role: 'sme' | 'sdp';
  customer: {
    name?: string;
    email: string;
  };
  metadata?: {
    postTrialAmount?: number;
    planDurationDays?: number;
    planLabel?: string;
    customId?: string;
  };
  onSuccess: (subscriptionId: string, orderId: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
  label?: string;
}

export function PayPalButton({
  amount,
  currency = 'USD',
  planId,
  billingType,
  role,
  customer,
  metadata,
  onSuccess,
  onError,
  onCancel,
  label = 'Pay with Card'
}: PayPalButtonProps) {
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const cardFieldsRef = useRef<any>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
  const cardNumberRef = useRef<HTMLDivElement | null>(null);
  const cvvRef = useRef<HTMLDivElement | null>(null);
  const expirationDateRef = useRef<HTMLDivElement | null>(null);
  const paypalRef = useRef<any>(null);
  const buttonsInstanceRef = useRef<any>(null);
  const initializedRef = useRef<boolean>(false);

  // Get PayPal client ID from backend
  useEffect(() => {
    const getClientId = async () => {
      try {
        const getPaypalClientId = httpsCallable(functions, 'getPaypalClientId');
        const result = await getPaypalClientId();
        const data = result.data as { clientId: string; environment: string };
        setClientId(data.clientId);
        
        console.log('PayPal client ID received', {
          clientId: data.clientId ? data.clientId.substring(0, 10) + '...' : 'null',
          environment: data.environment
        });
        
        // Update PayPal SDK script with actual client ID
        // Use buttons component for subscriptions
        if (data.clientId && typeof window !== 'undefined') {
          // Check if PayPal SDK is already loaded and ready
          if (window.paypal && window.paypal.Buttons) {
            console.log('PayPal SDK already loaded');
            setPaypalLoaded(true);
            setLoading(false);
            return;
          }
          
          // Check if script already exists
          let script = document.querySelector('script[src*="paypal.com/sdk/js"]') as HTMLScriptElement;
          
          // Build PayPal SDK URL with required parameters for subscriptions
          // vault=true is REQUIRED for subscriptions (createSubscription)
          // Use sandbox URL if environment is sandbox
          const baseUrl = data.environment === 'sandbox' 
            ? 'https://www.sandbox.paypal.com/sdk/js'
            : 'https://www.paypal.com/sdk/js';
          const scriptSrc = `${baseUrl}?client-id=${encodeURIComponent(data.clientId)}&components=buttons&currency=${currency}&vault=true&intent=subscription`;
          
          console.log('PayPal SDK script URL:', {
            baseUrl,
            environment: data.environment,
            currency,
            scriptSrc: scriptSrc.substring(0, 100) + '...'
          });
          
          if (script) {
            // If script exists but SDK isn't loaded, wait for it or reload
            if (!window.paypal) {
              console.log('Script exists but SDK not loaded yet, waiting...');
              // Wait a bit for script to load
              const checkLoaded = setInterval(() => {
                if (window.paypal && window.paypal.Buttons) {
                  clearInterval(checkLoaded);
                  console.log('PayPal SDK loaded after wait');
                  setPaypalLoaded(true);
                  setLoading(false);
                }
              }, 100);
              
              // Timeout after 5 seconds
              setTimeout(() => {
                clearInterval(checkLoaded);
                if (!window.paypal) {
                  console.log('Script exists but SDK not loading, removing and recreating...');
                  script.remove();
                  // Fall through to create new script
                }
              }, 5000);
              
              // If script exists with different src, update it
              if (script.src !== scriptSrc && window.paypal) {
                console.log('Updating PayPal SDK script with new parameters');
                script.src = scriptSrc;
              } else if (script.src === scriptSrc) {
                // Script is correct, just wait for it to load
                return;
              }
            } else {
              // SDK is loaded, we're good
              console.log('PayPal SDK already loaded');
              setPaypalLoaded(true);
              setLoading(false);
              return;
            }
          }
          
          // Create new script if we get here
          console.log('Creating new PayPal SDK script:', scriptSrc);
          script = document.createElement('script');
          script.src = scriptSrc;
          script.async = true;
          script.id = 'paypal-sdk-script';
          script.onload = () => {
            console.log('PayPal SDK script loaded successfully', {
              hasPaypal: !!window.paypal,
              hasButtons: !!(window.paypal && window.paypal.Buttons)
            });
            // Give it a moment to initialize
            setTimeout(() => {
              if (window.paypal && window.paypal.Buttons) {
                console.log('PayPal SDK fully initialized');
                setPaypalLoaded(true);
              }
            }, 100);
          };
          script.onerror = (err) => {
            console.error('PayPal SDK failed to load:', err, {
              scriptSrc,
              clientId: data.clientId.substring(0, 10) + '...'
            });
            setError('Failed to load PayPal SDK. Please refresh and try again.');
            setLoading(false);
          };
          document.head.appendChild(script);
        }
      } catch (err: any) {
        console.error('Error getting PayPal client ID:', err);
        setError('Failed to load PayPal. Please try again.');
        setLoading(false);
      }
    };

    getClientId();
  }, [currency]);

  // Initialize PayPal when SDK is loaded
  useEffect(() => {
    if (!clientId || initializedRef.current) return;

    // First, try to find container by ID as fallback
    const findContainerById = (): HTMLDivElement | null => {
      const container = document.getElementById('paypal-button-container') as HTMLDivElement | null;
      if (container && !buttonsRef.current) {
        buttonsRef.current = container;
        console.log('Found container by ID and set ref', container);
      }
      return container;
    };

    let checkCount = 0;
    const maxChecks = 150; // 15 seconds (150 * 100ms)
    
    const checkPayPal = setInterval(() => {
      checkCount++;
      
      // Check if PayPal SDK is loaded
      const sdkReady = window.paypal && window.paypal.Buttons;
      
      // Try to get container - check ref first, then by ID
      let container: HTMLDivElement | null = buttonsRef.current;
      if (!container) {
        container = findContainerById();
      }
      const containerReady = container && container instanceof HTMLDivElement;
      
      if (sdkReady && containerReady) {
        clearInterval(checkPayPal);
        console.log('PayPal SDK and container ready, initializing...', {
          container: container,
          containerId: container?.id,
          isConnected: container?.isConnected
        });
        setPaypalLoaded(true);
        setLoading(false);
        initializedRef.current = true;
        initializePayPal();
      } else if (checkCount >= maxChecks) {
        // Timeout reached
        clearInterval(checkPayPal);
        console.error('Timeout waiting for PayPal SDK or container', {
          sdkReady,
          containerReady,
          hasPaypal: !!window.paypal,
          hasButtons: !!(window.paypal && window.paypal.Buttons),
          containerExists: !!container,
          containerRef: !!buttonsRef.current,
          containerById: !!document.getElementById('paypal-button-container'),
          containerType: container ? typeof container : 'null',
          containerElement: container instanceof HTMLElement
        });
        
        // If SDK is ready but container isn't, that's a React rendering issue
        // If container is ready but SDK isn't, that's a script loading issue
        if (sdkReady && !containerReady) {
          setError('Payment container not found. Please refresh the page.');
        } else if (!sdkReady && containerReady) {
          setError('PayPal SDK failed to load. Please refresh the page.');
        } else {
          setError('Payment system timed out. Please refresh the page.');
        }
        setLoading(false);
      } else {
        // Still waiting, log progress every 5 seconds
        if (checkCount % 50 === 0) {
          console.log('Waiting for PayPal SDK...', {
            checkCount,
            sdkReady: !!sdkReady,
            containerReady: !!containerReady,
            containerRef: !!buttonsRef.current,
            containerById: !!document.getElementById('paypal-button-container'),
            containerElement: container instanceof HTMLElement
          });
        }
      }
    }, 100);

    return () => {
      clearInterval(checkPayPal);
    };
  }, [clientId]);

  const initializePayPal = async () => {
    // Prevent multiple initializations
    if (buttonsInstanceRef.current) {
      console.log('PayPal already initialized, skipping...');
      return;
    }

    if (!window.paypal) {
      console.error('PayPal SDK not available');
      setError('PayPal SDK not loaded. Please refresh the page.');
      setLoading(false);
      return;
    }

    // Wait for button container to be available - check more thoroughly
    if (!buttonsRef.current || !(buttonsRef.current instanceof HTMLElement)) {
      console.warn('Button container not available yet', {
        refExists: !!buttonsRef.current,
        isHTMLElement: buttonsRef.current instanceof HTMLElement,
        refValue: buttonsRef.current
      });
      // Retry after a short delay
      setTimeout(() => {
        if (buttonsRef.current && buttonsRef.current instanceof HTMLElement && !buttonsInstanceRef.current) {
          initializePayPal();
        }
      }, 200);
      return;
    }
    
    console.log('Container is ready', {
      container: buttonsRef.current,
      id: buttonsRef.current.id,
      className: buttonsRef.current.className
    });

    try {
      console.log('Creating PayPal subscription...');
      // Create subscription on backend first
      const initiatePaypal = httpsCallable(functions, 'initiatePaypalPayment');
      const response = await initiatePaypal({
        amount,
        currency,
        planId,
        billingType,
        role,
        customer,
        metadata,
        returnUrl: `${window.location.origin}/payments/success`,
        cancelUrl: `${window.location.origin}/payments/cancelled`
      });

      const data = response.data as any;
      const subscriptionId = data.orderId;
      const url = data.approvalUrl;

      if (!subscriptionId) {
        throw new Error('Failed to create PayPal subscription');
      }

      // Store approval URL as fallback - show it immediately
      if (url) {
        setApprovalUrl(url);
        console.log('Approval URL stored:', url);
      }

      console.log('PayPal subscription created:', { subscriptionId, approvalUrl: url });

      // Render PayPal subscription buttons
      // IMPORTANT: PayPal subscriptions API doesn't support inline card fields
      // The button will redirect to PayPal's hosted checkout page
      // With landing_page: 'BILLING' and email pre-filled, it goes directly to card entry
      console.log('Rendering PayPal buttons with subscription ID:', subscriptionId);
      
      const buttons = window.paypal.Buttons({
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'subscribe',
          height: 50,
          tagline: false
        },
        createSubscription: async (data: any, actions: any) => {
          console.log('Creating subscription with ID:', subscriptionId);
          // Return the subscription ID created on the backend
          return subscriptionId;
        },
        onApprove: async (data: any, actions: any) => {
          try {
            console.log('Subscription approved:', data);
            setProcessing(true);
            // Subscription approved - call success callback
            onSuccess(data.subscriptionID, data.subscriptionID);
            setProcessing(false);
          } catch (err: any) {
            console.error('PayPal approval error:', err);
            setProcessing(false);
            onError(err.message || 'Payment processing failed');
          }
        },
        onError: (err: any) => {
          console.error('PayPal error:', err);
          setProcessing(false);
          onError(err.message || 'Payment failed. Please try again.');
        },
        onCancel: () => {
          console.log('PayPal subscription cancelled');
          setProcessing(false);
          if (onCancel) {
            onCancel();
          }
        },
        onInit: (data: any, actions: any) => {
          console.log('PayPal buttons initialized');
        },
        onClick: () => {
          console.log('PayPal button clicked - redirecting to checkout');
        }
      });
      
      if (buttonsRef.current) {
        // Clear any existing buttons first
        buttonsRef.current.innerHTML = '';
        
        console.log('Attempting to render PayPal buttons in container:', buttonsRef.current);
        buttonsInstanceRef.current = buttons;
        
        buttons.render(buttonsRef.current)
          .then(() => {
            console.log('PayPal buttons rendered successfully');
            setLoading(false);
          })
          .catch((err: any) => {
            console.error('Error rendering PayPal buttons:', err);
            setError('Failed to render payment button. Using direct link instead.');
            setLoading(false);
            buttonsInstanceRef.current = null;
            // Don't throw - show fallback button instead
          });
      } else {
        console.error('Button container is null');
        setError('Payment container not available. Using direct link instead.');
        setLoading(false);
      }

    } catch (err: any) {
      console.error('Error initializing PayPal:', err);
      setError(err.message || 'Failed to initialize payment. Please try again.');
      setLoading(false);
      buttonsInstanceRef.current = null;
      initializedRef.current = false;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (buttonsRef.current) {
        buttonsRef.current.innerHTML = '';
      }
      buttonsInstanceRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  return (
    <div className="w-full space-y-3">
      {/* PayPal button container - ALWAYS render first, before any conditionals */}
      {/* This ensures the ref is available immediately when component mounts */}
      <div 
        ref={(el) => {
          if (el) {
            buttonsRef.current = el;
            console.log('Container ref set', {
              element: el,
              id: el.id,
              className: el.className,
              isConnected: el.isConnected
            });
          }
          // Note: React calls ref callback with null during cleanup - this is normal
        }}
        id="paypal-button-container" 
        className="w-full min-h-[50px]"
        style={{ minHeight: '50px', display: approvalUrl ? 'none' : 'block' }}
      ></div>
      
      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading payment...</span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-sm text-red-600 underline"
          >
            Reload and try again
          </button>
        </div>
      )}
      
      {/* Show fallback button immediately if approval URL is available */}
      {approvalUrl && (
        <div className="space-y-2">
          <button
            onClick={() => {
              if (approvalUrl) {
                console.log('Opening PayPal approval URL:', approvalUrl);
                window.location.href = approvalUrl;
              }
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            disabled={processing}
          >
            {processing ? 'Processing...' : (label || 'Pay with Card')}
          </button>
          <p className="text-xs text-gray-500 text-center">
            Click the button above to enter your card details. Your email ({customer.email}) will be pre-filled. 
            No PayPal account required - you can pay directly with your card.
          </p>
        </div>
      )}
      
      {/* Loading state */}
      {!approvalUrl && !error && loading && (
        <div className="text-center text-sm text-gray-500">
          Loading payment options...
        </div>
      )}
      
      {/* Error state */}
      {error && !approvalUrl && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

