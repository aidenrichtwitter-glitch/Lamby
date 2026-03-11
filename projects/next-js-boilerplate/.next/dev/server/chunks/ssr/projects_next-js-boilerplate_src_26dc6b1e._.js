;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="c86d555d-f443-1564-0f75-806ff1415674")}catch(e){}}();
module.exports = [
"[project]/projects/next-js-boilerplate/src/utils/AppConfig.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AppConfig",
    ()=>AppConfig,
    "ClerkLocalizations",
    ()=>ClerkLocalizations
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@clerk/localizations/dist/index.mjs [app-rsc] (ecmascript)");
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
    en: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["enUS"],
    fr: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["frFR"]
};
const ClerkLocalizations = {
    defaultLocale: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$clerk$2f$localizations$2f$dist$2f$index$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["enUS"],
    supportedLocales
};
}),
"[project]/projects/next-js-boilerplate/src/libs/I18nRouting.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "routing",
    ()=>routing
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$defineRouting$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__defineRouting$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/routing/defineRouting.js [app-rsc] (ecmascript) <export default as defineRouting>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/utils/AppConfig.ts [app-rsc] (ecmascript)");
;
;
const routing = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$defineRouting$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__defineRouting$3e$__["defineRouting"])({
    locales: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AppConfig"].i18n.locales,
    localePrefix: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AppConfig"].i18n.localePrefix,
    defaultLocale: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$utils$2f$AppConfig$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AppConfig"].i18n.defaultLocale
});
}),
"[project]/projects/next-js-boilerplate/src/libs/I18n.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$use$2d$intl$2f$dist$2f$esm$2f$development$2f$core$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/use-intl/dist/esm/development/core.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$server$2f$react$2d$server$2f$getRequestConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__getRequestConfig$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/server/react-server/getRequestConfig.js [app-rsc] (ecmascript) <export default as getRequestConfig>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/libs/I18nRouting.ts [app-rsc] (ecmascript)");
;
;
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$server$2f$react$2d$server$2f$getRequestConfig$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__getRequestConfig$3e$__["getRequestConfig"])(async ({ requestLocale })=>{
    // Typically corresponds to the `[locale]` segment
    const requested = await requestLocale;
    const locale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$use$2d$intl$2f$dist$2f$esm$2f$development$2f$core$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["hasLocale"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["routing"].locales, requested) ? requested : __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["routing"].defaultLocale;
    return {
        locale,
        messages: (await __turbopack_context__.f({
            "../locales/en.json": {
                id: ()=>"[project]/projects/next-js-boilerplate/src/locales/en.json (json, async loader)",
                module: ()=>__turbopack_context__.A("[project]/projects/next-js-boilerplate/src/locales/en.json (json, async loader)")
            },
            "../locales/fr.json": {
                id: ()=>"[project]/projects/next-js-boilerplate/src/locales/fr.json (json, async loader)",
                module: ()=>__turbopack_context__.A("[project]/projects/next-js-boilerplate/src/locales/fr.json (json, async loader)")
            }
        }).import(`../locales/${locale}.json`)).default
    };
});
}),
"[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PostHogProvider",
    ()=>PostHogProvider
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const PostHogProvider = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call PostHogProvider() from the server but PostHogProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx <module evaluation>", "PostHogProvider");
}),
"[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PostHogProvider",
    ()=>PostHogProvider
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const PostHogProvider = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call PostHogProvider() from the server but PostHogProvider is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx", "PostHogProvider");
}),
"[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$components$2f$analytics$2f$PostHogProvider$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$components$2f$analytics$2f$PostHogProvider$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$components$2f$analytics$2f$PostHogProvider$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/projects/next-js-boilerplate/src/components/DemoBadge.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DemoBadge",
    ()=>DemoBadge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
