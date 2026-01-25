import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Creates VAPID Keys for Push Notifications:');
console.log('------------------------------------------');
console.log('VAPID_PUBLIC_KEY:', vapidKeys.publicKey);
console.log('VAPID_PRIVATE_KEY:', vapidKeys.privateKey);
console.log('------------------------------------------');
console.log('1. Add VAPID_PUBLIC_KEY to your .env.local as VITE_VAPID_PUBLIC_KEY');
console.log('2. Add BOTH keys to your Supabase Edge Function secrets.');
