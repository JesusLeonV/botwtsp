const { Client, LocalAuth } = require('whatsapp-web.js');
console.log('Testing Client initialization...');
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: 'new',
        timeout: 30000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});
console.log('Client created');
client.on('qr', qr => console.log('QR_RECEIVED'));
client.on('ready', () => console.log('READY'));
client.on('disconnected', r => console.log('DISCONNECTED:', r));
client.initialize();
setTimeout(() => { console.log('TIMEOUT - no crash after 25s'); process.exit(0); }, 25000);
