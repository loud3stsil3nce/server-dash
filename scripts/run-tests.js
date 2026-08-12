import { runSystemServiceTests } from '../server/tests/systemService.test.js';
import { runMinecraftServiceTests } from '../server/tests/minecraftService.test.js';
import { runApiRoutesTests } from '../server/tests/apiRoutes.test.js';

process.env.NODE_ENV = 'test';

async function main() {
  console.log('🚀 Running Server-Dash Comprehensive Test Suite...\n');
  const start = Date.now();

  try {
    await runSystemServiceTests();
    await runMinecraftServiceTests();
    await runApiRoutesTests();

    console.log(`\n✅ ALL TESTS PASSED SUCCESSFULLY in ${Date.now() - start}ms!`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
  }
}

main();
