// Script to clean up duplicate ratings - keep only latest per user
const admin = require('firebase-admin');

// Check if service account file exists
let serviceAccount;
try {
  serviceAccount = require('../firebase-service-account.json');
} catch (error) {
  console.error('❌ Error: firebase-service-account.json not found!');
  console.error('Please download it from Firebase Console:');
  console.error('1. Go to: https://console.firebase.google.com/project/link-my-skills/settings/serviceaccounts/adminsdk');
  console.error('2. Click "Generate new private key"');
  console.error('3. Save as firebase-service-account.json in project root');
  process.exit(1);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'link-my-skills'
  });
}

const db = admin.firestore();

async function cleanupDuplicateRatings() {
  try {
    console.log('🔍 Scanning for duplicate ratings...\n');

    // Get all ratings
    const ratingsSnapshot = await db.collection('smeRatings').get();
    
    console.log(`📊 Found ${ratingsSnapshot.size} total rating documents\n`);

    // Group ratings by (smeId, sdpId) combination
    const ratingsMap = new Map();
    
    ratingsSnapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.smeId}___${data.sdpId}`;
      
      if (!ratingsMap.has(key)) {
        ratingsMap.set(key, []);
      }
      
      ratingsMap.get(key).push({
        id: doc.id,
        ...data,
        updatedAt: data.updatedAt?.toDate() || data.createdAt?.toDate() || new Date(0)
      });
    });

    console.log(`👥 Found ${ratingsMap.size} unique user-SME combinations\n`);

    let duplicatesFound = 0;
    let documentsToDelete = [];

    // Find duplicates
    ratingsMap.forEach((ratings, key) => {
      if (ratings.length > 1) {
        duplicatesFound++;
        const [smeId, sdpId] = key.split('___');
        
        console.log(`🔄 Duplicate found:`);
        console.log(`   SME ID: ${smeId}`);
        console.log(`   SDP ID: ${sdpId}`);
        console.log(`   Total duplicates: ${ratings.length}`);
        
        // Sort by updatedAt (newest first)
        ratings.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        
        const latest = ratings[0];
        console.log(`   ✅ Keeping: Rating ${latest.rating} (${latest.updatedAt.toISOString()})`);
        
        // Mark others for deletion
        for (let i = 1; i < ratings.length; i++) {
          const old = ratings[i];
          console.log(`   ❌ Deleting: Rating ${old.rating} (${old.updatedAt.toISOString()})`);
          documentsToDelete.push(old.id);
        }
        console.log('');
      }
    });

    if (duplicatesFound === 0) {
      console.log('✅ No duplicates found! Database is clean.\n');
      process.exit(0);
    }

    console.log(`\n📋 Summary:`);
    console.log(`   Total documents: ${ratingsSnapshot.size}`);
    console.log(`   Unique users: ${ratingsMap.size}`);
    console.log(`   Duplicates to remove: ${documentsToDelete.length}\n`);

    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('⚠️  Do you want to delete these duplicates? (yes/no): ', async (answer) => {
      if (answer.toLowerCase() === 'yes') {
        console.log('\n🗑️  Deleting duplicates...\n');
        
        const batch = db.batch();
        let batchCount = 0;
        
        for (const docId of documentsToDelete) {
          batch.delete(db.collection('smeRatings').doc(docId));
          batchCount++;
          
          // Firestore batch limit is 500
          if (batchCount === 500) {
            await batch.commit();
            console.log(`   Deleted batch of ${batchCount} documents...`);
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
          console.log(`   Deleted final batch of ${batchCount} documents...`);
        }
        
        console.log(`\n✅ Successfully deleted ${documentsToDelete.length} duplicate ratings!`);
        
        // Now update all SME ratings
        console.log('\n🔄 Updating SME profiles with correct counts...\n');
        
        const smeIds = new Set();
        ratingsMap.forEach((ratings, key) => {
          const [smeId] = key.split('___');
          smeIds.add(smeId);
        });
        
        for (const smeId of smeIds) {
          // Count unique ratings for this SME
          let uniqueCount = 0;
          let totalRating = 0;
          
          ratingsMap.forEach((ratings, key) => {
            const [rSmeId] = key.split('___');
            if (rSmeId === smeId) {
              uniqueCount++;
              // Use the latest rating (first in sorted array)
              totalRating += ratings[0].rating;
            }
          });
          
          const averageRating = uniqueCount > 0 ? Number((totalRating / uniqueCount).toFixed(1)) : 0.0;
          
          // Update SME profile
          await db.collection('users').doc(smeId).update({
            'profile.rating': averageRating,
            'profile.reviews': uniqueCount,
            'updatedAt': admin.firestore.Timestamp.now()
          });
          
          console.log(`   ✅ Updated SME ${smeId}: ${averageRating} (${uniqueCount} reviews)`);
        }
        
        console.log('\n🎉 Cleanup complete!');
      } else {
        console.log('\n❌ Cleanup cancelled.');
      }
      
      readline.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupDuplicateRatings();

