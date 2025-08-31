#!/usr/bin/env node

/**
 * Generate VAPID keys for Web Push notifications
 * Run this script to generate the required VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
 * for your .env file.
 * 
 * Usage: node generate-vapid-keys.js
 */

const crypto = require('crypto');

function urlBase64(buffer) {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function generateVapidKeys() {
    // Generate a random private key (32 bytes)
    const privateKeyBytes = crypto.randomBytes(32);
    
    // Create ECDH with the prime256v1 curve (same as secp256r1)
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(privateKeyBytes);
    
    // Get the public key in uncompressed format
    const publicKeyBytes = ecdh.getPublicKey();
    
    // Convert to URL-safe base64
    const privateKey = urlBase64(privateKeyBytes);
    const publicKey = urlBase64(publicKeyBytes);
    
    return {
        publicKey,
        privateKey
    };
}

try {
    const keys = generateVapidKeys();
    
    console.log('🔑 VAPID Keys Generated Successfully!');
    console.log('');
    console.log('Add these to your .env file:');
    console.log('');
    console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.log('VAPID_SUBJECT=mailto:admin@yourdomain.com');
    console.log('');
    console.log('⚠️  IMPORTANT:');
    console.log('- Keep the private key secure and never share it');
    console.log('- Change VAPID_SUBJECT to your actual email or domain');
    console.log('- The public key will be used by the frontend for push subscriptions');
    console.log('- The private key will be used by the backend to send push notifications');
    
} catch (error) {
    console.error('❌ Failed to generate VAPID keys:', error.message);
    process.exit(1);
}