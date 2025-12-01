import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [paymentDetails, setPaymentDetails] = useState<{
    orderId?: string;
    payerId?: string;
    planId?: string;
    amount?: string;
    role?: string;
  }>({});

  useEffect(() => {
    // Parse URL parameters to get payment details
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const payerId = params.get('PayerID');
    
    // In a real implementation, you would verify the payment with your backend
    // For now, we'll just extract the information we have
    if (token) {
      // Try to get payment details from localStorage (set during payment initiation)
      const pendingPayment = localStorage.getItem('pending_payment');
      if (pendingPayment) {
        try {
          const paymentData = JSON.parse(pendingPayment);
          setPaymentDetails({
            orderId: token,
            payerId: payerId || undefined,
            planId: paymentData.planId,
            amount: paymentData.amount,
            role: paymentData.role
          });
          
          // Clear the pending payment
          localStorage.removeItem('pending_payment');
        } catch (error) {
          console.error('Error parsing payment data:', error);
        }
      }
    }
  }, [location.search]);

  const handleContinue = () => {
    // Redirect based on user role
    if (paymentDetails.role === 'sme') {
      navigate('/sme-dashboard');
    } else if (paymentDetails.role === 'sdp') {
      navigate('/sdp-dashboard');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600">
            Your payment has been processed successfully. Welcome to Scholarz!
          </p>
        </div>

        {paymentDetails.orderId && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-medium text-green-900 mb-2">Payment Details</h3>
            <div className="space-y-1 text-sm text-green-800">
              <p>Order ID: {paymentDetails.orderId}</p>
              {paymentDetails.payerId && <p>Payer ID: {paymentDetails.payerId}</p>}
              {paymentDetails.planId && <p>Plan: {paymentDetails.planId}</p>}
              {paymentDetails.amount && <p>Amount: {paymentDetails.amount}</p>}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleContinue}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Continue to Dashboard
          </Button>
          <Link to="/">
            <Button variant="outline" className="w-full flex items-center justify-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>A confirmation email has been sent to your registered email address.</p>
          <p className="mt-1">If you have any questions, please contact our support team.</p>
        </div>
      </div>
    </div>
  );
}