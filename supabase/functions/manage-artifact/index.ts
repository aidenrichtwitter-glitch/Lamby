import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { action, path, content, contentType } = await req.json();

    if (action === 'upload') {
      // Upload a file to lambda-artifacts bucket
      if (!path || !content) {
        return new Response(JSON.stringify({ error: 'path and content required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const blob = new Blob([content], { type: contentType || 'text/plain' });
      const { data, error } = await supabase.storage
        .from('lambda-artifacts')
        .upload(path, blob, { upsert: true, contentType: contentType || 'text/plain' });

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, path: data.path }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list') {
      const folder = path || '';
      const { data, error } = await supabase.storage
        .from('lambda-artifacts')
        .list(folder, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

      if (error) throw error;
      return new Response(JSON.stringify({ files: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete') {
      if (!path) {
        return new Response(JSON.stringify({ error: 'path required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error } = await supabase.storage
        .from('lambda-artifacts')
        .remove([path]);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'read') {
      if (!path) {
        return new Response(JSON.stringify({ error: 'path required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase.storage
        .from('lambda-artifacts')
        .download(path);

      if (error) throw error;
      const text = await data.text();
      return new Response(JSON.stringify({ content: text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: upload, list, delete, read' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
