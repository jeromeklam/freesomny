import ivm from 'isolated-vm'
import type { ResolvedRequest, HttpResponse } from '@api-client/shared'

interface ScriptContext {
  env: Map<string, string>
  request?: {
    url: string
    method: string
    headers: Record<string, string>
    body: string | null
  }
  response?: {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    time: number
    size: number
  }
}

interface ScriptResult {
  success: boolean
  logs: string[]
  errors: string[]
  tests: Array<{ name: string; passed: boolean }>
  envUpdates: Map<string, string | null> // null = delete
  requestModifications?: {
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
  }
  skip: boolean
}

// Create sandbox code for pre-request scripts
function createPreRequestCode(userScript: string): string {
  return `
    (function() {
      const __logs = [];
      const __errors = [];
      const __envUpdates = new Map();
      let __skip = false;
      const __requestMods = {};

      // Console API
      const console = {
        log: (...args) => __logs.push(args.map(String).join(' ')),
        error: (...args) => __errors.push(args.map(String).join(' ')),
        warn: (...args) => __logs.push('[warn] ' + args.map(String).join(' ')),
        info: (...args) => __logs.push('[info] ' + args.map(String).join(' ')),
      };

      // Environment API
      const env = {
        get: (key) => __env.get(key),
        set: (key, value) => __envUpdates.set(key, value),
        delete: (key) => __envUpdates.set(key, null),
      };

      // Request API (pre-request)
      const request = {
        get url() { return __request.url; },
        set url(v) { __request.url = v; __requestMods.url = v; },
        get method() { return __request.method; },
        set method(v) { __request.method = v; __requestMods.method = v; },
        headers: {
          get: (key) => __request.headers[key],
          set: (key, value) => {
            __request.headers[key] = value;
            __requestMods.headers = __requestMods.headers || {};
            __requestMods.headers[key] = value;
          },
          delete: (key) => {
            delete __request.headers[key];
            __requestMods.headers = __requestMods.headers || {};
            __requestMods.headers[key] = undefined;
          },
        },
        body: {
          text: () => __request.body || '',
          json: () => __request.body ? JSON.parse(__request.body) : null,
          set: (value) => {
            __request.body = value;
            __requestMods.body = value;
          },
          setJSON: (value) => {
            const str = JSON.stringify(value);
            __request.body = str;
            __requestMods.body = str;
          },
        },
        skip: () => { __skip = true; },
      };

      try {
        ${userScript}
      } catch (e) {
        __errors.push(e.message || String(e));
      }

      return {
        logs: __logs,
        errors: __errors,
        envUpdates: Array.from(__envUpdates.entries()),
        requestMods: __requestMods,
        skip: __skip,
      };
    })()
  `
}

// Create sandbox code for post-response scripts
function createPostResponseCode(userScript: string): string {
  return `
    (function() {
      const __logs = [];
      const __errors = [];
      const __tests = [];
      const __envUpdates = new Map();

      // Console API
      const console = {
        log: (...args) => __logs.push(args.map(String).join(' ')),
        error: (...args) => __errors.push(args.map(String).join(' ')),
        warn: (...args) => __logs.push('[warn] ' + args.map(String).join(' ')),
        info: (...args) => __logs.push('[info] ' + args.map(String).join(' ')),
      };

      // Environment API
      const env = {
        get: (key) => __env.get(key),
        set: (key, value) => __envUpdates.set(key, value),
        delete: (key) => __envUpdates.set(key, null),
      };

      // Response API (read-only, except body parsing)
      const response = {
        get status() { return __response.status; },
        get statusText() { return __response.statusText; },
        get headers() { return __response.headers; },
        get time() { return __response.time; },
        get size() { return __response.size; },
        body: {
          text: () => __response.body,
          json: () => {
            try {
              return JSON.parse(__response.body);
            } catch {
              return null;
            }
          },
        },
      };

      // Test API
      function test(name, fn) {
        try {
          const result = fn();
          __tests.push({ name, passed: !!result });
        } catch (e) {
          __tests.push({ name, passed: false });
          __errors.push('Test "' + name + '" failed: ' + (e.message || String(e)));
        }
      }

      try {
        ${userScript}
      } catch (e) {
        __errors.push(e.message || String(e));
      }

      return {
        logs: __logs,
        errors: __errors,
        tests: __tests,
        envUpdates: Array.from(__envUpdates.entries()),
      };
    })()
  `
}

