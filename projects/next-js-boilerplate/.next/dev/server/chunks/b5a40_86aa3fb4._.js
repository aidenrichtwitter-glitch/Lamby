;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="6866e58c-ad46-e425-b884-65ece2fbdf08")}catch(e){}}();
module.exports = [
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/regex.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
const __TURBOPACK__default__export__ = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
}),
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/validate.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$regex$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/regex.js [middleware] (ecmascript)");
;
function validate(uuid) {
    return typeof uuid === 'string' && __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$regex$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"].test(uuid);
}
const __TURBOPACK__default__export__ = validate;
}),
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/stringify.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "unsafeStringify",
    ()=>unsafeStringify
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/validate.js [middleware] (ecmascript)");
;
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */ const byteToHex = [];
for(let i = 0; i < 256; ++i){
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
    // Note: Be careful editing this code!  It's been tuned for performance
    // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
    //
    // Note to future-self: No, you can't remove the `toLowerCase()` call.
    // REF: https://github.com/uuidjs/uuid/pull/677#issuecomment-1757351351
    return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset);
    // Consistency check for valid UUID.  If this throws, it's likely due to one
    // of the following:
    // - One or more input array values don't map to a hex octet (leading to
    // "undefined" in the uuid)
    // - Invalid input values for the RFC `version` or `variant` fields
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$validate$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"])(uuid)) {
        throw TypeError('Stringified UUID is invalid');
    }
    return uuid;
}
const __TURBOPACK__default__export__ = stringify;
}),
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/stringify.js [middleware] (ecmascript) <export default as stringify>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "stringify",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/stringify.js [middleware] (ecmascript)");
}),
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/rng.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>rng
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
;
const rnds8Pool = new Uint8Array(256); // # of random values to pre-allocate
let poolPtr = rnds8Pool.length;
function rng() {
    if (poolPtr > rnds8Pool.length - 16) {
        __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["default"].randomFillSync(rnds8Pool);
        poolPtr = 0;
    }
    return rnds8Pool.slice(poolPtr, poolPtr += 16);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/v7.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/rng.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/stringify.js [middleware] (ecmascript)");
;
;
/**
 * UUID V7 - Unix Epoch time-based UUID
 *
 * The IETF has published RFC9562, introducing 3 new UUID versions (6,7,8). This
 * implementation of V7 is based on the accepted, though not yet approved,
 * revisions.
 *
 * RFC 9562:https://www.rfc-editor.org/rfc/rfc9562.html Universally Unique
 * IDentifiers (UUIDs)

 *
 * Sample V7 value:
 * https://www.rfc-editor.org/rfc/rfc9562.html#name-example-of-a-uuidv7-value
 *
 * Monotonic Bit Layout: RFC rfc9562.6.2 Method 1, Dedicated Counter Bits ref:
 *     https://www.rfc-editor.org/rfc/rfc9562.html#section-6.2-5.1
 *
 *   0                   1                   2                   3 0 1 2 3 4 5 6
 *   7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |                          unix_ts_ms                           |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |          unix_ts_ms           |  ver  |        seq_hi         |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |var|               seq_low               |        rand         |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *  |                             rand                              |
 *  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 *
 * seq is a 31 bit serialized counter; comprised of 12 bit seq_hi and 19 bit
 * seq_low, and randomly initialized upon timestamp change. 31 bit counter size
 * was selected as any bitwise operations in node are done as _signed_ 32 bit
 * ints. we exclude the sign bit.
 */ let _seqLow = null;
let _seqHigh = null;
let _msecs = 0;
function v7(options, buf, offset) {
    options = options || {};
    // initialize buffer and pointer
    let i = buf && offset || 0;
    const b = buf || new Uint8Array(16);
    // rnds is Uint8Array(16) filled with random bytes
    const rnds = options.random || (options.rng || __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$rng$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"])();
    // milliseconds since unix epoch, 1970-01-01 00:00
    const msecs = options.msecs !== undefined ? options.msecs : Date.now();
    // seq is user provided 31 bit counter
    let seq = options.seq !== undefined ? options.seq : null;
    // initialize local seq high/low parts
    let seqHigh = _seqHigh;
    let seqLow = _seqLow;
    // check if clock has advanced and user has not provided msecs
    if (msecs > _msecs && options.msecs === undefined) {
        _msecs = msecs;
        // unless user provided seq, reset seq parts
        if (seq !== null) {
            seqHigh = null;
            seqLow = null;
        }
    }
    // if we have a user provided seq
    if (seq !== null) {
        // trim provided seq to 31 bits of value, avoiding overflow
        if (seq > 0x7fffffff) {
            seq = 0x7fffffff;
        }
        // split provided seq into high/low parts
        seqHigh = seq >>> 19 & 0xfff;
        seqLow = seq & 0x7ffff;
    }
    // randomly initialize seq
    if (seqHigh === null || seqLow === null) {
        seqHigh = rnds[6] & 0x7f;
        seqHigh = seqHigh << 8 | rnds[7];
        seqLow = rnds[8] & 0x3f; // pad for var
        seqLow = seqLow << 8 | rnds[9];
        seqLow = seqLow << 5 | rnds[10] >>> 3;
    }
    // increment seq if within msecs window
    if (msecs + 10000 > _msecs && seq === null) {
        if (++seqLow > 0x7ffff) {
            seqLow = 0;
            if (++seqHigh > 0xfff) {
                seqHigh = 0;
                // increment internal _msecs. this allows us to continue incrementing
                // while staying monotonic. Note, once we hit 10k milliseconds beyond system
                // clock, we will reset breaking monotonicity (after (2^31)*10000 generations)
                _msecs++;
            }
        }
    } else {
        // resetting; we have advanced more than
        // 10k milliseconds beyond system clock
        _msecs = msecs;
    }
    _seqHigh = seqHigh;
    _seqLow = seqLow;
    // [bytes 0-5] 48 bits of local timestamp
    b[i++] = _msecs / 0x10000000000 & 0xff;
    b[i++] = _msecs / 0x100000000 & 0xff;
    b[i++] = _msecs / 0x1000000 & 0xff;
    b[i++] = _msecs / 0x10000 & 0xff;
    b[i++] = _msecs / 0x100 & 0xff;
    b[i++] = _msecs & 0xff;
    // [byte 6] - set 4 bits of version (7) with first 4 bits seq_hi
    b[i++] = seqHigh >>> 4 & 0x0f | 0x70;
    // [byte 7] remaining 8 bits of seq_hi
    b[i++] = seqHigh & 0xff;
    // [byte 8] - variant (2 bits), first 6 bits seq_low
    b[i++] = seqLow >>> 13 & 0x3f | 0x80;
    // [byte 9] 8 bits seq_low
    b[i++] = seqLow >>> 5 & 0xff;
    // [byte 10] remaining 5 bits seq_low, 3 bits random
    b[i++] = seqLow << 3 & 0xff | rnds[10] & 0x07;
    // [bytes 11-15] always random
    b[i++] = rnds[11];
    b[i++] = rnds[12];
    b[i++] = rnds[13];
    b[i++] = rnds[14];
    b[i++] = rnds[15];
    return buf || (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeStringify"])(b);
}
const __TURBOPACK__default__export__ = v7;
}),
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/v7.js [middleware] (ecmascript) <export default as v7>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "v7",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v7$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v7$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/v7.js [middleware] (ecmascript)");
}),
"[project]/projects/next-js-boilerplate/node_modules/typeid-js/dist/index.mjs [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TypeID",
    ()=>TypeID,
    "fromString",
    ()=>fromString,
    "fromUUID",
    ()=>fromUUID,
    "fromUUIDBytes",
    ()=>fromUUIDBytes,
    "getSuffix",
    ()=>getSuffix,
    "getType",
    ()=>getType,
    "parseTypeId",
    ()=>parseTypeId,
    "toUUID",
    ()=>toUUID,
    "toUUIDBytes",
    ()=>toUUIDBytes,
    "typeid",
    ()=>typeid,
    "typeidUnboxed",
    ()=>typeidUnboxed
]);
// src/typeid.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$export__default__as__stringify$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/stringify.js [middleware] (ecmascript) <export default as stringify>");
// src/unboxed/typeid.ts
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v7$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$export__default__as__v7$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/typeid-js/node_modules/uuid/dist/esm-node/v7.js [middleware] (ecmascript) <export default as v7>");
;
// src/parse_uuid.ts
function parseUUID(uuid) {
    let v;
    const arr = new Uint8Array(16);
    arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
    arr[1] = v >>> 16 & 255;
    arr[2] = v >>> 8 & 255;
    arr[3] = v & 255;
    arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
    arr[5] = v & 255;
    arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
    arr[7] = v & 255;
    arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
    arr[9] = v & 255;
    arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255;
    arr[11] = v / 4294967296 & 255;
    arr[12] = v >>> 24 & 255;
    arr[13] = v >>> 16 & 255;
    arr[14] = v >>> 8 & 255;
    arr[15] = v & 255;
    return arr;
}
// src/base32.ts
var alphabet = "0123456789abcdefghjkmnpqrstvwxyz";
var dec = new Uint8Array([
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    255,
    18,
    19,
    255,
    20,
    21,
    255,
    22,
    23,
    24,
    25,
    26,
    255,
    27,
    28,
    29,
    30,
    31,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255,
    255
]);
function encode(src) {
    const dst = new Array(26).fill("");
    if (src.length !== 16) {
        throw new Error(`Invalid length. Expected 16 bytes, got ${src.length}. Input: ${src}`);
    }
    dst[0] = alphabet[(src[0] & 224) >> 5];
    dst[1] = alphabet[src[0] & 31];
    dst[2] = alphabet[(src[1] & 248) >> 3];
    dst[3] = alphabet[(src[1] & 7) << 2 | (src[2] & 192) >> 6];
    dst[4] = alphabet[(src[2] & 62) >> 1];
    dst[5] = alphabet[(src[2] & 1) << 4 | (src[3] & 240) >> 4];
    dst[6] = alphabet[(src[3] & 15) << 1 | (src[4] & 128) >> 7];
    dst[7] = alphabet[(src[4] & 124) >> 2];
    dst[8] = alphabet[(src[4] & 3) << 3 | (src[5] & 224) >> 5];
    dst[9] = alphabet[src[5] & 31];
    dst[10] = alphabet[(src[6] & 248) >> 3];
    dst[11] = alphabet[(src[6] & 7) << 2 | (src[7] & 192) >> 6];
    dst[12] = alphabet[(src[7] & 62) >> 1];
    dst[13] = alphabet[(src[7] & 1) << 4 | (src[8] & 240) >> 4];
    dst[14] = alphabet[(src[8] & 15) << 1 | (src[9] & 128) >> 7];
    dst[15] = alphabet[(src[9] & 124) >> 2];
    dst[16] = alphabet[(src[9] & 3) << 3 | (src[10] & 224) >> 5];
    dst[17] = alphabet[src[10] & 31];
    dst[18] = alphabet[(src[11] & 248) >> 3];
    dst[19] = alphabet[(src[11] & 7) << 2 | (src[12] & 192) >> 6];
    dst[20] = alphabet[(src[12] & 62) >> 1];
    dst[21] = alphabet[(src[12] & 1) << 4 | (src[13] & 240) >> 4];
    dst[22] = alphabet[(src[13] & 15) << 1 | (src[14] & 128) >> 7];
    dst[23] = alphabet[(src[14] & 124) >> 2];
    dst[24] = alphabet[(src[14] & 3) << 3 | (src[15] & 224) >> 5];
    dst[25] = alphabet[src[15] & 31];
    return dst.join("");
}
function decode(s) {
    if (s.length !== 26) {
        throw new Error(`Invalid length. Expected 26 bytes, got ${s.length}. Input: ${s}`);
    }
    const encoder = new TextEncoder();
    const v = encoder.encode(s);
    if (dec[v[0]] === 255 || dec[v[1]] === 255 || dec[v[2]] === 255 || dec[v[3]] === 255 || dec[v[4]] === 255 || dec[v[5]] === 255 || dec[v[6]] === 255 || dec[v[7]] === 255 || dec[v[8]] === 255 || dec[v[9]] === 255 || dec[v[10]] === 255 || dec[v[11]] === 255 || dec[v[12]] === 255 || dec[v[13]] === 255 || dec[v[14]] === 255 || dec[v[15]] === 255 || dec[v[16]] === 255 || dec[v[17]] === 255 || dec[v[18]] === 255 || dec[v[19]] === 255 || dec[v[20]] === 255 || dec[v[21]] === 255 || dec[v[22]] === 255 || dec[v[23]] === 255 || dec[v[24]] === 255 || dec[v[25]] === 255) {
        throw new Error("Invalid base32 character");
    }
    const id = new Uint8Array(16);
    id[0] = dec[v[0]] << 5 | dec[v[1]];
    id[1] = dec[v[2]] << 3 | dec[v[3]] >> 2;
    id[2] = (dec[v[3]] & 3) << 6 | dec[v[4]] << 1 | dec[v[5]] >> 4;
    id[3] = (dec[v[5]] & 15) << 4 | dec[v[6]] >> 1;
    id[4] = (dec[v[6]] & 1) << 7 | dec[v[7]] << 2 | dec[v[8]] >> 3;
    id[5] = (dec[v[8]] & 7) << 5 | dec[v[9]];
    id[6] = dec[v[10]] << 3 | dec[v[11]] >> 2;
    id[7] = (dec[v[11]] & 3) << 6 | dec[v[12]] << 1 | dec[v[13]] >> 4;
    id[8] = (dec[v[13]] & 15) << 4 | dec[v[14]] >> 1;
    id[9] = (dec[v[14]] & 1) << 7 | dec[v[15]] << 2 | dec[v[16]] >> 3;
    id[10] = (dec[v[16]] & 7) << 5 | dec[v[17]];
    id[11] = dec[v[18]] << 3 | dec[v[19]] >> 2;
    id[12] = (dec[v[19]] & 3) << 6 | dec[v[20]] << 1 | dec[v[21]] >> 4;
    id[13] = (dec[v[21]] & 15) << 4 | dec[v[22]] >> 1;
    id[14] = (dec[v[22]] & 1) << 7 | dec[v[23]] << 2 | dec[v[24]] >> 3;
    id[15] = (dec[v[24]] & 7) << 5 | dec[v[25]];
    return id;
}
;
// src/prefix.ts
function isValidPrefix(str) {
    if (str.length > 63) {
        return false;
    }
    let code;
    let i;
    let len;
    for(i = 0, len = str.length; i < len; i += 1){
        code = str.charCodeAt(i);
        const isLowerAtoZ = code > 96 && code < 123;
        const isUnderscore = code === 95;
        if ((i === 0 || i === len - 1) && !isLowerAtoZ) {
            return false;
        }
        if (!(isLowerAtoZ || isUnderscore)) {
            return false;
        }
    }
    return true;
}
// src/unboxed/error.ts
var InvalidPrefixError = class extends Error {
    constructor(prefix){
        super(`Invalid prefix "${prefix}". Must be at most 63 ASCII letters [a-z_]`);
        this.name = "InvalidPrefixError";
    }
};
var PrefixMismatchError = class extends Error {
    constructor(expected, actual){
        super(`Invalid TypeId. Prefix mismatch. Expected ${expected}, got ${actual}`);
        this.name = "PrefixMismatchError";
    }
};
var EmptyPrefixError = class extends Error {
    constructor(typeId){
        super(`Invalid TypeId. Prefix cannot be empty when there's a separator: ${typeId}`);
        this.name = "EmptyPrefixError";
    }
};
var InvalidSuffixLengthError = class extends Error {
    constructor(length){
        super(`Invalid length. Suffix should have 26 characters, got ${length}`);
        this.name = "InvalidSuffixLengthError";
    }
};
var InvalidSuffixCharacterError = class extends Error {
    constructor(firstChar){
        super(`Invalid suffix. First character "${firstChar}" must be in the range [0-7]`);
        this.name = "InvalidSuffixCharacterError";
    }
};
var TypeIDConversionError = class extends Error {
    constructor(actualPrefix, expectedPrefix){
        super(`Cannot convert TypeID of type ${actualPrefix} to type ${expectedPrefix}`);
        this.name = "TypeIDConversionError";
    }
};
// src/unboxed/typeid.ts
function typeidUnboxed(prefix = "", suffix = "") {
    if (!isValidPrefix(prefix)) {
        throw new InvalidPrefixError(prefix);
    }
    let finalSuffix;
    if (suffix) {
        finalSuffix = suffix;
    } else {
        const buffer = new Uint8Array(16);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$v7$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$export__default__as__v7$3e$__["v7"])(void 0, buffer);
        finalSuffix = encode(buffer);
    }
    if (finalSuffix.length !== 26) {
        throw new InvalidSuffixLengthError(finalSuffix.length);
    }
    if (finalSuffix[0] > "7") {
        throw new InvalidSuffixCharacterError(finalSuffix[0]);
    }
    decode(finalSuffix);
    if (prefix === "") {
        return finalSuffix;
    } else {
        return `${prefix}_${finalSuffix}`;
    }
}
function fromString(typeId, prefix) {
    let p;
    let s;
    const underscoreIndex = typeId.lastIndexOf("_");
    if (underscoreIndex === -1) {
        p = "";
        s = typeId;
    } else {
        p = typeId.substring(0, underscoreIndex);
        s = typeId.substring(underscoreIndex + 1);
        if (!p) {
            throw new EmptyPrefixError(typeId);
        }
    }
    if (!s) {
        throw new InvalidSuffixLengthError(0);
    }
    if (prefix && p !== prefix) {
        throw new PrefixMismatchError(prefix, p);
    }
    return typeidUnboxed(p, s);
}
function parseTypeId(typeId) {
    return {
        prefix: getType(typeId),
        suffix: getSuffix(typeId)
    };
}
function getType(typeId) {
    const underscoreIndex = typeId.lastIndexOf("_");
    if (underscoreIndex === -1) {
        return "";
    }
    return typeId.substring(0, underscoreIndex);
}
function getSuffix(typeId) {
    const underscoreIndex = typeId.lastIndexOf("_");
    if (underscoreIndex === -1) {
        return typeId;
    }
    return typeId.substring(underscoreIndex + 1);
}
function toUUIDBytes(typeId) {
    return decode(getSuffix(typeId));
}
function toUUID(typeId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$export__default__as__stringify$3e$__["stringify"])(toUUIDBytes(typeId));
}
function fromUUIDBytes(prefix, bytes) {
    const suffix = encode(bytes);
    return prefix ? `${prefix}_${suffix}` : suffix;
}
function fromUUID(uuid, prefix) {
    const suffix = encode(parseUUID(uuid));
    return prefix ? `${prefix}_${suffix}` : suffix;
}
// src/typeid.ts
var TypeID = class {
    constructor(prefix, suffix = ""){
        this.prefix = prefix;
        this.suffix = suffix;
        const typeIdRaw = typeidUnboxed(prefix, suffix);
        this.prefix = getType(typeIdRaw);
        this.suffix = getSuffix(typeIdRaw);
    }
    getType() {
        return this.prefix;
    }
    getSuffix() {
        return this.suffix;
    }
    asType(prefix) {
        const self = this;
        if (self.prefix !== prefix) {
            throw new TypeIDConversionError(self.prefix, prefix);
        }
        return self;
    }
    toUUIDBytes() {
        return decode(this.suffix);
    }
    toUUID() {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$typeid$2d$js$2f$node_modules$2f$uuid$2f$dist$2f$esm$2d$node$2f$stringify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$export__default__as__stringify$3e$__["stringify"])(this.toUUIDBytes());
    }
    toString() {
        if (this.prefix === "") {
            return this.suffix;
        }
        return `${this.prefix}_${this.suffix}`;
    }
    static fromString(str, prefix) {
        const typeIdRaw = fromString(str, prefix);
        return new TypeID(getType(typeIdRaw), getSuffix(typeIdRaw));
    }
    static fromUUIDBytes(prefix, bytes) {
        const suffix = encode(bytes);
        return new TypeID(prefix, suffix);
    }
    static fromUUID(prefix, uuid) {
        const suffix = encode(parseUUID(uuid));
        return new TypeID(prefix, suffix);
    }
};
function typeid(prefix = "", suffix = "") {
    return new TypeID(prefix, suffix);
}
;
 //# sourceMappingURL=index.mjs.map
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/analyze/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "detectBot",
    ()=>detectBot,
    "detectSensitiveInfo",
    ()=>detectSensitiveInfo,
    "generateFingerprint",
    ()=>generateFingerprint,
    "isValidEmail",
    ()=>isValidEmail,
    "matchFilters",
    ()=>matchFilters
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$analyze$2d$wasm$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/analyze-wasm/index.js [middleware] (ecmascript)");
;
const FREE_EMAIL_PROVIDERS = [
    "gmail.com",
    "yahoo.com",
    "hotmail.com",
    "aol.com",
    "hotmail.co.uk"
];
function noOpSensitiveInfoDetect() {
    return [];
}
function noOpBotsDetect() {
    return [];
}
function createCoreImports(detect) {
    if (typeof detect !== "function") {
        detect = noOpSensitiveInfoDetect;
    }
    return {
        "arcjet:js-req/bot-identifier": {
            detect: noOpBotsDetect
        },
        "arcjet:js-req/email-validator-overrides": {
            isFreeEmail (domain) {
                if (FREE_EMAIL_PROVIDERS.includes(domain)) {
                    return "yes";
                }
                return "unknown";
            },
            isDisposableEmail () {
                return "unknown";
            },
            hasMxRecords () {
                return "unknown";
            },
            hasGravatar () {
                return "unknown";
            }
        },
        "arcjet:js-req/filter-overrides": {
            ipLookup () {
                return undefined;
            }
        },
        // TODO(@wooorm-arcjet): figure out a test case for this with the default `detect`.
        "arcjet:js-req/sensitive-information-identifier": {
            detect
        },
        // TODO(@wooorm-arcjet): figure out a test case for this that calls `verify`.
        "arcjet:js-req/verify-bot": {
            verify () {
                return "unverifiable";
            }
        }
    };
}
/**
 * Generate a fingerprint.
 *
 * Fingerprints can be used to identify the client across multiple requests.
 *
 * This considers different things on the `request` based on the passed
 * `context.characteristics`.
 *
 * See [*Fingerprints* on
 * `docs.arcjet.com`](https://docs.arcjet.com/fingerprints/) for more info.
 *
 * @param context
 *   Context.
 * @param request
 *   Request.
 * @returns
 *   Promise for a SHA-256 fingerprint.
 */ async function generateFingerprint(context, request) {
    const { log } = context;
    const coreImports = createCoreImports();
    const analyze = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$analyze$2d$wasm$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["initializeWasm"])(coreImports);
    if (typeof analyze !== "undefined") {
        return analyze.generateFingerprint(JSON.stringify(request), context.characteristics);
    // Ignore the `else` branch as we test in places that have WebAssembly.
    /* node:coverage ignore next 4 */ }
    log.debug("WebAssembly is not supported in this runtime");
    return "";
}
/**
 * Check whether an email is valid.
 *
 * @param context
 *   Context.
 * @param value
 *   Value.
 * @param options
 *   Configuration.
 * @returns
 *   Promise for a result.
 */ async function isValidEmail(context, value, options) {
    const { log } = context;
    const coreImports = createCoreImports();
    const analyze = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$analyze$2d$wasm$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["initializeWasm"])(coreImports);
    if (typeof analyze !== "undefined") {
        return analyze.isValidEmail(value, options);
    // Ignore the `else` branch as we test in places that have WebAssembly.
    /* node:coverage ignore next 4 */ }
    log.debug("WebAssembly is not supported in this runtime");
    return {
        blocked: [],
        validity: "valid"
    };
}
/**
 * Detect whether a request is by a bot.
 *
 * @param context
 *   Context.
 * @param request
 *   Request.
 * @param options
 *   Configuration.
 * @returns
 *   Promise for a result.
 */ async function detectBot(context, request, options) {
    const { log } = context;
    const coreImports = createCoreImports();
    const analyze = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$analyze$2d$wasm$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["initializeWasm"])(coreImports);
    if (typeof analyze !== "undefined") {
        return analyze.detectBot(JSON.stringify(request), options);
    // Ignore the `else` branch as we test in places that have WebAssembly.
    /* node:coverage ignore next 4 */ }
    log.debug("WebAssembly is not supported in this runtime");
    return {
        allowed: [],
        denied: [],
        spoofed: false,
        verified: false
    };
}
/**
 * Detect sensitive info in a value.
 *
 * @param context
 *   Context.
 * @param value
 *   Value.
 * @param entities
 *   Strategy to use for detecting sensitive info;
 *   either by denying everything and allowing certain tags or by allowing
 *   everything and denying certain tags.
 * @param contextWindowSize
 *   Number of tokens to pass to `detect`.
 * @param detect
 *   Function to detect sensitive info (optional).
 * @returns
 *   Promise for a result.
 */ async function detectSensitiveInfo(context, value, entities, contextWindowSize, detect) {
    const { log } = context;
    const coreImports = createCoreImports(detect);
    const analyze = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$analyze$2d$wasm$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["initializeWasm"])(coreImports);
    if (typeof analyze !== "undefined") {
        const skipCustomDetect = typeof detect !== "function";
        return analyze.detectSensitiveInfo(value, {
            entities,
            contextWindowSize,
            skipCustomDetect
        });
    // Ignore the `else` branch as we test in places that have WebAssembly.
    /* node:coverage ignore next 4 */ }
    log.debug("WebAssembly is not supported in this runtime");
    throw new Error("SENSITIVE_INFO rule failed to run because Wasm is not supported in this environment.");
}
/**
 * Check if a filter matches a request.
 *
 * @param context
 *   Arcjet context.
 * @param request
 *   Request.
 * @param expressions
 *   Filter expressions.
 * @returns
 *   Promise to whether the filter matches the request.
 */ async function matchFilters(context, request, expressions, allowIfMatch) {
    const coreImports = createCoreImports();
    const analyze = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$analyze$2d$wasm$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["initializeWasm"])(coreImports);
    if (typeof analyze !== "undefined") {
        return analyze.matchFilters(JSON.stringify(request), // @ts-expect-error: WebAssembly does not support readonly values.
        expressions, allowIfMatch);
    // Ignore the `else` branch as we test in places that have WebAssembly.
    /* node:coverage ignore next 4 */ }
    context.log.debug("WebAssembly is not supported in this runtime");
    throw new Error("FILTER rule failed to run because Wasm is not supported in this environment.");
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/duration/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parse",
    ()=>parse
]);
// This Parser is a TypeScript implementation of similar code in the Go stdlib
// with deviations made to support usage in the Arcjet SDK.
//
// Parser source:
// https://github.com/golang/go/blob/c18ddc84e1ec6406b26f7e9d0e1ee3d1908d7c27/src/time/format.go#L1589-L1686
//
// Licensed: BSD 3-Clause "New" or "Revised" License
// Copyright (c) 2009 The Go Authors. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//    * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//    * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
const second = 1;
const minute = 60 * second;
const hour = 60 * minute;
const day = 24 * hour;
const maxUint32 = 4294967295;
const units = new Map([
    [
        "s",
        second
    ],
    [
        "m",
        minute
    ],
    [
        "h",
        hour
    ],
    [
        "d",
        day
    ]
]);
const integers = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9"
];
// leadingInt consumes the leading [0-9]* from s.
function leadingInt(s) {
    let i = 0;
    let x = 0;
    for(; i < s.length; i++){
        const c = s[i];
        if (!integers.includes(c)) {
            break;
        }
        x = x * 10 + parseInt(c, 10);
        if (x > maxUint32) {
            // overflow
            throw new Error("bad [0-9]*"); // never printed
        }
    }
    return [
        x,
        s.slice(i)
    ];
}
/**
 * Parse a duration into a number representing seconds while ensuring the value
 * fits within an unsigned 32-bit integer.
 *
 * If a number is passed it is validated and returned.
 *
 * If a string is passed it must be in the form of digits followed by a unit.
 * Supported units are `s` (seconds),
 * `m` (minutes),
 * `h` (hours),
 * and `d` (days).
 *
 * @example
 *   ```ts
 *   console.log(parse("1s")) // => 1
 *   console.log(parse("1m")) // => 60
 *   console.log(parse("1h")) // => 3600
 *   console.log(parse("1d")) // => 86400
 *   ```
 * @param value
 *   Value to parse.
 * @returns
 *   Parsed seconds.
 */ function parse(value) {
    const original = value;
    if (typeof value === "number") {
        if (value > maxUint32) {
            throw new Error(`invalid duration: ${original}`);
        }
        if (value < 0) {
            throw new Error(`invalid duration: ${original}`);
        }
        if (!Number.isInteger(value)) {
            throw new Error(`invalid duration: ${original}`);
        }
        return value;
    }
    if (typeof value !== "string") {
        throw new Error("can only parse a duration string");
    }
    let d = 0;
    // Special case: if all that is left is "0", this is zero.
    if (value === "0") {
        return 0;
    }
    if (value === "") {
        throw new Error(`invalid duration: ${original}`);
    }
    while(value !== ""){
        let v = 0;
        // The next character must be [0-9]
        if (!integers.includes(value[0])) {
            throw new Error(`invalid duration: ${original}`);
        }
        // Consume [0-9]*
        [v, value] = leadingInt(value);
        // Error on decimal (\.[0-9]*)?
        if (value !== "" && value[0] == ".") {
            // TODO: We could support decimals that turn into non-decimal seconds—e.g.
            // 1.5hours becomes 5400 seconds
            throw new Error(`unsupported decimal duration: ${original}`);
        }
        // Consume unit.
        let i = 0;
        for(; i < value.length; i++){
            const c = value[i];
            if (integers.includes(c)) {
                break;
            }
        }
        if (i == 0) {
            throw new Error(`missing unit in duration: ${original}`);
        }
        const u = value.slice(0, i);
        value = value.slice(i);
        const unit = units.get(u);
        if (typeof unit === "undefined") {
            throw new Error(`unknown unit "${u}" in duration ${original}`);
        }
        if (v > maxUint32 / unit) {
            // overflow
            throw new Error(`invalid duration ${original}`);
        }
        v *= unit;
        d += v;
        if (d > maxUint32) {
            throw new Error(`invalid duration ${original}`);
        }
    }
    return d;
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/headers/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ArcjetHeaders",
    ()=>ArcjetHeaders,
    "default",
    ()=>ArcjetHeaders
]);
function isIterable(val) {
    return typeof val?.[Symbol.iterator] === "function";
}
/**
 * Arcjet headers.
 *
 * This exists to prevent the `cookie` header from being set
 * and non-string values from being set.
 *
 * @see
 *   [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers).
 */ class ArcjetHeaders extends Headers {
    constructor(init){
        super();
        if (typeof init !== "undefined" && typeof init !== "string" && init !== null) {
            if (isIterable(init)) {
                for (const [key, value] of init){
                    this.append(key, value);
                }
            } else {
                for (const [key, value] of Object.entries(init)){
                    if (typeof value === "undefined") {
                        continue;
                    }
                    if (Array.isArray(value)) {
                        for (const singleValue of value){
                            this.append(key, singleValue);
                        }
                    } else {
                        this.append(key, value);
                    }
                }
            }
        }
    }
    /**
     * Append a header while ignoring `cookie`.
     *
     * @see
     *   [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/append)
     *
     * @param key
     *   Header name.
     * @param value
     *   Header value.
     * @returns
     *   Nothing.
     */ append = (key, value)=>{
        if (typeof key !== "string" || typeof value !== "string") {
            return;
        }
        if (key.toLowerCase() !== "cookie") {
            Headers.prototype.append.call(this, key, value);
        }
    };
    /**
     * Set a header while ignoring `cookie`.
     *
     * @see
     *   [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/set)
     *
     * @param key
     *   Header key.
     * @param value
     *   Header value.
     * @returns
     *   Nothing.
     */ set = (key, value)=>{
        if (typeof key !== "string" || typeof value !== "string") {
            return;
        }
        if (key.toLowerCase() !== "cookie") {
            Headers.prototype.set.call(this, key, value);
        }
    };
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/runtime/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "runtime",
    ()=>runtime
]);
// This code was improved by detection mechanisms in
// https://github.com/unjs/std-env/blob/b4ef16832baf4594ece7796a2c1805712fde70a3/src/runtimes.ts
//
// MIT License
//
// Copyright (c) Pooya Parsa <pooya@pi0.io>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
/**
 * Detect the current runtime environment at runtime.
 *
 * @returns
 *   Runtime.
 */ function runtime() {
    // The detection order matters in this function because some platforms will
    // implement compatibility layers, but we want to detect them accurately.
    // https://developers.cloudflare.com/workers/configuration/compatibility-dates/#global-navigator
    if (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") {
        return "workerd";
    }
    if (typeof Deno !== "undefined") {
        return "deno";
    }
    if (typeof Bun !== "undefined") {
        return "bun";
    }
    if (typeof EdgeRuntime !== "undefined") {
        return "edge-light";
    }
    if (typeof process !== "undefined" && process?.release?.name === "node") {
        return "node";
    }
    // Unknown or unsupported runtime
    return "";
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/stable-hash/hasher.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "bool",
    ()=>bool,
    "makeHasher",
    ()=>makeHasher,
    "string",
    ()=>string,
    "stringSliceOrdered",
    ()=>stringSliceOrdered,
    "uint32",
    ()=>uint32
]);
class Sha256 {
    encoder;
    subtle;
    buf;
    constructor(subtle){
        this.subtle = subtle;
        this.encoder = new TextEncoder();
        this.buf = "";
    }
    writeString(data) {
        this.buf += data;
    }
    async digest() {
        const buf = this.encoder.encode(this.buf);
        const digest = await this.subtle.digest("SHA-256", buf);
        return new Uint8Array(digest);
    }
}
// After this, it needs to wrap to 0
const maxUint32 = 4294967295;
const fieldSeparator = ":";
const itemSeparator = ",";
/**
 * Create a hasher for a boolean.
 *
 * @param key
 *   Key.
 * @param value
 *   Value.
 * @returns
 *   Hasher.
 */ function bool(key, value) {
    return (data)=>{
        data.writeString(key);
        data.writeString(fieldSeparator);
        if (value) {
            data.writeString("true");
        } else {
            data.writeString("false");
        }
    };
}
/**
 * Create a hasher for an unsigned 32-bit integer.
 *
 * @param key
 *   Key.
 * @param value
 *   Value.
 * @returns
 *   Hasher.
 */ function uint32(key, value) {
    return (data)=>{
        data.writeString(key);
        data.writeString(fieldSeparator);
        if (value > maxUint32) {
            data.writeString("0");
        } else {
            data.writeString(value.toFixed(0));
        }
    };
}
/**
 * Create a hasher for a string.
 *
 * @param key
 *   Key.
 * @param value
 *   Value.
 * @returns
 *   Hasher.
 */ function string(key, value) {
    return (data)=>{
        data.writeString(key);
        data.writeString(fieldSeparator);
        data.writeString(`"`);
        data.writeString(value.replaceAll(`"`, `\\"`));
        data.writeString(`"`);
    };
}
/**
 * Create a hasher for an array of strings.
 *
 * @param key
 *   Key.
 * @param values
 *   Values.
 * @returns
 *   Hasher.
 */ function stringSliceOrdered(key, values) {
    return (data)=>{
        data.writeString(key);
        data.writeString(fieldSeparator);
        data.writeString("[");
        for (const value of Array.from(values).sort()){
            data.writeString(`"`);
            data.writeString(value.replaceAll(`"`, `\\"`));
            data.writeString(`"`);
            data.writeString(itemSeparator);
        }
        data.writeString("]");
    };
}
/**
 * Create a hasher.
 *
 * @param subtle
 *   Subtle crypto.
 * @returns
 *   Hasher.
 */ function makeHasher(subtle) {
    /**
     * Hash fields.
     *
     * @param hashers
     *   Hashers.
     * @returns
     *   Promise to a hash.
     */ return async function hash(...hashers) {
        const h = new Sha256(subtle);
        for (const hasher of hashers){
            hasher(h);
            h.writeString(itemSeparator);
        }
        const digest = await h.digest();
        return hex(digest);
    };
}
// Hex encoding logic from https://github.com/feross/buffer but adjusted for
// our use.
//
// Licensed: The MIT License (MIT)
//
// Copyright (c) Feross Aboukhadijeh, and other contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
// https://github.com/feross/buffer/blob/5857e295f4d37e3ad02c3abcbf7e8e5ef51f3be6/index.js#L2096-L2106
const hexSliceLookupTable = function() {
    const alphabet = "0123456789abcdef";
    const table = new Array(256);
    for(let i = 0; i < 16; ++i){
        const i16 = i * 16;
        for(let j = 0; j < 16; ++j){
            table[i16 + j] = alphabet[i] + alphabet[j];
        }
    }
    return table;
}();
// https://github.com/feross/buffer/blob/5857e295f4d37e3ad02c3abcbf7e8e5ef51f3be6/index.js#L1085-L1096
function hex(buf) {
    const len = buf.length;
    const start = 0;
    const end = len;
    let out = "";
    for(let i = start; i < end; ++i){
        out += hexSliceLookupTable[buf[i]];
    }
    return out;
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/stable-hash/index.js [middleware] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "hash",
    ()=>hash
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$stable$2d$hash$2f$hasher$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/stable-hash/hasher.js [middleware] (ecmascript)");
;
;
;
const hash = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$stable$2d$hash$2f$hasher$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["makeHasher"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["subtle"]);
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/cache/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MemoryCache",
    ()=>MemoryCache
]);
function nowInSeconds() {
    return Math.floor(Date.now() / 1000);
}
class Bucket {
    expires;
    data;
    constructor(){
        this.expires = new Map();
        this.data = new Map();
    }
    get(key) {
        const now = nowInSeconds();
        const expiresAt = this.expires.get(key) ?? now;
        const ttl = expiresAt - now;
        if (ttl > 0) {
            return [
                this.data.get(key),
                ttl
            ];
        } else {
            // Cleanup if expired
            this.expires.delete(key);
            this.data.delete(key);
            return [
                undefined,
                0
            ];
        }
    }
    set(key, value, ttl) {
        const expiresAt = nowInSeconds() + ttl;
        this.expires.set(key, expiresAt);
        this.data.set(key, value);
    }
}
/**
 * In-memory cache.
 */ class MemoryCache {
    /**
     * Data.
     */ namespaces;
    /**
     * Create a new in-memory cache.
     */ constructor(){
        this.namespaces = new Map();
    }
    async get(namespace, key) {
        if (typeof namespace !== "string") {
            throw new Error("`namespace` must be a string");
        }
        if (typeof key !== "string") {
            throw new Error("`key` must be a string");
        }
        const namespaceCache = this.namespaces.get(namespace);
        if (typeof namespaceCache === "undefined") {
            return [
                undefined,
                0
            ];
        }
        return namespaceCache.get(key);
    }
    set(namespace, key, value, ttl) {
        if (typeof namespace !== "string") {
            throw new Error("`namespace` must be a string");
        }
        if (typeof key !== "string") {
            throw new Error("`key` must be a string");
        }
        const namespaceCache = this.namespaces.get(namespace) ?? new Bucket();
        namespaceCache.set(key, value, ttl);
        this.namespaces.set(namespace, namespaceCache);
    }
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/body/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "readBody",
    ()=>readBody,
    "readBodyWeb",
    ()=>readBodyWeb
]);
/**
 * Read the body of a
 * [web stream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream).
 *
 * @param stream
 *   Stream.
 * @param options
 *   Configuration (required).
 * @returns
 *   Promise that resolves to a concatenated body.
 */ async function readBodyWeb(stream, options) {
    const limit = options?.limit ?? 1048576; // 1mb.
    const length = options?.expectedLength ?? undefined;
    if (typeof limit !== "number" || limit < 0 || Number.isNaN(limit)) {
        return Promise.reject(new Error("Unexpected value `" + limit + "` for `options.limit`, expected positive number"));
    }
    if (length !== undefined && (typeof length !== "number" || length < 0 || Number.isNaN(length))) {
        return Promise.reject(new Error("Unexpected value `" + length + "` for `options.expectedLength`, expected positive number"));
    }
    // If we already know the length and it exceeds the limit, abort early.
    if (length !== undefined && length > limit) {
        return Promise.reject(new Error("Cannot read stream whose expected length exceeds limit"));
    }
    const controller = new AbortController();
    // Ensure that we do not wait forever if the stream is incorrectly configured.
    const timeout = setTimeout(function() {
        controller.abort(new Error("Cannot read stream, did not receive data in time limit"));
    }, 100);
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let received = 0;
    let written = false;
    await stream.pipeTo(new WritableStream({
        write (chunk) {
            if (!written) {
                clearTimeout(timeout);
                written = true;
            }
            received += chunk.byteLength;
            if (received > limit) {
                throw new Error("Cannot read stream that exceeds limit");
            }
            buffer += decoder.decode(chunk, {
                stream: true
            });
        }
    }), {
        signal: controller.signal
    });
    if (!written) {
        throw new Error("Cannot read stream, did not receive data");
    }
    if (length !== undefined && received !== length) {
        throw new Error("Cannot read stream whose length does not match expected length");
    }
    // Need to call it one final time to flush any remaining chars.
    buffer += decoder.decode();
    return buffer;
}
// This `readBody` function is a derivitive of the `getRawBody` function in the `raw-body`
// npm package with deviations to strip down the implementation to specifically what is needed
// by Arcjet.
//
// These include:
// - The removal of the sync interface.
// - The removal of the ability to return the body as a `Buffer`. Instead the body is always
//   parsed as a utf-8 string.
// - The removal of certain config options that are not relevant to us.
//
// Original source:
// https://github.com/stream-utils/raw-body/blob/191e4b6506dcf77198eed01c8feb4b6817008342/test/index.js
//
// Licensed: The MIT License (MIT)
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or
// substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
/**
 * Read the body of a Node.js stream.
 *
 * @param stream
 *   Stream.
 * @param options
 *   Configuration (optional).
 * @returns
 *   Promise that resolves to a concatenated body.
 */ async function readBody(stream, options) {
    const limit = options?.limit ?? 1048576; // 1mb.
    const length = options?.expectedLength ?? undefined;
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let complete = false;
    let received = 0;
    if (typeof limit !== "number" || limit < 0 || Number.isNaN(limit)) {
        return Promise.reject(new Error("Unexpected value `" + limit + "` for `options.limit`, expected positive number"));
    }
    if (length !== undefined && (typeof length !== "number" || length < 0 || Number.isNaN(length))) {
        return Promise.reject(new Error("Unexpected value `" + length + "` for `options.expectedLength`, expected positive number"));
    }
    if (typeof stream.on !== "function") {
        return Promise.reject(new Error("Unexpected value `" + stream.on + "` for `stream.on`, expected function"));
    }
    if (typeof stream.removeListener !== "function") {
        return Promise.reject(new Error("Unexpected value `" + stream.removeListener + "` for `stream.removeListener`, expected function"));
    }
    if (typeof stream.readable !== "undefined" && !stream.readable) {
        return Promise.reject(new Error("Cannot read unreadable stream"));
    }
    // If we already know the length and it exceeds the limit, abort early.
    if (length !== undefined && length > limit) {
        return Promise.reject(new Error("Cannot read stream whose expected length exceeds limit"));
    }
    return new Promise((resolve, reject)=>{
        // This was already checked at the top of the function but TypeScript lost
        // the context
        if (typeof stream.on === "function") {
            stream.on("aborted", onAborted);
            stream.on("close", cleanup);
            stream.on("data", onData);
            stream.on("end", onEnd);
            stream.on("error", onEnd);
        }
        function done(err, buffer) {
            // Ensure we avoid double resolve/reject if called more than once
            if (complete) return;
            complete = true;
            cleanup();
            if (typeof err !== "undefined") {
                reject(err);
            } else if (buffer !== null && buffer !== undefined) {
                // Need to call it one final time to flush any remaining chars.
                buffer += decoder.decode();
                resolve(buffer);
            }
        }
        function onAborted() {
            done(new Error("Cannot read aborted stream"));
        }
        function onData(chunk) {
            received += chunk.length;
            if (received > limit) {
                done(new Error("Cannot read stream that exceeds limit"));
            } else {
                buffer += decoder.decode(chunk, {
                    stream: true
                });
            }
        }
        function onEnd(err) {
            if (err) return done(err);
            if (length !== undefined && received !== length) {
                done(new Error("Cannot read stream whose length does not match expected length"));
            } else {
                done(undefined, buffer);
            }
        }
        function cleanup() {
            buffer = "";
            // This was already checked at the top of the function but TypeScript lost
            // the context
            if (typeof stream.removeListener === "function") {
                stream.removeListener("aborted", onAborted);
                stream.removeListener("data", onData);
                stream.removeListener("end", onEnd);
                stream.removeListener("error", onEnd);
                stream.removeListener("close", cleanup);
            }
        }
        // Ensure that we don't poll forever if the stream is incorrectly configured
        setTimeout(()=>{
            if (received === 0) {
                done(new Error("Cannot read stream, did not receive data in time limit"));
            }
        }, 100);
    });
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/ip/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>findIp,
    "findIp",
    ()=>findIp,
    "parseProxy",
    ()=>parseProxy
]);
function parseXForwardedFor(value) {
    if (typeof value !== "string") {
        return [];
    }
    const forwardedIps = [];
    // As per MDN X-Forwarded-For Headers documentation at
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
    // The `x-forwarded-for` header may return one or more IP addresses as
    // "client IP, proxy 1 IP, proxy 2 IP", so we want to split by the comma and
    // trim each item.
    for (const item of value.split(",")){
        forwardedIps.push(item.trim());
    }
    return forwardedIps;
}
function isIpv4Cidr(cidr) {
    return typeof cidr === "object" && cidr !== null && "type" in cidr && typeof cidr.type === "string" && cidr.type === "v4" && "contains" in cidr && typeof cidr.contains === "function";
}
function isIpv6Cidr(cidr) {
    return typeof cidr === "object" && cidr !== null && "type" in cidr && typeof cidr.type === "string" && cidr.type === "v6" && "contains" in cidr && typeof cidr.contains === "function";
}
function isTrustedProxy(ip, segments, proxies) {
    if (Array.isArray(proxies) && proxies.length > 0) {
        return proxies.some((proxy)=>{
            if (typeof proxy === "string") {
                return proxy === ip;
            }
            if (isIpv4Tuple(segments) && isIpv4Cidr(proxy)) {
                return proxy.contains(segments);
            }
            if (isIpv6Tuple(segments) && isIpv6Cidr(proxy)) {
                return proxy.contains(segments);
            }
            return false;
        });
    }
    return false;
}
// Based on CIDR matching implementation in `ipaddr.js`
// Source code:
// https://github.com/whitequark/ipaddr.js/blob/08c2cd41e2cb3400683cbd503f60421bfdf66921/lib/ipaddr.js#L107-L130
//
// Licensed: The MIT License (MIT)
// Copyright (C) 2011-2017 whitequark <whitequark@whitequark.org>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
function cidrContains(cidr, ip) {
    let part = 0;
    let shift;
    let cidrBits = cidr.bits;
    while(cidrBits > 0){
        shift = cidr.partSize - cidrBits;
        if (shift < 0) {
            shift = 0;
        }
        if (ip[part] >> shift !== cidr.parts[part] >> shift) {
            return false;
        }
        cidrBits -= cidr.partSize;
        part += 1;
    }
    return true;
}
class Ipv4Cidr {
    type = "v4";
    partSize = 8;
    parts;
    bits;
    constructor(parts, bits){
        this.bits = bits;
        this.parts = parts;
        Object.freeze(this);
    }
    contains(ip) {
        return cidrContains(this, ip);
    }
}
class Ipv6Cidr {
    type = "v6";
    partSize = 16;
    parts;
    bits;
    constructor(parts, bits){
        this.bits = bits;
        this.parts = parts;
        Object.freeze(this);
    }
    contains(ip) {
        return cidrContains(this, ip);
    }
}
function parseCidr(cidr) {
    // Pre-condition: `cidr` has be verified to have at least one `/`
    const cidrParts = cidr.split("/");
    if (cidrParts.length !== 2) {
        throw new Error("invalid CIDR address: must be exactly 2 parts");
    }
    const parser = new Parser(cidrParts[0]);
    const maybeIpv4 = parser.readIpv4Address();
    if (isIpv4Tuple(maybeIpv4)) {
        const bits = parseInt(cidrParts[1], 10);
        if (isNaN(bits) || bits < 0 || bits > 32) {
            throw new Error("invalid CIDR address: incorrect amount of bits");
        }
        return new Ipv4Cidr(maybeIpv4, bits);
    }
    const maybeIpv6 = parser.readIpv6Address();
    if (isIpv6Tuple(maybeIpv6)) {
        const bits = parseInt(cidrParts[1], 10);
        if (isNaN(bits) || bits < 0 || bits > 128) {
            throw new Error("invalid CIDR address: incorrect amount of bits");
        }
        return new Ipv6Cidr(maybeIpv6, bits);
    }
    throw new Error("invalid CIDR address: could not parse IP address");
}
function isCidr(address) {
    return address.includes("/");
}
/**
 * Parse CIDR addresses and keep non-CIDR IP addresses.
 *
 * @param value
 *   Value to parse.
 * @returns
 *   Parsed CIDR or given `value`.
 */ function parseProxy(value) {
    if (isCidr(value)) {
        return parseCidr(value);
    } else {
        return value;
    }
}
function isIpv4Tuple(segements) {
    if (typeof segements === "undefined") {
        return false;
    }
    return segements.length === 4;
}
function isIpv6Tuple(segements) {
    if (typeof segements === "undefined") {
        return false;
    }
    return segements.length === 8;
}
function u16FromBytes(bytes) {
    const u8 = new Uint8Array(bytes);
    return new Uint16Array(u8.buffer)[0];
}
function u32FromBytes(bytes) {
    const u8 = new Uint8Array(bytes);
    return new Uint32Array(u8.buffer)[0];
}
// This Parser and "is global" comparisons are a TypeScript implementation of
// similar code in the Rust stdlib with only slight deviations as noted.
//
// We want to mirror Rust's logic as close as possible, because we'll be relying
// on its implementation when we add a Wasm library to determine IPs and only
// falling back to JavaScript in non-Wasm environments.
//
// Parser source:
// https://github.com/rust-lang/rust/blob/07921b50ba6dcb5b2984a1dba039a38d85bffba2/library/core/src/net/parser.rs#L34
// Comparison source:
// https://github.com/rust-lang/rust/blob/87e1447aadaa2899ff6ccabe1fa669eb50fb60a1/library/core/src/net/ip_addr.rs#L749
// https://github.com/rust-lang/rust/blob/87e1447aadaa2899ff6ccabe1fa669eb50fb60a1/library/core/src/net/ip_addr.rs#L1453
//
// Licensed: The MIT License (MIT)
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or
// substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
class Parser {
    state;
    constructor(input){
        this.state = input;
    }
    readAtomically(inner) {
        const state = this.state;
        const result = inner(this);
        if (typeof result === "undefined") {
            this.state = state;
        }
        return result;
    }
    peakChar() {
        return this.state[0];
    }
    readChar() {
        const b = this.state[0];
        this.state = this.state.slice(1);
        return b;
    }
    readGivenChar(target) {
        return this.readAtomically((p)=>{
            const c = p.readChar();
            if (c === target) {
                return c;
            }
        });
    }
    readSeparator(sep, index, inner) {
        return this.readAtomically((p)=>{
            if (index > 0) {
                const c = p.readGivenChar(sep);
                if (typeof c === "undefined") {
                    return;
                }
            }
            return inner(p);
        });
    }
    readNumber(radix, maxDigits, allowZeroPrefix = false) {
        return this.readAtomically((p)=>{
            let result = 0;
            let digitCount = 0;
            const hasLeadingZero = p.peakChar() === "0";
            function nextCharAsDigit() {
                return p.readAtomically((p)=>{
                    const c = p.readChar();
                    if (c) {
                        const n = parseInt(c, radix);
                        if (!isNaN(n)) {
                            return n;
                        }
                    }
                });
            }
            for(let digit = nextCharAsDigit(); digit !== undefined; digit = nextCharAsDigit()){
                result = result * radix;
                result = result + digit;
                digitCount += 1;
                if (typeof maxDigits !== "undefined") {
                    if (digitCount > maxDigits) {
                        return;
                    }
                }
            }
            if (digitCount === 0) {
                return;
            } else if (!allowZeroPrefix && hasLeadingZero && digitCount > 1) {
                return;
            } else {
                return result;
            }
        });
    }
    readIpv4Address() {
        return this.readAtomically((p)=>{
            const groups = [];
            for(let idx = 0; idx < 4; idx++){
                const result = p.readSeparator(".", idx, (p)=>{
                    // Disallow octal number in IP string
                    // https://tools.ietf.org/html/rfc6943#section-3.1.1
                    return p.readNumber(10, 3, false);
                });
                if (result === undefined) {
                    return;
                } else {
                    groups.push(result);
                }
            }
            return groups;
        });
    }
    readIpv6Address() {
        // Read a chunk of an IPv6 address into `groups`. Returns the number of
        // groups read, along with a bool indicating if an embedded trailing IPv4
        // address was read. Specifically, read a series of colon-separated IPv6
        // groups (0x0000 - 0xFFFF), with an optional trailing embedded IPv4 address
        const readGroups = (p, groups)=>{
            const limit = groups.length;
            for (const i of groups.keys()){
                // Try to read a trailing embedded IPv4 address. There must be at least
                // two groups left
                if (i < limit - 1) {
                    const ipv4 = p.readSeparator(":", i, (p)=>p.readIpv4Address());
                    if (isIpv4Tuple(ipv4)) {
                        const [one, two, three, four] = ipv4;
                        groups[i + 0] = u16FromBytes([
                            one,
                            two
                        ]);
                        groups[i + 1] = u16FromBytes([
                            three,
                            four
                        ]);
                        return [
                            i + 2,
                            true
                        ];
                    }
                }
                const group = p.readSeparator(":", i, (p)=>p.readNumber(16, 4, true));
                if (typeof group !== "undefined") {
                    groups[i] = group;
                } else {
                    return [
                        i,
                        false
                    ];
                }
            }
            return [
                groups.length,
                false
            ];
        };
        return this.readAtomically((p)=>{
            // Read the front part of the address; either the whole thing, or up
            // to the first ::
            const head = new Uint16Array(8);
            const [headSize, headIpv4] = readGroups(p, head);
            if (headSize === 8) {
                return head;
            }
            // IPv4 part is not allowed before `::`
            if (headIpv4) {
                return;
            }
            // Read `::` if previous code parsed less than 8 groups.
            // `::` indicates one or more groups of 16 bits of zeros.
            if (typeof p.readGivenChar(":") === "undefined") {
                return;
            }
            if (typeof p.readGivenChar(":") === "undefined") {
                return;
            }
            // Read the back part of the address. The :: must contain at least one
            // set of zeroes, so our max length is 7.
            const tail = new Uint16Array(7);
            const limit = 8 - (headSize + 1);
            const [tailSize, _] = readGroups(p, tail.subarray(0, limit));
            head.set(tail.slice(0, tailSize), 8 - tailSize);
            return head;
        });
    }
    readPort() {
        return this.readAtomically((p)=>{
            if (typeof p.readGivenChar(":") !== "undefined") {
                return p.readNumber(10, undefined, true);
            }
        });
    }
    readScopeId() {
        return this.readAtomically((p)=>{
            if (typeof p.readGivenChar("%") !== "undefined") {
                return p.readNumber(10, undefined, true);
            }
        });
    }
}
const IPV4_BROADCAST = u32FromBytes([
    255,
    255,
    255,
    255
]);
function isGlobalIpv4(s, proxies) {
    if (typeof s !== "string") {
        return false;
    }
    const parser = new Parser(s);
    const octets = parser.readIpv4Address();
    if (!isIpv4Tuple(octets)) {
        return false;
    }
    if (isTrustedProxy(s, octets, proxies)) {
        return false;
    }
    // Rust doesn't check the remaining state when parsing an IPv4. However, we
    // want to ensure we have exactly an IP (with optionally a port), so we parse
    // it and then check remaining parser state.
    parser.readPort();
    if (parser.state.length !== 0) {
        return false;
    }
    // "This network"
    if (octets[0] === 0) {
        return false;
    }
    // Private IPv4 address ranges
    if (octets[0] === 10) {
        return false;
    }
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
        return false;
    }
    if (octets[0] === 192 && octets[1] === 168) {
        return false;
    }
    // Loopback address
    if (octets[0] === 127) {
        return false;
    }
    // Shared range
    if (octets[0] === 100 && (octets[1] & 0b1100_0000) === 0b0100_0000) {
        return false;
    }
    // Link-local range
    if (octets[0] === 169 && octets[1] === 254) {
        return false;
    }
    // addresses reserved for future protocols (`192.0.0.0/24`)
    if (octets[0] === 192 && octets[1] === 0 && octets[2] === 0) {
        return false;
    }
    // Documentation ranges
    if (octets[0] === 192 && octets[1] === 0 && octets[2] === 2) {
        return false;
    }
    if (octets[0] === 198 && octets[1] === 51 && octets[2] === 100) {
        return false;
    }
    if (octets[0] === 203 && octets[1] === 0 && octets[2] === 113) {
        return false;
    }
    // Benchmarking range
    if (octets[0] === 198 && (octets[1] & 0xfe) === 18) {
        return false;
    }
    const isBroadcast = u32FromBytes(octets) === IPV4_BROADCAST;
    // Reserved range
    if ((octets[0] & 240) === 240 && !isBroadcast) {
        return false;
    }
    // Broadcast address
    if (isBroadcast) {
        return false;
    }
    for (const octet of octets){
        if (octet < 0 || octet > 255) {
            return false;
        }
    }
    return true;
}
function isGlobalIpv6(s, proxies) {
    if (typeof s !== "string") {
        return false;
    }
    const parser = new Parser(s);
    const segments = parser.readIpv6Address();
    if (!isIpv6Tuple(segments)) {
        return false;
    }
    if (isTrustedProxy(s, segments, proxies)) {
        return false;
    }
    // Rust doesn't check the remaining state when parsing an IPv6. However, we
    // want to ensure we have exactly an IP (with optionally a scope id), so we
    // parse it and then check remaining parser state.
    // TODO: We don't support an IPv6 address with a port because that seems to
    // require wrapping the address and scope in `[]`, e.g. `[:ffff%1]:8080`
    parser.readScopeId();
    if (parser.state.length !== 0) {
        return false;
    }
    // Unspecified address
    if (segments[0] === 0 && segments[1] === 0 && segments[2] === 0 && segments[3] === 0 && segments[4] === 0 && segments[5] === 0 && segments[6] === 0 && segments[7] === 0) {
        return false;
    }
    // Loopback address
    if (segments[0] === 0 && segments[1] === 0 && segments[2] === 0 && segments[3] === 0 && segments[4] === 0 && segments[5] === 0 && segments[6] === 0 && segments[7] === 0x1) {
        return false;
    }
    // IPv4-mapped Address (`::ffff:0:0/96`)
    if (segments[0] === 0 && segments[1] === 0 && segments[2] === 0 && segments[3] === 0 && segments[4] === 0 && segments[5] === 0xffff) {
        return false;
    }
    // IPv4-IPv6 Translat. (`64:ff9b:1::/48`)
    if (segments[0] === 0x64 && segments[1] === 0xff9b && segments[2] === 1) {
        return false;
    }
    // Discard-Only Address Block (`100::/64`)
    if (segments[0] === 0x100 && segments[1] === 0 && segments[2] === 0 && segments[3] === 0) {
        return false;
    }
    // IETF Protocol Assignments (`2001::/23`)
    if (segments[0] === 0x2001 && segments[1] < 0x200) {
        // Port Control Protocol Anycast (`2001:1::1`)
        if (segments[0] === 0x2001 && segments[1] === 1 && segments[2] === 0 && segments[3] === 0 && segments[4] === 0 && segments[5] === 0 && segments[6] === 0 && segments[7] === 1) {
            return true;
        }
        // Traversal Using Relays around NAT Anycast (`2001:1::2`)
        if (segments[0] === 0x2001 && segments[1] === 1 && segments[2] === 0 && segments[3] === 0 && segments[4] === 0 && segments[5] === 0 && segments[6] === 0 && segments[7] === 2) {
            return true;
        }
        // AMT (`2001:3::/32`)
        if (segments[0] === 0x2001 && segments[1] === 3) {
            return true;
        }
        // AS112-v6 (`2001:4:112::/48`)
        if (segments[0] === 0x2001 && segments[1] === 4 && segments[2] === 0x112) {
            return true;
        }
        // ORCHIDv2 (`2001:20::/28`)
        if (segments[0] === 0x2001 && segments[1] >= 0x20 && segments[1] <= 0x2f) {
            return true;
        }
        // Benchmarking range (and others)
        return false;
    }
    // Documentation range
    if (segments[0] === 0x2001 && segments[1] === 0xdb8) {
        return false;
    }
    // Unique local range
    if ((segments[0] & 0xfe00) === 0xfc00) {
        return false;
    }
    // Unicast link local range
    if ((segments[0] & 0xffc0) === 0xfe80) {
        return false;
    }
    return true;
}
function isGlobalIp(s, proxies) {
    if (isGlobalIpv4(s, proxies)) {
        return true;
    }
    if (isGlobalIpv6(s, proxies)) {
        return true;
    }
    return false;
}
function isHeaders(val) {
    return typeof val.get === "function";
}
function getHeader(headers, headerKey) {
    if (isHeaders(headers)) {
        return headers.get(headerKey);
    } else {
        const headerValue = headers[headerKey];
        if (Array.isArray(headerValue)) {
            return headerValue.join(",");
        } else {
            return headerValue;
        }
    }
}
// Heavily based on https://github.com/pbojinov/request-ip
//
// Licensed: The MIT License (MIT) Copyright (c) 2022 Petar Bojinov -
// petarbojinov+github@gmail.com
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions: The above copyright
// notice and this permission notice shall be included in all copies or
// substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
function findIp(request, options) {
    const { platform, proxies: rawProxies } = options || {};
    const proxies = [];
    if (Array.isArray(rawProxies)) {
        for (const cidrOrIp of rawProxies){
            if (typeof cidrOrIp === "string") {
                proxies.push(parseProxy(cidrOrIp));
            }
            if (isIpv4Cidr(cidrOrIp) || isIpv6Cidr(cidrOrIp)) {
                proxies.push(cidrOrIp);
            }
        }
    }
    // Prefer anything available via the platform over headers since headers can
    // be set by users. Only if we don't have an IP available in `request` do we
    // search the `headers`.
    if (isGlobalIp(request.ip, proxies)) {
        return request.ip;
    }
    const socketRemoteAddress = request.socket?.remoteAddress;
    if (isGlobalIp(socketRemoteAddress, proxies)) {
        return socketRemoteAddress;
    }
    const infoRemoteAddress = request.info?.remoteAddress;
    if (isGlobalIp(infoRemoteAddress, proxies)) {
        return infoRemoteAddress;
    }
    // AWS Api Gateway + Lambda
    const requestContextIdentitySourceIp = request.requestContext?.identity?.sourceIp;
    if (isGlobalIp(requestContextIdentitySourceIp, proxies)) {
        return requestContextIdentitySourceIp;
    }
    // Validate we have some object for `request.headers`
    if (typeof request.headers !== "object" || request.headers === null) {
        return "";
    }
    // Platform-specific headers should only be accepted when we can determine
    // that we are running on that platform. For example, the `CF-Connecting-IP`
    // header should only be accepted when running on Cloudflare; otherwise, it
    // can be spoofed.
    if (platform === "cloudflare") {
        // CF-Connecting-IPv6: https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ipv6
        const cfConnectingIpv6 = getHeader(request.headers, "cf-connecting-ipv6");
        if (isGlobalIpv6(cfConnectingIpv6, proxies)) {
            return cfConnectingIpv6;
        }
        // CF-Connecting-IP: https://developers.cloudflare.com/fundamentals/reference/http-request-headers/#cf-connecting-ip
        const cfConnectingIp = getHeader(request.headers, "cf-connecting-ip");
        if (isGlobalIp(cfConnectingIp, proxies)) {
            return cfConnectingIp;
        }
        // If we are using a platform check and don't have a Global IP, we exit
        // early with an empty IP since the more generic headers shouldn't be
        // trusted over the platform-specific headers.
        return "";
    }
    // Firebase https://github.com/arcjet/arcjet-js/issues/5383
    if (platform === "firebase") {
        const fahClientIp = getHeader(request.headers, "x-fah-client-ip");
        if (isGlobalIp(fahClientIp, proxies)) {
            return fahClientIp;
        }
        // https://cloud.google.com/functions/docs/reference/headers#x-forwarded-for
        // (and https://github.com/arcjet/arcjet-js/issues/5383).
        // The last are probably going to be proxies which have to be filtered with
        // `proxies`.
        const xForwardedFor = getHeader(request.headers, "x-forwarded-for");
        const xForwardedForItems = parseXForwardedFor(xForwardedFor);
        for (const item of xForwardedForItems.reverse()){
            if (isGlobalIp(item, proxies)) {
                return item;
            }
        }
        // If we are using a platform check and don't have a Global IP, we exit
        // early with an empty IP since the more generic headers shouldn't be
        // trusted over the platform-specific headers.
        return "";
    }
    // Fly.io: https://fly.io/docs/machines/runtime-environment/#fly_app_name
    if (platform === "fly-io") {
        // Fly-Client-IP: https://fly.io/docs/networking/request-headers/#fly-client-ip
        const flyClientIp = getHeader(request.headers, "fly-client-ip");
        if (isGlobalIp(flyClientIp, proxies)) {
            return flyClientIp;
        }
        // If we are using a platform check and don't have a Global IP, we exit
        // early with an empty IP since the more generic headers shouldn't be
        // trusted over the platform-specific headers.
        return "";
    }
    if (platform === "vercel") {
        // https://vercel.com/docs/edge-network/headers/request-headers#x-real-ip
        // Also used by `@vercel/functions`, see:
        // https://github.com/vercel/vercel/blob/d7536d52c87712b1b3f83e4b0fd535a1fb7e384c/packages/functions/src/headers.ts#L12
        const xRealIp = getHeader(request.headers, "x-real-ip");
        if (isGlobalIp(xRealIp, proxies)) {
            return xRealIp;
        }
        // https://vercel.com/docs/edge-network/headers/request-headers#x-vercel-forwarded-for
        // By default, it seems this will be 1 address, but they discuss trusted
        // proxy forwarding so we try to parse it like normal. See
        // https://vercel.com/docs/edge-network/headers/request-headers#custom-x-forwarded-for-ip
        const xVercelForwardedFor = getHeader(request.headers, "x-vercel-forwarded-for");
        const xVercelForwardedForItems = parseXForwardedFor(xVercelForwardedFor);
        // As per MDN X-Forwarded-For Headers documentation at
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
        // We may find more than one IP in the `x-forwarded-for` header. Since the
        // first IP will be closest to the user (and the most likely to be spoofed),
        // we want to iterate tail-to-head so we reverse the list.
        for (const item of xVercelForwardedForItems.reverse()){
            if (isGlobalIp(item, proxies)) {
                return item;
            }
        }
        // https://vercel.com/docs/edge-network/headers/request-headers#x-forwarded-for
        // By default, it seems this will be 1 address, but they discuss trusted
        // proxy forwarding so we try to parse it like normal. See
        // https://vercel.com/docs/edge-network/headers/request-headers#custom-x-forwarded-for-ip
        const xForwardedFor = getHeader(request.headers, "x-forwarded-for");
        const xForwardedForItems = parseXForwardedFor(xForwardedFor);
        // As per MDN X-Forwarded-For Headers documentation at
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
        // We may find more than one IP in the `x-forwarded-for` header. Since the
        // first IP will be closest to the user (and the most likely to be spoofed),
        // we want to iterate tail-to-head so we reverse the list.
        for (const item of xForwardedForItems.reverse()){
            if (isGlobalIp(item, proxies)) {
                return item;
            }
        }
        // If we are using a platform check and don't have a Global IP, we exit
        // early with an empty IP since the more generic headers shouldn't be
        // trusted over the platform-specific headers.
        return "";
    }
    if (platform === "render") {
        // True-Client-IP: https://community.render.com/t/what-number-of-proxies-sit-in-front-of-an-express-app-deployed-on-render/35981/2
        const trueClientIp = getHeader(request.headers, "true-client-ip");
        if (isGlobalIp(trueClientIp, proxies)) {
            return trueClientIp;
        }
        // If we are using a platform check and don't have a Global IP, we exit
        // early with an empty IP since the more generic headers shouldn't be
        // trusted over the platform-specific headers.
        return "";
    }
    // Load-balancers (AWS ELB) or proxies.
    const xForwardedFor = getHeader(request.headers, "x-forwarded-for");
    const xForwardedForItems = parseXForwardedFor(xForwardedFor);
    // As per MDN X-Forwarded-For Headers documentation at
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Forwarded-For
    // We may find more than one IP in the `x-forwarded-for` header. Since the
    // first IP will be closest to the user (and the most likely to be spoofed),
    // we want to iterate tail-to-head so we reverse the list.
    for (const item of xForwardedForItems.reverse()){
        if (isGlobalIp(item, proxies)) {
            return item;
        }
    }
    // Standard headers used by Amazon EC2, Heroku, and others.
    const xClientIp = getHeader(request.headers, "x-client-ip");
    if (isGlobalIp(xClientIp, proxies)) {
        return xClientIp;
    }
    // DigitalOcean.
    // DO-Connecting-IP: https://www.digitalocean.com/community/questions/app-platform-client-ip
    const doConnectingIp = getHeader(request.headers, "do-connecting-ip");
    if (isGlobalIp(doConnectingIp, proxies)) {
        return doConnectingIp;
    }
    // Fastly and Firebase hosting header (When forwared to cloud function)
    // Fastly-Client-IP
    const fastlyClientIp = getHeader(request.headers, "fastly-client-ip");
    if (isGlobalIp(fastlyClientIp, proxies)) {
        return fastlyClientIp;
    }
    // Akamai
    // True-Client-IP
    const trueClientIp = getHeader(request.headers, "true-client-ip");
    if (isGlobalIp(trueClientIp, proxies)) {
        return trueClientIp;
    }
    // Default nginx proxy/fcgi; alternative to x-forwarded-for, used by some proxies
    // X-Real-IP
    const xRealIp = getHeader(request.headers, "x-real-ip");
    if (isGlobalIp(xRealIp, proxies)) {
        return xRealIp;
    }
    // Rackspace LB and Riverbed's Stingray?
    const xClusterClientIp = getHeader(request.headers, "x-cluster-client-ip");
    if (isGlobalIp(xClusterClientIp, proxies)) {
        return xClusterClientIp;
    }
    const xForwarded = getHeader(request.headers, "x-forwarded");
    if (isGlobalIp(xForwarded, proxies)) {
        return xForwarded;
    }
    const forwardedFor = getHeader(request.headers, "forwarded-for");
    if (isGlobalIp(forwardedFor, proxies)) {
        return forwardedFor;
    }
    const forwarded = getHeader(request.headers, "forwarded");
    if (isGlobalIp(forwarded, proxies)) {
        return forwarded;
    }
    // Google Cloud App Engine
    // X-Appengine-User-IP: https://cloud.google.com/appengine/docs/standard/reference/request-headers?tab=node.js
    const xAppEngineUserIp = getHeader(request.headers, "x-appengine-user-ip");
    if (isGlobalIp(xAppEngineUserIp, proxies)) {
        return xAppEngineUserIp;
    }
    return "";
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/env/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "baseUrl",
    ()=>baseUrl,
    "isDevelopment",
    ()=>isDevelopment,
    "logLevel",
    ()=>logLevel,
    "platform",
    ()=>platform
]);
/**
 * Detect the platform.
 *
 * @param environment
 *   Environment.
 * @returns
 *   Name of platform if found.
 */ function platform(environment) {
    if (typeof environment["FIREBASE_CONFIG"] === "string" && environment["FIREBASE_CONFIG"] !== "") {
        return "firebase";
    }
    if (typeof environment["FLY_APP_NAME"] === "string" && environment["FLY_APP_NAME"] !== "") {
        return "fly-io";
    }
    if (typeof environment["VERCEL"] === "string" && environment["VERCEL"] === "1") {
        return "vercel";
    }
    // https://render.com/docs/environment-variables
    if (typeof environment["RENDER"] === "string" && environment["RENDER"] === "true") {
        return "render";
    }
}
/**
 * Check if the environment is development.
 *
 * @param environment
 *   Environment.
 * @returns
 *   Whether the environment is development.
 */ function isDevelopment(environment) {
    return environment.NODE_ENV === "development" || environment.MODE === "development" || environment.ARCJET_ENV === "development";
}
/**
 * Get the log level.
 *
 * @param environment
 *   Environment.
 * @returns
 *   Log level.
 */ function logLevel(environment) {
    const level = environment["ARCJET_LOG_LEVEL"];
    switch(level){
        case "debug":
        case "info":
        case "warn":
        case "error":
            return level;
        default:
            // Default to warn if not set
            return "warn";
    }
}
const baseUrlAllowed = [
    "https://decide.arcjet.com",
    "https://decide.arcjettest.com",
    "https://fly.decide.arcjet.com",
    "https://fly.decide.arcjettest.com",
    "https://decide.arcjet.orb.local",
    // Allow trailing slashes
    "https://decide.arcjet.com/",
    "https://decide.arcjettest.com/",
    "https://fly.decide.arcjet.com/",
    "https://fly.decide.arcjettest.com/",
    "https://decide.arcjet.orb.local/"
];
/**
 * Get the base URL of an Arcjet API.
 *
 * @param environment
 *   Environment.
 * @returns
 *   Base URL of Arcjet API.
 */ function baseUrl(environment) {
    // Use ARCJET_BASE_URL if it is set and belongs to our allowlist; otherwise
    // use the hardcoded default.
    if (typeof environment["ARCJET_BASE_URL"] === "string" && baseUrlAllowed.includes(environment["ARCJET_BASE_URL"])) {
        return environment["ARCJET_BASE_URL"];
    }
    // If we're running on fly.io, use the Arcjet Decide Service hosted on fly
    // Ref: https://fly.io/docs/machines/runtime-environment/#environment-variables
    if (platform(environment) === "fly-io") {
        return "https://fly.decide.arcjet.com";
    }
    return "https://decide.arcjet.com";
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/sprintf/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>sprintf,
    "sprintf",
    ()=>sprintf
]);
function bigintReplacer(key, value) {
    if (typeof value === "bigint") {
        return "[BigInt]";
    }
    return value;
}
// TODO: Deduplicate this and logger implementation
function tryStringify(o) {
    try {
        return JSON.stringify(o, bigintReplacer);
    } catch  {
        return `"[Circular]"`;
    }
}
const PERCENT_CODE = 37; /* % */ 
const LOWERCASE_D_CODE = 100; /* d */ 
const LOWERCASE_F_CODE = 102; /* f */ 
const LOWERCASE_I_CODE = 105; /* i */ 
const UPPERCASE_O_CODE = 79; /* O */ 
const LOWERCASE_O_CODE = 111; /* o */ 
const LOWERCASE_J_CODE = 106; /* j */ 
const LOWERCASE_S_CODE = 115; /* s */ 
// Heavily based on https://github.com/pinojs/quick-format-unescaped
//
// The MIT License (MIT)
//
// Copyright (c) 2016-2019 David Mark Clements
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
/**
 * Format a string with placeholders using the provided arguments.
 *
 * @param template
 *   Template.
 * @param values
 *   Values to interpolate.
 * @returns
 *   Formatted string.
 */ function sprintf(template, ...values) {
    if (typeof template !== "string") {
        throw new TypeError("First argument must be a string");
    }
    if (values.length === 0) {
        return template;
    }
    let output = "";
    let valueIndex = 0;
    let lastPosition = -1;
    for(let index = 0; index < template.length;){
        if (template.charCodeAt(index) === PERCENT_CODE && index + 1 < template.length) {
            lastPosition = lastPosition > -1 ? lastPosition : 0;
            switch(template.charCodeAt(index + 1)){
                case LOWERCASE_D_CODE:
                case LOWERCASE_F_CODE:
                    {
                        if (valueIndex >= values.length) {
                            break;
                        }
                        const value = values[valueIndex];
                        if (typeof value !== "number") {
                            break;
                        }
                        if (lastPosition < index) {
                            output += template.slice(lastPosition, index);
                        }
                        output += value;
                        lastPosition = index + 2;
                        index++;
                        break;
                    }
                case LOWERCASE_I_CODE:
                    {
                        if (valueIndex >= values.length) {
                            break;
                        }
                        const value = values[valueIndex];
                        if (typeof value !== "number") {
                            break;
                        }
                        if (lastPosition < index) {
                            output += template.slice(lastPosition, index);
                        }
                        output += Math.floor(value);
                        lastPosition = index + 2;
                        index++;
                        break;
                    }
                case UPPERCASE_O_CODE:
                case LOWERCASE_O_CODE:
                case LOWERCASE_J_CODE:
                    {
                        if (valueIndex >= values.length) {
                            break;
                        }
                        const value = values[valueIndex];
                        if (value === undefined) {
                            break;
                        }
                        if (lastPosition < index) {
                            output += template.slice(lastPosition, index);
                        }
                        if (typeof value === "string") {
                            output += `'${value}'`;
                            lastPosition = index + 2;
                            index++;
                            break;
                        }
                        if (typeof value === "bigint") {
                            output += `"[BigInt]"`;
                            lastPosition = index + 2;
                            index++;
                            break;
                        }
                        if (typeof value === "function") {
                            output += value.name || "<anonymous>";
                            lastPosition = index + 2;
                            index++;
                            break;
                        }
                        output += tryStringify(value);
                        lastPosition = index + 2;
                        index++;
                        break;
                    }
                case LOWERCASE_S_CODE:
                    {
                        if (valueIndex >= values.length) {
                            break;
                        }
                        const value = values[valueIndex];
                        if (typeof value !== "string") {
                            break;
                        }
                        if (lastPosition < index) {
                            output += template.slice(lastPosition, index);
                        }
                        output += value;
                        lastPosition = index + 2;
                        index++;
                        break;
                    }
                case PERCENT_CODE:
                    {
                        if (lastPosition < index) {
                            output += template.slice(lastPosition, index);
                        }
                        output += "%";
                        lastPosition = index + 2;
                        index++;
                        valueIndex--;
                        break;
                    }
            }
            ++valueIndex;
        }
        ++index;
    }
    if (lastPosition === -1) {
        return template;
    }
    if (lastPosition < template.length) {
        output += template.slice(lastPosition);
    }
    return output;
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/logger/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Logger",
    ()=>Logger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$sprintf$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/sprintf/index.js [middleware] (ecmascript)");
;
function bigintReplacer(key, value) {
    if (typeof value === "bigint") {
        return "[BigInt]";
    }
    return value;
}
// TODO: Deduplicate this and sprintf implementation
function tryStringify(value) {
    try {
        return JSON.stringify(value, bigintReplacer);
    } catch  {
        return "[Circular]";
    }
}
const PREFIX = "✦Aj";
function getMessage(mergingObject, message, interpolationValues) {
    // The first argument was the message so juggle the arguments
    if (typeof mergingObject === "string") {
        interpolationValues = [
            message,
            ...interpolationValues
        ];
        message = mergingObject;
    }
    // Prefer a string message over `mergingObject.msg`, as per Pino:
    // https://github.com/pinojs/pino/blob/8db130eba0439e61c802448d31eb1998cebfbc98/docs/api.md#message-string
    if (typeof message === "string") {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$sprintf$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["sprintf"])(message, ...interpolationValues);
    }
    if (typeof mergingObject === "object" && mergingObject !== null && "msg" in mergingObject && typeof mergingObject.msg === "string") {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$sprintf$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["sprintf"])(mergingObject.msg, [
            message,
            ...interpolationValues
        ]);
    }
}
function getOutput(messageOrObject, message, interpolationValues) {
    let output = getMessage(messageOrObject, message, interpolationValues);
    if (typeof output !== "string") {
        return;
    }
    if (typeof messageOrObject === "object" && messageOrObject !== null) {
        for (const [key, value] of Object.entries(messageOrObject)){
            output += `\n      ${key}: ${tryStringify(value)}`;
        }
    }
    return output;
}
/**
 * Logger.
 */ class Logger {
    #logLevel;
    /**
     * Configuration.
     *
     * @param options
     *   Configuration.
     * @returns
     *   Logger.
     */ constructor(options){
        if (typeof options.level !== "string") {
            throw new Error(`Invalid log level`);
        }
        switch(options.level){
            case "debug":
                this.#logLevel = 0;
                break;
            case "info":
                this.#logLevel = 1;
                break;
            case "warn":
                this.#logLevel = 2;
                break;
            case "error":
                this.#logLevel = 3;
                break;
            default:
                {
                    throw new Error(`Unknown log level: ${options.level}`);
                }
        }
    }
    debug(messageOrObject, message, ...interpolationValues) {
        if (this.#logLevel <= 0) {
            const output = getOutput(messageOrObject, message, interpolationValues);
            if (typeof output !== "undefined") {
                console.debug(`${PREFIX} DEBUG ${output}`);
            }
        }
    }
    info(messageOrObject, message, ...interpolationValues) {
        if (this.#logLevel <= 1) {
            const output = getOutput(messageOrObject, message, interpolationValues);
            if (typeof output !== "undefined") {
                console.info(`${PREFIX} INFO ${output}`);
            }
        }
    }
    warn(messageOrObject, message, ...interpolationValues) {
        if (this.#logLevel <= 2) {
            const output = getOutput(messageOrObject, message, interpolationValues);
            if (typeof output !== "undefined") {
                console.warn(`${PREFIX} WARN ${output}`);
            }
        }
    }
    error(messageOrObject, message, ...interpolationValues) {
        if (this.#logLevel <= 3) {
            const output = getOutput(messageOrObject, message, interpolationValues);
            if (typeof output !== "undefined") {
                console.error(`${PREFIX} ERROR ${output}`);
            }
        }
    }
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-error.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "H2Code",
    ()=>H2Code,
    "connectErrorFromH2ResetCode",
    ()=>connectErrorFromH2ResetCode,
    "connectErrorFromNodeReason",
    ()=>connectErrorFromNodeReason,
    "getNodeErrorProps",
    ()=>getNodeErrorProps,
    "unwrapNodeErrorChain",
    ()=>unwrapNodeErrorChain
]);
// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/code.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/connect-error.js [middleware] (ecmascript)");
;
function connectErrorFromNodeReason(reason) {
    let code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal;
    const chain = unwrapNodeErrorChain(reason).map(getNodeErrorProps);
    if (chain.some((p)=>p.code == "ERR_STREAM_WRITE_AFTER_END")) {
        // We do not want intentional errors from the server to be shadowed
        // by client-side errors.
        // This can occur if the server has written a response with an error
        // and has ended the connection. This response may already sit in a
        // buffer on the client, while it is still writing to the request
        // body.
        // To avoid this problem, we wrap ERR_STREAM_WRITE_AFTER_END as a
        // ConnectError with Code.Aborted. The special meaning of this code
        // in this situation is documented in StreamingConn.send() and in
        // createServerStreamingFn().
        code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Aborted;
    } else if (chain.some((p)=>p.code == "ERR_STREAM_DESTROYED" || p.code == "ERR_HTTP2_INVALID_STREAM" || p.code == "ECONNRESET")) {
        // A handler whose stream is suddenly destroyed usually means the client
        // hung up. This behavior is triggered by the conformance test "cancel_after_begin".
        code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Aborted;
    } else if (chain.some((p)=>p.code == "ETIMEDOUT" || p.code == "ENOTFOUND" || p.code == "EAI_AGAIN" || p.code == "ECONNREFUSED")) {
        // Calling an unresolvable host should raise a ConnectError with
        // Code.Aborted.
        // This behavior is covered by the conformance test "unresolvable_host".
        code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Unavailable;
    }
    const ce = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"].from(reason, code);
    if (ce !== reason) {
        ce.cause = reason;
    }
    return ce;
}
function unwrapNodeErrorChain(reason) {
    const chain = [];
    for(;;){
        if (!(reason instanceof Error)) {
            break;
        }
        if (chain.includes(reason)) {
            break;
        }
        chain.push(reason);
        if (!("cause" in reason)) {
            break;
        }
        reason = reason.cause;
    }
    return chain;
}
function getNodeErrorProps(reason) {
    const props = {};
    if (reason instanceof Error) {
        if ("code" in reason && typeof reason.code == "string") {
            props.code = reason.code;
        }
        if ("syscall" in reason && typeof reason.syscall == "string") {
            props.syscall = reason.syscall;
        }
    }
    return props;
}
function connectErrorFromH2ResetCode(rstCode) {
    switch(rstCode){
        case H2Code.PROTOCOL_ERROR:
        case H2Code.INTERNAL_ERROR:
        case H2Code.FLOW_CONTROL_ERROR:
        case H2Code.SETTINGS_TIMEOUT:
        case H2Code.FRAME_SIZE_ERROR:
        case H2Code.COMPRESSION_ERROR:
        case H2Code.CONNECT_ERROR:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal);
        case H2Code.REFUSED_STREAM:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Unavailable);
        case H2Code.CANCEL:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Canceled);
        case H2Code.ENHANCE_YOUR_CALM:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].ResourceExhausted);
        case H2Code.INADEQUATE_SECURITY:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].PermissionDenied);
        case H2Code.HTTP_1_1_REQUIRED:
            return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](`http/2 stream closed with error code ${H2Code[rstCode]} (0x${rstCode.toString(16)})`, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].PermissionDenied);
        default:
            break;
    }
    return undefined;
}
var H2Code;
(function(H2Code) {
    H2Code[H2Code["PROTOCOL_ERROR"] = 1] = "PROTOCOL_ERROR";
    H2Code[H2Code["INTERNAL_ERROR"] = 2] = "INTERNAL_ERROR";
    H2Code[H2Code["FLOW_CONTROL_ERROR"] = 3] = "FLOW_CONTROL_ERROR";
    H2Code[H2Code["SETTINGS_TIMEOUT"] = 4] = "SETTINGS_TIMEOUT";
    H2Code[H2Code["STREAM_CLOSED"] = 5] = "STREAM_CLOSED";
    H2Code[H2Code["FRAME_SIZE_ERROR"] = 6] = "FRAME_SIZE_ERROR";
    H2Code[H2Code["REFUSED_STREAM"] = 7] = "REFUSED_STREAM";
    H2Code[H2Code["CANCEL"] = 8] = "CANCEL";
    H2Code[H2Code["COMPRESSION_ERROR"] = 9] = "COMPRESSION_ERROR";
    H2Code[H2Code["CONNECT_ERROR"] = 10] = "CONNECT_ERROR";
    H2Code[H2Code["ENHANCE_YOUR_CALM"] = 11] = "ENHANCE_YOUR_CALM";
    H2Code[H2Code["INADEQUATE_SECURITY"] = 12] = "INADEQUATE_SECURITY";
    H2Code[H2Code["HTTP_1_1_REQUIRED"] = 13] = "HTTP_1_1_REQUIRED";
})(H2Code || (H2Code = {}));
}),
"[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/http2-session-manager.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Http2SessionManager",
    ()=>Http2SessionManager
]);
// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:http2 [external] (node:http2, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/code.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/connect-error.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-error.js [middleware] (ecmascript)");
;
;
;
class Http2SessionManager {
    /**
     * The current state of the connection:
     *
     * - "closed"
     *   The connection is closed, or no connection has been opened yet.
     * - connecting
     *   Currently establishing a connection.
     *
     * - "open"
     *   A connection is open and has open streams. PING frames are sent every
     *   pingIntervalMs, unless a stream received data.
     *   If a PING frame is not responded to within pingTimeoutMs, the connection
     *   and all open streams close.
     *
     * - "idle"
     *   A connection is open, but it does not have any open streams.
     *   If pingIdleConnection is enabled, PING frames are used to keep the
     *   connection alive, similar to an "open" connection.
     *   If a connection is idle for longer than idleConnectionTimeoutMs, it closes.
     *   If a request is made on an idle connection that has not been used for
     *   longer than pingIntervalMs, the connection is verified.
     *
     * - "verifying"
     *   Verifying a connection after a long period of inactivity before issuing a
     *   request. A PING frame is sent, and if it times out within pingTimeoutMs, a
     *   new connection is opened.
     *
     * - "error"
     *   The connection is closed because of a transient error. A connection
     *   may have failed to reach the host, or the connection may have died,
     *   or it may have been aborted.
     */ state() {
        if (this.s.t == "ready") {
            if (this.verifying !== undefined) {
                return "verifying";
            }
            return this.s.streamCount() > 0 ? "open" : "idle";
        }
        return this.s.t;
    }
    /**
     * Returns the error object if the connection is in the "error" state,
     * `undefined` otherwise.
     */ error() {
        if (this.s.t == "error") {
            return this.s.reason;
        }
        return undefined;
    }
    constructor(url, pingOptions, http2SessionOptions){
        var _a, _b, _c, _d;
        this.s = closed();
        this.shuttingDown = [];
        this.authority = new URL(url).origin;
        this.http2SessionOptions = http2SessionOptions;
        this.options = {
            pingIntervalMs: (_a = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.pingIntervalMs) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY,
            pingTimeoutMs: (_b = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.pingTimeoutMs) !== null && _b !== void 0 ? _b : 1000 * 15,
            pingIdleConnection: (_c = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.pingIdleConnection) !== null && _c !== void 0 ? _c : false,
            idleConnectionTimeoutMs: (_d = pingOptions === null || pingOptions === void 0 ? void 0 : pingOptions.idleConnectionTimeoutMs) !== null && _d !== void 0 ? _d : 1000 * 60 * 15
        };
    }
    /**
     * Open a connection if none exists, verify an existing connection if
     * necessary.
     */ async connect() {
        try {
            const ready = await this.gotoReady();
            return ready.streamCount() > 0 ? "open" : "idle";
        } catch (e) {
            return "error";
        }
    }
    /**
     * Issue a request.
     *
     * This method automatically opens a connection if none exists, and verifies
     * an existing connection if necessary. It calls http2.ClientHttp2Session.request(),
     * and keeps track of all open http2.ClientHttp2Stream.
     *
     * Clients must call notifyResponseByteRead() whenever they successfully read
     * data from the http2.ClientHttp2Stream.
     */ async request(method, path, headers, options) {
        // Request sometimes fails with goaway/destroyed
        // errors, we use a loop to retry.
        //
        // This is not expected to happen often, but it is possible that a
        // connection is closed while we are trying to open a stream.
        //
        // Ref: https://github.com/nodejs/help/issues/2105
        for(;;){
            const ready = await this.gotoReady();
            try {
                const stream = ready.conn.request(Object.assign(Object.assign({}, headers), {
                    ":method": method,
                    ":path": path
                }), options);
                ready.registerRequest(stream);
                return stream;
            } catch (e) {
                // Check to see if the connection is closed or destroyed
                // and if so, we try again.
                if (ready.conn.closed || ready.conn.destroyed) {
                    continue;
                }
                throw e;
            }
        }
    }
    /**
     * Notify the manager of a successful read from a http2.ClientHttp2Stream.
     *
     * Clients must call this function whenever they successfully read data from
     * a http2.ClientHttp2Stream obtained from request(). This informs the
     * keep-alive logic that the connection is alive, and prevents it from sending
     * unnecessary PING frames.
     */ notifyResponseByteRead(stream) {
        if (this.s.t == "ready") {
            this.s.responseByteRead(stream);
        }
        for (const s of this.shuttingDown){
            s.responseByteRead(stream);
        }
    }
    /**
     * If there is an open connection, close it. This also closes any open streams.
     */ abort(reason) {
        var _a, _b, _c;
        const err = reason !== null && reason !== void 0 ? reason : new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("connection aborted", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Canceled);
        (_b = (_a = this.s).abort) === null || _b === void 0 ? void 0 : _b.call(_a, err);
        for (const s of this.shuttingDown){
            (_c = s.abort) === null || _c === void 0 ? void 0 : _c.call(s, err);
        }
        this.setState(closedOrError(err));
    }
    async gotoReady() {
        if (this.s.t == "ready") {
            if (this.s.isShuttingDown() || this.s.conn.closed || this.s.conn.destroyed) {
                this.setState(connect(this.authority, this.http2SessionOptions));
            } else if (this.s.requiresVerify()) {
                await this.verify(this.s);
            }
        } else if (this.s.t == "closed" || this.s.t == "error") {
            this.setState(connect(this.authority, this.http2SessionOptions));
        }
        while(this.s.t !== "ready"){
            if (this.s.t === "error") {
                throw this.s.reason;
            }
            if (this.s.t === "connecting") {
                await this.s.conn;
            }
        }
        return this.s;
    }
    setState(state) {
        var _a, _b;
        (_b = (_a = this.s).onExitState) === null || _b === void 0 ? void 0 : _b.call(_a);
        if (this.s.t == "ready" && this.s.isShuttingDown()) {
            // Maintain connections that have been asked to shut down.
            const sd = this.s;
            this.shuttingDown.push(sd);
            sd.onClose = sd.onError = ()=>{
                const i = this.shuttingDown.indexOf(sd);
                if (i !== -1) {
                    this.shuttingDown.splice(i, 1);
                }
            };
        }
        switch(state.t){
            case "connecting":
                state.conn.then((value)=>{
                    this.setState(ready(value, this.options));
                }, (reason)=>{
                    this.setState(closedOrError(reason));
                });
                break;
            case "ready":
                state.onClose = ()=>this.setState(closed());
                state.onError = (err)=>this.setState(closedOrError(err));
                break;
            case "closed":
                break;
            case "error":
                break;
        }
        this.s = state;
    }
    verify(stateReady) {
        if (this.verifying !== undefined) {
            return this.verifying;
        }
        this.verifying = stateReady.verify().then((success)=>{
            if (success) {
                return;
            }
            // verify() has destroyed the old connection
            this.setState(connect(this.authority, this.http2SessionOptions));
        }, (reason)=>{
            this.setState(closedOrError(reason));
        }).finally(()=>{
            this.verifying = undefined;
        });
        return this.verifying;
    }
}
function closed() {
    return {
        t: "closed"
    };
}
function error(reason) {
    return {
        t: "error",
        reason
    };
}
function closedOrError(reason) {
    const isCancel = reason instanceof __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"] && __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"].from(reason).code == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Canceled;
    return isCancel ? closed() : error(reason);
}
function connect(authority, http2SessionOptions) {
    let resolve;
    let reject;
    const conn = new Promise((res, rej)=>{
        resolve = res;
        reject = rej;
    });
    const newConn = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["connect"](authority, http2SessionOptions);
    newConn.on("connect", onConnect);
    newConn.on("error", onError);
    function onConnect() {
        resolve === null || resolve === void 0 ? void 0 : resolve(newConn);
        cleanup();
    }
    function onError(err) {
        reject === null || reject === void 0 ? void 0 : reject((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["connectErrorFromNodeReason"])(err));
        cleanup();
    }
    function cleanup() {
        newConn.off("connect", onConnect);
        newConn.off("error", onError);
    }
    return {
        t: "connecting",
        conn,
        abort (reason) {
            if (!newConn.destroyed) {
                newConn.destroy(undefined, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["constants"].NGHTTP2_CANCEL);
            }
            // According to the documentation, destroy() should immediately terminate
            // the session and the socket, but we still receive a "connect" event.
            // We must not resolve a broken connection, so we reject it manually here.
            reject === null || reject === void 0 ? void 0 : reject(reason);
        },
        onExitState () {
            cleanup();
        }
    };
}
function ready(conn, options) {
    // Users have reported an error "The session has been destroyed" raised
    // from H2SessionManager.request(), see https://github.com/connectrpc/connect-es/issues/683
    // This assertion will show whether the session already died in the
    // "connecting" state.
    assertSessionOpen(conn);
    // Do not block Node.js from exiting on an idle connection.
    // Note that we ref() again for the first stream to open, and unref() again
    // for the last stream to close.
    conn.unref();
    // the last time we were sure that the connection is alive, via a PING
    // response, or via received response bytes
    let lastAliveAt = Date.now();
    // how many streams are currently open on this session
    let streamCount = 0;
    // timer for the keep-alive interval
    let pingIntervalId;
    // timer for waiting for a PING response
    let pingTimeoutId;
    // keep track of GOAWAY - gracefully shut down open streams / wait for connection to error
    let receivedGoAway = false;
    // keep track of GOAWAY with ENHANCE_YOUR_CALM and with debug data too_many_pings
    let receivedGoAwayEnhanceYourCalmTooManyPings = false;
    // timer for closing connections without open streams, must be initialized
    let idleTimeoutId;
    resetIdleTimeout();
    const state = {
        t: "ready",
        conn,
        streamCount () {
            return streamCount;
        },
        requiresVerify () {
            const elapsedMs = Date.now() - lastAliveAt;
            return elapsedMs > options.pingIntervalMs;
        },
        isShuttingDown () {
            return receivedGoAway;
        },
        onClose: undefined,
        onError: undefined,
        registerRequest (stream) {
            streamCount++;
            if (streamCount == 1) {
                conn.ref();
                resetPingInterval(); // reset to ping with the appropriate interval for "open"
                stopIdleTimeout();
            }
            stream.once("response", ()=>{
                lastAliveAt = Date.now();
                resetPingInterval();
            });
            stream.once("close", ()=>{
                streamCount--;
                if (streamCount == 0) {
                    conn.unref();
                    resetPingInterval(); // reset to ping with the appropriate interval for "idle"
                    resetIdleTimeout();
                }
            });
        },
        responseByteRead (stream) {
            if (stream.session !== conn) {
                return;
            }
            if (conn.closed || conn.destroyed) {
                return;
            }
            if (streamCount <= 0) {
                return;
            }
            lastAliveAt = Date.now();
            resetPingInterval();
        },
        verify () {
            conn.ref();
            return new Promise((resolve)=>{
                const onError = ()=>{
                    resolve(false);
                };
                commonPing(()=>{
                    if (streamCount == 0) conn.unref();
                    conn.off("error", onError);
                    resolve(true);
                });
                conn.once("error", onError);
            });
        },
        abort (reason) {
            if (!conn.destroyed) {
                conn.once("error", ()=>{
                // conn.destroy() may raise an error after onExitState() was called
                // and our error listeners are removed.
                // We attach this one to swallow uncaught exceptions.
                });
                conn.destroy(reason, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["constants"].NGHTTP2_CANCEL);
            }
        },
        onExitState () {
            if (state.isShuttingDown()) {
                // Per the interface, this method is called when the manager is leaving
                // the state. We maintain this connection in the session manager until
                // all streams have finished, so we do not detach event listeners here.
                return;
            }
            cleanup();
            this.onError = undefined;
            this.onClose = undefined;
        }
    };
    // start or restart the ping interval
    function resetPingInterval() {
        stopPingInterval();
        if (streamCount > 0 || options.pingIdleConnection) {
            pingIntervalId = safeSetTimeout(onPingInterval, options.pingIntervalMs);
        }
    }
    function stopPingInterval() {
        clearTimeout(pingIntervalId);
        clearTimeout(pingTimeoutId);
    }
    function onPingInterval() {
        commonPing(resetPingInterval);
    }
    function commonPing(onSuccess) {
        clearTimeout(pingTimeoutId);
        pingTimeoutId = safeSetTimeout(()=>{
            conn.destroy(new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("PING timed out", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Unavailable), __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["constants"].NGHTTP2_CANCEL);
        }, options.pingTimeoutMs);
        conn.ping((err, duration)=>{
            clearTimeout(pingTimeoutId);
            if (err !== null) {
                // We will receive an ERR_HTTP2_PING_CANCEL here if we destroy the
                // connection with a pending ping.
                // We might also see other errors, but they should be picked up by the
                // "error" event listener.
                return;
            }
            if (duration > options.pingTimeoutMs) {
                // setTimeout is not precise, and HTTP/2 pings take less than 1ms in
                // tests.
                conn.destroy(new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("PING timed out", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Unavailable), __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["constants"].NGHTTP2_CANCEL);
                return;
            }
            lastAliveAt = Date.now();
            onSuccess();
        });
    }
    function stopIdleTimeout() {
        clearTimeout(idleTimeoutId);
    }
    function resetIdleTimeout() {
        idleTimeoutId = safeSetTimeout(onIdleTimeout, options.idleConnectionTimeoutMs);
    }
    function onIdleTimeout() {
        conn.close();
        onClose(); // trigger a state change right away, so we are not open to races
    }
    function onGoaway(errorCode, lastStreamID, opaqueData) {
        if (errorCode === __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["constants"].NGHTTP2_NO_ERROR && streamCount === 0) {
            // Node.js v16 closes the connection on its own when it receives a GOAWAY
            // frame and there are no open streams (emitting a "close" event and
            // destroying the session), but later versions do not.
            // We call conn.destroy() because calling conn.close() ourselves is ineffective
            // here - it appears that the method is already being called, see https://github.com/nodejs/node/blob/198affc63973805ce5102d246f6b7822be57f5fc/lib/internal/http2/core.js#L681
            conn.destroy(new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("received GOAWAY without any open streams", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Canceled), __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["constants"].NGHTTP2_NO_ERROR);
            return;
        }
        receivedGoAway = true;
        const tooManyPingsAscii = Buffer.from("too_many_pings", "ascii");
        if (opaqueData === null || opaqueData === void 0 ? void 0 : opaqueData.equals(tooManyPingsAscii)) {
            // double pingIntervalMs, following the last paragraph of https://github.com/grpc/proposal/blob/0ba0c1905050525f9b0aee46f3f23c8e1e515489/A8-client-side-keepalive.md#basic-keepalive
            options.pingIntervalMs = options.pingIntervalMs * 2;
            receivedGoAwayEnhanceYourCalmTooManyPings = true;
        }
    }
    function onClose() {
        var _a;
        cleanup();
        (_a = state.onClose) === null || _a === void 0 ? void 0 : _a.call(state);
    }
    function onError(err) {
        var _a, _b;
        cleanup();
        if (receivedGoAwayEnhanceYourCalmTooManyPings) {
            // We cannot prevent node from destroying session and streams with its own
            // error that does not carry debug data, but at least we can wrap the error
            // we surface on the manager.
            const ce = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](`http/2 connection closed with error code ENHANCE_YOUR_CALM (0x${__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http2__$5b$external$5d$__$28$node$3a$http2$2c$__cjs$29$__["constants"].NGHTTP2_ENHANCE_YOUR_CALM.toString(16)}), too_many_pings, doubled the interval`, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].ResourceExhausted);
            (_a = state.onError) === null || _a === void 0 ? void 0 : _a.call(state, ce);
        } else {
            (_b = state.onError) === null || _b === void 0 ? void 0 : _b.call(state, (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["connectErrorFromNodeReason"])(err));
        }
    }
    function cleanup() {
        stopPingInterval();
        stopIdleTimeout();
        conn.off("error", onError);
        conn.off("close", onClose);
        conn.off("goaway", onGoaway);
    }
    conn.on("error", onError);
    conn.on("close", onClose);
    conn.on("goaway", onGoaway);
    return state;
}
/**
 * setTimeout(), but simply ignores values larger than the maximum supported
 * value (signed 32-bit integer) instead of calling the callback right away,
 * and does not block Node.js from exiting.
 */ function safeSetTimeout(callback, ms) {
    if (ms > 0x7fffffff) {
        return;
    }
    return setTimeout(callback, ms).unref();
}
function assertSessionOpen(conn) {
    if (conn.connecting) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("expected open session, but it is connecting", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal);
    }
    if (conn.destroyed) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("expected open session, but it is destroyed", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal);
    }
    if (conn.closed) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("expected open session, but it is closed", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal);
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/compression.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "compressionBrotli",
    ()=>compressionBrotli,
    "compressionGzip",
    ()=>compressionGzip
]);
// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$zlib__$5b$external$5d$__$28$node$3a$zlib$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:zlib [external] (node:zlib, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:util [external] (node:util, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/code.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/connect-error.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-error.js [middleware] (ecmascript)");
;
;
;
;
const gzip = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$zlib__$5b$external$5d$__$28$node$3a$zlib$2c$__cjs$29$__["gzip"]);
const gunzip = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$zlib__$5b$external$5d$__$28$node$3a$zlib$2c$__cjs$29$__["gunzip"]);
const brotliCompress = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$zlib__$5b$external$5d$__$28$node$3a$zlib$2c$__cjs$29$__["brotliCompress"]);
const brotliDecompress = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$util__$5b$external$5d$__$28$node$3a$util$2c$__cjs$29$__["promisify"])(__TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$zlib__$5b$external$5d$__$28$node$3a$zlib$2c$__cjs$29$__["brotliDecompress"]);
const compressionGzip = {
    name: "gzip",
    compress (bytes) {
        return asUint8ArrayArrayBuffer(gzip(bytes, {}));
    },
    decompress (bytes, readMaxBytes) {
        if (bytes.length == 0) {
            return Promise.resolve(new Uint8Array(0));
        }
        return asUint8ArrayArrayBuffer(wrapZLibErrors(gunzip(bytes, {
            maxOutputLength: readMaxBytes
        }), readMaxBytes));
    }
};
const compressionBrotli = {
    name: "br",
    compress (bytes) {
        return asUint8ArrayArrayBuffer(brotliCompress(bytes, {}));
    },
    decompress (bytes, readMaxBytes) {
        if (bytes.length == 0) {
            return Promise.resolve(new Uint8Array(0));
        }
        return asUint8ArrayArrayBuffer(wrapZLibErrors(brotliDecompress(bytes, {
            maxOutputLength: readMaxBytes
        }), readMaxBytes));
    }
};
function asUint8ArrayArrayBuffer(bytes) {
    return bytes.then((b)=>{
        if (b.buffer instanceof ArrayBuffer) {
            return b;
        }
        return new Uint8Array(b);
    });
}
function wrapZLibErrors(promise, readMaxBytes) {
    return promise.catch((e)=>{
        var _a;
        const props = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getNodeErrorProps"])(e);
        let code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal;
        let message = "decompression failed";
        switch(props.code){
            case "ERR_BUFFER_TOO_LARGE":
                code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].ResourceExhausted;
                message = `message is larger than configured readMaxBytes ${readMaxBytes} after decompression`;
                break;
            case "Z_DATA_ERROR":
            case "ERR_PADDING_2":
                code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].InvalidArgument;
                break;
            default:
                if ((_a = props.code) === null || _a === void 0 ? void 0 : _a.startsWith("ERR__ERROR_FORMAT_")) {
                    code = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].InvalidArgument;
                }
                break;
        }
        return Promise.reject(new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](message, code, undefined, undefined, e));
    });
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-universal-header.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * Convert a Node.js header object to a fetch API Headers object.
 *
 * This function works for Node.js incoming and outgoing headers, and for the
 * http and the http2 package.
 *
 * HTTP/2 pseudo-headers (:method, :path, etc.) are stripped.
 */ __turbopack_context__.s([
    "nodeHeaderToWebHeader",
    ()=>nodeHeaderToWebHeader,
    "webHeaderToNodeHeaders",
    ()=>webHeaderToNodeHeaders
]);
function nodeHeaderToWebHeader(nodeHeaders) {
    const header = new Headers();
    for (const [k, v] of Object.entries(nodeHeaders)){
        if (k.startsWith(":")) {
            continue;
        }
        if (v === undefined) {
            continue;
        }
        if (typeof v == "string") {
            header.append(k, v);
        } else if (typeof v == "number") {
            header.append(k, String(v));
        } else {
            for (const e of v){
                header.append(k, e);
            }
        }
    }
    return header;
}
function webHeaderToNodeHeaders(headersInit, defaultNodeHeaders) {
    if (headersInit === undefined && defaultNodeHeaders === undefined) {
        return undefined;
    }
    const o = Object.create(null);
    if (defaultNodeHeaders !== undefined) {
        if (Array.isArray(defaultNodeHeaders)) {
            // headers may be an Array where the keys and values are in the same list.
            // It is _not_ a list of tuples. So, the even-numbered offsets are key values,
            // and the odd-numbered offsets are the associated values.
            for(let i = 0; i + 1 < defaultNodeHeaders.length; i += 2){
                const key = defaultNodeHeaders[i];
                const value = defaultNodeHeaders[i + 1];
                if (Array.isArray(o[key])) {
                    o[key].push(value);
                } else if (typeof o[key] == "string") {
                    o[key] = [
                        o[key],
                        value
                    ];
                } else {
                    o[key] = value;
                }
            }
        } else {
            for (const [key, value] of Object.entries(defaultNodeHeaders)){
                if (Array.isArray(value)) {
                    o[key] = value.concat();
                } else if (value !== undefined) {
                    o[key] = value;
                }
            }
        }
    }
    if (headersInit !== undefined) {
        if (Array.isArray(headersInit)) {
            for (const [key, value] of headersInit){
                appendWebHeader(o, key, value);
            }
        } else if ("forEach" in headersInit) {
            if (typeof headersInit.forEach == "function") {
                headersInit.forEach((value, key)=>{
                    appendWebHeader(o, key, value);
                });
            }
        } else {
            for (const [key, value] of Object.entries(headersInit)){
                appendWebHeader(o, key, value);
            }
        }
    }
    return o;
}
function appendWebHeader(o, key, value) {
    key = key.toLowerCase();
    const existing = o[key];
    if (Array.isArray(existing)) {
        existing.push(value);
    } else if (existing === undefined) {
        o[key] = value;
    } else {
        o[key] = [
            existing.toString(),
            value
        ];
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-universal-client.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createNodeHttpClient",
    ()=>createNodeHttpClient
]);
// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http__$5b$external$5d$__$28$node$3a$http$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:http [external] (node:http, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$https__$5b$external$5d$__$28$node$3a$https$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:https [external] (node:https, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/code.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/connect-error.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$header$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-universal-header.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-error.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$protocol$2f$signals$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/protocol/signals.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$http2$2d$session$2d$manager$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/http2-session-manager.js [middleware] (ecmascript)");
;
;
;
;
;
;
;
function createNodeHttpClient(options) {
    var _a;
    if (options.httpVersion == "1.1") {
        return createNodeHttp1Client(options.nodeOptions);
    }
    const sessionProvider = (_a = options.sessionProvider) !== null && _a !== void 0 ? _a : (url)=>new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$http2$2d$session$2d$manager$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Http2SessionManager"](url);
    return createNodeHttp2Client(sessionProvider);
}
/**
 * Create an HTTP client using the Node.js `http` or `https` package.
 *
 * The HTTP client is a simple function conforming to the type UniversalClientFn.
 * It takes an UniversalClientRequest as an argument, and returns a promise for
 * an UniversalClientResponse.
 */ function createNodeHttp1Client(httpOptions) {
    return async function request(req) {
        const sentinel = createSentinel(req.signal);
        return new Promise((resolve, reject)=>{
            sentinel.onError((e)=>{
                reject(e);
            });
            h1Request(sentinel, req.url, Object.assign(Object.assign({}, httpOptions), {
                headers: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$header$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["webHeaderToNodeHeaders"])(req.header, httpOptions === null || httpOptions === void 0 ? void 0 : httpOptions.headers),
                method: req.method
            }), (request)=>{
                void sinkRequest(req, request, sentinel);
                request.on("response", (response)=>{
                    var _a;
                    response.on("error", sentinel.error);
                    sentinel.onError((reason)=>response.destroy(reason));
                    const trailer = new Headers();
                    resolve({
                        status: (_a = response.statusCode) !== null && _a !== void 0 ? _a : 0,
                        header: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$header$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["nodeHeaderToWebHeader"])(response.headers),
                        body: h1ResponseIterable(sentinel, response, trailer),
                        trailer
                    });
                });
            });
        });
    };
}
/**
 * Create an HTTP client using the Node.js `http2` package.
 *
 * The HTTP client is a simple function conforming to the type UniversalClientFn.
 * It takes an UniversalClientRequest as an argument, and returns a promise for
 * an UniversalClientResponse.
 */ function createNodeHttp2Client(sessionProvider) {
    return function request(req) {
        const sentinel = createSentinel(req.signal);
        const sessionManager = sessionProvider(req.url);
        return new Promise((resolve, reject)=>{
            sentinel.onError((e)=>{
                reject(e);
            });
            h2Request(sentinel, sessionManager, req.url, req.method, (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$header$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["webHeaderToNodeHeaders"])(req.header), {}, (stream)=>{
                void sinkRequest(req, stream, sentinel);
                stream.on("response", (headers)=>{
                    var _a;
                    const response = {
                        status: (_a = headers[":status"]) !== null && _a !== void 0 ? _a : 0,
                        header: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$header$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["nodeHeaderToWebHeader"])(headers),
                        body: h2ResponseIterable(sentinel, stream, sessionManager),
                        trailer: h2ResponseTrailer(stream)
                    };
                    resolve(response);
                });
            });
        });
    };
}
function h1Request(sentinel, url, options, onRequest) {
    let request;
    if (new URL(url).protocol.startsWith("https")) {
        request = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$https__$5b$external$5d$__$28$node$3a$https$2c$__cjs$29$__["request"](url, options);
    } else {
        request = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$http__$5b$external$5d$__$28$node$3a$http$2c$__cjs$29$__["request"](url, options);
    }
    sentinel.onError((reason)=>request.destroy(reason));
    // Node.js will only send headers with the first request body byte by default.
    // We force it to send headers right away for consistent behavior between
    // HTTP/1.1 and HTTP/2.0 clients.
    request.flushHeaders();
    request.on("error", sentinel.error);
    request.on("socket", function onRequestSocket(socket) {
        function onSocketConnect() {
            socket.off("connect", onSocketConnect);
            onRequest(request);
        }
        // If readyState is open, then socket is already open due to keepAlive, so
        // the 'connect' event will never fire so call onRequest explicitly
        if (socket.readyState === "open") {
            onRequest(request);
        } else {
            socket.on("connect", onSocketConnect);
        }
    });
}
function h1ResponseIterable(sentinel, response, trailer) {
    const inner = response[Symbol.asyncIterator]();
    return {
        [Symbol.asyncIterator] () {
            return {
                async next () {
                    const r = await sentinel.race(inner.next());
                    if (r.done === true) {
                        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$header$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["nodeHeaderToWebHeader"])(response.trailers).forEach((value, key)=>{
                            trailer.set(key, value);
                        });
                        sentinel.close();
                    }
                    return r;
                },
                throw (e) {
                    sentinel.error(e);
                    throw e;
                }
            };
        }
    };
}
function h2Request(sentinel, sm, url, method, headers, options, onStream) {
    const requestUrl = new URL(url);
    if (requestUrl.origin !== sm.authority) {
        const message = `cannot make a request to ${requestUrl.origin}: the http2 session is connected to ${sm.authority}`;
        sentinel.error(new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"](message, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal));
        return;
    }
    sm.request(method, requestUrl.pathname + requestUrl.search, headers, {}).then((stream)=>{
        sentinel.onError((reason)=>{
            if (stream.closed) {
                return;
            }
            // Node.js http2 streams that are aborted via an AbortSignal close with
            // an RST_STREAM with code INTERNAL_ERROR.
            // To comply with the mapping between gRPC and HTTP/2 codes, we need to
            // close with code CANCEL.
            // See https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-HTTP2.md#errors
            // See https://www.rfc-editor.org/rfc/rfc7540#section-7
            const rstCode = reason.code == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Canceled ? __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["H2Code"].CANCEL : __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["H2Code"].INTERNAL_ERROR;
            return new Promise((resolve)=>stream.close(rstCode, resolve));
        });
        stream.on("error", function h2StreamError(e) {
            if (stream.writableEnded && (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unwrapNodeErrorChain"])(e).map(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getNodeErrorProps"]).some((p)=>p.code == "ERR_STREAM_WRITE_AFTER_END")) {
                return;
            }
            sentinel.error(e);
        });
        stream.on("close", function h2StreamClose() {
            const err = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["connectErrorFromH2ResetCode"])(stream.rstCode);
            if (err) {
                sentinel.error(err);
            }
        });
        onStream(stream);
    }, (reason)=>{
        sentinel.error(reason);
    });
}
function h2ResponseTrailer(response) {
    const trailer = new Headers();
    response.on("trailers", (args)=>{
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$header$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["nodeHeaderToWebHeader"])(args).forEach((value, key)=>{
            trailer.set(key, value);
        });
    });
    return trailer;
}
function h2ResponseIterable(sentinel, response, sm) {
    const inner = response[Symbol.asyncIterator]();
    return {
        [Symbol.asyncIterator] () {
            return {
                async next () {
                    const r = await sentinel.race(inner.next());
                    if (r.done === true) {
                        sentinel.close();
                    }
                    sm === null || sm === void 0 ? void 0 : sm.notifyResponseByteRead(response);
                    return r;
                },
                throw (e) {
                    sentinel.error(e);
                    throw e;
                }
            };
        }
    };
}
async function sinkRequest(request, nodeRequest, sentinel) {
    if (request.body === undefined) {
        await new Promise((resolve)=>nodeRequest.end(resolve));
        return;
    }
    const it = request.body[Symbol.asyncIterator]();
    return new Promise((resolve)=>{
        writeNext();
        function writeNext() {
            if (sentinel.isClosed()) {
                return;
            }
            it.next().then((r)=>{
                if (r.done === true) {
                    nodeRequest.end(resolve);
                    return;
                }
                nodeRequest.write(r.value, "binary", (e)=>{
                    if (e === null || e === undefined) {
                        writeNext();
                        return;
                    }
                    if (it.throw !== undefined) {
                        it.throw((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["connectErrorFromNodeReason"])(e)).catch(()=>{
                        //
                        });
                    }
                    // If the server responds and closes the connection before the client has written the entire response
                    // body, we get an ERR_STREAM_WRITE_AFTER_END error code from Node.js here.
                    // We do want to notify the iterable of the error condition, but we do not want to reject our sentinel,
                    // because that would also affect the reading side.
                    if (nodeRequest.writableEnded && (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unwrapNodeErrorChain"])(e).map(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getNodeErrorProps"]).some((p)=>p.code == "ERR_STREAM_WRITE_AFTER_END")) {
                        return;
                    }
                    sentinel.error(e);
                });
            }, (e)=>{
                sentinel.error(e);
            });
        }
    });
}
function createSentinel(signal) {
    let rejectRace;
    let closed = false;
    let closedError = undefined;
    let onErrorListeners = [];
    const sentinel = {
        error (error) {
            if (closed) {
                return;
            }
            closed = true;
            closedError = error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"] ? error : (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["connectErrorFromNodeReason"])(error);
            rejectRace === null || rejectRace === void 0 ? void 0 : rejectRace(closedError);
            for (const onRejected of onErrorListeners){
                onRejected(closedError);
            }
            cleanup();
        },
        close () {
            if (closed) {
                return;
            }
            closed = true;
            if (rejectRace) {
                rejectRace(new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("sentinel completed early", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal));
            }
            cleanup();
        },
        isClosed () {
            return closed;
        },
        onError (onError) {
            if (closed) {
                if (closedError !== undefined) {
                    onError(closedError);
                }
            } else {
                onErrorListeners.push(onError);
            }
        },
        race (promise) {
            let resolveRace;
            const race = new Promise((resolve, reject)=>{
                resolveRace = resolve;
                rejectRace = reject;
            });
            promise.then((value)=>{
                resolveRace === null || resolveRace === void 0 ? void 0 : resolveRace(value);
            }, (reason)=>{
                rejectRace === null || rejectRace === void 0 ? void 0 : rejectRace(reason);
            });
            if (closed) {
                rejectRace === null || rejectRace === void 0 ? void 0 : rejectRace(closedError !== null && closedError !== void 0 ? closedError : new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$connect$2d$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ConnectError"]("sentinel completed early", __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$code$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Code"].Internal));
            }
            return race;
        }
    };
    function cleanup() {
        if (signal) {
            signal.removeEventListener("abort", onSignalAbort);
        }
        onErrorListeners = [];
        rejectRace = undefined;
    }
    function onSignalAbort() {
        sentinel.error((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$protocol$2f$signals$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getAbortSignalReason"])(this));
    }
    if (signal) {
        signal.addEventListener("abort", onSignalAbort);
        if (signal.aborted) {
            sentinel.error((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$protocol$2f$signals$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getAbortSignalReason"])(signal));
        }
    }
    return sentinel;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-transport-options.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "validateNodeTransportOptions",
    ()=>validateNodeTransportOptions
]);
// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$protocol$2f$limit$2d$io$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/protocol/limit-io.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$compression$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/compression.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$client$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-universal-client.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$http2$2d$session$2d$manager$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/http2-session-manager.js [middleware] (ecmascript)");
;
;
;
;
function validateNodeTransportOptions(options) {
    var _a, _b, _c, _d;
    let httpClient;
    if (options.httpVersion == "2") {
        let sessionManager;
        if (options.sessionManager) {
            sessionManager = options.sessionManager;
        } else {
            sessionManager = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$http2$2d$session$2d$manager$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Http2SessionManager"](options.baseUrl, {
                pingIntervalMs: options.pingIntervalMs,
                pingIdleConnection: options.pingIdleConnection,
                pingTimeoutMs: options.pingTimeoutMs,
                idleConnectionTimeoutMs: options.idleConnectionTimeoutMs
            }, options.nodeOptions);
        }
        httpClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$client$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createNodeHttpClient"])({
            httpVersion: "2",
            sessionProvider: ()=>sessionManager
        });
    } else {
        httpClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$universal$2d$client$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createNodeHttpClient"])({
            httpVersion: "1.1",
            nodeOptions: options.nodeOptions
        });
    }
    return Object.assign(Object.assign(Object.assign({}, options), {
        httpClient,
        useBinaryFormat: (_a = options.useBinaryFormat) !== null && _a !== void 0 ? _a : true,
        interceptors: (_b = options.interceptors) !== null && _b !== void 0 ? _b : [],
        sendCompression: (_c = options.sendCompression) !== null && _c !== void 0 ? _c : null,
        acceptCompression: (_d = options.acceptCompression) !== null && _d !== void 0 ? _d : [
            __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$compression$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["compressionGzip"],
            __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$compression$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["compressionBrotli"]
        ]
    }), (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$protocol$2f$limit$2d$io$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateReadWriteMaxBytes"])(options.readMaxBytes, options.writeMaxBytes, options.compressMinBytes));
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/connect-transport.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createConnectTransport",
    ()=>createConnectTransport
]);
// Copyright 2021-2025 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$protocol$2d$connect$2f$transport$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect/dist/esm/protocol-connect/transport.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$transport$2d$options$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/node-transport-options.js [middleware] (ecmascript)");
;
;
function createConnectTransport(options) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2f$dist$2f$esm$2f$protocol$2d$connect$2f$transport$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createTransport"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$node$2d$transport$2d$options$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["validateNodeTransportOptions"])(options));
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/transport/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createTransport",
    ()=>createTransport
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$http2$2d$session$2d$manager$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/http2-session-manager.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$connect$2d$transport$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@connectrpc/connect-node/dist/esm/connect-transport.js [middleware] (ecmascript)");
;
/**
 * Create a transport that talks over HTTP/2 using Connect RPC.
 *
 * A thin wrapper around {@linkcode createConnectTransport}.
 *
 * @param baseUrl
 *   Base URI for all HTTP requests (example: `https://example.com/my-api`).
 * @returns
 *   Connect transport used to make RPC calls.
 */ function createTransport(baseUrl) {
    // We create our own session manager so we can attempt to pre-connect
    const sessionManager = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$http2$2d$session$2d$manager$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Http2SessionManager"](baseUrl, {
        // AWS Global Accelerator doesn't support PING so we use a very high idle
        // timeout. Ref:
        // https://docs.aws.amazon.com/global-accelerator/latest/dg/introduction-how-it-works.html#about-idle-timeout
        idleConnectionTimeoutMs: 340 * 1000
    });
    // We ignore the promise result because this is an optimistic pre-connect
    sessionManager.connect();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$connectrpc$2f$connect$2d$node$2f$dist$2f$esm$2f$connect$2d$transport$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createConnectTransport"])({
        baseUrl,
        httpVersion: "2",
        sessionManager
    });
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/@arcjet/next/index.js [middleware] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createMiddleware",
    ()=>createMiddleware,
    "createRemoteClient",
    ()=>createRemoteClient,
    "default",
    ()=>arcjet,
    "request",
    ()=>request,
    "withArcjet",
    ()=>withArcjet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/server.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$headers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/headers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$arcjet$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/arcjet/index.js [middleware] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$body$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/body/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$ip$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/ip/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$headers$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/headers/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/env/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$logger$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/logger/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$protocol$2f$client$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/protocol/client.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$transport$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@arcjet/transport/index.js [middleware] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
