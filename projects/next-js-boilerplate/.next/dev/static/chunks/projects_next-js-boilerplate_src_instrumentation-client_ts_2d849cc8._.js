;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="5c4e38bb-2add-8e47-0ed5-a444a3d6bc2d")}catch(e){}}();
(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/projects/next-js-boilerplate/src/instrumentation-client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
__turbopack_context__.s([
    "onRouterTransitionStart",
    ()=>onRouterTransitionStart
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$client$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@sentry/nextjs/build/esm/client/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2d$internal$2f$replay$2f$build$2f$npm$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@sentry-internal/replay/build/npm/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$core$2f$build$2f$esm$2f$logs$2f$console$2d$integration$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@sentry/core/build/esm/logs/console-integration.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$client$2f$browserTracingIntegration$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@sentry/nextjs/build/esm/client/browserTracingIntegration.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$browser$2f$build$2f$npm$2f$esm$2f$dev$2f$integrations$2f$spotlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@sentry/browser/build/npm/esm/dev/integrations/spotlight.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$client$2f$routing$2f$appRouterRoutingInstrumentation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@sentry/nextjs/build/esm/client/routing/appRouterRoutingInstrumentation.js [app-client] (ecmascript)");
globalThis["_sentryRouteManifest"] = "{\"dynamicRoutes\":[{\"path\":\"/:locale/sign-in/:sign-in*?\",\"regex\":\"^/([^/]+)/sign-in(?:/(.*))?$\",\"paramNames\":[\"locale\",\"sign-in\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale/sign-up/:sign-up*?\",\"regex\":\"^/([^/]+)/sign-up(?:/(.*))?$\",\"paramNames\":[\"locale\",\"sign-up\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale/dashboard\",\"regex\":\"^/([^/]+)/dashboard$\",\"paramNames\":[\"locale\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale/dashboard/user-profile/:user-profile*?\",\"regex\":\"^/([^/]+)/dashboard/user-profile(?:/(.*))?$\",\"paramNames\":[\"locale\",\"user-profile\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale\",\"regex\":\"^/([^/]+)$\",\"paramNames\":[\"locale\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale/about\",\"regex\":\"^/([^/]+)/about$\",\"paramNames\":[\"locale\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale/counter\",\"regex\":\"^/([^/]+)/counter$\",\"paramNames\":[\"locale\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale/portfolio\",\"regex\":\"^/([^/]+)/portfolio$\",\"paramNames\":[\"locale\"],\"hasOptionalPrefix\":true},{\"path\":\"/:locale/portfolio/:slug\",\"regex\":\"^/([^/]+)/portfolio/([^/]+)$\",\"paramNames\":[\"locale\",\"slug\"],\"hasOptionalPrefix\":true}],\"staticRoutes\":[],\"isrRoutes\":[\"/:locale/portfolio/:slug\"]}";
globalThis["_sentryNextJsVersion"] = "16.1.6";
globalThis["_sentryRewritesTunnelPath"] = "/monitoring";
;
if (!__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_SENTRY_DISABLED) {
    __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$client$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["init"]({
        dsn: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_SENTRY_DSN,
        // Add optional integrations for additional features
        integrations: [
            __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2d$internal$2f$replay$2f$build$2f$npm$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["replayIntegration"]({
                maskAllText: false,
                maskAllInputs: false,
                blockAllMedia: false
            }),
            __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$core$2f$build$2f$esm$2f$logs$2f$console$2d$integration$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["consoleLoggingIntegration"](),
            __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$client$2f$browserTracingIntegration$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["browserTracingIntegration"](),
            ...("TURBOPACK compile-time truthy", 1) ? [
                __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$browser$2f$build$2f$npm$2f$esm$2f$dev$2f$integrations$2f$spotlight$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["spotlightBrowserIntegration"]()
            ] : "TURBOPACK unreachable"
        ],
        // Adds request headers and IP for users, for more info visit
        sendDefaultPii: true,
        // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
        tracesSampleRate: 1,
        // Define how likely Replay events are sampled.
        // This sets the sample rate to be 10%. You may want this to be 100% while
        // in development and sample at a lower rate in production
        replaysSessionSampleRate: 0.1,
        // Define how likely Replay events are sampled when an error occurs.
        replaysOnErrorSampleRate: 1.0,
        // Enable logs to be sent to Sentry
        enableLogs: true,
        // Setting this option to true will print useful information to the console while you're setting up Sentry.
        debug: false
    });
}
const onRouterTransitionStart = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$sentry$2f$nextjs$2f$build$2f$esm$2f$client$2f$routing$2f$appRouterRoutingInstrumentation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["captureRouterTransitionStart"];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# debugId=5c4e38bb-2add-8e47-0ed5-a444a3d6bc2d
//# sourceMappingURL=projects_next-js-boilerplate_src_instrumentation-client_ts_2d849cc8._.js.map