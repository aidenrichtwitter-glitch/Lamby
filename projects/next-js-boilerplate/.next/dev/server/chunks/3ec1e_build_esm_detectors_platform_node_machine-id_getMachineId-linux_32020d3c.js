;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="dc097ef5-5c5b-6d95-dc57-46dcb757c0d4")}catch(e){}}();
module.exports = [
"[project]/projects/next-js-boilerplate/node_modules/@opentelemetry/resources/build/esm/detectors/platform/node/machine-id/getMachineId-linux.js [instrumentation] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getMachineId",
    ()=>getMachineId
]);
/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */ var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$opentelemetry$2f$api$2f$build$2f$esm$2f$diag$2d$api$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@opentelemetry/api/build/esm/diag-api.js [instrumentation] (ecmascript)");
;
;
async function getMachineId() {
    const paths = [
        '/etc/machine-id',
        '/var/lib/dbus/machine-id'
    ];
    for (const path of paths){
        try {
            const result = await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readFile(path, {
                encoding: 'utf8'
            });
            return result.trim();
        } catch (e) {
            __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$opentelemetry$2f$api$2f$build$2f$esm$2f$diag$2d$api$2e$js__$5b$instrumentation$5d$__$28$ecmascript$29$__["diag"].debug(`error reading machine id: ${e}`);
        }
    }
    return undefined;
} //# sourceMappingURL=getMachineId-linux.js.map
}),
];

//# debugId=dc097ef5-5c5b-6d95-dc57-46dcb757c0d4
//# sourceMappingURL=3ec1e_build_esm_detectors_platform_node_machine-id_getMachineId-linux_32020d3c.js.map