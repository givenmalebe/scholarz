#!/usr/bin/env node

/**
 * One-Time Admin Account Creation Script
 * 
 * This script creates a single admin account in Firebase.
 * Run this ONCE to set up your first admin user.
 * 
 * Usage: node scripts/create-admin.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

// Initialize Firebase Admin SDK with your service account
// You need to download the service account key from Firebase Console
let serviceAccount;
try {
  serviceAccount = require('../serviceAccountKey.json');
} catch (error) {
  console.error('❌ Error: serviceAccountKey.json not found!');
  console.error('\n📋 To fix this:');
  console.error('1. Go to: https://console.firebase.google.com/project/link-my-skills/settings/serviceaccounts');
  console.error('2. Click "Generate New Private Key"');
  console.error('3. Save the file as: serviceAccountKey.json in the project root');
  console.error('4. Run this script again\n');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'link-my-skills.firebasestorage.app'
});

const auth = admin.auth();
const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Helper function to prompt for password (hidden input)
function promptPassword(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    
    stdout.write(question);
    
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    
    let password = '';
    
    stdin.on('data', function(char) {
      char = char.toString('utf8');
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // Backspace
          password = password.slice(0, -1);
          stdout.clearLine();
          stdout.cursorTo(0);
          stdout.write(question + '*'.repeat(password.length));
          break;
        default:
          password += char;
          stdout.write('*');
          break;
      }
    });
  });
}

async function createAdminAccount() {
  console.log('\n🔐 Admin Account Creation\n');
  console.log('This will create a single admin account for your platform.');
  console.log('You only need to run this ONCE.\n');

  try {
    // Get admin details from user input
    const firstName = await prompt('First Name: ');
    const lastName = await prompt('Last Name: ');
    const email = await prompt('Email Address: ');
    const phone = await prompt('Phone Number: ');
    const password = await promptPassword('Password (min 6 chars): ');
    
    console.log('\n');

    // Validate inputs
    if (!firstName || !lastName || !email || !password) {
      console.error('❌ Error: All fields are required!');
      rl.close();
      process.exit(1);
    }

    if (password.length < 6) {
      console.error('❌ Error: Password must be at least 6 characters!');
      rl.close();
      process.exit(1);
    }

    console.log('🔄 Creating admin account...\n');

    // Check if user already exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log('⚠️  User with this email already exists!');
      console.log(`   UID: ${userRecord.uid}`);
      console.log(`   Email: ${userRecord.email}`);
      
      const updateExisting = await prompt('\nDo you want to update this user to Admin? (yes/no): ');
      if (updateExisting.toLowerCase() !== 'yes') {
        console.log('❌ Operation cancelled.');
        rl.close();
        process.exit(0);
      }
    } catch (error) {
      // User doesn't exist, create new one
      userRecord = await auth.createUser({
        email: email,
        password: password,
        emailVerified: true,
        disabled: false,
        displayName: `${firstName} ${lastName}`
      });
      console.log('✅ Created user in Firebase Authentication');
      console.log(`   UID: ${userRecord.uid}`);
    }

    // Set custom claims for admin access
    await auth.setCustomUserClaims(userRecord.uid, {
      role: 'Admin',
      verified: true,
      admin: true
    });
    console.log('✅ Set custom claims (role: Admin)');

    // Create/update Firestore document
    const userDocRef = db.collection('users').doc(userRecord.uid);
    const adminData = {
      email: email,
      role: 'Admin',
      verified: true,
      profile: {
        id: userRecord.uid,
        name: `${firstName} ${lastName}`,
        email: email,
        role: 'Platform Administrator',
        specializations: ['Platform Management', 'User Support', 'System Administration'],
        sectors: ['Administration', 'Technology'],
        location: 'Head Office',
        experience: 'Admin',
        qualifications: ['Platform Administrator'],
        rates: {},
        availability: 'Available',
        rating: 0.0,
        reviews: 0,
        verified: true,
        profileImage: '',
        aboutMe: 'Platform administrator with full system access'
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
      adminData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      await userDocRef.set(adminData);
      console.log('✅ Created Firestore document');
    } else {
      await userDocRef.update(adminData);
      console.log('✅ Updated Firestore document');
    }

    console.log('\n🎉 Admin account created successfully!\n');
    console.log('📋 Login Details:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: Admin`);
    console.log(`   UID: ${userRecord.uid}\n`);
    console.log('🔐 Keep these credentials safe!\n');
    console.log('You can now log in at: http://localhost:5173/login\n');

  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Run the script
createAdminAccount();