;
const DemoBadge = ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed right-20 bottom-0 z-10",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            href: "https://github.com/ixartz/Next-js-Boilerplate",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-md bg-gray-900 px-3 py-2 font-semibold text-gray-100",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-gray-500",
                        children: "Demo of"
                    }, void 0, false, {
                        fileName: "[project]/projects/next-js-boilerplate/src/components/DemoBadge.tsx",
                        lineNumber: 7,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    ` Next.js Boilerplate`
                ]
            }, void 0, true, {
                fileName: "[project]/projects/next-js-boilerplate/src/components/DemoBadge.tsx",
                lineNumber: 6,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/projects/next-js-boilerplate/src/components/DemoBadge.tsx",
            lineNumber: 3,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/projects/next-js-boilerplate/src/components/DemoBadge.tsx",
        lineNumber: 2,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
}),
"[project]/projects/next-js-boilerplate/src/app/[locale]/layout.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RootLayout,
    "generateStaticParams",
    ()=>generateStaticParams,
    "metadata",
    ()=>metadata,
    "viewport",
    ()=>viewport
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$use$2d$intl$2f$dist$2f$esm$2f$development$2f$core$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/use-intl/dist/esm/development/core.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$react$2d$server$2f$NextIntlClientProviderServer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__NextIntlClientProvider$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/react-server/NextIntlClientProviderServer.js [app-rsc] (ecmascript) <export default as NextIntlClientProvider>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$server$2f$react$2d$server$2f$RequestLocaleCache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__setCachedRequestLocale__as__setRequestLocale$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/server/react-server/RequestLocaleCache.js [app-rsc] (ecmascript) <export setCachedRequestLocale as setRequestLocale>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$components$2f$analytics$2f$PostHogProvider$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/components/analytics/PostHogProvider.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$components$2f$DemoBadge$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/components/DemoBadge.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/src/libs/I18nRouting.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
const metadata = {
    icons: [
        {
            rel: 'apple-touch-icon',
            url: '/apple-touch-icon.png'
        },
        {
            rel: 'icon',
            type: 'image/png',
            sizes: '32x32',
            url: '/favicon-32x32.png'
        },
        {
            rel: 'icon',
            type: 'image/png',
            sizes: '16x16',
            url: '/favicon-16x16.png'
        },
        {
            rel: 'icon',
            url: '/favicon.ico'
        }
    ]
};
const viewport = {
    width: 'device-width',
    initialScale: 1
};
function generateStaticParams() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["routing"].locales.map((locale)=>({
            locale
        }));
}
async function RootLayout(props) {
    const { locale } = await props.params;
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$use$2d$intl$2f$dist$2f$esm$2f$development$2f$core$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["hasLocale"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$libs$2f$I18nRouting$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["routing"].locales, locale)) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["notFound"])();
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$server$2f$react$2d$server$2f$RequestLocaleCache$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__setCachedRequestLocale__as__setRequestLocale$3e$__["setRequestLocale"])(locale);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("html", {
        lang: locale,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("body", {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$react$2d$server$2f$NextIntlClientProviderServer$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$export__default__as__NextIntlClientProvider$3e$__["NextIntlClientProvider"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$components$2f$analytics$2f$PostHogProvider$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["PostHogProvider"], {
                        children: props.children
                    }, void 0, false, {
                        fileName: "[project]/projects/next-js-boilerplate/src/app/[locale]/layout.tsx",
                        lineNumber: 60,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$src$2f$components$2f$DemoBadge$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DemoBadge"], {}, void 0, false, {
                        fileName: "[project]/projects/next-js-boilerplate/src/app/[locale]/layout.tsx",
                        lineNumber: 64,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/projects/next-js-boilerplate/src/app/[locale]/layout.tsx",
                lineNumber: 59,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/projects/next-js-boilerplate/src/app/[locale]/layout.tsx",
            lineNumber: 58,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/projects/next-js-boilerplate/src/app/[locale]/layout.tsx",
        lineNumber: 57,
        columnNumber: 5
    }, this);
}
}),
];

//# debugId=c86d555d-f443-1564-0f75-806ff1415674
//# sourceMappingURL=projects_next-js-boilerplate_src_26dc6b1e._.js.map