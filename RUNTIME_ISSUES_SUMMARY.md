# Runtime Issues Summary - For GitHub Issue Creation

## Issue Title
Runtime Issues: Plugin Initialization Failures and Test Errors

## Issue Body (Copy this to create a GitHub issue)

```markdown
## Summary
Encountered several runtime issues during development and testing of the Wormhole data provider plugin that prevented proper initialization and test execution.

## Issues Fixed ✅

### 1. Plugin Initialization Failure
**Problem:** Plugin initialization failed when Wormhole API was unavailable, causing the entire plugin to crash.

**Root Cause:** The `ping()` method was called during initialization without proper error handling. If the API was down, initialization would fail.

**Fix:** Made initialization resilient by catching ping errors:
```typescript
yield* service.ping().pipe(
  Effect.catchAll(() => Effect.void)
);
```

**Files:** `packages/wormhole-plugin/src/index.ts`

### 2. Test Initialization Failures
**Problem:** Integration tests failed because fetch mocks were set up incorrectly, causing plugin initialization to fail in tests.

**Root Cause:** Tests mocked fetch to reject during `beforeAll`, which prevented plugin initialization.

**Fix:** Updated test setup to mock successful health checks during initialization, then reset mocks for actual test calls.

**Files:** `packages/wormhole-plugin/src/__tests__/integration/plugin.test.ts`

### 3. Dependency Resolution Issues
**Problem:** Plugin couldn't be installed in standalone mode due to workspace references (`catalog:` and `link:`).

**Root Cause:** Template used monorepo-specific dependency references that don't work standalone.

**Fix:** 
- Updated `package.json` to use npm package versions (`every-plugin: ^0.3.2`)
- Made `zephyr-rspack-plugin` optional in rspack config

**Files:** 
- `packages/wormhole-plugin/package.json`
- `packages/wormhole-plugin/rspack.config.cjs`

### 4. Error Handling Improvements
**Problem:** Errors weren't properly mapped to CommonPluginErrors following every-plugin best practices.

**Fix:** Implemented proper error mapping in handlers:
- `PluginConfigurationError` → `errors.UNAUTHORIZED`
- Rate limiting → `errors.RATE_LIMITED`
- Other errors → `errors.SERVICE_UNAVAILABLE`

**Files:** `packages/wormhole-plugin/src/index.ts`, `packages/wormhole-plugin/src/service.ts`

## Remaining Issues ⚠️

### Test Execution Time
Tests are taking longer than expected due to retry logic with exponential backoff. Consider:
- Reducing retry delays in test environment
- Optimizing mock response times
- Using test-specific timeout configurations

## Testing Status
- ✅ Unit tests: Passing
- ⚠️ Integration tests: Need final verification
- ✅ Service layer: Handles errors gracefully
- ✅ Initialization: Resilient to API failures

## Related Commits
- `1311487` - Initial commit
- `9b6965f` - Error handling improvements
- `5d06fd2` - Initialization fixes
- `ed9f5b7` - Documentation

## Full Details
See [ISSUES.md](./ISSUES.md) for complete documentation of all issues and solutions.
```

## To Create GitHub Issue

1. Go to: https://github.com/Drehalas/data_adapter_near/issues/new
2. Use the title: "Runtime Issues: Plugin Initialization Failures and Test Errors"
3. Copy the Issue Body section above
4. Add appropriate labels: `bug`, `runtime`, `help wanted`
5. Submit the issue

