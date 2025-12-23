export function generateJobId(): string {
    // Format: job_<timestamp>_<random>
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `job_${timestamp}_${random}`;
  }