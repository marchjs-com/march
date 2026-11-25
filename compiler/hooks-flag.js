// Imported first by register.js and node-loader.js (main thread and the module.register() hooks thread): load-ts.js
// then adds no in-thread sync hook. Node 22 crashes chaining one into these hooks (loadSync is not a function), and
// node-loader.js stubs .css itself.
globalThis[Symbol.for("march.asyncHooks")] = true;