export async function runPreRequestScript(
  script: string,
  context: ScriptContext
): Promise<ScriptResult> {
  const isolate = new ivm.Isolate({ memoryLimit: 8 })

  try {
    const ctx = await isolate.createContext()
    const jail = ctx.global

    // Set up environment
    await jail.set('__env', new ivm.ExternalCopy(Object.fromEntries(context.env)).copyInto())

    // Set up request
    if (context.request) {
      await jail.set('__request', new ivm.ExternalCopy(context.request).copyInto())
    }

    const code = createPreRequestCode(script)
    const compiledScript = await isolate.compileScript(code)
    const result = await compiledScript.run(ctx, { timeout: 5000 })

    const parsed = result as {
      logs: string[]
      errors: string[]
      envUpdates: Array<[string, string | null]>
      requestMods: Record<string, unknown>
      skip: boolean
    }

    return {
      success: parsed.errors.length === 0,
      logs: parsed.logs || [],
      errors: parsed.errors || [],
      tests: [],
      envUpdates: new Map(parsed.envUpdates || []),
      requestModifications: parsed.requestMods as ScriptResult['requestModifications'],
      skip: parsed.skip || false,
    }
  } catch (error) {
    return {
      success: false,
      logs: [],
      errors: [error instanceof Error ? error.message : 'Script execution failed'],
      tests: [],
      envUpdates: new Map(),
      skip: false,
    }
  } finally {
    isolate.dispose()
  }
}

export async function runPostResponseScript(
  script: string,
  context: ScriptContext
): Promise<ScriptResult> {
  const isolate = new ivm.Isolate({ memoryLimit: 8 })

  try {
    const ctx = await isolate.createContext()
    const jail = ctx.global

    // Set up environment
    await jail.set('__env', new ivm.ExternalCopy(Object.fromEntries(context.env)).copyInto())

    // Set up response
    if (context.response) {
      await jail.set('__response', new ivm.ExternalCopy(context.response).copyInto())
    }

    const code = createPostResponseCode(script)
    const compiledScript = await isolate.compileScript(code)
    const result = await compiledScript.run(ctx, { timeout: 5000 })

    const parsed = result as {
      logs: string[]
      errors: string[]
      tests: Array<{ name: string; passed: boolean }>
      envUpdates: Array<[string, string | null]>
    }

    return {
      success: parsed.errors.length === 0,
      logs: parsed.logs || [],
      errors: parsed.errors || [],
      tests: parsed.tests || [],
      envUpdates: new Map(parsed.envUpdates || []),
      skip: false,
    }
  } catch (error) {
    return {
      success: false,
      logs: [],
      errors: [error instanceof Error ? error.message : 'Script execution failed'],
      tests: [],
      envUpdates: new Map(),
      skip: false,
    }
  } finally {
    isolate.dispose()
  }
}

// Execute all scripts in order
export async function executeScripts(
  scripts: Array<{ source: string; script: string }>,
  context: ScriptContext,
  isPreRequest: boolean
): Promise<{
  success: boolean
  logs: Array<{ source: string; message: string }>
  errors: Array<{ source: string; message: string }>
  tests: Array<{ source: string; name: string; passed: boolean }>
  envUpdates: Map<string, string | null>
  requestModifications?: ScriptResult['requestModifications']
  skip: boolean
}> {
  const allLogs: Array<{ source: string; message: string }> = []
  const allErrors: Array<{ source: string; message: string }> = []
  const allTests: Array<{ source: string; name: string; passed: boolean }> = []
  const allEnvUpdates = new Map<string, string | null>()
  let requestMods: ScriptResult['requestModifications']
  let skip = false

  for (const { source, script } of scripts) {
    const result = isPreRequest
      ? await runPreRequestScript(script, context)
      : await runPostResponseScript(script, context)

    // Collect logs
    for (const log of result.logs) {
      allLogs.push({ source, message: log })
    }

    // Collect errors
    for (const error of result.errors) {
      allErrors.push({ source, message: error })
    }

    // Collect tests
    for (const test of result.tests) {
      allTests.push({ source, name: test.name, passed: test.passed })
    }

    // Merge env updates
    for (const [key, value] of result.envUpdates) {
      allEnvUpdates.set(key, value)
      // Also update context for next script
      if (value === null) {
        context.env.delete(key)
      } else {
        context.env.set(key, value)
      }
    }

    // Apply request modifications for pre-request scripts
    if (isPreRequest && result.requestModifications && context.request) {
      if (result.requestModifications.url) {
        context.request.url = result.requestModifications.url
      }
      if (result.requestModifications.method) {
        context.request.method = result.requestModifications.method
      }
      if (result.requestModifications.headers) {
        context.request.headers = { ...context.request.headers, ...result.requestModifications.headers }
      }
      if (result.requestModifications.body !== undefined) {
        context.request.body = result.requestModifications.body
      }
      requestMods = { ...requestMods, ...result.requestModifications }
    }

    if (result.skip) {
      skip = true
      break
    }
  }

  return {
    success: allErrors.length === 0,
    logs: allLogs,
    errors: allErrors,
    tests: allTests,
    envUpdates: allEnvUpdates,
    requestModifications: requestMods,
    skip,
  }
}
