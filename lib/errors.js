import { randomUUID } from 'node:crypto';

export class ThreadsScoutError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'ThreadsScoutError';
    this.code = code;
    this.status = options.status || 500;
    this.retryable = Boolean(options.retryable);
    this.meta = options.meta || null;
    this.action = options.action || null;
  }
}

export function classifyMetaError({ status, body, scopeMissing = false }) {
  const apiError = body?.error || body || {};
  const code = apiError?.code ?? null;
  const subcode = apiError?.error_subcode ?? null;
  const message =
    apiError?.message ||
    apiError?.error_message ||
    `Threads API request failed (${status}).`;

  const meta = {
    httpStatus: status,
    metaCode: code,
    metaSubcode: subcode,
    metaType: apiError?.type || apiError?.error_type || null,
    trace: apiError?.fbtrace_id || null,
  };

  if (scopeMissing) {
    return new ThreadsScoutError(
      'PERMISSION_REQUIRED',
      'Meta did not grant the permission required for public profile research.',
      {
        status: 403,
        retryable: false,
        meta,
        action:
          'Reconnect Threads. If threads_profile_discovery is still missing after reconnecting, check the permission access/testing status in Meta Developer.',
      }
    );
  }

  if (status === 401 || code === 190) {
    return new ThreadsScoutError('TOKEN_INVALID', message, {
      status: 401,
      retryable: false,
      meta,
      action: 'Disconnect and reconnect Threads.',
    });
  }

  if (status === 403 || code === 10 || code === 200) {
    return new ThreadsScoutError('PERMISSION_REQUIRED', message, {
      status: 403,
      retryable: false,
      meta,
      action:
        'Reconnect Threads and verify the required permission is granted to this app.',
    });
  }

  if (status === 404) {
    return new ThreadsScoutError('ACCOUNT_UNAVAILABLE', message, {
      status: 404,
      retryable: false,
      meta,
      action: 'Check the exact public Threads username and try again.',
    });
  }

  if (status === 429) {
    return new ThreadsScoutError('RATE_LIMITED', message, {
      status: 429,
      retryable: true,
      meta,
      action: 'Wait a little and retry.',
    });
  }

  if (status >= 500) {
    return new ThreadsScoutError('META_TEMPORARY_ERROR', message, {
      status: 502,
      retryable: true,
      meta,
      action: 'Retry later. Do not rotate tokens or change code for a Meta 5xx error.',
    });
  }

  return new ThreadsScoutError('THREADS_API_ERROR', message, {
    status: 502,
    retryable: false,
    meta,
    action: 'Check the diagnostics and Threads app configuration.',
  });
}

export function publicError(error) {
  const requestId = randomUUID().slice(0, 12);

  if (error instanceof ThreadsScoutError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          action: error.action,
          retryable: error.retryable,
          requestId,
          diagnostics: error.meta,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Threads Scout hit an unexpected server error.',
        action: 'Retry once. If it repeats, inspect the Vercel function log.',
        retryable: true,
        requestId,
        diagnostics: null,
      },
    },
  };
}
