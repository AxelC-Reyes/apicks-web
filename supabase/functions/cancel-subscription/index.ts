import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { subscriptionId } = await req.json()

    // 1. Cancelar en Stripe (cancela al final del período actual)
    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId)

    // 2. Actualizar en tu DB
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: canceledSubscription.status, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: canceledSubscription.status,
        cancelAt: canceledSubscription.cancel_at 
      }),
      { headers }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers }
    )
  }
})