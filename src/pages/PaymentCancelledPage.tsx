import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

export function PaymentCancelledPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentDetails, setPaymentDetails] = useState<{
    planId?: string;
    amount?: string;
    role?: string;
  }>({});

  useEffect(() => {
    // Try to get payment details from localStorage (set during payment initiation)
    const pendingPayment = localStorage.getItem('pending_payment');
    if (pendingPayment) {
      try {
        const paymentData = JSON.parse(pendingPayment);
        setPaymentDetails({
          planId: paymentData.planId,
          amount: paymentData.amount,
          role: paymentData.role
        });
        
        // Don't clear the pending payment here as the user might want to retry
      } catch (error) {
        console.error('Error parsing payment data:', error);
      }
    }
  }, []);

  const handleRetryPayment = () => {
    // Navigate back to the appropriate registration page based on role
    if (paymentDetails.role === 'sme') {
      navigate('/register/sme');
    } else if (paymentDetails.role === 'sdp') {
      navigate('/register/sdp');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-10 h-10 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Cancelled</h1>
          <p className="text-gray-600">
            Your payment was cancelled. No charges were made to your account.
          </p>
        </div>

        {paymentDetails.planId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 mb-2">Cancelled Payment Details</h3>
            <div className="space-y-1 text-sm text-yellow-800">
              <p>Plan: {paymentDetails.planId}</p>
              {paymentDetails.amount && <p>Amount: {paymentDetails.amount}</p>}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleRetryPayment}
            className="w-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Payment Again
          </Button>
          <Link to="/">
            <Button variant="outline" className="w-full flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>If you cancelled this payment by mistake or encountered any issues during checkout,</p>
          <p className="mt-1">please try again or contact our support team for assistance.</p>
        </div>
      </div>
    </div>
  );
}