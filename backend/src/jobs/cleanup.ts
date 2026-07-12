import { PFP } from '../models/PFP.js';
import { checkBlobExists } from '../services/shelby.js';

/**
 * Periodically checks if PFPs still exist on the Shelby network.
 * If a blob has expired and is deleted from Shelby, it will also be deleted from the Shelfy database.
 */
export function startExpiredBlobCleanupJob() {
  // Run every 1 hour
  const ONE_HOUR = 60 * 60 * 1000;
  
  setInterval(async () => {
    try {
      console.log('🧹 Running expired PFP cleanup job...');
      // Fetch all PFPs (for a massive production app, we'd only check ones near their expected expiration)
      const pfps = await PFP.find();
      let deletedCount = 0;
      
      for (const pfp of pfps) {
        const exists = await checkBlobExists(pfp.owner, pfp.blobName);
        if (!exists) {
          console.log(`[Cleanup] Blob ${pfp.blobName} expired on Shelby. Deleting PFP from DB...`);
          await PFP.deleteOne({ _id: pfp._id });
          deletedCount++;
        }
        
        // Small delay to prevent rate-limiting on Shelby Gateway
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      console.log(`✅ Cleanup job finished. Deleted ${deletedCount} expired PFPs.`);
    } catch (err) {
      console.error('❌ Error running cleanup job:', err);
    }
  }, ONE_HOUR);

  // Optionally, run it once 1 minute after startup
  setTimeout(() => {
    console.log('⏰ Scheduling initial expired PFP cleanup in 1 minute...');
    // We don't await this so it doesn't block startup
    (async () => {
      try {
        const pfps = await PFP.find();
        let deletedCount = 0;
        for (const pfp of pfps) {
          const exists = await checkBlobExists(pfp.owner, pfp.blobName);
          if (!exists) {
            console.log(`[Cleanup] Blob ${pfp.blobName} expired on Shelby. Deleting PFP from DB...`);
            await PFP.deleteOne({ _id: pfp._id });
            deletedCount++;
          }
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        console.log(`✅ Initial cleanup finished. Deleted ${deletedCount} expired PFPs.`);
      } catch (err) {
        console.error('❌ Error running initial cleanup:', err);
      }
    })();
  }, 60 * 1000);
}
