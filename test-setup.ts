// Test setup for vitest
import { beforeAll } from 'vitest';
import * as dotenv from 'dotenv';

// Load environment variables for tests
beforeAll(() => {
  dotenv.config({ path: '.env' });
});
