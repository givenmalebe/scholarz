// Script to check and display SME ratings from Firebase
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'link-my-skills'
  });
}

const db = admin.firestore();

async function checkRatings() {
  try {
    console.log('🔍 Checking SME ratings in Firebase...\n');

    // Get all SME users
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'SME')
      .get();

    console.log(`📊 Found ${usersSnapshot.size} SME(s)\n`);

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const profile = userData.profile || {};
      
      console.log(`👤 SME: ${profile.name || 'Unknown'}`);
      console.log(`   ID: ${userDoc.id}`);
      console.log(`   Current Rating: ${profile.rating || 0}`);
      console.log(`   Current Reviews: ${profile.reviews || 0}`);

      // Check ratings in smeRatings collection
      const ratingsSnapshot = await db.collection('smeRatings')
        .where('smeId', '==', userDoc.id)
        .get();

      console.log(`   Ratings Count: ${ratingsSnapshot.size}`);

      if (ratingsSnapshot.size > 0) {
        let totalRating = 0;
        ratingsSnapshot.forEach(ratingDoc => {
          const ratingData = ratingDoc.data();
          console.log(`   - Rating: ${ratingData.rating} stars by ${ratingData.sdpName}`);
          console.log(`     Comment: ${ratingData.comment || '(no comment)'}`);
          totalRating += ratingData.rating || 0;
        });

        const averageRating = Number((totalRating / ratingsSnapshot.size).toFixed(1));
        console.log(`   ✅ Calculated Average: ${averageRating}`);

        // Update if different
        if (profile.rating !== averageRating || profile.reviews !== ratingsSnapshot.size) {
          console.log(`   🔄 Updating profile with correct rating...`);
          await db.collection('users').doc(userDoc.id).update({
            'profile.rating': averageRating,
            'profile.reviews': ratingsSnapshot.size,
            updatedAt: admin.firestore.Timestamp.now()
          });
          console.log(`   ✅ Profile updated!`);
        } else {
          console.log(`   ℹ️  Rating already correct`);
        }
      } else {
        console.log(`   ℹ️  No ratings found`);
      }

      console.log('');
    }

    console.log('✅ Rating check complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error checking ratings:', error);
    process.exit(1);
  }
}

checkRatings();

