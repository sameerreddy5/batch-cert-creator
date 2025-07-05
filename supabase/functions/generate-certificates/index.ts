import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { batchId } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get batch details with template
    const { data: batch, error: batchError } = await supabase
      .from('certificate_batches')
      .select(`
        *,
        template:certificate_templates(*)
      `)
      .eq('id', batchId)
      .single()

    if (batchError) throw batchError

    // Get all certificates for this batch
    const { data: certificates, error: certificatesError } = await supabase
      .from('certificates')
      .select('*')
      .eq('batch_id', batchId)
      .eq('status', 'pending')

    if (certificatesError) throw certificatesError

    console.log(`Processing ${certificates.length} certificates for batch ${batchId}`)

    // Process certificates in batches to avoid timeouts
    const processedCertificates = []
    
    for (const certificate of certificates) {
      try {
        // Generate HTML content by replacing placeholders
        let htmlContent = batch.template.template_content
        
        if (certificate.certificate_data) {
          Object.entries(certificate.certificate_data).forEach(([key, value]) => {
            const placeholder = `{{${key}}}`
            htmlContent = htmlContent.replace(new RegExp(placeholder, 'g'), String(value))
          })
        }

        // For now, we'll mark as generated without actual PDF creation
        // In production, you'd use Puppeteer or similar to generate PDFs
        const certificateFileName = `certificate_${certificate.id}.html`
        
        // Upload HTML content to storage (simplified approach)
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(certificateFileName, new Blob([htmlContent], { type: 'text/html' }))

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw uploadError
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('certificates')
          .getPublicUrl(certificateFileName)

        // Update certificate status
        const { error: updateError } = await supabase
          .from('certificates')
          .update({
            status: 'generated',
            certificate_url: publicUrl
          })
          .eq('id', certificate.id)

        if (updateError) throw updateError

        processedCertificates.push(certificate.id)
        console.log(`Processed certificate ${certificate.id}`)

      } catch (error) {
        console.error(`Error processing certificate ${certificate.id}:`, error)
        
        // Mark certificate as failed
        await supabase
          .from('certificates')
          .update({
            status: 'failed',
            error_message: error.message
          })
          .eq('id', certificate.id)
      }
    }

    // Update batch status and count
    const { error: batchUpdateError } = await supabase
      .from('certificate_batches')
      .update({
        status: processedCertificates.length === certificates.length ? 'completed' : 'partial',
        generated_certificates: processedCertificates.length,
        updated_at: new Date().toISOString()
      })
      .eq('id', batchId)

    if (batchUpdateError) throw batchUpdateError

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCertificates.length,
        total: certificates.length,
        batchId
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in generate-certificates function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})