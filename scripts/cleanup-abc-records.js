import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanup() {
  try {
    // Delete duplicate ABC pricing jobs
    const deletedJobs = await prisma.pricingJob.deleteMany({
      where: { name: 'ABC' }
    });
    console.log('Deleted', deletedJobs.count, 'ABC pricing jobs');
    
    // Delete the ABC campaign (it's from manual job, not real automation)
    const deletedCampaigns = await prisma.campaign.deleteMany({
      where: { name: 'ABC' }
    });
    console.log('Deleted', deletedCampaigns.count, 'ABC campaigns');
    
    console.log('Cleanup completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
