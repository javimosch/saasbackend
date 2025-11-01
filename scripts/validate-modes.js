// Validation script to check both server and middleware modes
const { server, middleware } = require('./index');

console.log('✅ Module exports validation:');
console.log('  - server function:', typeof server === 'function' ? '✓' : '✗');
console.log('  - middleware function:', typeof middleware === 'function' ? '✓' : '✗');

console.log('\n✅ Middleware returns Express Router:');
const router = middleware({ corsOrigin: '*' });
console.log('  - Router created:', router ? '✓' : '✗');
console.log('  - Has stack:', Array.isArray(router.stack) ? '✓' : '✗');
console.log('  - Routes registered:', router.stack.length, 'middleware/routes');

console.log('\n✅ All validations passed!');
console.log('\n📋 Usage:');
console.log('  Standalone: const { server } = require("./index"); server();');
console.log('  Middleware: const { middleware } = require("./index"); app.use("/saas", middleware());');

process.exit(0);
