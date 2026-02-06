import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase credentials');
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
}

export async function hasPermission(
  sessionId: string,
  action: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('session_permissions')
    .select('action')
    .eq('session_id', sessionId)
    .eq('action', action)
    .single();
  
  return !error && !!data;
}

export async function checkRateLimit(
  userId: string,
  action: string,
  maxRequests = 10
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('check_rate_limit', {
      p_user_id: userId,
      p_action: action,
      p_max_requests: maxRequests
    });
  
  if (error) {
    console.error('Rate limit check error:', error);
    return false;
  }
  
  return data === true;
}
