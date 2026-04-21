import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const { paymentMethodId, priceId } = await req.json();
  
  try {
    // Crear cliente
    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    
    // Crear suscripción
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });
    
    const paymentIntent = (subscription.latest_invoice as any).payment_intent;
    
    // Guardar en DB (usando service role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    await supabaseAdmin.from('subscriptions').insert({
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
    });
    
    return new Response(JSON.stringify({
      clientSecret: paymentIntent?.client_secret,
      status: paymentIntent?.status,
      customerId: customer.id,
      subscriptionId: subscription.id,
    }), { headers: { 'Content-Type': 'application/json' } });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});