let warnedForAutomaticBodyRead = false;
/**
 * Get minimal request details (cookies, headers).
 *
 * This function can be used in server components, server actions,
 * route handlers, and middleware.
 *
 * @returns
 *   Promise that resolves to the request details.
 */ async function request() {
    const hdrs = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$headers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["headers"])();
    const cook = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$headers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["cookies"])();
    const cookieEntries = cook.getAll().map((cookie)=>[
            cookie.name,
            cookie.value
        ]);
    return {
        headers: hdrs,
        cookies: Object.fromEntries(cookieEntries)
    };
}
/**
 * Create a remote client.
 *
 * @param options
 *   Configuration (optional).
 * @returns
 *   Client.
 */ function createRemoteClient(options) {
    const url = options?.baseUrl ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["baseUrl"])(process.env);
    const timeout = options?.timeout ?? ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isDevelopment"])(process.env) ? 1000 : 500);
    // Transport is the HTTP client that the client uses to make requests.
    const transport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$transport$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createTransport"])(url);
    const sdkStack = "NEXTJS";
    const sdkVersion = "1.1.0";
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$protocol$2f$client$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createClient"])({
        transport,
        baseUrl: url,
        timeout,
        sdkStack,
        sdkVersion
    });
}
function isIterable(val) {
    return typeof val?.[Symbol.iterator] === "function";
}
function cookiesToArray(cookies) {
    if (typeof cookies === "undefined") {
        return [];
    }
    if (isIterable(cookies)) {
        return Array.from(cookies).map(([_, cookie])=>cookie);
    } else {
        return Object.entries(cookies).map(([name, value])=>({
                name,
                value: value ?? ""
            }));
    }
}
function cookiesToString(cookies) {
    // This is essentially the implementation of `RequestCookies#toString` in
    // Next.js but normalized for NextApiRequest cookies object
    return cookiesToArray(cookies).map((v)=>`${v.name}=${encodeURIComponent(v.value)}`).join("; ");
}
/**
 * Create a new Next.js integration of Arcjet.
 *
 * > 👉 **Tip**:
 * > build your initial base client with as many rules as possible outside of a
 * > request handler;
 * > if you need more rules inside handlers later then you can call `withRule()`
 * > on that base client.
 *
 * @template Rules
 *   List of rules.
 * @template Characteristics
 *   Characteristics to track a user by.
 * @param options
 *   Configuration.
 * @returns
 *   Next.js integration of Arcjet.
 */ function arcjet(options) {
    const client = options.client ?? createRemoteClient();
    const log = options.log ? options.log : new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$logger$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["Logger"]({
        level: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["logLevel"])(process.env)
    });
    const proxies = Array.isArray(options.proxies) ? options.proxies.map(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$ip$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["parseProxy"]) : undefined;
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isDevelopment"])(process.env)) {
        log.warn("Arcjet will use 127.0.0.1 when missing public IP address in development mode");
    }
    function toArcjetRequest(request, props) {
        // We construct an ArcjetHeaders to normalize over Headers
        const headers = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$headers$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ArcjetHeaders"](request.headers);
        const xArcjetIp = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isDevelopment"])(process.env) ? headers.get("x-arcjet-ip") : undefined;
        let ip = xArcjetIp || (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$ip$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["findIp"])({
            ip: request.ip,
            socket: request.socket,
            info: request.info,
            requestContext: request.requestContext,
            headers
        }, {
            platform: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["platform"])(process.env),
            proxies
        });
        if (ip === "") {
            // If the `ip` is empty but we're in development mode, we default the IP
            // so the request doesn't fail.
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$env$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isDevelopment"])(process.env)) {
                ip = "127.0.0.1";
            } else {
                log.warn(`Client IP address is missing. If this is a dev environment set the ARCJET_ENV env var to "development"`);
            }
        }
        const method = request.method ?? "";
        const host = headers.get("host") ?? "";
        let path = "";
        let query = "";
        let protocol = "";
        // TODO(#36): nextUrl has formatting logic when you `toString` but
        // we don't account for that here
        if (typeof request.nextUrl !== "undefined") {
            path = request.nextUrl.pathname ?? "";
            if (typeof request.nextUrl.search !== "undefined") {
                query = request.nextUrl.search;
            }
            if (typeof request.nextUrl.protocol !== "undefined") {
                protocol = request.nextUrl.protocol;
            }
        } else {
            if (typeof request.socket?.encrypted !== "undefined") {
                protocol = request.socket.encrypted ? "https:" : "http:";
            } else {
                protocol = "http:";
            }
            // Do some very simple validation, but also try/catch around URL parsing
            if (typeof request.url !== "undefined" && request.url !== "" && host !== "") {
                try {
                    const url = new URL(request.url, `${protocol}//${host}`);
                    path = url.pathname;
                    query = url.search;
                    protocol = url.protocol;
                } catch  {
                    // If the parsing above fails, just set the path as whatever url we
                    // received.
                    path = request.url ?? "";
                    log.warn('Unable to parse URL. Using "%s" as `path`.', path);
                }
            } else {
                path = request.url ?? "";
            }
        }
        const cookies = cookiesToString(request.cookies);
        const extra = {};
        // If we're running on Vercel, we can add some extra information
        if (process.env["VERCEL"]) {
            // Vercel ID https://vercel.com/docs/concepts/edge-network/headers
            extra["vercel-id"] = headers.get("x-vercel-id") ?? "";
            // Vercel deployment URL
            // https://vercel.com/docs/concepts/edge-network/headers
            extra["vercel-deployment-url"] = headers.get("x-vercel-deployment-url") ?? "";
            // Vercel git commit SHA
            // https://vercel.com/docs/environment-variables/system-environment-variables#VERCEL_GIT_COMMIT_SHA
            extra["vercel-git-commit-sha"] = process.env["VERCEL_GIT_COMMIT_SHA"] ?? "";
        }
        return {
            ...props,
            ...extra,
            ip,
            method,
            protocol,
            host,
            path,
            headers,
            cookies,
            query
        };
    }
    function withClient(aj) {
        const client = {
            withRule (rule) {
                const client = aj.withRule(rule);
                return withClient(client);
            },
            async protect (request, props) {
                // Cast of `{}` because here we switch from `undefined` to `Properties`.
                const req = toArcjetRequest(request, props || {});
                const getBody = async ()=>{
                    if (typeof request.clone === "function") {
                        const clonedRequest = request.clone();
                        let expectedLength;
                        // TODO: This shouldn't need to build headers again but the type
                        // for `req` above is overly relaxed
                        const headers = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$headers$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ArcjetHeaders"](request.headers);
                        const expectedLengthString = headers.get("content-length");
                        if (typeof expectedLengthString === "string") {
                            expectedLength = parseInt(expectedLengthString, 10);
                        }
                        // HEAD and GET requests do not have a body.
                        if (!clonedRequest.body) {
                            throw new Error("Cannot read body: body is missing");
                        }
                        if (!warnedForAutomaticBodyRead) {
                            warnedForAutomaticBodyRead = true;
                            log.warn("Automatically reading the request body is deprecated; please pass an explicit `sensitiveInfoValue` field. See <https://docs.arcjet.com/upgrading/sdk-migration>.");
                        }
                        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$arcjet$2f$body$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["readBodyWeb"])(clonedRequest.body, {
                            expectedLength
                        });
                    }
                    // The body is `null` if there was no body with the request.
                    // See: <https://nextjs.org/docs/pages/building-your-application/routing/api-routes#request-helpers>
                    if (request.body === null || request.body === undefined) {
                        throw new Error("Cannot read body: body is missing");
                    }
                    if (typeof request.body === "string") {
                        return request.body;
                    }
                    return JSON.stringify(request.body);
                };
                return aj.protect({
                    getBody
                }, req);
            }
        };
        return Object.freeze(client);
    }
    const aj = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$arcjet$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["default"])({
        ...options,
        client,
        log
    });
    return withClient(aj);
}
/**
 * Protect your Next.js application using Arcjet as middleware.
 *
 * @param arcjet
 *   Next.js integration of Arcjet.
 * @param existingMiddleware
 *   Existing middleware to be called after Arcjet decides that a request is
 *   allowed.
 * @returns
 *   Next.js middleware that will run Arcjet and when it allows the request
 *   call further middleware,
 *   but when it denies the request will immediately return a JSON
 *   `NextResponse` with `403` or `429`.
 */ function createMiddleware(arcjet, existingMiddleware) {
    return async function middleware(request, event) {
        const decision = await arcjet.protect(request);
        if (decision.isDenied()) {
            // TODO(#222): Content type negotiation using `Accept` header
            if (decision.reason.isRateLimit()) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    code: 429,
                    message: "Too Many Requests"
                }, {
                    status: 429
                });
            } else {
                return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    code: 403,
                    message: "Forbidden"
                }, {
                    status: 403
                });
            }
        } else {
            if (typeof existingMiddleware === "function") {
                return existingMiddleware(request, event);
            } else {
                return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
            }
        }
    };
}
function isNextApiResponse(val) {
    if (val === null) {
        return false;
    }
    if (typeof val !== "object") {
        return false;
    }
    if (!("status" in val)) {
        return false;
    }
    if (!("json" in val)) {
        return false;
    }
    if (typeof val.status !== "function" || typeof val.json !== "function") {
        return false;
    }
    return true;
}
/**
 * Wrap a Next.js page route, edge middleware, or an API route running on the
 * Edge Runtime.
 *
 * @param arcjet
 *   Next.js integration of Arcjet.
 * @param handler
 *   Request handler to be called after Arcjet decides that a request is
 *   allowed.
 * @returns
 *   Function that will run Arcjet on a request and when it is allowed call
 *   `handler`,
 *   but when it is denied will immediately return a JSON `NextResponse` or
 *   `NextApiResponse` with `403` or `429`.
 */ function withArcjet(arcjet, handler) {
    return async (...args)=>{
        const request = args[0];
        const response = args[1];
        const decision = await arcjet.protect(request);
        if (decision.isDenied()) {
            if (isNextApiResponse(response)) {
                // TODO(#222): Content type negotiation using `Accept` header
                if (decision.reason.isRateLimit()) {
                    return response.status(429).json({
                        code: 429,
                        message: "Too Many Requests"
                    });
                } else {
                    return response.status(403).json({
                        code: 403,
                        message: "Forbidden"
                    });
                }
            } else {
                // TODO(#222): Content type negotiation using `Accept` header
                if (decision.reason.isRateLimit()) {
                    return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        code: 429,
                        message: "Too Many Requests"
                    }, {
                        status: 429
                    });
                } else {
                    return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].json({
                        code: 403,
                        message: "Forbidden"
                    }, {
                        status: 403
                    });
                }
            }
        } else {
            return handler(...args);
        }
    };
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/routing/config.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "receiveRoutingConfig",
    ()=>receiveRoutingConfig
]);
function receiveRoutingConfig(input) {
    return {
        ...input,
        localePrefix: receiveLocalePrefixConfig(input.localePrefix),
        localeCookie: receiveLocaleCookie(input.localeCookie),
        localeDetection: input.localeDetection ?? true,
        alternateLinks: input.alternateLinks ?? true
    };
}
function receiveLocaleCookie(localeCookie) {
    return localeCookie ?? true ? {
        name: 'NEXT_LOCALE',
        sameSite: 'lax',
        ...typeof localeCookie === 'object' && localeCookie
    } : false;
}
function receiveLocalePrefixConfig(localePrefix) {
    return typeof localePrefix === 'object' ? localePrefix : {
        mode: localePrefix || 'always'
    };
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/shared/constants.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HEADER_LOCALE_NAME",
    ()=>HEADER_LOCALE_NAME
]);
// Used to read the locale from the middleware
const HEADER_LOCALE_NAME = 'X-NEXT-INTL-LOCALE';
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/shared/utils.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getLocaleAsPrefix",
    ()=>getLocaleAsPrefix,
    "getLocalePrefix",
    ()=>getLocalePrefix,
    "getLocalizedTemplate",
    ()=>getLocalizedTemplate,
    "getSortedPathnames",
    ()=>getSortedPathnames,
    "hasPathnamePrefixed",
    ()=>hasPathnamePrefixed,
    "isLocalizableHref",
    ()=>isLocalizableHref,
    "isPromise",
    ()=>isPromise,
    "matchesPathname",
    ()=>matchesPathname,
    "normalizeTrailingSlash",
    ()=>normalizeTrailingSlash,
    "prefixPathname",
    ()=>prefixPathname,
    "templateToRegex",
    ()=>templateToRegex,
    "unprefixPathname",
    ()=>unprefixPathname
]);
function isRelativeHref(href) {
    const pathname = typeof href === 'object' ? href.pathname : href;
    return pathname != null && !pathname.startsWith('/');
}
function isLocalHref(href) {
    if (typeof href === 'object') {
        return href.host == null && href.hostname == null;
    } else {
        const hasProtocol = /^[a-z]+:/i.test(href);
        return !hasProtocol;
    }
}
function isLocalizableHref(href) {
    return isLocalHref(href) && !isRelativeHref(href);
}
function unprefixPathname(pathname, prefix) {
    return pathname.replace(new RegExp(`^${prefix}`), '') || '/';
}
function prefixPathname(prefix, pathname) {
    let localizedHref = prefix;
    // Avoid trailing slashes
    if (/^\/(\?.*)?$/.test(pathname)) {
        pathname = pathname.slice(1);
    }
    localizedHref += pathname;
    return localizedHref;
}
function hasPathnamePrefixed(prefix, pathname) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
function hasTrailingSlash() {
    try {
        // Provided via `env` setting in `next.config.js` via the plugin
        return process.env._next_intl_trailing_slash === 'true';
    } catch  {
        return false;
    }
}
function getLocalizedTemplate(pathnameConfig, locale, internalTemplate) {
    return typeof pathnameConfig === 'string' ? pathnameConfig : pathnameConfig[locale] || internalTemplate;
}
function normalizeTrailingSlash(pathname) {
    const trailingSlash = hasTrailingSlash();
    const [path, ...hashParts] = pathname.split('#');
    const hash = hashParts.join('#');
    let normalizedPath = path;
    if (normalizedPath !== '/') {
        const pathnameEndsWithSlash = normalizedPath.endsWith('/');
        if (trailingSlash && !pathnameEndsWithSlash) {
            normalizedPath += '/';
        } else if (!trailingSlash && pathnameEndsWithSlash) {
            normalizedPath = normalizedPath.slice(0, -1);
        }
    }
    if (hash) {
        normalizedPath += '#' + hash;
    }
    return normalizedPath;
}
function matchesPathname(/** E.g. `/users/[userId]-[userName]` */ template, /** E.g. `/users/23-jane` */ pathname) {
    const normalizedTemplate = normalizeTrailingSlash(template);
    const normalizedPathname = normalizeTrailingSlash(pathname);
    const regex = templateToRegex(normalizedTemplate);
    return regex.test(normalizedPathname);
}
function getLocalePrefix(locale, localePrefix) {
    return localePrefix.mode !== 'never' && localePrefix.prefixes?.[locale] || // We return a prefix even if `mode: 'never'`. It's up to the consumer
    // to decide to use it or not.
    getLocaleAsPrefix(locale);
}
function getLocaleAsPrefix(locale) {
    return '/' + locale;
}
function templateToRegex(template) {
    const regexPattern = template// Replace optional catchall ('[[...slug]]')
    .replace(/\/\[\[(\.\.\.[^\]]+)\]\]/g, '(?:/(.*))?') // With leading slash
    .replace(/\[\[(\.\.\.[^\]]+)\]\]/g, '(?:/(.*))?') // Without leading slash
    // Replace catchall ('[...slug]')
    .replace(/\[(\.\.\.[^\]]+)\]/g, '(.+)')// Replace regular parameter ('[slug]')
    .replace(/\[([^\]]+)\]/g, '([^/]+)');
    return new RegExp(`^${regexPattern}$`);
}
function isOptionalCatchAllSegment(pathname) {
    return pathname.includes('[[...');
}
function isCatchAllSegment(pathname) {
    return pathname.includes('[...');
}
function isDynamicSegment(pathname) {
    return pathname.includes('[');
}
function comparePathnamePairs(a, b) {
    const pathA = a.split('/');
    const pathB = b.split('/');
    const maxLength = Math.max(pathA.length, pathB.length);
    for(let i = 0; i < maxLength; i++){
        const segmentA = pathA[i];
        const segmentB = pathB[i];
        // If one of the paths ends, prioritize the shorter path
        if (!segmentA && segmentB) return -1;
        if (segmentA && !segmentB) return 1;
        if (!segmentA && !segmentB) continue;
        // Prioritize static segments over dynamic segments
        if (!isDynamicSegment(segmentA) && isDynamicSegment(segmentB)) return -1;
        if (isDynamicSegment(segmentA) && !isDynamicSegment(segmentB)) return 1;
        // Prioritize non-catch-all segments over catch-all segments
        if (!isCatchAllSegment(segmentA) && isCatchAllSegment(segmentB)) return -1;
        if (isCatchAllSegment(segmentA) && !isCatchAllSegment(segmentB)) return 1;
        // Prioritize non-optional catch-all segments over optional catch-all segments
        if (!isOptionalCatchAllSegment(segmentA) && isOptionalCatchAllSegment(segmentB)) {
            return -1;
        }
        if (isOptionalCatchAllSegment(segmentA) && !isOptionalCatchAllSegment(segmentB)) {
            return 1;
        }
        if (segmentA === segmentB) continue;
    }
    // Both pathnames are completely static
    return 0;
}
function getSortedPathnames(pathnames) {
    return pathnames.sort(comparePathnamePairs);
}
function isPromise(value) {
    // https://github.com/amannn/next-intl/issues/1711
    return typeof value.then === 'function';
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/utils.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "applyBasePath",
    ()=>applyBasePath,
    "formatPathname",
    ()=>formatPathname,
    "formatPathnameTemplate",
    ()=>formatPathnameTemplate,
    "formatTemplatePathname",
    ()=>formatTemplatePathname,
    "getBestMatchingDomain",
    ()=>getBestMatchingDomain,
    "getHost",
    ()=>getHost,
    "getInternalTemplate",
    ()=>getInternalTemplate,
    "getLocaleAsPrefix",
    ()=>getLocaleAsPrefix,
    "getLocalePrefixes",
    ()=>getLocalePrefixes,
    "getNormalizedPathname",
    ()=>getNormalizedPathname,
    "getPathnameMatch",
    ()=>getPathnameMatch,
    "getRouteParams",
    ()=>getRouteParams,
    "isLocaleSupportedOnDomain",
    ()=>isLocaleSupportedOnDomain,
    "sanitizePathname",
    ()=>sanitizePathname
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/shared/utils.js [middleware] (ecmascript)");
;
function getInternalTemplate(pathnames, pathname, locale) {
    const sortedPathnames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getSortedPathnames"])(Object.keys(pathnames));
    // Try to find a localized pathname that matches
    for (const internalPathname of sortedPathnames){
        const localizedPathnamesOrPathname = pathnames[internalPathname];
        if (typeof localizedPathnamesOrPathname === 'string') {
            const localizedPathname = localizedPathnamesOrPathname;
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["matchesPathname"])(localizedPathname, pathname)) {
                return [
                    undefined,
                    internalPathname
                ];
            }
        } else {
            // Prefer the entry with the current locale in case multiple
            // localized pathnames match the current pathname
            const sortedEntries = Object.entries(localizedPathnamesOrPathname);
            const curLocaleIndex = sortedEntries.findIndex(([entryLocale])=>entryLocale === locale);
            if (curLocaleIndex > 0) {
                sortedEntries.unshift(sortedEntries.splice(curLocaleIndex, 1)[0]);
            }
            for (const [entryLocale] of sortedEntries){
                const localizedTemplate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalizedTemplate"])(pathnames[internalPathname], entryLocale, internalPathname);
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["matchesPathname"])(localizedTemplate, pathname)) {
                    return [
                        entryLocale,
                        internalPathname
                    ];
                }
            }
        }
    }
    // Try to find an internal pathname that matches (this can be the case
    // if all localized pathnames are different from the internal pathnames)
    for (const internalPathname of Object.keys(pathnames)){
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["matchesPathname"])(internalPathname, pathname)) {
            return [
                undefined,
                internalPathname
            ];
        }
    }
    // No match
    return [
        undefined,
        undefined
    ];
}
function formatTemplatePathname(sourcePathname, sourceTemplate, targetTemplate, prefix) {
    const params = getRouteParams(sourceTemplate, sourcePathname);
    let targetPathname = '';
    targetPathname += formatPathnameTemplate(targetTemplate, params);
    // A pathname with an optional catchall like `/categories/[[...slug]]`
    // should be normalized to `/categories` if the catchall is not present
    // and no trailing slash is configured
    targetPathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(targetPathname);
    return targetPathname;
}
/**
 * Removes potential prefixes from the pathname.
 */ function getNormalizedPathname(pathname, locales, localePrefix) {
    // Add trailing slash for consistent handling
    // both for the root as well as nested paths
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }
    const localePrefixes = getLocalePrefixes(locales, localePrefix);
    const regex = new RegExp(`^(${localePrefixes.map(([, prefix])=>prefix.replaceAll('/', '\\/')).join('|')})/(.*)`, 'i');
    const match = pathname.match(regex);
    let result = match ? '/' + match[2] : pathname;
    if (result !== '/') {
        result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(result);
    }
    return result;
}
function getLocalePrefixes(locales, localePrefix, sort = true) {
    const prefixes = locales.map((locale)=>[
            locale,
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalePrefix"])(locale, localePrefix)
        ]);
    if (sort) {
        // More specific ones first
        prefixes.sort((a, b)=>b[1].length - a[1].length);
    }
    return prefixes;
}
function getPathnameMatch(pathname, locales, localePrefix, domain) {
    const localePrefixes = getLocalePrefixes(locales, localePrefix);
    // Sort to prioritize domain locales
    if (domain) {
        localePrefixes.sort(([localeA], [localeB])=>{
            if (localeA === domain.defaultLocale) return -1;
            if (localeB === domain.defaultLocale) return 1;
            const isLocaleAInDomain = domain.locales.includes(localeA);
            const isLocaleBInDomain = domain.locales.includes(localeB);
            if (isLocaleAInDomain && !isLocaleBInDomain) return -1;
            if (!isLocaleAInDomain && isLocaleBInDomain) return 1;
            return 0;
        });
    }
    for (const [locale, prefix] of localePrefixes){
        let exact, matches;
        if (pathname === prefix || pathname.startsWith(prefix + '/')) {
            exact = matches = true;
        } else {
            const normalizedPathname = pathname.toLowerCase();
            const normalizedPrefix = prefix.toLowerCase();
            if (normalizedPathname === normalizedPrefix || normalizedPathname.startsWith(normalizedPrefix + '/')) {
                exact = false;
                matches = true;
            }
        }
        if (matches) {
            return {
                locale,
                prefix,
                matchedPrefix: pathname.slice(0, prefix.length),
                exact
            };
        }
    }
}
function getRouteParams(template, pathname) {
    const normalizedPathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(pathname);
    const normalizedTemplate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(template);
    const regex = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["templateToRegex"])(normalizedTemplate);
    const match = regex.exec(normalizedPathname);
    if (!match) return undefined;
    const params = {};
    const keys = normalizedTemplate.match(/\[([^\]]+)\]/g) ?? [];
    for(let i = 1; i < match.length; i++){
        const rawKey = keys[i - 1];
        if (!rawKey) continue;
        const key = rawKey.replace(/[[\]]/g, '');
        const value = match[i] ?? '';
        params[key] = value;
    }
    return params;
}
function formatPathnameTemplate(template, params) {
    if (!params) return template;
    // Simplify syntax for optional catchall ('[[...slug]]') so
    // we can replace the value with simple interpolation
    template = template.replace(/\[\[/g, '[').replace(/\]\]/g, ']');
    let result = template;
    Object.entries(params).forEach(([key, value])=>{
        result = result.replace(`[${key}]`, value);
    });
    return result;
}
function formatPathname(pathname, prefix, search) {
    let result = pathname;
    if (prefix) {
        result = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["prefixPathname"])(prefix, result);
    }
    if (search) {
        result += search;
    }
    return result;
}
function getHost(requestHeaders) {
    return requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? undefined;
}
function isLocaleSupportedOnDomain(locale, domain) {
    return domain.defaultLocale === locale || domain.locales.includes(locale);
}
function getBestMatchingDomain(curHostDomain, locale, domainsConfig) {
    let domainConfig;
    // Prio 1: Stay on current domain
    if (curHostDomain && isLocaleSupportedOnDomain(locale, curHostDomain)) {
        domainConfig = curHostDomain;
    }
    // Prio 2: Use alternative domain with matching default locale
    if (!domainConfig) {
        domainConfig = domainsConfig.find((cur)=>cur.defaultLocale === locale);
    }
    // Prio 3: Use alternative domain that supports the locale
    if (!domainConfig) {
        domainConfig = domainsConfig.find((cur)=>cur.locales.includes(locale));
    }
    return domainConfig;
}
function applyBasePath(pathname, basePath) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(basePath + pathname);
}
function getLocaleAsPrefix(locale) {
    return `/${locale}`;
}
function sanitizePathname(pathname) {
    // Sanitize malicious URIs, e.g.:
    // '/en/\\example.org → /en/%5C%5Cexample.org'
    // '/en////example.org → /en/example.org'
    return pathname.replace(/\\/g, '%5C').replace(/\/+/g, '/');
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/getAlternateLinksHeaderValue.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>getAlternateLinksHeaderValue
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/shared/utils.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/utils.js [middleware] (ecmascript)");
;
;
/**
 * See https://developers.google.com/search/docs/specialty/international/localized-versions
 */ function getAlternateLinksHeaderValue({ internalTemplateName, localizedPathnames, request, resolvedLocale, routing }) {
    const normalizedUrl = request.nextUrl.clone();
    const host = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getHost"])(request.headers);
    if (host) {
        normalizedUrl.port = '';
        normalizedUrl.host = host;
    }
    normalizedUrl.protocol = request.headers.get('x-forwarded-proto') ?? normalizedUrl.protocol;
    normalizedUrl.pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getNormalizedPathname"])(normalizedUrl.pathname, routing.locales, routing.localePrefix);
    function getAlternateEntry(url, locale) {
        url.pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(url.pathname);
        if (request.nextUrl.basePath) {
            url = new URL(url);
            url.pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["applyBasePath"])(url.pathname, request.nextUrl.basePath);
        }
        return `<${url.toString()}>; rel="alternate"; hreflang="${locale}"`;
    }
    function getLocalizedPathname(pathname, locale) {
        if (localizedPathnames && typeof localizedPathnames === 'object') {
            const sourceTemplate = localizedPathnames[resolvedLocale];
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatTemplatePathname"])(pathname, sourceTemplate ?? internalTemplateName, localizedPathnames[locale] ?? internalTemplateName);
        } else {
            return pathname;
        }
    }
    const links = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalePrefixes"])(routing.locales, routing.localePrefix, false).flatMap(([locale, prefix])=>{
        function prefixPathname(pathname) {
            if (pathname === '/') {
                return prefix;
            } else {
                return prefix + pathname;
            }
        }
        let url;
        if (routing.domains) {
            const domainConfigs = routing.domains.filter((cur)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isLocaleSupportedOnDomain"])(locale, cur));
            return domainConfigs.map((domainConfig)=>{
                url = new URL(normalizedUrl);
                url.port = '';
                url.host = domainConfig.domain;
                // Important: Use `normalizedUrl` here, as `url` potentially uses
                // a `basePath` that automatically gets applied to the pathname
                url.pathname = getLocalizedPathname(normalizedUrl.pathname, locale);
                if (locale !== domainConfig.defaultLocale || routing.localePrefix.mode === 'always') {
                    url.pathname = prefixPathname(url.pathname);
                }
                return getAlternateEntry(url, locale);
            });
        } else {
            let pathname;
            if (localizedPathnames && typeof localizedPathnames === 'object') {
                pathname = getLocalizedPathname(normalizedUrl.pathname, locale);
            } else {
                pathname = normalizedUrl.pathname;
            }
            if (locale !== routing.defaultLocale || routing.localePrefix.mode === 'always') {
                pathname = prefixPathname(pathname);
            }
            url = new URL(pathname, normalizedUrl);
        }
        return getAlternateEntry(url, locale);
    });
    // Add x-default entry
    const shouldAddXDefault = // For domain-based routing there is no reasonable x-default
    !routing.domains || routing.domains.length === 0;
    if (shouldAddXDefault) {
        const localizedPathname = getLocalizedPathname(normalizedUrl.pathname, routing.defaultLocale);
        if (localizedPathname) {
            const url = new URL(localizedPathname, normalizedUrl);
            links.push(getAlternateEntry(url, 'x-default'));
        }
    }
    return links.join(', ');
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/resolveLocale.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>resolveLocale,
    "getAcceptLanguageLocale",
    ()=>getAcceptLanguageLocale
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$node_modules$2f40$formatjs$2f$intl$2d$localematcher$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/node_modules/@formatjs/intl-localematcher/index.js [middleware] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$negotiator$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/negotiator/index.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/utils.js [middleware] (ecmascript)");
;
;
;
function findDomainFromHost(requestHeaders, domains) {
    const host = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getHost"])(requestHeaders);
    if (host) {
        return domains.find((cur)=>cur.domain === host);
    }
    return undefined;
}
function orderLocales(locales) {
    // Workaround for https://github.com/formatjs/formatjs/issues/4469
    return locales.slice().sort((a, b)=>b.length - a.length);
}
function mapToProvidedLocale(locales, locale) {
    return locales.find((cur)=>cur.toLowerCase() === locale.toLowerCase());
}
function getAcceptLanguageLocale(requestHeaders, locales, defaultLocale) {
    let locale;
    const languages = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$negotiator$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"]({
        headers: {
            'accept-language': requestHeaders.get('accept-language') || undefined
        }
    }).languages();
    try {
        const orderedLocales = orderLocales(locales);
        locale = mapToProvidedLocale(locales, (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$node_modules$2f40$formatjs$2f$intl$2d$localematcher$2f$index$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__$3c$locals$3e$__["match"])(languages, orderedLocales, defaultLocale));
    } catch  {
    // Invalid language
    }
    return locale;
}
function getLocaleFromCookie(routing, requestCookies) {
    if (routing.localeCookie && requestCookies.has(routing.localeCookie.name)) {
        const value = requestCookies.get(routing.localeCookie.name)?.value;
        if (value && routing.locales.includes(value)) {
            return value;
        }
    }
}
function resolveLocaleFromPrefix(routing, requestHeaders, requestCookies, pathname) {
    let locale;
    // Prio 1: Use route prefix
    if (pathname) {
        locale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getPathnameMatch"])(pathname, routing.locales, routing.localePrefix)?.locale;
    }
    // Prio 2: Use existing cookie
    if (!locale && routing.localeDetection) {
        locale = getLocaleFromCookie(routing, requestCookies);
    }
    // Prio 3: Use the `accept-language` header
    if (!locale && routing.localeDetection) {
        locale = getAcceptLanguageLocale(requestHeaders, routing.locales, routing.defaultLocale);
    }
    // Prio 4: Use default locale
    if (!locale) {
        locale = routing.defaultLocale;
    }
    return locale;
}
function resolveLocaleFromDomain(routing, requestHeaders, requestCookies, pathname) {
    const domains = routing.domains;
    const domain = findDomainFromHost(requestHeaders, domains);
    if (!domain) {
        return {
            locale: resolveLocaleFromPrefix(routing, requestHeaders, requestCookies, pathname)
        };
    }
    let locale;
    // Prio 1: Use route prefix
    if (pathname) {
        const prefixLocale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getPathnameMatch"])(pathname, routing.locales, routing.localePrefix, domain)?.locale;
        if (prefixLocale) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isLocaleSupportedOnDomain"])(prefixLocale, domain)) {
                locale = prefixLocale;
            } else {
                // Causes a redirect to a domain that supports the locale
                return {
                    locale: prefixLocale,
                    domain
                };
            }
        }
    }
    // Prio 2: Use existing cookie
    if (!locale && routing.localeDetection) {
        const cookieLocale = getLocaleFromCookie(routing, requestCookies);
        if (cookieLocale) {
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isLocaleSupportedOnDomain"])(cookieLocale, domain)) {
                locale = cookieLocale;
            }
        }
    }
    // Prio 3: Use the `accept-language` header
    if (!locale && routing.localeDetection) {
        const headerLocale = getAcceptLanguageLocale(requestHeaders, domain.locales, domain.defaultLocale);
        if (headerLocale) {
            locale = headerLocale;
        }
    }
    // Prio 4: Use default locale
    if (!locale) {
        locale = domain.defaultLocale;
    }
    return {
        locale,
        domain
    };
}
function resolveLocale(routing, requestHeaders, requestCookies, pathname) {
    if (routing.domains) {
        return resolveLocaleFromDomain(routing, requestHeaders, requestCookies, pathname);
    } else {
        return {
            locale: resolveLocaleFromPrefix(routing, requestHeaders, requestCookies, pathname)
        };
    }
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/syncCookie.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>syncCookie
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$resolveLocale$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/resolveLocale.js [middleware] (ecmascript)");
;
function syncCookie(request, response, locale, routing, domain) {
    if (!routing.localeCookie) return;
    const { name, ...rest } = routing.localeCookie;
    const hasLocaleCookie = request.cookies.has(name);
    const hasOutdatedCookie = hasLocaleCookie && request.cookies.get(name)?.value !== locale;
    if (hasOutdatedCookie) {
        response.cookies.set(name, locale, {
            path: request.nextUrl.basePath || undefined,
            ...rest
        });
    } else if (!hasLocaleCookie) {
        const acceptLanguageLocale = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$resolveLocale$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getAcceptLanguageLocale"])(request.headers, domain?.locales || routing.locales, routing.defaultLocale);
        if (acceptLanguageLocale !== locale) {
            response.cookies.set(name, locale, {
                path: request.nextUrl.basePath || undefined,
                ...rest
            });
        }
    }
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/middleware.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>createMiddleware
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next/server.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$config$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/routing/config.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/shared/constants.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/shared/utils.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$getAlternateLinksHeaderValue$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/getAlternateLinksHeaderValue.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$resolveLocale$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/resolveLocale.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$syncCookie$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/syncCookie.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/middleware/utils.js [middleware] (ecmascript)");
;
;
;
;
;
;
;
;
function createMiddleware(routing) {
    const resolvedRouting = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$config$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["receiveRoutingConfig"])(routing);
    return function middleware(request) {
        let unsafeExternalPathname;
        try {
            // Resolve potential foreign symbols (e.g. /ja/%E7%B4%84 → /ja/約))
            unsafeExternalPathname = decodeURI(request.nextUrl.pathname);
        } catch  {
            // In case an invalid pathname is encountered, forward
            // it to Next.js which in turn responds with a 400
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
        }
        // Sanitize malicious URIs to prevent open redirect attacks due to
        // decodeURI doesn't escape encoded backslashes ('%5C' & '%5c')
        const externalPathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["sanitizePathname"])(unsafeExternalPathname);
        const { domain, locale } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$resolveLocale$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"])(resolvedRouting, request.headers, request.cookies, externalPathname);
        const hasMatchedDefaultLocale = domain ? domain.defaultLocale === locale : locale === resolvedRouting.defaultLocale;
        const domainsConfig = resolvedRouting.domains?.filter((curDomain)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isLocaleSupportedOnDomain"])(locale, curDomain)) || [];
        const hasUnknownHost = resolvedRouting.domains != null && !domain;
        function next(url) {
            const urlObj = new URL(url, request.url);
            if (request.nextUrl.basePath) {
                urlObj.pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["applyBasePath"])(urlObj.pathname, request.nextUrl.basePath);
            }
            const headers = new Headers(request.headers);
            headers.set(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$constants$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["HEADER_LOCALE_NAME"], locale);
            const isRewriteNecessary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(request.nextUrl.pathname) !== (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(urlObj.pathname);
            if (isRewriteNecessary) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].rewrite(urlObj, {
                    request: {
                        headers
                    }
                });
            } else {
                return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next({
                    request: {
                        headers
                    }
                });
            }
        }
        function redirect(url, redirectDomain) {
            const urlObj = new URL(url, request.url);
            urlObj.pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["normalizeTrailingSlash"])(urlObj.pathname);
            if (domainsConfig.length > 0 && !redirectDomain && domain) {
                const bestMatchingDomain = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getBestMatchingDomain"])(domain, locale, domainsConfig);
                if (bestMatchingDomain) {
                    redirectDomain = bestMatchingDomain.domain;
                    if (bestMatchingDomain.defaultLocale === locale && resolvedRouting.localePrefix.mode === 'as-needed') {
                        urlObj.pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getNormalizedPathname"])(urlObj.pathname, resolvedRouting.locales, resolvedRouting.localePrefix);
                    }
                }
            }
            if (redirectDomain) {
                urlObj.host = redirectDomain;
                if (request.headers.get('x-forwarded-host')) {
                    urlObj.protocol = request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol;
                    const redirectDomainPort = redirectDomain.split(':')[1];
                    urlObj.port = redirectDomainPort ?? request.headers.get('x-forwarded-port') ?? '';
                }
            }
            if (request.nextUrl.basePath) {
                urlObj.pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["applyBasePath"])(urlObj.pathname, request.nextUrl.basePath);
            }
            hasRedirected = true;
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(urlObj.toString());
        }
        const unprefixedExternalPathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getNormalizedPathname"])(externalPathname, resolvedRouting.locales, resolvedRouting.localePrefix);
        const pathnameMatch = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getPathnameMatch"])(externalPathname, resolvedRouting.locales, resolvedRouting.localePrefix, domain);
        const hasLocalePrefix = pathnameMatch != null;
        const isUnprefixedRouting = resolvedRouting.localePrefix.mode === 'never' || hasMatchedDefaultLocale && resolvedRouting.localePrefix.mode === 'as-needed';
        let response;
        let internalTemplateName;
        let hasRedirected;
        let unprefixedInternalPathname = unprefixedExternalPathname;
        const pathnames = resolvedRouting.pathnames;
        if (pathnames) {
            let resolvedTemplateLocale;
            [resolvedTemplateLocale, internalTemplateName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getInternalTemplate"])(pathnames, unprefixedExternalPathname, locale);
            if (internalTemplateName) {
                const pathnameConfig = pathnames[internalTemplateName];
                const localeTemplate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalizedTemplate"])(pathnameConfig, locale, internalTemplateName);
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["matchesPathname"])(localeTemplate, unprefixedExternalPathname)) {
                    unprefixedInternalPathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatTemplatePathname"])(unprefixedExternalPathname, localeTemplate, internalTemplateName);
                } else {
                    let sourceTemplate;
                    if (resolvedTemplateLocale) {
                        // A localized pathname from another locale has matched
                        sourceTemplate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalizedTemplate"])(pathnameConfig, resolvedTemplateLocale, internalTemplateName);
                    } else {
                        // An internal pathname has matched that
                        // doesn't have a localized pathname
                        sourceTemplate = internalTemplateName;
                    }
                    const localePrefix = isUnprefixedRouting ? undefined : (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalePrefix"])(locale, resolvedRouting.localePrefix);
                    const template = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatTemplatePathname"])(unprefixedExternalPathname, sourceTemplate, localeTemplate);
                    response = redirect((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(template, localePrefix, request.nextUrl.search));
                }
            }
        }
        if (!response) {
            if (unprefixedInternalPathname === '/' && !hasLocalePrefix) {
                if (isUnprefixedRouting) {
                    response = next((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(unprefixedInternalPathname, (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocaleAsPrefix"])(locale), request.nextUrl.search));
                } else {
                    response = redirect((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(unprefixedExternalPathname, (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalePrefix"])(locale, resolvedRouting.localePrefix), request.nextUrl.search));
                }
            } else {
                const internalHref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(unprefixedInternalPathname, (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocaleAsPrefix"])(locale), request.nextUrl.search);
                if (hasLocalePrefix) {
                    const externalHref = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(unprefixedExternalPathname, pathnameMatch.prefix, request.nextUrl.search);
                    if (resolvedRouting.localePrefix.mode === 'never') {
                        response = redirect((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(unprefixedExternalPathname, undefined, request.nextUrl.search));
                    } else if (pathnameMatch.exact) {
                        if (hasMatchedDefaultLocale && isUnprefixedRouting) {
                            response = redirect((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(unprefixedExternalPathname, undefined, request.nextUrl.search));
                        } else {
                            if (resolvedRouting.domains) {
                                const pathDomain = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getBestMatchingDomain"])(domain, pathnameMatch.locale, domainsConfig);
                                if (domain?.domain !== pathDomain?.domain && !hasUnknownHost) {
                                    response = redirect(externalHref, pathDomain?.domain);
                                } else {
                                    response = next(internalHref);
                                }
                            } else {
                                response = next(internalHref);
                            }
                        }
                    } else {
                        response = redirect(externalHref);
                    }
                } else {
                    if (isUnprefixedRouting) {
                        response = next(internalHref);
                    } else {
                        response = redirect((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatPathname"])(unprefixedExternalPathname, (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$shared$2f$utils$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getLocalePrefix"])(locale, resolvedRouting.localePrefix), request.nextUrl.search));
                    }
                }
            }
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$syncCookie$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"])(request, response, locale, resolvedRouting, domain);
        if (!hasRedirected && resolvedRouting.localePrefix.mode !== 'never' && resolvedRouting.alternateLinks && resolvedRouting.locales.length > 1) {
            response.headers.set('Link', (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$middleware$2f$getAlternateLinksHeaderValue$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"])({
                routing: resolvedRouting,
                internalTemplateName,
                localizedPathnames: internalTemplateName != null && pathnames ? pathnames[internalTemplateName] : undefined,
                request,
                resolvedLocale: locale
            }));
        }
        return response;
    };
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/routing/defineRouting.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>defineRouting
]);
function defineRouting(config) {
    if (config.domains) {
        validateUniqueLocalesPerDomain(config.domains);
    }
    return config;
}
function validateUniqueLocalesPerDomain(domains) {
    const domainsByLocale = new Map();
    for (const { domain, locales } of domains){
        for (const locale of locales){
            const localeDomains = domainsByLocale.get(locale) || new Set();
            localeDomains.add(domain);
            domainsByLocale.set(locale, localeDomains);
        }
    }
    const duplicateLocaleMessages = Array.from(domainsByLocale.entries()).filter(([, localeDomains])=>localeDomains.size > 1).map(([locale, localeDomains])=>`- "${locale}" is used by: ${Array.from(localeDomains).join(', ')}`);
    if (duplicateLocaleMessages.length > 0) {
        console.warn('Locales are expected to be unique per domain, but found overlap:\n' + duplicateLocaleMessages.join('\n') + '\nPlease see https://next-intl.dev/docs/routing/configuration#domains');
    }
}
;
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/routing/defineRouting.js [middleware] (ecmascript) <export default as defineRouting>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "defineRouting",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$defineRouting$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f$next$2d$intl$2f$dist$2f$esm$2f$development$2f$routing$2f$defineRouting$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/next-intl/dist/esm/development/routing/defineRouting.js [middleware] (ecmascript)");
}),
"[project]/projects/next-js-boilerplate/node_modules/next-intl/node_modules/@formatjs/fast-memoize/index.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "memoize",
    ()=>memoize,
    "strategies",
    ()=>strategies
]);
function memoize(fn, options) {
    const cache = options && options.cache ? options.cache : cacheDefault;
    const serializer = options && options.serializer ? options.serializer : serializerDefault;
    const strategy = options && options.strategy ? options.strategy : strategyDefault;
    return strategy(fn, {
        cache,
        serializer
    });
}
//
// Strategy
//
function isPrimitive(value) {
    return value == null || typeof value === "number" || typeof value === "boolean";
}
function monadic(fn, cache, serializer, arg) {
    const cacheKey = isPrimitive(arg) ? arg : serializer(arg);
    let computedValue = cache.get(cacheKey);
    if (typeof computedValue === "undefined") {
        computedValue = fn.call(this, arg);
        cache.set(cacheKey, computedValue);
    }
    return computedValue;
}
function variadic(fn, cache, serializer) {
    const args = Array.prototype.slice.call(arguments, 3);
    const cacheKey = serializer(args);
    let computedValue = cache.get(cacheKey);
    if (typeof computedValue === "undefined") {
        computedValue = fn.apply(this, args);
        cache.set(cacheKey, computedValue);
    }
    return computedValue;
}
function assemble(fn, context, strategy, cache, serialize) {
    return strategy.bind(context, fn, cache, serialize);
}
function strategyDefault(fn, options) {
    const strategy = fn.length === 1 ? monadic : variadic;
    return assemble(fn, this, strategy, options.cache.create(), options.serializer);
}
function strategyVariadic(fn, options) {
    return assemble(fn, this, variadic, options.cache.create(), options.serializer);
}
function strategyMonadic(fn, options) {
    return assemble(fn, this, monadic, options.cache.create(), options.serializer);
}
//
// Serializer
//
const serializerDefault = function() {
    return JSON.stringify(arguments);
};
//
// Cache
//
class ObjectWithoutPrototypeCache {
    cache;
    constructor(){
        this.cache = Object.create(null);
    }
    get(key) {
        return this.cache[key];
    }
    set(key, value) {
        this.cache[key] = value;
    }
}
const cacheDefault = {
    create: function create() {
        return new ObjectWithoutPrototypeCache();
    }
};
const strategies = {
    variadic: strategyVariadic,
    monadic: strategyMonadic
};
}),
"[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/charset.js [middleware] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * negotiator
 * Copyright(c) 2012 Isaac Z. Schlueter
 * Copyright(c) 2014 Federico Romero
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */ /**
 * Module exports.
 * @public
 */ module.exports = preferredCharsets;
module.exports.preferredCharsets = preferredCharsets;
/**
 * Module variables.
 * @private
 */ var simpleCharsetRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
/**
 * Parse the Accept-Charset header.
 * @private
 */ function parseAcceptCharset(accept) {
    var accepts = accept.split(',');
    for(var i = 0, j = 0; i < accepts.length; i++){
        var charset = parseCharset(accepts[i].trim(), i);
        if (charset) {
            accepts[j++] = charset;
        }
    }
    // trim accepts
    accepts.length = j;
    return accepts;
}
/**
 * Parse a charset from the Accept-Charset header.
 * @private
 */ function parseCharset(str, i) {
    var match = simpleCharsetRegExp.exec(str);
    if (!match) return null;
    var charset = match[1];
    var q = 1;
    if (match[2]) {
        var params = match[2].split(';');
        for(var j = 0; j < params.length; j++){
            var p = params[j].trim().split('=');
            if (p[0] === 'q') {
                q = parseFloat(p[1]);
                break;
            }
        }
    }
    return {
        charset: charset,
        q: q,
        i: i
    };
}
/**
 * Get the priority of a charset.
 * @private
 */ function getCharsetPriority(charset, accepted, index) {
    var priority = {
        o: -1,
        q: 0,
        s: 0
    };
    for(var i = 0; i < accepted.length; i++){
        var spec = specify(charset, accepted[i], index);
        if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
            priority = spec;
        }
    }
    return priority;
}
/**
 * Get the specificity of the charset.
 * @private
 */ function specify(charset, spec, index) {
    var s = 0;
    if (spec.charset.toLowerCase() === charset.toLowerCase()) {
        s |= 1;
    } else if (spec.charset !== '*') {
        return null;
    }
    return {
        i: index,
        o: spec.i,
        q: spec.q,
        s: s
    };
}
/**
 * Get the preferred charsets from an Accept-Charset header.
 * @public
 */ function preferredCharsets(accept, provided) {
    // RFC 2616 sec 14.2: no header = *
    var accepts = parseAcceptCharset(accept === undefined ? '*' : accept || '');
    if (!provided) {
        // sorted list of all charsets
        return accepts.filter(isQuality).sort(compareSpecs).map(getFullCharset);
    }
    var priorities = provided.map(function getPriority(type, index) {
        return getCharsetPriority(type, accepts, index);
    });
    // sorted list of accepted charsets
    return priorities.filter(isQuality).sort(compareSpecs).map(function getCharset(priority) {
        return provided[priorities.indexOf(priority)];
    });
}
/**
 * Compare two specs.
 * @private
 */ function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0;
}
/**
 * Get full charset string.
 * @private
 */ function getFullCharset(spec) {
    return spec.charset;
}
/**
 * Check if a spec has any quality.
 * @private
 */ function isQuality(spec) {
    return spec.q > 0;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/encoding.js [middleware] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * negotiator
 * Copyright(c) 2012 Isaac Z. Schlueter
 * Copyright(c) 2014 Federico Romero
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */ /**
 * Module exports.
 * @public
 */ module.exports = preferredEncodings;
module.exports.preferredEncodings = preferredEncodings;
/**
 * Module variables.
 * @private
 */ var simpleEncodingRegExp = /^\s*([^\s;]+)\s*(?:;(.*))?$/;
/**
 * Parse the Accept-Encoding header.
 * @private
 */ function parseAcceptEncoding(accept) {
    var accepts = accept.split(',');
    var hasIdentity = false;
    var minQuality = 1;
    for(var i = 0, j = 0; i < accepts.length; i++){
        var encoding = parseEncoding(accepts[i].trim(), i);
        if (encoding) {
            accepts[j++] = encoding;
            hasIdentity = hasIdentity || specify('identity', encoding);
            minQuality = Math.min(minQuality, encoding.q || 1);
        }
    }
    if (!hasIdentity) {
        /*
     * If identity doesn't explicitly appear in the accept-encoding header,
     * it's added to the list of acceptable encoding with the lowest q
     */ accepts[j++] = {
            encoding: 'identity',
            q: minQuality,
            i: i
        };
    }
    // trim accepts
    accepts.length = j;
    return accepts;
}
/**
 * Parse an encoding from the Accept-Encoding header.
 * @private
 */ function parseEncoding(str, i) {
    var match = simpleEncodingRegExp.exec(str);
    if (!match) return null;
    var encoding = match[1];
    var q = 1;
    if (match[2]) {
        var params = match[2].split(';');
        for(var j = 0; j < params.length; j++){
            var p = params[j].trim().split('=');
            if (p[0] === 'q') {
                q = parseFloat(p[1]);
                break;
            }
        }
    }
    return {
        encoding: encoding,
        q: q,
        i: i
    };
}
/**
 * Get the priority of an encoding.
 * @private
 */ function getEncodingPriority(encoding, accepted, index) {
    var priority = {
        encoding: encoding,
        o: -1,
        q: 0,
        s: 0
    };
    for(var i = 0; i < accepted.length; i++){
        var spec = specify(encoding, accepted[i], index);
        if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
            priority = spec;
        }
    }
    return priority;
}
/**
 * Get the specificity of the encoding.
 * @private
 */ function specify(encoding, spec, index) {
    var s = 0;
    if (spec.encoding.toLowerCase() === encoding.toLowerCase()) {
        s |= 1;
    } else if (spec.encoding !== '*') {
        return null;
    }
    return {
        encoding: encoding,
        i: index,
        o: spec.i,
        q: spec.q,
        s: s
    };
}
;
/**
 * Get the preferred encodings from an Accept-Encoding header.
 * @public
 */ function preferredEncodings(accept, provided, preferred) {
    var accepts = parseAcceptEncoding(accept || '');
    var comparator = preferred ? function comparator(a, b) {
        if (a.q !== b.q) {
            return b.q - a.q // higher quality first
            ;
        }
        var aPreferred = preferred.indexOf(a.encoding);
        var bPreferred = preferred.indexOf(b.encoding);
        if (aPreferred === -1 && bPreferred === -1) {
            // consider the original specifity/order
            return b.s - a.s || a.o - b.o || a.i - b.i;
        }
        if (aPreferred !== -1 && bPreferred !== -1) {
            return aPreferred - bPreferred // consider the preferred order
            ;
        }
        return aPreferred === -1 ? 1 : -1 // preferred first
        ;
    } : compareSpecs;
    if (!provided) {
        // sorted list of all encodings
        return accepts.filter(isQuality).sort(comparator).map(getFullEncoding);
    }
    var priorities = provided.map(function getPriority(type, index) {
        return getEncodingPriority(type, accepts, index);
    });
    // sorted list of accepted encodings
    return priorities.filter(isQuality).sort(comparator).map(function getEncoding(priority) {
        return provided[priorities.indexOf(priority)];
    });
}
/**
 * Compare two specs.
 * @private
 */ function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i;
}
/**
 * Get full encoding string.
 * @private
 */ function getFullEncoding(spec) {
    return spec.encoding;
}
/**
 * Check if a spec has any quality.
 * @private
 */ function isQuality(spec) {
    return spec.q > 0;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/language.js [middleware] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * negotiator
 * Copyright(c) 2012 Isaac Z. Schlueter
 * Copyright(c) 2014 Federico Romero
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */ /**
 * Module exports.
 * @public
 */ module.exports = preferredLanguages;
module.exports.preferredLanguages = preferredLanguages;
/**
 * Module variables.
 * @private
 */ var simpleLanguageRegExp = /^\s*([^\s\-;]+)(?:-([^\s;]+))?\s*(?:;(.*))?$/;
/**
 * Parse the Accept-Language header.
 * @private
 */ function parseAcceptLanguage(accept) {
    var accepts = accept.split(',');
    for(var i = 0, j = 0; i < accepts.length; i++){
        var language = parseLanguage(accepts[i].trim(), i);
        if (language) {
            accepts[j++] = language;
        }
    }
    // trim accepts
    accepts.length = j;
    return accepts;
}
/**
 * Parse a language from the Accept-Language header.
 * @private
 */ function parseLanguage(str, i) {
    var match = simpleLanguageRegExp.exec(str);
    if (!match) return null;
    var prefix = match[1];
    var suffix = match[2];
    var full = prefix;
    if (suffix) full += "-" + suffix;
    var q = 1;
    if (match[3]) {
        var params = match[3].split(';');
        for(var j = 0; j < params.length; j++){
            var p = params[j].split('=');
            if (p[0] === 'q') q = parseFloat(p[1]);
        }
    }
    return {
        prefix: prefix,
        suffix: suffix,
        q: q,
        i: i,
        full: full
    };
}
/**
 * Get the priority of a language.
 * @private
 */ function getLanguagePriority(language, accepted, index) {
    var priority = {
        o: -1,
        q: 0,
        s: 0
    };
    for(var i = 0; i < accepted.length; i++){
        var spec = specify(language, accepted[i], index);
        if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
            priority = spec;
        }
    }
    return priority;
}
/**
 * Get the specificity of the language.
 * @private
 */ function specify(language, spec, index) {
    var p = parseLanguage(language);
    if (!p) return null;
    var s = 0;
    if (spec.full.toLowerCase() === p.full.toLowerCase()) {
        s |= 4;
    } else if (spec.prefix.toLowerCase() === p.full.toLowerCase()) {
        s |= 2;
    } else if (spec.full.toLowerCase() === p.prefix.toLowerCase()) {
        s |= 1;
    } else if (spec.full !== '*') {
        return null;
    }
    return {
        i: index,
        o: spec.i,
        q: spec.q,
        s: s
    };
}
;
/**
 * Get the preferred languages from an Accept-Language header.
 * @public
 */ function preferredLanguages(accept, provided) {
    // RFC 2616 sec 14.4: no header = *
    var accepts = parseAcceptLanguage(accept === undefined ? '*' : accept || '');
    if (!provided) {
        // sorted list of all languages
        return accepts.filter(isQuality).sort(compareSpecs).map(getFullLanguage);
    }
    var priorities = provided.map(function getPriority(type, index) {
        return getLanguagePriority(type, accepts, index);
    });
    // sorted list of accepted languages
    return priorities.filter(isQuality).sort(compareSpecs).map(function getLanguage(priority) {
        return provided[priorities.indexOf(priority)];
    });
}
/**
 * Compare two specs.
 * @private
 */ function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0;
}
/**
 * Get full language string.
 * @private
 */ function getFullLanguage(spec) {
    return spec.full;
}
/**
 * Check if a spec has any quality.
 * @private
 */ function isQuality(spec) {
    return spec.q > 0;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/mediaType.js [middleware] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/**
 * negotiator
 * Copyright(c) 2012 Isaac Z. Schlueter
 * Copyright(c) 2014 Federico Romero
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */ /**
 * Module exports.
 * @public
 */ module.exports = preferredMediaTypes;
module.exports.preferredMediaTypes = preferredMediaTypes;
/**
 * Module variables.
 * @private
 */ var simpleMediaTypeRegExp = /^\s*([^\s\/;]+)\/([^;\s]+)\s*(?:;(.*))?$/;
/**
 * Parse the Accept header.
 * @private
 */ function parseAccept(accept) {
    var accepts = splitMediaTypes(accept);
    for(var i = 0, j = 0; i < accepts.length; i++){
        var mediaType = parseMediaType(accepts[i].trim(), i);
        if (mediaType) {
            accepts[j++] = mediaType;
        }
    }
    // trim accepts
    accepts.length = j;
    return accepts;
}
/**
 * Parse a media type from the Accept header.
 * @private
 */ function parseMediaType(str, i) {
    var match = simpleMediaTypeRegExp.exec(str);
    if (!match) return null;
    var params = Object.create(null);
    var q = 1;
    var subtype = match[2];
    var type = match[1];
    if (match[3]) {
        var kvps = splitParameters(match[3]).map(splitKeyValuePair);
        for(var j = 0; j < kvps.length; j++){
            var pair = kvps[j];
            var key = pair[0].toLowerCase();
            var val = pair[1];
            // get the value, unwrapping quotes
            var value = val && val[0] === '"' && val[val.length - 1] === '"' ? val.slice(1, -1) : val;
            if (key === 'q') {
                q = parseFloat(value);
                break;
            }
            // store parameter
            params[key] = value;
        }
    }
    return {
        type: type,
        subtype: subtype,
        params: params,
        q: q,
        i: i
    };
}
/**
 * Get the priority of a media type.
 * @private
 */ function getMediaTypePriority(type, accepted, index) {
    var priority = {
        o: -1,
        q: 0,
        s: 0
    };
    for(var i = 0; i < accepted.length; i++){
        var spec = specify(type, accepted[i], index);
        if (spec && (priority.s - spec.s || priority.q - spec.q || priority.o - spec.o) < 0) {
            priority = spec;
        }
    }
    return priority;
}
/**
 * Get the specificity of the media type.
 * @private
 */ function specify(type, spec, index) {
    var p = parseMediaType(type);
    var s = 0;
    if (!p) {
        return null;
    }
    if (spec.type.toLowerCase() == p.type.toLowerCase()) {
        s |= 4;
    } else if (spec.type != '*') {
        return null;
    }
    if (spec.subtype.toLowerCase() == p.subtype.toLowerCase()) {
        s |= 2;
    } else if (spec.subtype != '*') {
        return null;
    }
    var keys = Object.keys(spec.params);
    if (keys.length > 0) {
        if (keys.every(function(k) {
            return spec.params[k] == '*' || (spec.params[k] || '').toLowerCase() == (p.params[k] || '').toLowerCase();
        })) {
            s |= 1;
        } else {
            return null;
        }
    }
    return {
        i: index,
        o: spec.i,
        q: spec.q,
        s: s
    };
}
/**
 * Get the preferred media types from an Accept header.
 * @public
 */ function preferredMediaTypes(accept, provided) {
    // RFC 2616 sec 14.2: no header = */*
    var accepts = parseAccept(accept === undefined ? '*/*' : accept || '');
    if (!provided) {
        // sorted list of all types
        return accepts.filter(isQuality).sort(compareSpecs).map(getFullType);
    }
    var priorities = provided.map(function getPriority(type, index) {
        return getMediaTypePriority(type, accepts, index);
    });
    // sorted list of accepted types
    return priorities.filter(isQuality).sort(compareSpecs).map(function getType(priority) {
        return provided[priorities.indexOf(priority)];
    });
}
/**
 * Compare two specs.
 * @private
 */ function compareSpecs(a, b) {
    return b.q - a.q || b.s - a.s || a.o - b.o || a.i - b.i || 0;
}
/**
 * Get full type string.
 * @private
 */ function getFullType(spec) {
    return spec.type + '/' + spec.subtype;
}
/**
 * Check if a spec has any quality.
 * @private
 */ function isQuality(spec) {
    return spec.q > 0;
}
/**
 * Count the number of quotes in a string.
 * @private
 */ function quoteCount(string) {
    var count = 0;
    var index = 0;
    while((index = string.indexOf('"', index)) !== -1){
        count++;
        index++;
    }
    return count;
}
/**
 * Split a key value pair.
 * @private
 */ function splitKeyValuePair(str) {
    var index = str.indexOf('=');
    var key;
    var val;
    if (index === -1) {
        key = str;
    } else {
        key = str.slice(0, index);
        val = str.slice(index + 1);
    }
    return [
        key,
        val
    ];
}
/**
 * Split an Accept header into media types.
 * @private
 */ function splitMediaTypes(accept) {
    var accepts = accept.split(',');
    for(var i = 1, j = 0; i < accepts.length; i++){
        if (quoteCount(accepts[j]) % 2 == 0) {
            accepts[++j] = accepts[i];
        } else {
            accepts[j] += ',' + accepts[i];
        }
    }
    // trim accepts
    accepts.length = j + 1;
    return accepts;
}
/**
 * Split a string of parameters.
 * @private
 */ function splitParameters(str) {
    var parameters = str.split(';');
    for(var i = 1, j = 0; i < parameters.length; i++){
        if (quoteCount(parameters[j]) % 2 == 0) {
            parameters[++j] = parameters[i];
        } else {
            parameters[j] += ';' + parameters[i];
        }
    }
    // trim parameters
    parameters.length = j + 1;
    for(var i = 0; i < parameters.length; i++){
        parameters[i] = parameters[i].trim();
    }
    return parameters;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/negotiator/index.js [middleware] (ecmascript)", ((__turbopack_context__, module, exports) => {
"use strict";

/*!
 * negotiator
 * Copyright(c) 2012 Federico Romero
 * Copyright(c) 2012-2014 Isaac Z. Schlueter
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */ var preferredCharsets = __turbopack_context__.r("[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/charset.js [middleware] (ecmascript)");
var preferredEncodings = __turbopack_context__.r("[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/encoding.js [middleware] (ecmascript)");
var preferredLanguages = __turbopack_context__.r("[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/language.js [middleware] (ecmascript)");
var preferredMediaTypes = __turbopack_context__.r("[project]/projects/next-js-boilerplate/node_modules/negotiator/lib/mediaType.js [middleware] (ecmascript)");
/**
 * Module exports.
 * @public
 */ module.exports = Negotiator;
module.exports.Negotiator = Negotiator;
/**
 * Create a Negotiator instance from a request.
 * @param {object} request
 * @public
 */ function Negotiator(request) {
    if (!(this instanceof Negotiator)) {
        return new Negotiator(request);
    }
    this.request = request;
}
Negotiator.prototype.charset = function charset(available) {
    var set = this.charsets(available);
    return set && set[0];
};
Negotiator.prototype.charsets = function charsets(available) {
    return preferredCharsets(this.request.headers['accept-charset'], available);
};
Negotiator.prototype.encoding = function encoding(available, opts) {
    var set = this.encodings(available, opts);
    return set && set[0];
};
Negotiator.prototype.encodings = function encodings(available, options) {
    var opts = options || {};
    return preferredEncodings(this.request.headers['accept-encoding'], available, opts.preferred);
};
Negotiator.prototype.language = function language(available) {
    var set = this.languages(available);
    return set && set[0];
};
Negotiator.prototype.languages = function languages(available) {
    return preferredLanguages(this.request.headers['accept-language'], available);
};
Negotiator.prototype.mediaType = function mediaType(available) {
    var set = this.mediaTypes(available);
    return set && set[0];
};
Negotiator.prototype.mediaTypes = function mediaTypes(available) {
    return preferredMediaTypes(this.request.headers.accept, available);
};
// Backwards compatibility
Negotiator.prototype.preferredCharset = Negotiator.prototype.charset;
Negotiator.prototype.preferredCharsets = Negotiator.prototype.charsets;
Negotiator.prototype.preferredEncoding = Negotiator.prototype.encoding;
Negotiator.prototype.preferredEncodings = Negotiator.prototype.encodings;
Negotiator.prototype.preferredLanguage = Negotiator.prototype.language;
Negotiator.prototype.preferredLanguages = Negotiator.prototype.languages;
Negotiator.prototype.preferredMediaType = Negotiator.prototype.mediaType;
Negotiator.prototype.preferredMediaTypes = Negotiator.prototype.mediaTypes;
}),
];

//# debugId=6866e58c-ad46-e425-b884-65ece2fbdf08
//# sourceMappingURL=b5a40_86aa3fb4._.js.map