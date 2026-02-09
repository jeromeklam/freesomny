import type { ResolvedRequest, HttpResponse } from '@api-client/shared'

// Lazy import: isolated-vm is a native C++ module that may not be
// available on cross-platform deployments (built on macOS, deployed on Linux).
// We load it on first use so the server can start without it.
let _ivm: any = null

async function getIvm() {
  if (_ivm) return _ivm
  try {
    const mod = await import('isolated-vm')
    _ivm = mod.default ?? mod
    return _ivm
  } catch {
    throw new Error('Script sandboxing not available (isolated-vm not loaded)')
  }
}

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
// Returns JSON string to avoid isolated-vm serialization issues
function createPreRequestCode(userScript: string): string {
  return `
    (function() {
      const __logs = [];
      const __errors = [];
      const __envUpdates = [];
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
        get: (key) => __env[key],
        set: (key, value) => { __envUpdates.push([key, String(value)]); __env[key] = String(value); },
        delete: (key) => { __envUpdates.push([key, null]); delete __env[key]; },
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

      // pw.* compatibility (Hoppscotch / Postman style)
      const pw = { env, request, console };

      try {
        ${userScript}
      } catch (e) {
        __errors.push(e.message || String(e));
      }

      // Return as JSON string to safely cross isolate boundary
      return JSON.stringify({
        logs: __logs,
        errors: __errors,
        envUpdates: __envUpdates,
        requestMods: __requestMods,
        skip: __skip,
      });
    })()
  `
}

// Create sandbox code for post-response scripts
// Returns JSON string to avoid isolated-vm serialization issues
function createPostResponseCode(userScript: string): string {
  return `
    (function() {
      const __logs = [];
      const __errors = [];
      const __tests = [];
      const __envUpdates = [];

      // Console API
      const console = {
        log: (...args) => __logs.push(args.map(String).join(' ')),
        error: (...args) => __errors.push(args.map(String).join(' ')),
        warn: (...args) => __logs.push('[warn] ' + args.map(String).join(' ')),
        info: (...args) => __logs.push('[info] ' + args.map(String).join(' ')),
      };

      // Environment API
      const env = {
        get: (key) => __env[key],
        set: (key, value) => { __envUpdates.push([key, String(value)]); __env[key] = String(value); },
        delete: (key) => { __envUpdates.push([key, null]); delete __env[key]; },
      };

      // Build headers: array of {key,value} with direct property access (both Hoppscotch and native)
      const __headersObj = (typeof __response !== 'undefined' && __response && __response.headers) ? __response.headers : {};
      const __headersArray = Object.entries(__headersObj).map(function(entry) { return { key: entry[0], value: entry[1] }; });
      // Also add object-style access: headers['content-type'] works
      for (var __hk in __headersObj) {
        __headersArray[__hk] = __headersObj[__hk];
      }

      // Safe response getters
      const __safeResponse = (typeof __response !== 'undefined' && __response) ? __response : {};

      // Response API (read-only, with body methods)
      const response = {
        get status() { return __safeResponse.status || 0; },
        get statusText() { return __safeResponse.statusText || ''; },
        get headers() { return __headersArray; },
        get time() { return __safeResponse.time || 0; },
        get size() { return __safeResponse.size || 0; },
        body: {
          text: function() { return __safeResponse.body || ''; },
          json: function() {
            try {
              return JSON.parse(__safeResponse.body);
            } catch (e) {
              return null;
            }
          },
        },
      };

      // pw.* compatibility (Hoppscotch / Postman style)
      // In Hoppscotch: pw.response.body is a raw string, not an object with methods
      const pw = {
        env: env,
        response: {
          get status() { return __safeResponse.status || 0; },
          get statusText() { return __safeResponse.statusText || ''; },
          get headers() { return __headersArray; },
          get body() { return __safeResponse.body || ''; },
          get time() { return __safeResponse.time || 0; },
          get size() { return __safeResponse.size || 0; },
        },
        console: console,
        test: undefined,
      };

      // Expect API (Hoppscotch pw.expect compatibility)
      function __createExpectation(value) {
        var assertion = {
          toBe: function(expected) { if (value !== expected) throw new Error('Expected ' + JSON.stringify(value) + ' to be ' + JSON.stringify(expected)); return true; },
          toBeLevel2xx: function() { if (value < 200 || value >= 300) throw new Error('Expected status ' + value + ' to be 2xx'); return true; },
          toBeLevel3xx: function() { if (value < 300 || value >= 400) throw new Error('Expected status ' + value + ' to be 3xx'); return true; },
          toBeLevel4xx: function() { if (value < 400 || value >= 500) throw new Error('Expected status ' + value + ' to be 4xx'); return true; },
          toBeLevel5xx: function() { if (value < 500 || value >= 600) throw new Error('Expected status ' + value + ' to be 5xx'); return true; },
          toHaveProperty: function(key) { if (typeof value !== 'object' || value === null || !(key in value)) throw new Error('Expected object to have property "' + key + '"'); return true; },
          toBeType: function(type) { if (typeof value !== type) throw new Error('Expected type "' + typeof value + '" to be "' + type + '"'); return true; },
          toInclude: function(item) {
            if (typeof value === 'string') { if (value.indexOf(item) === -1) throw new Error('Expected string to include "' + item + '"'); }
            else if (Array.isArray(value)) { if (value.indexOf(item) === -1) throw new Error('Expected array to include ' + JSON.stringify(item)); }
            else throw new Error('toInclude requires string or array');
            return true;
          },
          toHaveLength: function(len) { if (!value || value.length !== len) throw new Error('Expected length ' + (value ? value.length : 0) + ' to be ' + len); return true; },
          not: {
            toBe: function(expected) { if (value === expected) throw new Error('Expected ' + JSON.stringify(value) + ' not to be ' + JSON.stringify(expected)); return true; },
            toBeLevel2xx: function() { if (value >= 200 && value < 300) throw new Error('Expected status ' + value + ' not to be 2xx'); return true; },
            toBeLevel3xx: function() { if (value >= 300 && value < 400) throw new Error('Expected status ' + value + ' not to be 3xx'); return true; },
            toBeLevel4xx: function() { if (value >= 400 && value < 500) throw new Error('Expected status ' + value + ' not to be 4xx'); return true; },
            toBeLevel5xx: function() { if (value >= 500 && value < 600) throw new Error('Expected status ' + value + ' not to be 5xx'); return true; },
            toHaveProperty: function(key) { if (typeof value === 'object' && value !== null && key in value) throw new Error('Expected object not to have property "' + key + '"'); return true; },
            toBeType: function(type) { if (typeof value === type) throw new Error('Expected type not to be "' + type + '"'); return true; },
            toInclude: function(item) {
              if (typeof value === 'string' && value.indexOf(item) !== -1) throw new Error('Expected string not to include "' + item + '"');
              if (Array.isArray(value) && value.indexOf(item) !== -1) throw new Error('Expected array not to include ' + JSON.stringify(item));
              return true;
            },
          },
        };
        return assertion;
      }

      // Test API
      function test(name, fn) {
        try {
          fn();
          __tests.push({ name: name, passed: true });
        } catch (e) {
          __tests.push({ name: name, passed: false });
          __errors.push('Test "' + name + '" failed: ' + (e.message || String(e)));
        }
      }
      pw.test = test;
      pw.expect = __createExpectation;

      // Top-level aliases
      const expect = __createExpectation;

      try {
        ${userScript}
      } catch (e) {
        __errors.push(e.message || String(e));
      }

      // Return as JSON string to safely cross isolate boundary
      return JSON.stringify({
        logs: __logs,
        errors: __errors,
        tests: __tests,
        envUpdates: __envUpdates,
      });
    })()
  `
}

