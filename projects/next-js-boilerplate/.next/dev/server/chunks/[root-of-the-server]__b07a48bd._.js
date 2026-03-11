;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="2c36b5e2-0bf3-531b-1487-f381acbfd366")}catch(e){}}();
module.exports = [
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/tags-manifest.external.js [external] (next/dist/server/lib/incremental-cache/tags-manifest.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/tags-manifest.external.js", () => require("next/dist/server/lib/incremental-cache/tags-manifest.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[externals]/node:http2 [external] (node:http2, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:http2", () => require("node:http2"));

module.exports = mod;
}),
"[externals]/node:zlib [external] (node:zlib, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:zlib", () => require("node:zlib"));

module.exports = mod;
}),
"[externals]/node:util [external] (node:util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:util", () => require("node:util"));

module.exports = mod;
}),
"[externals]/node:http [external] (node:http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:http", () => require("node:http"));

module.exports = mod;
}),
"[externals]/node:https [external] (node:https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:https", () => require("node:https"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[project]/projects/next-js-boilerplate/src/libs/Arcjet.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$next$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/next/index.js [middleware] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$arcjet$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/arcjet/index.js [middleware] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$next$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])({
    // Get your site key from https://launch.arcjet.com/Q6eLbRE
    // Use `process.env` instead of Env to reduce bundle size in middleware
    key: process.env.ARCJET_KEY ?? '',
    // Identify the user by their IP address
    characteristics: [
        'ip.src'
    ],
    rules: [
        // Protect against common attacks with Arcjet Shield
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$arcjet$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["shield"])({
            mode: 'LIVE'
        })
    ]
});
}),
"[project]/projects/next-js-boilerplate/src/utils/AppConfig.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppConfig",
    ()=>AppConfig,
    "ClerkLocalizations",
    ()=>ClerkLocalizations
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@clerk/localizations/dist/index.mjs [middleware] (ecmascript)");
;
/** Locale prefix strategy for next-intl routing. */ const localePrefix = 'as-needed';
const AppConfig = {
    name: 'Nextjs Starter',
    i18n: {
        locales: [
            'en',
            'fr'
        ],
        defaultLocale: 'en',
        localePrefix
    }
};
const supportedLocales = {
    en: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__["enUS"],
    fr: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__["frFR"]
};
const ClerkLocalizations = {
    defaultLocale: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$middleware$5d$__$28$ecmascript$29$__["enUS"],
    supportedLocales
};
}),
"[project]/projects/next-js-boilerplate/src/libs/I18nRouting.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "routing",
    ()=>routing
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$defineRouting$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$export__default__as__defineRouting$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/routing/defineRouting.js [middleware] (ecmascript) <export default as defineRouting>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/utils/AppConfig.ts [middleware] (ecmascript)");
;
;
const routing = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$defineRouting$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$export__default__as__defineRouting$3e$__["defineRouting"])({
    locales: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["AppConfig"].i18n.locales,
    localePrefix: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["AppConfig"].i18n.localePrefix,
    defaultLocale: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["AppConfig"].i18n.defaultLocale
});
}),
"[project]/projects/next-js-boilerplate/src/proxy.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "default",
    ()=>proxy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$next$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/next/index.js [middleware] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$arcjet$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/arcjet/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$clerkMiddleware$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@clerk/nextjs/dist/esm/server/clerkMiddleware.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$routeMatcher$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@clerk/nextjs/dist/esm/server/routeMatcher.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$middleware$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/middleware.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/server.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$Arcjet$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/libs/Arcjet.ts [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/libs/I18nRouting.ts [middleware] (ecmascript)");
;
;
;
;
;
;
const handleI18nRouting = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$middleware$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["routing"]);
const isProtectedRoute = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$routeMatcher$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createRouteMatcher"])([
    '/dashboard(.*)',
    '/:locale/dashboard(.*)'
]);
const isAuthPage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$routeMatcher$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createRouteMatcher"])([
    '/sign-in(.*)',
    '/:locale/sign-in(.*)',
    '/sign-up(.*)',
    '/:locale/sign-up(.*)'
]);
// Improve security with Arcjet
const aj = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$Arcjet$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["default"].withRule((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$arcjet$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["detectBot"])({
    mode: 'LIVE',
    // Block all bots except the following
    allow: [
        // See https://docs.arcjet.com/bot-protection/identifying-bots
        'CATEGORY:SEARCH_ENGINE',
        'CATEGORY:PREVIEW',
        'CATEGORY:MONITOR'
    ]
}));
async function proxy(request, event) {
    // Verify the request with Arcjet
    // Use `process.env` instead of Env to reduce bundle size in middleware
    if (process.env.ARCJET_KEY) {
        const decision = await aj.protect(request);
        if (decision.isDenied()) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Forbidden'
            }, {
                status: 403
            });
        }
    }
    // Clerk keyless mode doesn't work with i18n, this is why we need to run the middleware conditionally
    if (isAuthPage(request) || isProtectedRoute(request)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$server$2f$clerkMiddleware$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["clerkMiddleware"])(async (auth, req)=>{
            if (isProtectedRoute(req)) {
                const locale = req.nextUrl.pathname.match(/(\/.*)\/dashboard/)?.at(1) ?? '';
                const signInUrl = new URL(`${locale}/sign-in`, req.url);
                await auth.protect({
                    unauthenticatedUrl: signInUrl.toString()
                });
            }
            return handleI18nRouting(req);
        })(request, event);
    }
    return handleI18nRouting(request);
}
const config = {
    // Match all pathnames except for
    // - … if they start with `/_next`, `/_vercel` or `monitoring`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    matcher: '/((?!_next|_vercel|monitoring|.*\\..*).*)'
};
}),
];

//# debugId=2c36b5e2-0bf3-531b-1487-f381acbfd366
//# sourceMappingURL=%5Broot-of-the-server%5D__b07a48bd._.js.map