import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qxnxtnhtbpsgzprqtrjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4bnh0bmh0YnBzZ3pwcnF0cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjIzNDEsImV4cCI6MjA3OTAzODM0MX0.Lwj2kZPjYaM6M7VbUX48hSnCh3N2YB6iMJtdhFP9brU';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function sendTestNotification() {
  try {
    console.log('📤 Enviando notificación de prueba...');

    const { data, error } = await supabase.functions.invoke('send-push', {
      body: {
        title: '🧪 Notificación de Prueba',
        message: 'Si recibes esto, las notificaciones están funcionando correctamente!',
        url: '/'
      }
    });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Respuesta del servidor:', data);
    console.log('\nRevisa tu celular/navegador para ver la notificación');
  } catch (err) {
    console.error('❌ Error inesperado:', err);
  }
}

sendTestNotification();