export async function runPreRequestScript(
  script: string,
  context: ScriptContext
): Promise<ScriptResult> {
  const ivm = await getIvm()
  const isolate = new ivm.Isolate({ memoryLimit: 8 })

  try {
    const ctx = await isolate.createContext()
    const jail = ctx.global

    // Set up environment as plain object (bracket access)
    await jail.set('__env', new ivm.ExternalCopy(Object.fromEntries(context.env)).copyInto())

    // Set up request
    if (context.request) {
      await jail.set('__request', new ivm.ExternalCopy(context.request).copyInto())
    }

    const code = createPreRequestCode(script)
    const compiledScript = await isolate.compileScript(code)
    const jsonResult = await compiledScript.run(ctx, { timeout: 5000 })

    // Result is a JSON string from the sandbox
    if (typeof jsonResult !== 'string') {
      return {
        success: false,
        logs: [],
        errors: ['Script returned no result'],
        tests: [],
        envUpdates: new Map(),
        skip: false,
      }
    }

    const parsed = JSON.parse(jsonResult) as {
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
  const ivm = await getIvm()
  const isolate = new ivm.Isolate({ memoryLimit: 8 })

  try {
    const ctx = await isolate.createContext()
    const jail = ctx.global

    // Set up environment as plain object (bracket access)
    await jail.set('__env', new ivm.ExternalCopy(Object.fromEntries(context.env)).copyInto())

    // Set up response
    if (context.response) {
      await jail.set('__response', new ivm.ExternalCopy(context.response).copyInto())
    }

    const code = createPostResponseCode(script)
    const compiledScript = await isolate.compileScript(code)
    const jsonResult = await compiledScript.run(ctx, { timeout: 5000 })

    // Result is a JSON string from the sandbox
    if (typeof jsonResult !== 'string') {
      return {
        success: false,
        logs: [],
        errors: ['Script returned no result'],
        tests: [],
        envUpdates: new Map(),
        skip: false,
      }
    }

    const parsed = JSON.parse(jsonResult) as {
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
