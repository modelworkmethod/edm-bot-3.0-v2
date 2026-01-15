/**
 * Test Framework
 * Comprehensive testing utilities for the Discord bot
 */

class TestFramework {
  constructor(suiteName) {
    this.suiteName = suiteName;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.skipped = 0;
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Start test suite
   */
  start() {
    this.startTime = Date.now();
    console.log('========================================');
    console.log(`TEST SUITE: ${this.suiteName}`);
    console.log('========================================');
    console.log('');
  }

  /**
   * Run a test
   */
  test(name, testFn) {
    try {
      const result = testFn();
      if (result === true) {
        this.passed++;
        console.log(`✅ PASS - ${name}`);
        this.tests.push({ name, status: 'PASS', error: null });
      } else if (result === null) {
        this.skipped++;
        console.log(`⏭️  SKIP - ${name}`);
        this.tests.push({ name, status: 'SKIP', error: null });
      } else if (result && result.warning) {
        this.warnings++;
        console.log(`⚠️  WARN - ${name}: ${result.message}`);
        this.tests.push({ name, status: 'WARN', error: result.message });
      } else {
        this.failed++;
        console.log(`❌ FAIL - ${name}`);
        if (result && result.message) {
          console.log(`   Error: ${result.message}`);
        }
        this.tests.push({ name, status: 'FAIL', error: result?.message || 'Unknown error' });
      }
    } catch (error) {
      this.failed++;
      console.log(`❌ FAIL - ${name}`);
      console.log(`   Exception: ${error.message}`);
      this.tests.push({ name, status: 'FAIL', error: error.message });
    }
  }

  /**
   * Test with custom assertion
   */
  assert(name, condition, expected, actual) {
    if (condition) {
      this.passed++;
      console.log(`✅ PASS - ${name}`);
      this.tests.push({ name, status: 'PASS', error: null });
    } else {
      this.failed++;
      console.log(`❌ FAIL - ${name}`);
      console.log(`   Expected: ${expected}`);
      console.log(`   Actual: ${actual}`);
      this.tests.push({ name, status: 'FAIL', error: `Expected ${expected}, got ${actual}` });
    }
  }

  /**
   * Test file exists
   */
  testFileExists(name, filePath, fs, path) {
    const fullPath = path.join(process.cwd(), filePath);
    const exists = fs.existsSync(fullPath);
    this.assert(name, exists, 'File exists', exists ? 'File exists' : 'File missing');
    return exists;
  }

  /**
   * Test file contains text
   */
  testFileContains(name, filePath, searchText, fs, path) {
    const fullPath = path.join(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      this.assert(name, false, 'Contains text', 'File not found');
      return false;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    const contains = content.includes(searchText);
    this.assert(name, contains, `Contains "${searchText}"`, contains ? 'Found' : 'Not found');
    return contains;
  }

  /**
   * Group tests under a category
   */
  category(categoryName) {
    console.log('');
    console.log(`📊 ${categoryName}`);
    console.log('─'.repeat(40));
  }

  /**
   * End test suite and show summary
   */
  end() {
    this.endTime = Date.now();
    const duration = ((this.endTime - this.startTime) / 1000).toFixed(2);
    const total = this.passed + this.failed + this.warnings + this.skipped;
    
    console.log('');
    console.log('========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⚠️  Warnings: ${this.warnings}`);
    console.log(`⏭️  Skipped: ${this.skipped}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log('');
    
    const passRate = total > 0 ? ((this.passed / total) * 100).toFixed(1) : 0;
    console.log(`Pass Rate: ${passRate}%`);
    
    if (this.failed === 0 && this.warnings === 0) {
      console.log('');
      console.log('🎉 ALL TESTS PASSED!');
      console.log('');
    } else if (this.failed === 0) {
      console.log('');
      console.log('✅ All critical tests passed (some warnings)');
      console.log('');
    } else {
      console.log('');
      console.log('❌ Some tests failed. Review above.');
      console.log('');
    }

    return {
      suite: this.suiteName,
      total,
      passed: this.passed,
      failed: this.failed,
      warnings: this.warnings,
      skipped: this.skipped,
      duration,
      passRate,
      tests: this.tests
    };
  }

  /**
   * Check if all tests passed
   */
  allPassed() {
    return this.failed === 0;
  }
}

module.exports = TestFramework;
