;!function(){try { var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof global?global:"undefined"!=typeof window?window:"undefined"!=typeof self?self:{},n=(new e.Error).stack;n&&((e._debugIds|| (e._debugIds={}))[n]="4ab29864-68fc-b0d7-1c40-d97684c979bc")}catch(e){}}();
module.exports = [
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/is-message.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Determine whether the given `arg` is a message.
 * If `desc` is set, determine whether `arg` is this specific message.
 */ __turbopack_context__.s([
    "isMessage",
    ()=>isMessage
]);
function isMessage(arg, schema) {
    const isMessage = arg !== null && typeof arg == "object" && "$typeName" in arg && typeof arg.$typeName == "string";
    if (!isMessage) {
        return false;
    }
    if (schema === undefined) {
        return true;
    }
    return schema.typeName === arg.$typeName;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv1/enum.js [middleware] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
__turbopack_context__.s([
    "enumDesc",
    ()=>enumDesc
]);
;
function enumDesc(file, path, ...paths) {
    if (paths.length == 0) {
        return file.enums[path];
    }
    const e = paths.pop(); // we checked length above
    return paths.reduce((acc, cur)=>acc.nestedMessages[cur], file.messages[path]).nestedEnums[e];
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Decodes a base64 string to a byte array.
 *
 * - ignores white-space, including line breaks and tabs
 * - allows inner padding (can decode concatenated base64 strings)
 * - does not require padding
 * - understands base64url encoding:
 *   "-" instead of "+",
 *   "_" instead of "/",
 *   no padding
 */ __turbopack_context__.s([
    "base64Decode",
    ()=>base64Decode,
    "base64Encode",
    ()=>base64Encode
]);
function base64Decode(base64Str) {
    const table = getDecodeTable();
    // estimate byte size, not accounting for inner padding and whitespace
    let es = base64Str.length * 3 / 4;
    if (base64Str[base64Str.length - 2] == "=") es -= 2;
    else if (base64Str[base64Str.length - 1] == "=") es -= 1;
    let bytes = new Uint8Array(es), bytePos = 0, groupPos = 0, b, p = 0; // previous byte
    for(let i = 0; i < base64Str.length; i++){
        b = table[base64Str.charCodeAt(i)];
        if (b === undefined) {
            switch(base64Str[i]){
                // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
                case "=":
                    groupPos = 0; // reset state when padding found
                case "\n":
                case "\r":
                case "\t":
                case " ":
                    continue; // skip white-space, and padding
                default:
                    throw Error("invalid base64 string");
            }
        }
        switch(groupPos){
            case 0:
                p = b;
                groupPos = 1;
                break;
            case 1:
                bytes[bytePos++] = p << 2 | (b & 48) >> 4;
                p = b;
                groupPos = 2;
                break;
            case 2:
                bytes[bytePos++] = (p & 15) << 4 | (b & 60) >> 2;
                p = b;
                groupPos = 3;
                break;
            case 3:
                bytes[bytePos++] = (p & 3) << 6 | b;
                groupPos = 0;
                break;
        }
    }
    if (groupPos == 1) throw Error("invalid base64 string");
    return bytes.subarray(0, bytePos);
}
function base64Encode(bytes, encoding = "std") {
    const table = getEncodeTable(encoding);
    const pad = encoding == "std";
    let base64 = "", groupPos = 0, b, p = 0; // carry over from previous byte
    for(let i = 0; i < bytes.length; i++){
        b = bytes[i];
        switch(groupPos){
            case 0:
                base64 += table[b >> 2];
                p = (b & 3) << 4;
                groupPos = 1;
                break;
            case 1:
                base64 += table[p | b >> 4];
                p = (b & 15) << 2;
                groupPos = 2;
                break;
            case 2:
                base64 += table[p | b >> 6];
                base64 += table[b & 63];
                groupPos = 0;
                break;
        }
    }
    // add output padding
    if (groupPos) {
        base64 += table[p];
        if (pad) {
            base64 += "=";
            if (groupPos == 1) base64 += "=";
        }
    }
    return base64;
}
// lookup table from base64 character to byte
let encodeTableStd;
let encodeTableUrl;
// lookup table from base64 character *code* to byte because lookup by number is fast
let decodeTable;
function getEncodeTable(encoding) {
    if (!encodeTableStd) {
        encodeTableStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
        encodeTableUrl = encodeTableStd.slice(0, -2).concat("-", "_");
    }
    return encoding == "url" ? encodeTableUrl : encodeTableStd;
}
function getDecodeTable() {
    if (!decodeTable) {
        decodeTable = [];
        const encodeTable = getEncodeTable("std");
        for(let i = 0; i < encodeTable.length; i++)decodeTable[encodeTable[i].charCodeAt(0)] = i;
        // support base64url variants
        decodeTable["-".charCodeAt(0)] = encodeTable.indexOf("+");
        decodeTable["_".charCodeAt(0)] = encodeTable.indexOf("/");
    }
    return decodeTable;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Return a fully-qualified name for a Protobuf descriptor.
 * For a file descriptor, return the original file path.
 *
 * See https://protobuf.com/docs/language-spec#fully-qualified-names
 */ __turbopack_context__.s([
    "protoCamelCase",
    ()=>protoCamelCase,
    "protoSnakeCase",
    ()=>protoSnakeCase,
    "qualifiedName",
    ()=>qualifiedName,
    "safeObjectProperty",
    ()=>safeObjectProperty
]);
function qualifiedName(desc) {
    switch(desc.kind){
        case "field":
        case "oneof":
        case "rpc":
            return desc.parent.typeName + "." + desc.name;
        case "enum_value":
            {
                const p = desc.parent.parent ? desc.parent.parent.typeName : desc.parent.file.proto.package;
                return p + (p.length > 0 ? "." : "") + desc.name;
            }
        case "service":
        case "message":
        case "enum":
        case "extension":
            return desc.typeName;
        case "file":
            return desc.proto.name;
    }
}
function protoCamelCase(snakeCase) {
    let capNext = false;
    const b = [];
    for(let i = 0; i < snakeCase.length; i++){
        let c = snakeCase.charAt(i);
        switch(c){
            case "_":
                capNext = true;
                break;
            case "0":
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
                b.push(c);
                capNext = false;
                break;
            default:
                if (capNext) {
                    capNext = false;
                    c = c.toUpperCase();
                }
                b.push(c);
                break;
        }
    }
    return b.join("");
}
function protoSnakeCase(lowerCamelCase) {
    return lowerCamelCase.replace(/[A-Z]/g, (letter)=>"_" + letter.toLowerCase());
}
/**
 * Names that cannot be used for object properties because they are reserved
 * by built-in JavaScript properties.
 */ const reservedObjectProperties = new Set([
    // names reserved by JavaScript
    "constructor",
    "toString",
    "toJSON",
    "valueOf"
]);
function safeObjectProperty(name) {
    return reservedObjectProperties.has(name) ? name + "$" : name;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2008 Google Inc.  All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
// * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
// * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
// * Neither the name of Google Inc. nor the names of its
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
//
// Code generated by the Protocol Buffer compiler is owned by the owner
// of the input file used when generating it.  This code is not
// standalone and requires a support library to be linked with it.  This
// support library is itself covered by the above license.
/**
 * Read a 64 bit varint as two JS numbers.
 *
 * Returns tuple:
 * [0]: low bits
 * [1]: high bits
 *
 * Copyright 2008 Google Inc.  All rights reserved.
 *
 * See https://github.com/protocolbuffers/protobuf/blob/8a71927d74a4ce34efe2d8769fda198f52d20d12/js/experimental/runtime/kernel/buffer_decoder.js#L175
 */ __turbopack_context__.s([
    "int64FromString",
    ()=>int64FromString,
    "int64ToString",
    ()=>int64ToString,
    "uInt64ToString",
    ()=>uInt64ToString,
    "varint32read",
    ()=>varint32read,
    "varint32write",
    ()=>varint32write,
    "varint64read",
    ()=>varint64read,
    "varint64write",
    ()=>varint64write
]);
function varint64read() {
    let lowBits = 0;
    let highBits = 0;
    for(let shift = 0; shift < 28; shift += 7){
        let b = this.buf[this.pos++];
        lowBits |= (b & 0x7f) << shift;
        if ((b & 0x80) == 0) {
            this.assertBounds();
            return [
                lowBits,
                highBits
            ];
        }
    }
    let middleByte = this.buf[this.pos++];
    // last four bits of the first 32 bit number
    lowBits |= (middleByte & 0x0f) << 28;
    // 3 upper bits are part of the next 32 bit number
    highBits = (middleByte & 0x70) >> 4;
    if ((middleByte & 0x80) == 0) {
        this.assertBounds();
        return [
            lowBits,
            highBits
        ];
    }
    for(let shift = 3; shift <= 31; shift += 7){
        let b = this.buf[this.pos++];
        highBits |= (b & 0x7f) << shift;
        if ((b & 0x80) == 0) {
            this.assertBounds();
            return [
                lowBits,
                highBits
            ];
        }
    }
    throw new Error("invalid varint");
}
function varint64write(lo, hi, bytes) {
    for(let i = 0; i < 28; i = i + 7){
        const shift = lo >>> i;
        const hasNext = !(shift >>> 7 == 0 && hi == 0);
        const byte = (hasNext ? shift | 0x80 : shift) & 0xff;
        bytes.push(byte);
        if (!hasNext) {
            return;
        }
    }
    const splitBits = lo >>> 28 & 0x0f | (hi & 0x07) << 4;
    const hasMoreBits = !(hi >> 3 == 0);
    bytes.push((hasMoreBits ? splitBits | 0x80 : splitBits) & 0xff);
    if (!hasMoreBits) {
        return;
    }
    for(let i = 3; i < 31; i = i + 7){
        const shift = hi >>> i;
        const hasNext = !(shift >>> 7 == 0);
        const byte = (hasNext ? shift | 0x80 : shift) & 0xff;
        bytes.push(byte);
        if (!hasNext) {
            return;
        }
    }
    bytes.push(hi >>> 31 & 0x01);
}
// constants for binary math
const TWO_PWR_32_DBL = 0x100000000;
function int64FromString(dec) {
    // Check for minus sign.
    const minus = dec[0] === "-";
    if (minus) {
        dec = dec.slice(1);
    }
    // Work 6 decimal digits at a time, acting like we're converting base 1e6
    // digits to binary. This is safe to do with floating point math because
    // Number.isSafeInteger(ALL_32_BITS * 1e6) == true.
    const base = 1e6;
    let lowBits = 0;
    let highBits = 0;
    function add1e6digit(begin, end) {
        // Note: Number('') is 0.
        const digit1e6 = Number(dec.slice(begin, end));
        highBits *= base;
        lowBits = lowBits * base + digit1e6;
        // Carry bits from lowBits to
        if (lowBits >= TWO_PWR_32_DBL) {
            highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
            lowBits = lowBits % TWO_PWR_32_DBL;
        }
    }
    add1e6digit(-24, -18);
    add1e6digit(-18, -12);
    add1e6digit(-12, -6);
    add1e6digit(-6);
    return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
function int64ToString(lo, hi) {
    let bits = newBits(lo, hi);
    // If we're treating the input as a signed value and the high bit is set, do
    // a manual two's complement conversion before the decimal conversion.
    const negative = bits.hi & 0x80000000;
    if (negative) {
        bits = negate(bits.lo, bits.hi);
    }
    const result = uInt64ToString(bits.lo, bits.hi);
    return negative ? "-" + result : result;
}
function uInt64ToString(lo, hi) {
    ({ lo, hi } = toUnsigned(lo, hi));
    // Skip the expensive conversion if the number is small enough to use the
    // built-in conversions.
    // Number.MAX_SAFE_INTEGER = 0x001FFFFF FFFFFFFF, thus any number with
    // highBits <= 0x1FFFFF can be safely expressed with a double and retain
    // integer precision.
    // Proven by: Number.isSafeInteger(0x1FFFFF * 2**32 + 0xFFFFFFFF) == true.
    if (hi <= 0x1fffff) {
        return String(TWO_PWR_32_DBL * hi + lo);
    }
    // What this code is doing is essentially converting the input number from
    // base-2 to base-1e7, which allows us to represent the 64-bit range with
    // only 3 (very large) digits. Those digits are then trivial to convert to
    // a base-10 string.
    // The magic numbers used here are -
    // 2^24 = 16777216 = (1,6777216) in base-1e7.
    // 2^48 = 281474976710656 = (2,8147497,6710656) in base-1e7.
    // Split 32:32 representation into 16:24:24 representation so our
    // intermediate digits don't overflow.
    const low = lo & 0xffffff;
    const mid = (lo >>> 24 | hi << 8) & 0xffffff;
    const high = hi >> 16 & 0xffff;
    // Assemble our three base-1e7 digits, ignoring carries. The maximum
    // value in a digit at this step is representable as a 48-bit integer, which
    // can be stored in a 64-bit floating point number.
    let digitA = low + mid * 6777216 + high * 6710656;
    let digitB = mid + high * 8147497;
    let digitC = high * 2;
    // Apply carries from A to B and from B to C.
    const base = 10000000;
    if (digitA >= base) {
        digitB += Math.floor(digitA / base);
        digitA %= base;
    }
    if (digitB >= base) {
        digitC += Math.floor(digitB / base);
        digitB %= base;
    }
    // If digitC is 0, then we should have returned in the trivial code path
    // at the top for non-safe integers. Given this, we can assume both digitB
    // and digitA need leading zeros.
    return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
function toUnsigned(lo, hi) {
    return {
        lo: lo >>> 0,
        hi: hi >>> 0
    };
}
function newBits(lo, hi) {
    return {
        lo: lo | 0,
        hi: hi | 0
    };
}
/**
 * Returns two's compliment negation of input.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_Operators#Signed_32-bit_integers
 */ function negate(lowBits, highBits) {
    highBits = ~highBits;
    if (lowBits) {
        lowBits = ~lowBits + 1;
    } else {
        // If lowBits is 0, then bitwise-not is 0xFFFFFFFF,
        // adding 1 to that, results in 0x100000000, which leaves
        // the low bits 0x0 and simply adds one to the high bits.
        highBits += 1;
    }
    return newBits(lowBits, highBits);
}
/**
 * Returns decimal representation of digit1e7 with leading zeros.
 */ const decimalFrom1e7WithLeadingZeros = (digit1e7)=>{
    const partial = String(digit1e7);
    return "0000000".slice(partial.length) + partial;
};
function varint32write(value, bytes) {
    if (value >= 0) {
        // write value as varint 32
        while(value > 0x7f){
            bytes.push(value & 0x7f | 0x80);
            value = value >>> 7;
        }
        bytes.push(value);
    } else {
        for(let i = 0; i < 9; i++){
            bytes.push(value & 127 | 128);
            value = value >> 7;
        }
        bytes.push(1);
    }
}
function varint32read() {
    let b = this.buf[this.pos++];
    let result = b & 0x7f;
    if ((b & 0x80) == 0) {
        this.assertBounds();
        return result;
    }
    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 7;
    if ((b & 0x80) == 0) {
        this.assertBounds();
        return result;
    }
    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 14;
    if ((b & 0x80) == 0) {
        this.assertBounds();
        return result;
    }
    b = this.buf[this.pos++];
    result |= (b & 0x7f) << 21;
    if ((b & 0x80) == 0) {
        this.assertBounds();
        return result;
    }
    // Extract only last 4 bits
    b = this.buf[this.pos++];
    result |= (b & 0x0f) << 28;
    for(let readBytes = 5; (b & 0x80) !== 0 && readBytes < 10; readBytes++)b = this.buf[this.pos++];
    if ((b & 0x80) != 0) throw new Error("invalid varint");
    this.assertBounds();
    // Result can have 32 bits, convert it to unsigned
    return result >>> 0;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "protoInt64",
    ()=>protoInt64
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js [middleware] (ecmascript)");
;
const protoInt64 = /*@__PURE__*/ makeInt64Support();
function makeInt64Support() {
    const dv = new DataView(new ArrayBuffer(8));
    // note that Safari 14 implements BigInt, but not the DataView methods
    const ok = typeof BigInt === "function" && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function" && (!!globalThis.Deno || typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1");
    if (ok) {
        const MIN = BigInt("-9223372036854775808");
        const MAX = BigInt("9223372036854775807");
        const UMIN = BigInt("0");
        const UMAX = BigInt("18446744073709551615");
        return {
            zero: BigInt(0),
            supported: true,
            parse (value) {
                const bi = typeof value == "bigint" ? value : BigInt(value);
                if (bi > MAX || bi < MIN) {
                    throw new Error(`invalid int64: ${value}`);
                }
                return bi;
            },
            uParse (value) {
                const bi = typeof value == "bigint" ? value : BigInt(value);
                if (bi > UMAX || bi < UMIN) {
                    throw new Error(`invalid uint64: ${value}`);
                }
                return bi;
            },
            enc (value) {
                dv.setBigInt64(0, this.parse(value), true);
                return {
                    lo: dv.getInt32(0, true),
                    hi: dv.getInt32(4, true)
                };
            },
            uEnc (value) {
                dv.setBigInt64(0, this.uParse(value), true);
                return {
                    lo: dv.getInt32(0, true),
                    hi: dv.getInt32(4, true)
                };
            },
            dec (lo, hi) {
                dv.setInt32(0, lo, true);
                dv.setInt32(4, hi, true);
                return dv.getBigInt64(0, true);
            },
            uDec (lo, hi) {
                dv.setInt32(0, lo, true);
                dv.setInt32(4, hi, true);
                return dv.getBigUint64(0, true);
            }
        };
    }
    return {
        zero: "0",
        supported: false,
        parse (value) {
            if (typeof value != "string") {
                value = value.toString();
            }
            assertInt64String(value);
            return value;
        },
        uParse (value) {
            if (typeof value != "string") {
                value = value.toString();
            }
            assertUInt64String(value);
            return value;
        },
        enc (value) {
            if (typeof value != "string") {
                value = value.toString();
            }
            assertInt64String(value);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["int64FromString"])(value);
        },
        uEnc (value) {
            if (typeof value != "string") {
                value = value.toString();
            }
            assertUInt64String(value);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["int64FromString"])(value);
        },
        dec (lo, hi) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["int64ToString"])(lo, hi);
        },
        uDec (lo, hi) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["uInt64ToString"])(lo, hi);
        }
    };
}
function assertInt64String(value) {
    if (!/^-?[0-9]+$/.test(value)) {
        throw new Error("invalid int64: " + value);
    }
}
function assertUInt64String(value) {
    if (!/^[0-9]+$/.test(value)) {
        throw new Error("invalid uint64: " + value);
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Scalar value types. This is a subset of field types declared by protobuf
 * enum google.protobuf.FieldDescriptorProto.Type The types GROUP and MESSAGE
 * are omitted, but the numerical values are identical.
 */ __turbopack_context__.s([
    "ScalarType",
    ()=>ScalarType
]);
var ScalarType;
(function(ScalarType) {
    // 0 is reserved for errors.
    // Order is weird for historical reasons.
    ScalarType[ScalarType["DOUBLE"] = 1] = "DOUBLE";
    ScalarType[ScalarType["FLOAT"] = 2] = "FLOAT";
    // Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT64 if
    // negative values are likely.
    ScalarType[ScalarType["INT64"] = 3] = "INT64";
    ScalarType[ScalarType["UINT64"] = 4] = "UINT64";
    // Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT32 if
    // negative values are likely.
    ScalarType[ScalarType["INT32"] = 5] = "INT32";
    ScalarType[ScalarType["FIXED64"] = 6] = "FIXED64";
    ScalarType[ScalarType["FIXED32"] = 7] = "FIXED32";
    ScalarType[ScalarType["BOOL"] = 8] = "BOOL";
    ScalarType[ScalarType["STRING"] = 9] = "STRING";
    // Tag-delimited aggregate.
    // Group type is deprecated and not supported in proto3. However, Proto3
    // implementations should still be able to parse the group wire format and
    // treat group fields as unknown fields.
    // TYPE_GROUP = 10,
    // TYPE_MESSAGE = 11,  // Length-delimited aggregate.
    // New in version 2.
    ScalarType[ScalarType["BYTES"] = 12] = "BYTES";
    ScalarType[ScalarType["UINT32"] = 13] = "UINT32";
    // TYPE_ENUM = 14,
    ScalarType[ScalarType["SFIXED32"] = 15] = "SFIXED32";
    ScalarType[ScalarType["SFIXED64"] = 16] = "SFIXED64";
    ScalarType[ScalarType["SINT32"] = 17] = "SINT32";
    ScalarType[ScalarType["SINT64"] = 18] = "SINT64";
})(ScalarType || (ScalarType = {}));
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isScalarZeroValue",
    ()=>isScalarZeroValue,
    "scalarEquals",
    ()=>scalarEquals,
    "scalarZeroValue",
    ()=>scalarZeroValue
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
;
;
function scalarEquals(type, a, b) {
    if (a === b) {
        // This correctly matches equal values except BYTES and (possibly) 64-bit integers.
        return true;
    }
    // Special case BYTES - we need to compare each byte individually
    if (type == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES) {
        if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
            return false;
        }
        if (a.length !== b.length) {
            return false;
        }
        for(let i = 0; i < a.length; i++){
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
    }
    // Special case 64-bit integers - we support number, string and bigint representation.
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            // Loose comparison will match between 0n, 0 and "0".
            return a == b;
    }
    // Anything that hasn't been caught by strict comparison or special cased
    // BYTES and 64-bit integers is not equal.
    return false;
}
function scalarZeroValue(type, longAsString) {
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            return "";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            return false;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
            return 0.0;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            return longAsString ? "0" : __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].zero;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            return new Uint8Array(0);
        default:
            // Handles INT32, UINT32, SINT32, FIXED32, SFIXED32.
            // We do not use individual cases to save a few bytes code size.
            return 0;
    }
}
function isScalarZeroValue(type, value) {
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            return value === false;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            return value === "";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            return value instanceof Uint8Array && !value.byteLength;
        default:
            return value == 0; // Loose comparison matches 0n, 0 and "0"
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "unsafeClear",
    ()=>unsafeClear,
    "unsafeGet",
    ()=>unsafeGet,
    "unsafeIsSet",
    ()=>unsafeIsSet,
    "unsafeIsSetExplicit",
    ()=>unsafeIsSetExplicit,
    "unsafeLocal",
    ()=>unsafeLocal,
    "unsafeOneofCase",
    ()=>unsafeOneofCase,
    "unsafeSet",
    ()=>unsafeSet
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js [middleware] (ecmascript)");
;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.IMPLICIT: const $name: FeatureSet_FieldPresence.$localName = $number;
const IMPLICIT = 2;
const unsafeLocal = Symbol.for("reflect unsafe local");
function unsafeOneofCase(// biome-ignore lint/suspicious/noExplicitAny: `any` is the best choice for dynamic access
target, oneof) {
    const c = target[oneof.localName].case;
    if (c === undefined) {
        return c;
    }
    return oneof.fields.find((f)=>f.localName === c);
}
function unsafeIsSet(// biome-ignore lint/suspicious/noExplicitAny: `any` is the best choice for dynamic access
target, field) {
    const name = field.localName;
    if (field.oneof) {
        return target[field.oneof.localName].case === name;
    }
    if (field.presence != IMPLICIT) {
        // Fields with explicit presence have properties on the prototype chain
        // for default / zero values (except for proto3).
        return target[name] !== undefined && Object.prototype.hasOwnProperty.call(target, name);
    }
    switch(field.fieldKind){
        case "list":
            return target[name].length > 0;
        case "map":
            return Object.keys(target[name]).length > 0;
        case "scalar":
            return !(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isScalarZeroValue"])(field.scalar, target[name]);
        case "enum":
            return target[name] !== field.enum.values[0].number;
    }
    throw new Error("message field with implicit presence");
}
function unsafeIsSetExplicit(target, localName) {
    return Object.prototype.hasOwnProperty.call(target, localName) && target[localName] !== undefined;
}
function unsafeGet(target, field) {
    if (field.oneof) {
        const oneof = target[field.oneof.localName];
        if (oneof.case === field.localName) {
            return oneof.value;
        }
        return undefined;
    }
    return target[field.localName];
}
function unsafeSet(target, field, value) {
    if (field.oneof) {
        target[field.oneof.localName] = {
            case: field.localName,
            value: value
        };
    } else {
        target[field.localName] = value;
    }
}
function unsafeClear(// biome-ignore lint/suspicious/noExplicitAny: `any` is the best choice for dynamic access
target, field) {
    const name = field.localName;
    if (field.oneof) {
        const oneofLocalName = field.oneof.localName;
        if (target[oneofLocalName].case === name) {
            target[oneofLocalName] = {
                case: undefined
            };
        }
    } else if (field.presence != IMPLICIT) {
        // Fields with explicit presence have properties on the prototype chain
        // for default / zero values (except for proto3). By deleting their own
        // property, the field is reset.
        delete target[name];
    } else {
        switch(field.fieldKind){
            case "map":
                target[name] = {};
                break;
            case "list":
                target[name] = [];
                break;
            case "enum":
                target[name] = field.enum.values[0].number;
                break;
            case "scalar":
                target[name] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["scalarZeroValue"])(field.scalar, field.longAsString);
                break;
        }
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "restoreJsonNames",
    ()=>restoreJsonNames
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js [middleware] (ecmascript)");
;
;
function restoreJsonNames(message) {
    for (const f of message.field){
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeIsSetExplicit"])(f, "jsonName")) {
            f.jsonName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoCamelCase"])(f.name);
        }
    }
    message.nestedType.forEach(restoreJsonNames);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseTextFormatEnumValue",
    ()=>parseTextFormatEnumValue,
    "parseTextFormatScalarValue",
    ()=>parseTextFormatScalarValue
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)");
;
;
function parseTextFormatEnumValue(descEnum, value) {
    const enumValue = descEnum.values.find((v)=>v.name === value);
    if (!enumValue) {
        throw new Error(`cannot parse ${descEnum} default value: ${value}`);
    }
    return enumValue.number;
}
function parseTextFormatScalarValue(type, value) {
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            return value;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            {
                const u = unescapeBytesDefaultValue(value);
                if (u === false) {
                    throw new Error(`cannot parse ${__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"][type]} default value: ${value}`);
                }
                return u;
            }
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(value);
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uParse(value);
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
            switch(value){
                case "inf":
                    return Number.POSITIVE_INFINITY;
                case "-inf":
                    return Number.NEGATIVE_INFINITY;
                case "nan":
                    return Number.NaN;
                default:
                    return parseFloat(value);
            }
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            return value === "true";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
            return parseInt(value, 10);
    }
}
/**
 * Parses a text-encoded default value (proto2) of a BYTES field.
 */ function unescapeBytesDefaultValue(str) {
    const b = [];
    const input = {
        tail: str,
        c: "",
        next () {
            if (this.tail.length == 0) {
                return false;
            }
            this.c = this.tail[0];
            this.tail = this.tail.substring(1);
            return true;
        },
        take (n) {
            if (this.tail.length >= n) {
                const r = this.tail.substring(0, n);
                this.tail = this.tail.substring(n);
                return r;
            }
            return false;
        }
    };
    while(input.next()){
        switch(input.c){
            case "\\":
                if (input.next()) {
                    switch(input.c){
                        case "\\":
                            b.push(input.c.charCodeAt(0));
                            break;
                        case "b":
                            b.push(0x08);
                            break;
                        case "f":
                            b.push(0x0c);
                            break;
                        case "n":
                            b.push(0x0a);
                            break;
                        case "r":
                            b.push(0x0d);
                            break;
                        case "t":
                            b.push(0x09);
                            break;
                        case "v":
                            b.push(0x0b);
                            break;
                        case "0":
                        case "1":
                        case "2":
                        case "3":
                        case "4":
                        case "5":
                        case "6":
                        case "7":
                            {
                                const s = input.c;
                                const t = input.take(2);
                                if (t === false) {
                                    return false;
                                }
                                const n = parseInt(s + t, 8);
                                if (Number.isNaN(n)) {
                                    return false;
                                }
                                b.push(n);
                                break;
                            }
                        case "x":
                            {
                                const s = input.c;
                                const t = input.take(2);
                                if (t === false) {
                                    return false;
                                }
                                const n = parseInt(s + t, 16);
                                if (Number.isNaN(n)) {
                                    return false;
                                }
                                b.push(n);
                                break;
                            }
                        case "u":
                            {
                                const s = input.c;
                                const t = input.take(4);
                                if (t === false) {
                                    return false;
                                }
                                const n = parseInt(s + t, 16);
                                if (Number.isNaN(n)) {
                                    return false;
                                }
                                const chunk = new Uint8Array(4);
                                const view = new DataView(chunk.buffer);
                                view.setInt32(0, n, true);
                                b.push(chunk[0], chunk[1], chunk[2], chunk[3]);
                                break;
                            }
                        case "U":
                            {
                                const s = input.c;
                                const t = input.take(8);
                                if (t === false) {
                                    return false;
                                }
                                const tc = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uEnc(s + t);
                                const chunk = new Uint8Array(8);
                                const view = new DataView(chunk.buffer);
                                view.setInt32(0, tc.lo, true);
                                view.setInt32(4, tc.hi, true);
                                b.push(chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7]);
                                break;
                            }
                    }
                }
                break;
            default:
                b.push(input.c.charCodeAt(0));
        }
    }
    return new Uint8Array(b);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/nested-types.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Iterate over all types - enumerations, extensions, services, messages -
 * and enumerations, extensions and messages nested in messages.
 */ __turbopack_context__.s([
    "nestedTypes",
    ()=>nestedTypes,
    "parentTypes",
    ()=>parentTypes,
    "usedTypes",
    ()=>usedTypes
]);
function* nestedTypes(desc) {
    switch(desc.kind){
        case "file":
            for (const message of desc.messages){
                yield message;
                yield* nestedTypes(message);
            }
            yield* desc.enums;
            yield* desc.services;
            yield* desc.extensions;
            break;
        case "message":
            for (const message of desc.nestedMessages){
                yield message;
                yield* nestedTypes(message);
            }
            yield* desc.nestedEnums;
            yield* desc.nestedExtensions;
            break;
    }
}
function usedTypes(descMessage) {
    return usedTypesInternal(descMessage, new Set());
}
function* usedTypesInternal(descMessage, seen) {
    var _a, _b;
    for (const field of descMessage.fields){
        const ref = (_b = (_a = field.enum) !== null && _a !== void 0 ? _a : field.message) !== null && _b !== void 0 ? _b : undefined;
        if (!ref || seen.has(ref.typeName)) {
            continue;
        }
        seen.add(ref.typeName);
        yield ref;
        if (ref.kind == "message") {
            yield* usedTypesInternal(ref, seen);
        }
    }
}
function parentTypes(desc) {
    const parents = [];
    while(desc.kind !== "file"){
        const p = parent(desc);
        desc = p;
        parents.push(p);
    }
    return parents;
}
function parent(desc) {
    var _a;
    switch(desc.kind){
        case "enum_value":
        case "field":
        case "oneof":
        case "rpc":
            return desc.parent;
        case "service":
            return desc.file;
        case "extension":
        case "enum":
        case "message":
            return (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file;
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/registry.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createFileRegistry",
    ()=>createFileRegistry,
    "createMutableRegistry",
    ()=>createMutableRegistry,
    "createRegistry",
    ()=>createRegistry,
    "maximumEdition",
    ()=>maximumEdition,
    "minimumEdition",
    ()=>minimumEdition
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$format$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/text-format.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$nested$2d$types$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/nested-types.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js [middleware] (ecmascript)");
;
;
;
;
;
function createRegistry(...input) {
    return initBaseRegistry(input);
}
function createMutableRegistry(...input) {
    const reg = initBaseRegistry(input);
    return Object.assign(Object.assign({}, reg), {
        remove (desc) {
            var _a;
            if (desc.kind == "extension") {
                (_a = reg.extendees.get(desc.extendee.typeName)) === null || _a === void 0 ? void 0 : _a.delete(desc.number);
            }
            reg.types.delete(desc.typeName);
        }
    });
}
function createFileRegistry(...args) {
    const registry = createBaseRegistry();
    if (!args.length) {
        return registry;
    }
    if ("$typeName" in args[0] && args[0].$typeName == "google.protobuf.FileDescriptorSet") {
        for (const file of args[0].file){
            addFile(file, registry);
        }
        return registry;
    }
    if ("$typeName" in args[0]) {
        const input = args[0];
        const resolve = args[1];
        const seen = new Set();
        function recurseDeps(file) {
            const deps = [];
            for (const protoFileName of file.dependency){
                if (registry.getFile(protoFileName) != undefined) {
                    continue;
                }
                if (seen.has(protoFileName)) {
                    continue;
                }
                const dep = resolve(protoFileName);
                if (!dep) {
                    throw new Error(`Unable to resolve ${protoFileName}, imported by ${file.name}`);
                }
                if ("kind" in dep) {
                    registry.addFile(dep, false, true);
                } else {
                    seen.add(dep.name);
                    deps.push(dep);
                }
            }
            return deps.concat(...deps.map(recurseDeps));
        }
        for (const file of [
            input,
            ...recurseDeps(input)
        ].reverse()){
            addFile(file, registry);
        }
    } else {
        for (const fileReg of args){
            for (const file of fileReg.files){
                registry.addFile(file);
            }
        }
    }
    return registry;
}
/**
 * @private
 */ function createBaseRegistry() {
    const types = new Map();
    const extendees = new Map();
    const files = new Map();
    return {
        kind: "registry",
        types,
        extendees,
        [Symbol.iterator] () {
            return types.values();
        },
        get files () {
            return files.values();
        },
        addFile (file, skipTypes, withDeps) {
            files.set(file.proto.name, file);
            if (!skipTypes) {
                for (const type of (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$nested$2d$types$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["nestedTypes"])(file)){
                    this.add(type);
                }
            }
            if (withDeps) {
                for (const f of file.dependencies){
                    this.addFile(f, skipTypes, withDeps);
                }
            }
        },
        add (desc) {
            if (desc.kind == "extension") {
                let numberToExt = extendees.get(desc.extendee.typeName);
                if (!numberToExt) {
                    extendees.set(desc.extendee.typeName, numberToExt = new Map());
                }
                numberToExt.set(desc.number, desc);
            }
            types.set(desc.typeName, desc);
        },
        get (typeName) {
            return types.get(typeName);
        },
        getFile (fileName) {
            return files.get(fileName);
        },
        getMessage (typeName) {
            const t = types.get(typeName);
            return (t === null || t === void 0 ? void 0 : t.kind) == "message" ? t : undefined;
        },
        getEnum (typeName) {
            const t = types.get(typeName);
            return (t === null || t === void 0 ? void 0 : t.kind) == "enum" ? t : undefined;
        },
        getExtension (typeName) {
            const t = types.get(typeName);
            return (t === null || t === void 0 ? void 0 : t.kind) == "extension" ? t : undefined;
        },
        getExtensionFor (extendee, no) {
            var _a;
            return (_a = extendees.get(extendee.typeName)) === null || _a === void 0 ? void 0 : _a.get(no);
        },
        getService (typeName) {
            const t = types.get(typeName);
            return (t === null || t === void 0 ? void 0 : t.kind) == "service" ? t : undefined;
        }
    };
}
/**
 * @private
 */ function initBaseRegistry(inputs) {
    const registry = createBaseRegistry();
    for (const input of inputs){
        switch(input.kind){
            case "registry":
                for (const n of input){
                    registry.add(n);
                }
                break;
            case "file":
                registry.addFile(input);
                break;
            default:
                registry.add(input);
                break;
        }
    }
    return registry;
}
// bootstrap-inject google.protobuf.Edition.EDITION_PROTO2: const $name: Edition.$localName = $number;
const EDITION_PROTO2 = 998;
// bootstrap-inject google.protobuf.Edition.EDITION_PROTO3: const $name: Edition.$localName = $number;
const EDITION_PROTO3 = 999;
// bootstrap-inject google.protobuf.FieldDescriptorProto.Type.TYPE_STRING: const $name: FieldDescriptorProto_Type.$localName = $number;
const TYPE_STRING = 9;
// bootstrap-inject google.protobuf.FieldDescriptorProto.Type.TYPE_GROUP: const $name: FieldDescriptorProto_Type.$localName = $number;
const TYPE_GROUP = 10;
// bootstrap-inject google.protobuf.FieldDescriptorProto.Type.TYPE_MESSAGE: const $name: FieldDescriptorProto_Type.$localName = $number;
const TYPE_MESSAGE = 11;
// bootstrap-inject google.protobuf.FieldDescriptorProto.Type.TYPE_BYTES: const $name: FieldDescriptorProto_Type.$localName = $number;
const TYPE_BYTES = 12;
// bootstrap-inject google.protobuf.FieldDescriptorProto.Type.TYPE_ENUM: const $name: FieldDescriptorProto_Type.$localName = $number;
const TYPE_ENUM = 14;
// bootstrap-inject google.protobuf.FieldDescriptorProto.Label.LABEL_REPEATED: const $name: FieldDescriptorProto_Label.$localName = $number;
const LABEL_REPEATED = 3;
// bootstrap-inject google.protobuf.FieldDescriptorProto.Label.LABEL_REQUIRED: const $name: FieldDescriptorProto_Label.$localName = $number;
const LABEL_REQUIRED = 2;
// bootstrap-inject google.protobuf.FieldOptions.JSType.JS_STRING: const $name: FieldOptions_JSType.$localName = $number;
const JS_STRING = 1;
// bootstrap-inject google.protobuf.MethodOptions.IdempotencyLevel.IDEMPOTENCY_UNKNOWN: const $name: MethodOptions_IdempotencyLevel.$localName = $number;
const IDEMPOTENCY_UNKNOWN = 0;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.EXPLICIT: const $name: FeatureSet_FieldPresence.$localName = $number;
const EXPLICIT = 1;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.IMPLICIT: const $name: FeatureSet_FieldPresence.$localName = $number;
const IMPLICIT = 2;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.LEGACY_REQUIRED: const $name: FeatureSet_FieldPresence.$localName = $number;
const LEGACY_REQUIRED = 3;
// bootstrap-inject google.protobuf.FeatureSet.RepeatedFieldEncoding.PACKED: const $name: FeatureSet_RepeatedFieldEncoding.$localName = $number;
const PACKED = 1;
// bootstrap-inject google.protobuf.FeatureSet.MessageEncoding.DELIMITED: const $name: FeatureSet_MessageEncoding.$localName = $number;
const DELIMITED = 2;
// bootstrap-inject google.protobuf.FeatureSet.EnumType.OPEN: const $name: FeatureSet_EnumType.$localName = $number;
const OPEN = 1;
const minimumEdition = 998, maximumEdition = 1001;
const featureDefaults = {
    // EDITION_PROTO2
    998: {
        fieldPresence: 1,
        enumType: 2,
        repeatedFieldEncoding: 2,
        utf8Validation: 3,
        messageEncoding: 1,
        jsonFormat: 2,
        enforceNamingStyle: 2,
        defaultSymbolVisibility: 1
    },
    // EDITION_PROTO3
    999: {
        fieldPresence: 2,
        enumType: 1,
        repeatedFieldEncoding: 1,
        utf8Validation: 2,
        messageEncoding: 1,
        jsonFormat: 1,
        enforceNamingStyle: 2,
        defaultSymbolVisibility: 1
    },
    // EDITION_2023
    1000: {
        fieldPresence: 1,
        enumType: 1,
        repeatedFieldEncoding: 1,
        utf8Validation: 2,
        messageEncoding: 1,
        jsonFormat: 1,
        enforceNamingStyle: 2,
        defaultSymbolVisibility: 1
    },
    // EDITION_2024
    1001: {
        fieldPresence: 1,
        enumType: 1,
        repeatedFieldEncoding: 1,
        utf8Validation: 2,
        messageEncoding: 1,
        jsonFormat: 1,
        enforceNamingStyle: 1,
        defaultSymbolVisibility: 2
    }
};
/**
 * Create a descriptor for a file, add it to the registry.
 */ function addFile(proto, reg) {
    var _a, _b;
    const file = {
        kind: "file",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
        edition: getFileEdition(proto),
        name: proto.name.replace(/\.proto$/, ""),
        dependencies: findFileDependencies(proto, reg),
        enums: [],
        messages: [],
        extensions: [],
        services: [],
        toString () {
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- we asserted above
            return `file ${proto.name}`;
        }
    };
    const mapEntriesStore = new Map();
    const mapEntries = {
        get (typeName) {
            return mapEntriesStore.get(typeName);
        },
        add (desc) {
            var _a;
            assert(((_a = desc.proto.options) === null || _a === void 0 ? void 0 : _a.mapEntry) === true);
            mapEntriesStore.set(desc.typeName, desc);
        }
    };
    for (const enumProto of proto.enumType){
        addEnum(enumProto, file, undefined, reg);
    }
    for (const messageProto of proto.messageType){
        addMessage(messageProto, file, undefined, reg, mapEntries);
    }
    for (const serviceProto of proto.service){
        addService(serviceProto, file, reg);
    }
    addExtensions(file, reg);
    for (const mapEntry of mapEntriesStore.values()){
        // to create a map field, we need access to the map entry's fields
        addFields(mapEntry, reg, mapEntries);
    }
    for (const message of file.messages){
        addFields(message, reg, mapEntries);
        addExtensions(message, reg);
    }
    reg.addFile(file, true);
}
/**
 * Create descriptors for extensions, and add them to the message / file,
 * and to our cart.
 * Recurses into nested types.
 */ function addExtensions(desc, reg) {
    switch(desc.kind){
        case "file":
            for (const proto of desc.proto.extension){
                const ext = newField(proto, desc, reg);
                desc.extensions.push(ext);
                reg.add(ext);
            }
            break;
        case "message":
            for (const proto of desc.proto.extension){
                const ext = newField(proto, desc, reg);
                desc.nestedExtensions.push(ext);
                reg.add(ext);
            }
            for (const message of desc.nestedMessages){
                addExtensions(message, reg);
            }
            break;
    }
}
/**
 * Create descriptors for fields and oneof groups, and add them to the message.
 * Recurses into nested types.
 */ function addFields(message, reg, mapEntries) {
    const allOneofs = message.proto.oneofDecl.map((proto)=>newOneof(proto, message));
    const oneofsSeen = new Set();
    for (const proto of message.proto.field){
        const oneof = findOneof(proto, allOneofs);
        const field = newField(proto, message, reg, oneof, mapEntries);
        message.fields.push(field);
        message.field[field.localName] = field;
        if (oneof === undefined) {
            message.members.push(field);
        } else {
            oneof.fields.push(field);
            if (!oneofsSeen.has(oneof)) {
                oneofsSeen.add(oneof);
                message.members.push(oneof);
            }
        }
    }
    for (const oneof of allOneofs.filter((o)=>oneofsSeen.has(o))){
        message.oneofs.push(oneof);
    }
    for (const child of message.nestedMessages){
        addFields(child, reg, mapEntries);
    }
}
/**
 * Create a descriptor for an enumeration, and add it our cart and to the
 * parent type, if any.
 */ function addEnum(proto, file, parent, reg) {
    var _a, _b, _c, _d, _e;
    const sharedPrefix = findEnumSharedPrefix(proto.name, proto.value);
    const desc = {
        kind: "enum",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
        file,
        parent,
        open: true,
        name: proto.name,
        typeName: makeTypeName(proto, parent, file),
        value: {},
        values: [],
        sharedPrefix,
        toString () {
            return `enum ${this.typeName}`;
        }
    };
    desc.open = isEnumOpen(desc);
    reg.add(desc);
    for (const p of proto.value){
        const name = p.name;
        desc.values.push(desc.value[p.number] = {
            kind: "enum_value",
            proto: p,
            deprecated: (_d = (_c = p.options) === null || _c === void 0 ? void 0 : _c.deprecated) !== null && _d !== void 0 ? _d : false,
            parent: desc,
            name,
            localName: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["safeObjectProperty"])(sharedPrefix == undefined ? name : name.substring(sharedPrefix.length)),
            number: p.number,
            toString () {
                return `enum value ${desc.typeName}.${name}`;
            }
        });
    }
    ((_e = parent === null || parent === void 0 ? void 0 : parent.nestedEnums) !== null && _e !== void 0 ? _e : file.enums).push(desc);
}
/**
 * Create a descriptor for a message, including nested types, and add it to our
 * cart. Note that this does not create descriptors fields.
 */ function addMessage(proto, file, parent, reg, mapEntries) {
    var _a, _b, _c, _d;
    const desc = {
        kind: "message",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
        file,
        parent,
        name: proto.name,
        typeName: makeTypeName(proto, parent, file),
        fields: [],
        field: {},
        oneofs: [],
        members: [],
        nestedEnums: [],
        nestedMessages: [],
        nestedExtensions: [],
        toString () {
            return `message ${this.typeName}`;
        }
    };
    if (((_c = proto.options) === null || _c === void 0 ? void 0 : _c.mapEntry) === true) {
        mapEntries.add(desc);
    } else {
        ((_d = parent === null || parent === void 0 ? void 0 : parent.nestedMessages) !== null && _d !== void 0 ? _d : file.messages).push(desc);
        reg.add(desc);
    }
    for (const enumProto of proto.enumType){
        addEnum(enumProto, file, desc, reg);
    }
    for (const messageProto of proto.nestedType){
        addMessage(messageProto, file, desc, reg, mapEntries);
    }
}
/**
 * Create a descriptor for a service, including methods, and add it to our
 * cart.
 */ function addService(proto, file, reg) {
    var _a, _b;
    const desc = {
        kind: "service",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
        file,
        name: proto.name,
        typeName: makeTypeName(proto, undefined, file),
        methods: [],
        method: {},
        toString () {
            return `service ${this.typeName}`;
        }
    };
    file.services.push(desc);
    reg.add(desc);
    for (const methodProto of proto.method){
        const method = newMethod(methodProto, desc, reg);
        desc.methods.push(method);
        desc.method[method.localName] = method;
    }
}
/**
 * Create a descriptor for a method.
 */ function newMethod(proto, parent, reg) {
    var _a, _b, _c, _d;
    let methodKind;
    if (proto.clientStreaming && proto.serverStreaming) {
        methodKind = "bidi_streaming";
    } else if (proto.clientStreaming) {
        methodKind = "client_streaming";
    } else if (proto.serverStreaming) {
        methodKind = "server_streaming";
    } else {
        methodKind = "unary";
    }
    const input = reg.getMessage(trimLeadingDot(proto.inputType));
    const output = reg.getMessage(trimLeadingDot(proto.outputType));
    assert(input, `invalid MethodDescriptorProto: input_type ${proto.inputType} not found`);
    assert(output, `invalid MethodDescriptorProto: output_type ${proto.inputType} not found`);
    const name = proto.name;
    return {
        kind: "rpc",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
        parent,
        name,
        localName: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["safeObjectProperty"])(name.length ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["safeObjectProperty"])(name[0].toLowerCase() + name.substring(1)) : name),
        methodKind,
        input,
        output,
        idempotency: (_d = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.idempotencyLevel) !== null && _d !== void 0 ? _d : IDEMPOTENCY_UNKNOWN,
        toString () {
            return `rpc ${parent.typeName}.${name}`;
        }
    };
}
/**
 * Create a descriptor for a oneof group.
 */ function newOneof(proto, parent) {
    return {
        kind: "oneof",
        proto,
        deprecated: false,
        parent,
        fields: [],
        name: proto.name,
        localName: (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["safeObjectProperty"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoCamelCase"])(proto.name)),
        toString () {
            return `oneof ${parent.typeName}.${this.name}`;
        }
    };
}
function newField(proto, parentOrFile, reg, oneof, mapEntries) {
    var _a, _b, _c;
    const isExtension = mapEntries === undefined;
    const field = {
        kind: "field",
        proto,
        deprecated: (_b = (_a = proto.options) === null || _a === void 0 ? void 0 : _a.deprecated) !== null && _b !== void 0 ? _b : false,
        name: proto.name,
        number: proto.number,
        scalar: undefined,
        message: undefined,
        enum: undefined,
        presence: getFieldPresence(proto, oneof, isExtension, parentOrFile),
        listKind: undefined,
        mapKind: undefined,
        mapKey: undefined,
        delimitedEncoding: undefined,
        packed: undefined,
        longAsString: false,
        getDefaultValue: undefined
    };
    if (isExtension) {
        // extension field
        const file = parentOrFile.kind == "file" ? parentOrFile : parentOrFile.file;
        const parent = parentOrFile.kind == "file" ? undefined : parentOrFile;
        const typeName = makeTypeName(proto, parent, file);
        field.kind = "extension";
        field.file = file;
        field.parent = parent;
        field.oneof = undefined;
        field.typeName = typeName;
        field.jsonName = `[${typeName}]`; // option json_name is not allowed on extension fields
        field.toString = ()=>`extension ${typeName}`;
        const extendee = reg.getMessage(trimLeadingDot(proto.extendee));
        assert(extendee, `invalid FieldDescriptorProto: extendee ${proto.extendee} not found`);
        field.extendee = extendee;
    } else {
        // regular field
        const parent = parentOrFile;
        assert(parent.kind == "message");
        field.parent = parent;
        field.oneof = oneof;
        field.localName = oneof ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoCamelCase"])(proto.name) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["safeObjectProperty"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoCamelCase"])(proto.name));
        field.jsonName = proto.jsonName;
        field.toString = ()=>`field ${parent.typeName}.${proto.name}`;
    }
    const label = proto.label;
    const type = proto.type;
    const jstype = (_c = proto.options) === null || _c === void 0 ? void 0 : _c.jstype;
    if (label === LABEL_REPEATED) {
        // list or map field
        const mapEntry = type == TYPE_MESSAGE ? mapEntries === null || mapEntries === void 0 ? void 0 : mapEntries.get(trimLeadingDot(proto.typeName)) : undefined;
        if (mapEntry) {
            // map field
            field.fieldKind = "map";
            const { key, value } = findMapEntryFields(mapEntry);
            field.mapKey = key.scalar;
            field.mapKind = value.fieldKind;
            field.message = value.message;
            field.delimitedEncoding = false; // map fields are always LENGTH_PREFIXED
            field.enum = value.enum;
            field.scalar = value.scalar;
            return field;
        }
        // list field
        field.fieldKind = "list";
        switch(type){
            case TYPE_MESSAGE:
            case TYPE_GROUP:
                field.listKind = "message";
                field.message = reg.getMessage(trimLeadingDot(proto.typeName));
                assert(field.message);
                field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
                break;
            case TYPE_ENUM:
                field.listKind = "enum";
                field.enum = reg.getEnum(trimLeadingDot(proto.typeName));
                assert(field.enum);
                break;
            default:
                field.listKind = "scalar";
                field.scalar = type;
                field.longAsString = jstype == JS_STRING;
                break;
        }
        field.packed = isPackedField(proto, parentOrFile);
        return field;
    }
    // singular
    switch(type){
        case TYPE_MESSAGE:
        case TYPE_GROUP:
            field.fieldKind = "message";
            field.message = reg.getMessage(trimLeadingDot(proto.typeName));
            assert(field.message, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`);
            field.delimitedEncoding = isDelimitedEncoding(proto, parentOrFile);
            field.getDefaultValue = ()=>undefined;
            break;
        case TYPE_ENUM:
            {
                const enumeration = reg.getEnum(trimLeadingDot(proto.typeName));
                assert(enumeration !== undefined, `invalid FieldDescriptorProto: type_name ${proto.typeName} not found`);
                field.fieldKind = "enum";
                field.enum = reg.getEnum(trimLeadingDot(proto.typeName));
                field.getDefaultValue = ()=>{
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeIsSetExplicit"])(proto, "defaultValue") ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$format$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["parseTextFormatEnumValue"])(enumeration, proto.defaultValue) : undefined;
                };
                break;
            }
        default:
            {
                field.fieldKind = "scalar";
                field.scalar = type;
                field.longAsString = jstype == JS_STRING;
                field.getDefaultValue = ()=>{
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeIsSetExplicit"])(proto, "defaultValue") ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$format$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["parseTextFormatScalarValue"])(type, proto.defaultValue) : undefined;
                };
                break;
            }
    }
    return field;
}
/**
 * Parse the "syntax" and "edition" fields, returning one of the supported
 * editions.
 */ function getFileEdition(proto) {
    switch(proto.syntax){
        case "":
        case "proto2":
            return EDITION_PROTO2;
        case "proto3":
            return EDITION_PROTO3;
        case "editions":
            if (proto.edition in featureDefaults) {
                return proto.edition;
            }
            throw new Error(`${proto.name}: unsupported edition`);
        default:
            throw new Error(`${proto.name}: unsupported syntax "${proto.syntax}"`);
    }
}
/**
 * Resolve dependencies of FileDescriptorProto to DescFile.
 */ function findFileDependencies(proto, reg) {
    return proto.dependency.map((wantName)=>{
        const dep = reg.getFile(wantName);
        if (!dep) {
            throw new Error(`Cannot find ${wantName}, imported by ${proto.name}`);
        }
        return dep;
    });
}
/**
 * Finds a prefix shared by enum values, for example `my_enum_` for
 * `enum MyEnum {MY_ENUM_A=0; MY_ENUM_B=1;}`.
 */ function findEnumSharedPrefix(enumName, values) {
    const prefix = camelToSnakeCase(enumName) + "_";
    for (const value of values){
        if (!value.name.toLowerCase().startsWith(prefix)) {
            return undefined;
        }
        const shortName = value.name.substring(prefix.length);
        if (shortName.length == 0) {
            return undefined;
        }
        if (/^\d/.test(shortName)) {
            // identifiers must not start with numbers
            return undefined;
        }
    }
    return prefix;
}
/**
 * Converts lowerCamelCase or UpperCamelCase into lower_snake_case.
 * This is used to find shared prefixes in an enum.
 */ function camelToSnakeCase(camel) {
    return (camel.substring(0, 1) + camel.substring(1).replace(/[A-Z]/g, (c)=>"_" + c)).toLowerCase();
}
/**
 * Create a fully qualified name for a protobuf type or extension field.
 *
 * The fully qualified name for messages, enumerations, and services is
 * constructed by concatenating the package name (if present), parent
 * message names (for nested types), and the type name. We omit the leading
 * dot added by protobuf compilers. Examples:
 * - mypackage.MyMessage
 * - mypackage.MyMessage.NestedMessage
 *
 * The fully qualified name for extension fields is constructed by
 * concatenating the package name (if present), parent message names (for
 * extensions declared within a message), and the field name. Examples:
 * - mypackage.extfield
 * - mypackage.MyMessage.extfield
 */ function makeTypeName(proto, parent, file) {
    let typeName;
    if (parent) {
        typeName = `${parent.typeName}.${proto.name}`;
    } else if (file.proto.package.length > 0) {
        typeName = `${file.proto.package}.${proto.name}`;
    } else {
        typeName = `${proto.name}`;
    }
    return typeName;
}
/**
 * Remove the leading dot from a fully qualified type name.
 */ function trimLeadingDot(typeName) {
    return typeName.startsWith(".") ? typeName.substring(1) : typeName;
}
/**
 * Did the user put the field in a oneof group?
 * Synthetic oneofs for proto3 optionals are ignored.
 */ function findOneof(proto, allOneofs) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeIsSetExplicit"])(proto, "oneofIndex")) {
        return undefined;
    }
    if (proto.proto3Optional) {
        return undefined;
    }
    const oneof = allOneofs[proto.oneofIndex];
    assert(oneof, `invalid FieldDescriptorProto: oneof #${proto.oneofIndex} for field #${proto.number} not found`);
    return oneof;
}
/**
 * Presence of the field.
 * See https://protobuf.dev/programming-guides/field_presence/
 */ function getFieldPresence(proto, oneof, isExtension, parent) {
    if (proto.label == LABEL_REQUIRED) {
        // proto2 required is LEGACY_REQUIRED
        return LEGACY_REQUIRED;
    }
    if (proto.label == LABEL_REPEATED) {
        // repeated fields (including maps) do not track presence
        return IMPLICIT;
    }
    if (!!oneof || proto.proto3Optional) {
        // oneof is always explicit
        return EXPLICIT;
    }
    if (isExtension) {
        // extensions always track presence
        return EXPLICIT;
    }
    const resolved = resolveFeature("fieldPresence", {
        proto,
        parent
    });
    if (resolved == IMPLICIT && (proto.type == TYPE_MESSAGE || proto.type == TYPE_GROUP)) {
        // singular message field cannot be implicit
        return EXPLICIT;
    }
    return resolved;
}
/**
 * Pack this repeated field?
 */ function isPackedField(proto, parent) {
    if (proto.label != LABEL_REPEATED) {
        return false;
    }
    switch(proto.type){
        case TYPE_STRING:
        case TYPE_BYTES:
        case TYPE_GROUP:
        case TYPE_MESSAGE:
            // length-delimited types cannot be packed
            return false;
    }
    const o = proto.options;
    if (o && (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeIsSetExplicit"])(o, "packed")) {
        // prefer the field option over edition features
        return o.packed;
    }
    return PACKED == resolveFeature("repeatedFieldEncoding", {
        proto,
        parent
    });
}
/**
 * Find the key and value fields of a synthetic map entry message.
 */ function findMapEntryFields(mapEntry) {
    const key = mapEntry.fields.find((f)=>f.number === 1);
    const value = mapEntry.fields.find((f)=>f.number === 2);
    assert(key && key.fieldKind == "scalar" && key.scalar != __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES && key.scalar != __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT && key.scalar != __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE && value && value.fieldKind != "list" && value.fieldKind != "map");
    return {
        key,
        value
    };
}
/**
 * Enumerations can be open or closed.
 * See https://protobuf.dev/programming-guides/enum/
 */ function isEnumOpen(desc) {
    var _a;
    return OPEN == resolveFeature("enumType", {
        proto: desc.proto,
        parent: (_a = desc.parent) !== null && _a !== void 0 ? _a : desc.file
    });
}
/**
 * Encode the message delimited (a.k.a. proto2 group encoding), or
 * length-prefixed?
 */ function isDelimitedEncoding(proto, parent) {
    if (proto.type == TYPE_GROUP) {
        return true;
    }
    return DELIMITED == resolveFeature("messageEncoding", {
        proto,
        parent
    });
}
function resolveFeature(name, ref) {
    var _a, _b;
    const featureSet = (_a = ref.proto.options) === null || _a === void 0 ? void 0 : _a.features;
    if (featureSet) {
        const val = featureSet[name];
        if (val != 0) {
            return val;
        }
    }
    if ("kind" in ref) {
        if (ref.kind == "message") {
            return resolveFeature(name, (_b = ref.parent) !== null && _b !== void 0 ? _b : ref.file);
        }
        const editionDefaults = featureDefaults[ref.edition];
        if (!editionDefaults) {
            throw new Error(`feature default for edition ${ref.edition} not found`);
        }
        return editionDefaults[name];
    }
    return resolveFeature(name, ref.parent);
}
/**
 * Assert that condition is truthy or throw error (with message)
 */ function assert(condition, msg) {
    if (!condition) {
        throw new Error(msg);
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/boot.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "boot",
    ()=>boot,
    "bootFileDescriptorProto",
    ()=>bootFileDescriptorProto
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$restore$2d$json$2d$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$registry$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/registry.js [middleware] (ecmascript)");
;
;
function boot(boot) {
    const root = bootFileDescriptorProto(boot);
    root.messageType.forEach(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$restore$2d$json$2d$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["restoreJsonNames"]);
    const reg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$registry$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createFileRegistry"])(root, ()=>undefined);
    // biome-ignore lint/style/noNonNullAssertion: non-null assertion because we just created the registry from the file we look up
    return reg.getFile(root.name);
}
function bootFileDescriptorProto(init) {
    const proto = Object.create({
        syntax: "",
        edition: 0
    });
    return Object.assign(proto, Object.assign(Object.assign({
        $typeName: "google.protobuf.FileDescriptorProto",
        dependency: [],
        publicDependency: [],
        weakDependency: [],
        optionDependency: [],
        service: [],
        extension: []
    }, init), {
        messageType: init.messageType.map(bootDescriptorProto),
        enumType: init.enumType.map(bootEnumDescriptorProto)
    }));
}
function bootDescriptorProto(init) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const proto = Object.create({
        visibility: 0
    });
    return Object.assign(proto, {
        $typeName: "google.protobuf.DescriptorProto",
        name: init.name,
        field: (_b = (_a = init.field) === null || _a === void 0 ? void 0 : _a.map(bootFieldDescriptorProto)) !== null && _b !== void 0 ? _b : [],
        extension: [],
        nestedType: (_d = (_c = init.nestedType) === null || _c === void 0 ? void 0 : _c.map(bootDescriptorProto)) !== null && _d !== void 0 ? _d : [],
        enumType: (_f = (_e = init.enumType) === null || _e === void 0 ? void 0 : _e.map(bootEnumDescriptorProto)) !== null && _f !== void 0 ? _f : [],
        extensionRange: (_h = (_g = init.extensionRange) === null || _g === void 0 ? void 0 : _g.map((e)=>Object.assign({
                $typeName: "google.protobuf.DescriptorProto.ExtensionRange"
            }, e))) !== null && _h !== void 0 ? _h : [],
        oneofDecl: [],
        reservedRange: [],
        reservedName: []
    });
}
function bootFieldDescriptorProto(init) {
    const proto = Object.create({
        label: 1,
        typeName: "",
        extendee: "",
        defaultValue: "",
        oneofIndex: 0,
        jsonName: "",
        proto3Optional: false
    });
    return Object.assign(proto, Object.assign(Object.assign({
        $typeName: "google.protobuf.FieldDescriptorProto"
    }, init), {
        options: init.options ? bootFieldOptions(init.options) : undefined
    }));
}
function bootFieldOptions(init) {
    var _a, _b, _c;
    const proto = Object.create({
        ctype: 0,
        packed: false,
        jstype: 0,
        lazy: false,
        unverifiedLazy: false,
        deprecated: false,
        weak: false,
        debugRedact: false,
        retention: 0
    });
    return Object.assign(proto, Object.assign(Object.assign({
        $typeName: "google.protobuf.FieldOptions"
    }, init), {
        targets: (_a = init.targets) !== null && _a !== void 0 ? _a : [],
        editionDefaults: (_c = (_b = init.editionDefaults) === null || _b === void 0 ? void 0 : _b.map((e)=>Object.assign({
                $typeName: "google.protobuf.FieldOptions.EditionDefault"
            }, e))) !== null && _c !== void 0 ? _c : [],
        uninterpretedOption: []
    }));
}
function bootEnumDescriptorProto(init) {
    const proto = Object.create({
        visibility: 0
    });
    return Object.assign(proto, {
        $typeName: "google.protobuf.EnumDescriptorProto",
        name: init.name,
        reservedName: [],
        reservedRange: [],
        value: init.value.map((e)=>Object.assign({
                $typeName: "google.protobuf.EnumValueDescriptorProto"
            }, e))
    });
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Hydrate a message descriptor.
 *
 * @private
 */ __turbopack_context__.s([
    "messageDesc",
    ()=>messageDesc
]);
function messageDesc(file, path, ...paths) {
    return paths.reduce((acc, cur)=>acc.nestedMessages[cur], file.messages[path]);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/enum.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Hydrate an enum descriptor.
 *
 * @private
 */ __turbopack_context__.s([
    "enumDesc",
    ()=>enumDesc,
    "tsEnum",
    ()=>tsEnum
]);
function enumDesc(file, path, ...paths) {
    if (paths.length == 0) {
        return file.enums[path];
    }
    const e = paths.pop(); // we checked length above
    return paths.reduce((acc, cur)=>acc.nestedMessages[cur], file.messages[path]).nestedEnums[e];
}
function tsEnum(desc) {
    const enumObject = {};
    for (const value of desc.values){
        enumObject[value.localName] = value.number;
        enumObject[value.number] = value.localName;
    }
    return enumObject;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/descriptor_pb.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DescriptorProtoSchema",
    ()=>DescriptorProtoSchema,
    "DescriptorProto_ExtensionRangeSchema",
    ()=>DescriptorProto_ExtensionRangeSchema,
    "DescriptorProto_ReservedRangeSchema",
    ()=>DescriptorProto_ReservedRangeSchema,
    "Edition",
    ()=>Edition,
    "EditionSchema",
    ()=>EditionSchema,
    "EnumDescriptorProtoSchema",
    ()=>EnumDescriptorProtoSchema,
    "EnumDescriptorProto_EnumReservedRangeSchema",
    ()=>EnumDescriptorProto_EnumReservedRangeSchema,
    "EnumOptionsSchema",
    ()=>EnumOptionsSchema,
    "EnumValueDescriptorProtoSchema",
    ()=>EnumValueDescriptorProtoSchema,
    "EnumValueOptionsSchema",
    ()=>EnumValueOptionsSchema,
    "ExtensionRangeOptionsSchema",
    ()=>ExtensionRangeOptionsSchema,
    "ExtensionRangeOptions_DeclarationSchema",
    ()=>ExtensionRangeOptions_DeclarationSchema,
    "ExtensionRangeOptions_VerificationState",
    ()=>ExtensionRangeOptions_VerificationState,
    "ExtensionRangeOptions_VerificationStateSchema",
    ()=>ExtensionRangeOptions_VerificationStateSchema,
    "FeatureSetDefaultsSchema",
    ()=>FeatureSetDefaultsSchema,
    "FeatureSetDefaults_FeatureSetEditionDefaultSchema",
    ()=>FeatureSetDefaults_FeatureSetEditionDefaultSchema,
    "FeatureSetSchema",
    ()=>FeatureSetSchema,
    "FeatureSet_EnforceNamingStyle",
    ()=>FeatureSet_EnforceNamingStyle,
    "FeatureSet_EnforceNamingStyleSchema",
    ()=>FeatureSet_EnforceNamingStyleSchema,
    "FeatureSet_EnumType",
    ()=>FeatureSet_EnumType,
    "FeatureSet_EnumTypeSchema",
    ()=>FeatureSet_EnumTypeSchema,
    "FeatureSet_FieldPresence",
    ()=>FeatureSet_FieldPresence,
    "FeatureSet_FieldPresenceSchema",
    ()=>FeatureSet_FieldPresenceSchema,
    "FeatureSet_JsonFormat",
    ()=>FeatureSet_JsonFormat,
    "FeatureSet_JsonFormatSchema",
    ()=>FeatureSet_JsonFormatSchema,
    "FeatureSet_MessageEncoding",
    ()=>FeatureSet_MessageEncoding,
    "FeatureSet_MessageEncodingSchema",
    ()=>FeatureSet_MessageEncodingSchema,
    "FeatureSet_RepeatedFieldEncoding",
    ()=>FeatureSet_RepeatedFieldEncoding,
    "FeatureSet_RepeatedFieldEncodingSchema",
    ()=>FeatureSet_RepeatedFieldEncodingSchema,
    "FeatureSet_Utf8Validation",
    ()=>FeatureSet_Utf8Validation,
    "FeatureSet_Utf8ValidationSchema",
    ()=>FeatureSet_Utf8ValidationSchema,
    "FeatureSet_VisibilityFeatureSchema",
    ()=>FeatureSet_VisibilityFeatureSchema,
    "FeatureSet_VisibilityFeature_DefaultSymbolVisibility",
    ()=>FeatureSet_VisibilityFeature_DefaultSymbolVisibility,
    "FeatureSet_VisibilityFeature_DefaultSymbolVisibilitySchema",
    ()=>FeatureSet_VisibilityFeature_DefaultSymbolVisibilitySchema,
    "FieldDescriptorProtoSchema",
    ()=>FieldDescriptorProtoSchema,
    "FieldDescriptorProto_Label",
    ()=>FieldDescriptorProto_Label,
    "FieldDescriptorProto_LabelSchema",
    ()=>FieldDescriptorProto_LabelSchema,
    "FieldDescriptorProto_Type",
    ()=>FieldDescriptorProto_Type,
    "FieldDescriptorProto_TypeSchema",
    ()=>FieldDescriptorProto_TypeSchema,
    "FieldOptionsSchema",
    ()=>FieldOptionsSchema,
    "FieldOptions_CType",
    ()=>FieldOptions_CType,
    "FieldOptions_CTypeSchema",
    ()=>FieldOptions_CTypeSchema,
    "FieldOptions_EditionDefaultSchema",
    ()=>FieldOptions_EditionDefaultSchema,
    "FieldOptions_FeatureSupportSchema",
    ()=>FieldOptions_FeatureSupportSchema,
    "FieldOptions_JSType",
    ()=>FieldOptions_JSType,
    "FieldOptions_JSTypeSchema",
    ()=>FieldOptions_JSTypeSchema,
    "FieldOptions_OptionRetention",
    ()=>FieldOptions_OptionRetention,
    "FieldOptions_OptionRetentionSchema",
    ()=>FieldOptions_OptionRetentionSchema,
    "FieldOptions_OptionTargetType",
    ()=>FieldOptions_OptionTargetType,
    "FieldOptions_OptionTargetTypeSchema",
    ()=>FieldOptions_OptionTargetTypeSchema,
    "FileDescriptorProtoSchema",
    ()=>FileDescriptorProtoSchema,
    "FileDescriptorSetSchema",
    ()=>FileDescriptorSetSchema,
    "FileOptionsSchema",
    ()=>FileOptionsSchema,
    "FileOptions_OptimizeMode",
    ()=>FileOptions_OptimizeMode,
    "FileOptions_OptimizeModeSchema",
    ()=>FileOptions_OptimizeModeSchema,
    "GeneratedCodeInfoSchema",
    ()=>GeneratedCodeInfoSchema,
    "GeneratedCodeInfo_AnnotationSchema",
    ()=>GeneratedCodeInfo_AnnotationSchema,
    "GeneratedCodeInfo_Annotation_Semantic",
    ()=>GeneratedCodeInfo_Annotation_Semantic,
    "GeneratedCodeInfo_Annotation_SemanticSchema",
    ()=>GeneratedCodeInfo_Annotation_SemanticSchema,
    "MessageOptionsSchema",
    ()=>MessageOptionsSchema,
    "MethodDescriptorProtoSchema",
    ()=>MethodDescriptorProtoSchema,
    "MethodOptionsSchema",
    ()=>MethodOptionsSchema,
    "MethodOptions_IdempotencyLevel",
    ()=>MethodOptions_IdempotencyLevel,
    "MethodOptions_IdempotencyLevelSchema",
    ()=>MethodOptions_IdempotencyLevelSchema,
    "OneofDescriptorProtoSchema",
    ()=>OneofDescriptorProtoSchema,
    "OneofOptionsSchema",
    ()=>OneofOptionsSchema,
    "ServiceDescriptorProtoSchema",
    ()=>ServiceDescriptorProtoSchema,
    "ServiceOptionsSchema",
    ()=>ServiceOptionsSchema,
    "SourceCodeInfoSchema",
    ()=>SourceCodeInfoSchema,
    "SourceCodeInfo_LocationSchema",
    ()=>SourceCodeInfo_LocationSchema,
    "SymbolVisibility",
    ()=>SymbolVisibility,
    "SymbolVisibilitySchema",
    ()=>SymbolVisibilitySchema,
    "UninterpretedOptionSchema",
    ()=>UninterpretedOptionSchema,
    "UninterpretedOption_NamePartSchema",
    ()=>UninterpretedOption_NamePartSchema,
    "file_google_protobuf_descriptor",
    ()=>file_google_protobuf_descriptor
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$boot$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/boot.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/enum.js [middleware] (ecmascript)");
;
;
;
const file_google_protobuf_descriptor = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$boot$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["boot"])({
    "name": "google/protobuf/descriptor.proto",
    "package": "google.protobuf",
    "messageType": [
        {
            "name": "FileDescriptorSet",
            "field": [
                {
                    "name": "file",
                    "number": 1,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.FileDescriptorProto"
                }
            ],
            "extensionRange": [
                {
                    "start": 536000000,
                    "end": 536000001
                }
            ]
        },
        {
            "name": "FileDescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "package",
                    "number": 2,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "dependency",
                    "number": 3,
                    "type": 9,
                    "label": 3
                },
                {
                    "name": "public_dependency",
                    "number": 10,
                    "type": 5,
                    "label": 3
                },
                {
                    "name": "weak_dependency",
                    "number": 11,
                    "type": 5,
                    "label": 3
                },
                {
                    "name": "option_dependency",
                    "number": 15,
                    "type": 9,
                    "label": 3
                },
                {
                    "name": "message_type",
                    "number": 4,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.DescriptorProto"
                },
                {
                    "name": "enum_type",
                    "number": 5,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.EnumDescriptorProto"
                },
                {
                    "name": "service",
                    "number": 6,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.ServiceDescriptorProto"
                },
                {
                    "name": "extension",
                    "number": 7,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.FieldDescriptorProto"
                },
                {
                    "name": "options",
                    "number": 8,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FileOptions"
                },
                {
                    "name": "source_code_info",
                    "number": 9,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.SourceCodeInfo"
                },
                {
                    "name": "syntax",
                    "number": 12,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "edition",
                    "number": 14,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.Edition"
                }
            ]
        },
        {
            "name": "DescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "field",
                    "number": 2,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.FieldDescriptorProto"
                },
                {
                    "name": "extension",
                    "number": 6,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.FieldDescriptorProto"
                },
                {
                    "name": "nested_type",
                    "number": 3,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.DescriptorProto"
                },
                {
                    "name": "enum_type",
                    "number": 4,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.EnumDescriptorProto"
                },
                {
                    "name": "extension_range",
                    "number": 5,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.DescriptorProto.ExtensionRange"
                },
                {
                    "name": "oneof_decl",
                    "number": 8,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.OneofDescriptorProto"
                },
                {
                    "name": "options",
                    "number": 7,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.MessageOptions"
                },
                {
                    "name": "reserved_range",
                    "number": 9,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.DescriptorProto.ReservedRange"
                },
                {
                    "name": "reserved_name",
                    "number": 10,
                    "type": 9,
                    "label": 3
                },
                {
                    "name": "visibility",
                    "number": 11,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.SymbolVisibility"
                }
            ],
            "nestedType": [
                {
                    "name": "ExtensionRange",
                    "field": [
                        {
                            "name": "start",
                            "number": 1,
                            "type": 5,
                            "label": 1
                        },
                        {
                            "name": "end",
                            "number": 2,
                            "type": 5,
                            "label": 1
                        },
                        {
                            "name": "options",
                            "number": 3,
                            "type": 11,
                            "label": 1,
                            "typeName": ".google.protobuf.ExtensionRangeOptions"
                        }
                    ]
                },
                {
                    "name": "ReservedRange",
                    "field": [
                        {
                            "name": "start",
                            "number": 1,
                            "type": 5,
                            "label": 1
                        },
                        {
                            "name": "end",
                            "number": 2,
                            "type": 5,
                            "label": 1
                        }
                    ]
                }
            ]
        },
        {
            "name": "ExtensionRangeOptions",
            "field": [
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                },
                {
                    "name": "declaration",
                    "number": 2,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.ExtensionRangeOptions.Declaration",
                    "options": {
                        "retention": 2
                    }
                },
                {
                    "name": "features",
                    "number": 50,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "verification",
                    "number": 3,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.ExtensionRangeOptions.VerificationState",
                    "defaultValue": "UNVERIFIED",
                    "options": {
                        "retention": 2
                    }
                }
            ],
            "nestedType": [
                {
                    "name": "Declaration",
                    "field": [
                        {
                            "name": "number",
                            "number": 1,
                            "type": 5,
                            "label": 1
                        },
                        {
                            "name": "full_name",
                            "number": 2,
                            "type": 9,
                            "label": 1
                        },
                        {
                            "name": "type",
                            "number": 3,
                            "type": 9,
                            "label": 1
                        },
                        {
                            "name": "reserved",
                            "number": 5,
                            "type": 8,
                            "label": 1
                        },
                        {
                            "name": "repeated",
                            "number": 6,
                            "type": 8,
                            "label": 1
                        }
                    ]
                }
            ],
            "enumType": [
                {
                    "name": "VerificationState",
                    "value": [
                        {
                            "name": "DECLARATION",
                            "number": 0
                        },
                        {
                            "name": "UNVERIFIED",
                            "number": 1
                        }
                    ]
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "FieldDescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "number",
                    "number": 3,
                    "type": 5,
                    "label": 1
                },
                {
                    "name": "label",
                    "number": 4,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldDescriptorProto.Label"
                },
                {
                    "name": "type",
                    "number": 5,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldDescriptorProto.Type"
                },
                {
                    "name": "type_name",
                    "number": 6,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "extendee",
                    "number": 2,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "default_value",
                    "number": 7,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "oneof_index",
                    "number": 9,
                    "type": 5,
                    "label": 1
                },
                {
                    "name": "json_name",
                    "number": 10,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "options",
                    "number": 8,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldOptions"
                },
                {
                    "name": "proto3_optional",
                    "number": 17,
                    "type": 8,
                    "label": 1
                }
            ],
            "enumType": [
                {
                    "name": "Type",
                    "value": [
                        {
                            "name": "TYPE_DOUBLE",
                            "number": 1
                        },
                        {
                            "name": "TYPE_FLOAT",
                            "number": 2
                        },
                        {
                            "name": "TYPE_INT64",
                            "number": 3
                        },
                        {
                            "name": "TYPE_UINT64",
                            "number": 4
                        },
                        {
                            "name": "TYPE_INT32",
                            "number": 5
                        },
                        {
                            "name": "TYPE_FIXED64",
                            "number": 6
                        },
                        {
                            "name": "TYPE_FIXED32",
                            "number": 7
                        },
                        {
                            "name": "TYPE_BOOL",
                            "number": 8
                        },
                        {
                            "name": "TYPE_STRING",
                            "number": 9
                        },
                        {
                            "name": "TYPE_GROUP",
                            "number": 10
                        },
                        {
                            "name": "TYPE_MESSAGE",
                            "number": 11
                        },
                        {
                            "name": "TYPE_BYTES",
                            "number": 12
                        },
                        {
                            "name": "TYPE_UINT32",
                            "number": 13
                        },
                        {
                            "name": "TYPE_ENUM",
                            "number": 14
                        },
                        {
                            "name": "TYPE_SFIXED32",
                            "number": 15
                        },
                        {
                            "name": "TYPE_SFIXED64",
                            "number": 16
                        },
                        {
                            "name": "TYPE_SINT32",
                            "number": 17
                        },
                        {
                            "name": "TYPE_SINT64",
                            "number": 18
                        }
                    ]
                },
                {
                    "name": "Label",
                    "value": [
                        {
                            "name": "LABEL_OPTIONAL",
                            "number": 1
                        },
                        {
                            "name": "LABEL_REPEATED",
                            "number": 3
                        },
                        {
                            "name": "LABEL_REQUIRED",
                            "number": 2
                        }
                    ]
                }
            ]
        },
        {
            "name": "OneofDescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "options",
                    "number": 2,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.OneofOptions"
                }
            ]
        },
        {
            "name": "EnumDescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "value",
                    "number": 2,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.EnumValueDescriptorProto"
                },
                {
                    "name": "options",
                    "number": 3,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.EnumOptions"
                },
                {
                    "name": "reserved_range",
                    "number": 4,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.EnumDescriptorProto.EnumReservedRange"
                },
                {
                    "name": "reserved_name",
                    "number": 5,
                    "type": 9,
                    "label": 3
                },
                {
                    "name": "visibility",
                    "number": 6,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.SymbolVisibility"
                }
            ],
            "nestedType": [
                {
                    "name": "EnumReservedRange",
                    "field": [
                        {
                            "name": "start",
                            "number": 1,
                            "type": 5,
                            "label": 1
                        },
                        {
                            "name": "end",
                            "number": 2,
                            "type": 5,
                            "label": 1
                        }
                    ]
                }
            ]
        },
        {
            "name": "EnumValueDescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "number",
                    "number": 2,
                    "type": 5,
                    "label": 1
                },
                {
                    "name": "options",
                    "number": 3,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.EnumValueOptions"
                }
            ]
        },
        {
            "name": "ServiceDescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "method",
                    "number": 2,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.MethodDescriptorProto"
                },
                {
                    "name": "options",
                    "number": 3,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.ServiceOptions"
                }
            ]
        },
        {
            "name": "MethodDescriptorProto",
            "field": [
                {
                    "name": "name",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "input_type",
                    "number": 2,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "output_type",
                    "number": 3,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "options",
                    "number": 4,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.MethodOptions"
                },
                {
                    "name": "client_streaming",
                    "number": 5,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "server_streaming",
                    "number": 6,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                }
            ]
        },
        {
            "name": "FileOptions",
            "field": [
                {
                    "name": "java_package",
                    "number": 1,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "java_outer_classname",
                    "number": 8,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "java_multiple_files",
                    "number": 10,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "java_generate_equals_and_hash",
                    "number": 20,
                    "type": 8,
                    "label": 1,
                    "options": {
                        "deprecated": true
                    }
                },
                {
                    "name": "java_string_check_utf8",
                    "number": 27,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "optimize_for",
                    "number": 9,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FileOptions.OptimizeMode",
                    "defaultValue": "SPEED"
                },
                {
                    "name": "go_package",
                    "number": 11,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "cc_generic_services",
                    "number": 16,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "java_generic_services",
                    "number": 17,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "py_generic_services",
                    "number": 18,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "deprecated",
                    "number": 23,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "cc_enable_arenas",
                    "number": 31,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "true"
                },
                {
                    "name": "objc_class_prefix",
                    "number": 36,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "csharp_namespace",
                    "number": 37,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "swift_prefix",
                    "number": 39,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "php_class_prefix",
                    "number": 40,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "php_namespace",
                    "number": 41,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "php_metadata_namespace",
                    "number": 44,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "ruby_package",
                    "number": 45,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "features",
                    "number": 50,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "enumType": [
                {
                    "name": "OptimizeMode",
                    "value": [
                        {
                            "name": "SPEED",
                            "number": 1
                        },
                        {
                            "name": "CODE_SIZE",
                            "number": 2
                        },
                        {
                            "name": "LITE_RUNTIME",
                            "number": 3
                        }
                    ]
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "MessageOptions",
            "field": [
                {
                    "name": "message_set_wire_format",
                    "number": 1,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "no_standard_descriptor_accessor",
                    "number": 2,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "deprecated",
                    "number": 3,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "map_entry",
                    "number": 7,
                    "type": 8,
                    "label": 1
                },
                {
                    "name": "deprecated_legacy_json_field_conflicts",
                    "number": 11,
                    "type": 8,
                    "label": 1,
                    "options": {
                        "deprecated": true
                    }
                },
                {
                    "name": "features",
                    "number": 12,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "FieldOptions",
            "field": [
                {
                    "name": "ctype",
                    "number": 1,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldOptions.CType",
                    "defaultValue": "STRING"
                },
                {
                    "name": "packed",
                    "number": 2,
                    "type": 8,
                    "label": 1
                },
                {
                    "name": "jstype",
                    "number": 6,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldOptions.JSType",
                    "defaultValue": "JS_NORMAL"
                },
                {
                    "name": "lazy",
                    "number": 5,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "unverified_lazy",
                    "number": 15,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "deprecated",
                    "number": 3,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "weak",
                    "number": 10,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false",
                    "options": {
                        "deprecated": true
                    }
                },
                {
                    "name": "debug_redact",
                    "number": 16,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "retention",
                    "number": 17,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldOptions.OptionRetention"
                },
                {
                    "name": "targets",
                    "number": 19,
                    "type": 14,
                    "label": 3,
                    "typeName": ".google.protobuf.FieldOptions.OptionTargetType"
                },
                {
                    "name": "edition_defaults",
                    "number": 20,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.FieldOptions.EditionDefault"
                },
                {
                    "name": "features",
                    "number": 21,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "feature_support",
                    "number": 22,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldOptions.FeatureSupport"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "nestedType": [
                {
                    "name": "EditionDefault",
                    "field": [
                        {
                            "name": "edition",
                            "number": 3,
                            "type": 14,
                            "label": 1,
                            "typeName": ".google.protobuf.Edition"
                        },
                        {
                            "name": "value",
                            "number": 2,
                            "type": 9,
                            "label": 1
                        }
                    ]
                },
                {
                    "name": "FeatureSupport",
                    "field": [
                        {
                            "name": "edition_introduced",
                            "number": 1,
                            "type": 14,
                            "label": 1,
                            "typeName": ".google.protobuf.Edition"
                        },
                        {
                            "name": "edition_deprecated",
                            "number": 2,
                            "type": 14,
                            "label": 1,
                            "typeName": ".google.protobuf.Edition"
                        },
                        {
                            "name": "deprecation_warning",
                            "number": 3,
                            "type": 9,
                            "label": 1
                        },
                        {
                            "name": "edition_removed",
                            "number": 4,
                            "type": 14,
                            "label": 1,
                            "typeName": ".google.protobuf.Edition"
                        }
                    ]
                }
            ],
            "enumType": [
                {
                    "name": "CType",
                    "value": [
                        {
                            "name": "STRING",
                            "number": 0
                        },
                        {
                            "name": "CORD",
                            "number": 1
                        },
                        {
                            "name": "STRING_PIECE",
                            "number": 2
                        }
                    ]
                },
                {
                    "name": "JSType",
                    "value": [
                        {
                            "name": "JS_NORMAL",
                            "number": 0
                        },
                        {
                            "name": "JS_STRING",
                            "number": 1
                        },
                        {
                            "name": "JS_NUMBER",
                            "number": 2
                        }
                    ]
                },
                {
                    "name": "OptionRetention",
                    "value": [
                        {
                            "name": "RETENTION_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "RETENTION_RUNTIME",
                            "number": 1
                        },
                        {
                            "name": "RETENTION_SOURCE",
                            "number": 2
                        }
                    ]
                },
                {
                    "name": "OptionTargetType",
                    "value": [
                        {
                            "name": "TARGET_TYPE_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "TARGET_TYPE_FILE",
                            "number": 1
                        },
                        {
                            "name": "TARGET_TYPE_EXTENSION_RANGE",
                            "number": 2
                        },
                        {
                            "name": "TARGET_TYPE_MESSAGE",
                            "number": 3
                        },
                        {
                            "name": "TARGET_TYPE_FIELD",
                            "number": 4
                        },
                        {
                            "name": "TARGET_TYPE_ONEOF",
                            "number": 5
                        },
                        {
                            "name": "TARGET_TYPE_ENUM",
                            "number": 6
                        },
                        {
                            "name": "TARGET_TYPE_ENUM_ENTRY",
                            "number": 7
                        },
                        {
                            "name": "TARGET_TYPE_SERVICE",
                            "number": 8
                        },
                        {
                            "name": "TARGET_TYPE_METHOD",
                            "number": 9
                        }
                    ]
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "OneofOptions",
            "field": [
                {
                    "name": "features",
                    "number": 1,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "EnumOptions",
            "field": [
                {
                    "name": "allow_alias",
                    "number": 2,
                    "type": 8,
                    "label": 1
                },
                {
                    "name": "deprecated",
                    "number": 3,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "deprecated_legacy_json_field_conflicts",
                    "number": 6,
                    "type": 8,
                    "label": 1,
                    "options": {
                        "deprecated": true
                    }
                },
                {
                    "name": "features",
                    "number": 7,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "EnumValueOptions",
            "field": [
                {
                    "name": "deprecated",
                    "number": 1,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "features",
                    "number": 2,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "debug_redact",
                    "number": 3,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "feature_support",
                    "number": 4,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FieldOptions.FeatureSupport"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "ServiceOptions",
            "field": [
                {
                    "name": "features",
                    "number": 34,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "deprecated",
                    "number": 33,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "MethodOptions",
            "field": [
                {
                    "name": "deprecated",
                    "number": 33,
                    "type": 8,
                    "label": 1,
                    "defaultValue": "false"
                },
                {
                    "name": "idempotency_level",
                    "number": 34,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.MethodOptions.IdempotencyLevel",
                    "defaultValue": "IDEMPOTENCY_UNKNOWN"
                },
                {
                    "name": "features",
                    "number": 35,
                    "type": 11,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet"
                },
                {
                    "name": "uninterpreted_option",
                    "number": 999,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption"
                }
            ],
            "enumType": [
                {
                    "name": "IdempotencyLevel",
                    "value": [
                        {
                            "name": "IDEMPOTENCY_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "NO_SIDE_EFFECTS",
                            "number": 1
                        },
                        {
                            "name": "IDEMPOTENT",
                            "number": 2
                        }
                    ]
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 536870912
                }
            ]
        },
        {
            "name": "UninterpretedOption",
            "field": [
                {
                    "name": "name",
                    "number": 2,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.UninterpretedOption.NamePart"
                },
                {
                    "name": "identifier_value",
                    "number": 3,
                    "type": 9,
                    "label": 1
                },
                {
                    "name": "positive_int_value",
                    "number": 4,
                    "type": 4,
                    "label": 1
                },
                {
                    "name": "negative_int_value",
                    "number": 5,
                    "type": 3,
                    "label": 1
                },
                {
                    "name": "double_value",
                    "number": 6,
                    "type": 1,
                    "label": 1
                },
                {
                    "name": "string_value",
                    "number": 7,
                    "type": 12,
                    "label": 1
                },
                {
                    "name": "aggregate_value",
                    "number": 8,
                    "type": 9,
                    "label": 1
                }
            ],
            "nestedType": [
                {
                    "name": "NamePart",
                    "field": [
                        {
                            "name": "name_part",
                            "number": 1,
                            "type": 9,
                            "label": 2
                        },
                        {
                            "name": "is_extension",
                            "number": 2,
                            "type": 8,
                            "label": 2
                        }
                    ]
                }
            ]
        },
        {
            "name": "FeatureSet",
            "field": [
                {
                    "name": "field_presence",
                    "number": 1,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.FieldPresence",
                    "options": {
                        "retention": 1,
                        "targets": [
                            4,
                            1
                        ],
                        "editionDefaults": [
                            {
                                "value": "EXPLICIT",
                                "edition": 900
                            },
                            {
                                "value": "IMPLICIT",
                                "edition": 999
                            },
                            {
                                "value": "EXPLICIT",
                                "edition": 1000
                            }
                        ]
                    }
                },
                {
                    "name": "enum_type",
                    "number": 2,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.EnumType",
                    "options": {
                        "retention": 1,
                        "targets": [
                            6,
                            1
                        ],
                        "editionDefaults": [
                            {
                                "value": "CLOSED",
                                "edition": 900
                            },
                            {
                                "value": "OPEN",
                                "edition": 999
                            }
                        ]
                    }
                },
                {
                    "name": "repeated_field_encoding",
                    "number": 3,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.RepeatedFieldEncoding",
                    "options": {
                        "retention": 1,
                        "targets": [
                            4,
                            1
                        ],
                        "editionDefaults": [
                            {
                                "value": "EXPANDED",
                                "edition": 900
                            },
                            {
                                "value": "PACKED",
                                "edition": 999
                            }
                        ]
                    }
                },
                {
                    "name": "utf8_validation",
                    "number": 4,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.Utf8Validation",
                    "options": {
                        "retention": 1,
                        "targets": [
                            4,
                            1
                        ],
                        "editionDefaults": [
                            {
                                "value": "NONE",
                                "edition": 900
                            },
                            {
                                "value": "VERIFY",
                                "edition": 999
                            }
                        ]
                    }
                },
                {
                    "name": "message_encoding",
                    "number": 5,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.MessageEncoding",
                    "options": {
                        "retention": 1,
                        "targets": [
                            4,
                            1
                        ],
                        "editionDefaults": [
                            {
                                "value": "LENGTH_PREFIXED",
                                "edition": 900
                            }
                        ]
                    }
                },
                {
                    "name": "json_format",
                    "number": 6,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.JsonFormat",
                    "options": {
                        "retention": 1,
                        "targets": [
                            3,
                            6,
                            1
                        ],
                        "editionDefaults": [
                            {
                                "value": "LEGACY_BEST_EFFORT",
                                "edition": 900
                            },
                            {
                                "value": "ALLOW",
                                "edition": 999
                            }
                        ]
                    }
                },
                {
                    "name": "enforce_naming_style",
                    "number": 7,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.EnforceNamingStyle",
                    "options": {
                        "retention": 2,
                        "targets": [
                            1,
                            2,
                            3,
                            4,
                            5,
                            6,
                            7,
                            8,
                            9
                        ],
                        "editionDefaults": [
                            {
                                "value": "STYLE_LEGACY",
                                "edition": 900
                            },
                            {
                                "value": "STYLE2024",
                                "edition": 1001
                            }
                        ]
                    }
                },
                {
                    "name": "default_symbol_visibility",
                    "number": 8,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.FeatureSet.VisibilityFeature.DefaultSymbolVisibility",
                    "options": {
                        "retention": 2,
                        "targets": [
                            1
                        ],
                        "editionDefaults": [
                            {
                                "value": "EXPORT_ALL",
                                "edition": 900
                            },
                            {
                                "value": "EXPORT_TOP_LEVEL",
                                "edition": 1001
                            }
                        ]
                    }
                }
            ],
            "nestedType": [
                {
                    "name": "VisibilityFeature",
                    "enumType": [
                        {
                            "name": "DefaultSymbolVisibility",
                            "value": [
                                {
                                    "name": "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN",
                                    "number": 0
                                },
                                {
                                    "name": "EXPORT_ALL",
                                    "number": 1
                                },
                                {
                                    "name": "EXPORT_TOP_LEVEL",
                                    "number": 2
                                },
                                {
                                    "name": "LOCAL_ALL",
                                    "number": 3
                                },
                                {
                                    "name": "STRICT",
                                    "number": 4
                                }
                            ]
                        }
                    ]
                }
            ],
            "enumType": [
                {
                    "name": "FieldPresence",
                    "value": [
                        {
                            "name": "FIELD_PRESENCE_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "EXPLICIT",
                            "number": 1
                        },
                        {
                            "name": "IMPLICIT",
                            "number": 2
                        },
                        {
                            "name": "LEGACY_REQUIRED",
                            "number": 3
                        }
                    ]
                },
                {
                    "name": "EnumType",
                    "value": [
                        {
                            "name": "ENUM_TYPE_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "OPEN",
                            "number": 1
                        },
                        {
                            "name": "CLOSED",
                            "number": 2
                        }
                    ]
                },
                {
                    "name": "RepeatedFieldEncoding",
                    "value": [
                        {
                            "name": "REPEATED_FIELD_ENCODING_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "PACKED",
                            "number": 1
                        },
                        {
                            "name": "EXPANDED",
                            "number": 2
                        }
                    ]
                },
                {
                    "name": "Utf8Validation",
                    "value": [
                        {
                            "name": "UTF8_VALIDATION_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "VERIFY",
                            "number": 2
                        },
                        {
                            "name": "NONE",
                            "number": 3
                        }
                    ]
                },
                {
                    "name": "MessageEncoding",
                    "value": [
                        {
                            "name": "MESSAGE_ENCODING_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "LENGTH_PREFIXED",
                            "number": 1
                        },
                        {
                            "name": "DELIMITED",
                            "number": 2
                        }
                    ]
                },
                {
                    "name": "JsonFormat",
                    "value": [
                        {
                            "name": "JSON_FORMAT_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "ALLOW",
                            "number": 1
                        },
                        {
                            "name": "LEGACY_BEST_EFFORT",
                            "number": 2
                        }
                    ]
                },
                {
                    "name": "EnforceNamingStyle",
                    "value": [
                        {
                            "name": "ENFORCE_NAMING_STYLE_UNKNOWN",
                            "number": 0
                        },
                        {
                            "name": "STYLE2024",
                            "number": 1
                        },
                        {
                            "name": "STYLE_LEGACY",
                            "number": 2
                        }
                    ]
                }
            ],
            "extensionRange": [
                {
                    "start": 1000,
                    "end": 9995
                },
                {
                    "start": 9995,
                    "end": 10000
                },
                {
                    "start": 10000,
                    "end": 10001
                }
            ]
        },
        {
            "name": "FeatureSetDefaults",
            "field": [
                {
                    "name": "defaults",
                    "number": 1,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.FeatureSetDefaults.FeatureSetEditionDefault"
                },
                {
                    "name": "minimum_edition",
                    "number": 4,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.Edition"
                },
                {
                    "name": "maximum_edition",
                    "number": 5,
                    "type": 14,
                    "label": 1,
                    "typeName": ".google.protobuf.Edition"
                }
            ],
            "nestedType": [
                {
                    "name": "FeatureSetEditionDefault",
                    "field": [
                        {
                            "name": "edition",
                            "number": 3,
                            "type": 14,
                            "label": 1,
                            "typeName": ".google.protobuf.Edition"
                        },
                        {
                            "name": "overridable_features",
                            "number": 4,
                            "type": 11,
                            "label": 1,
                            "typeName": ".google.protobuf.FeatureSet"
                        },
                        {
                            "name": "fixed_features",
                            "number": 5,
                            "type": 11,
                            "label": 1,
                            "typeName": ".google.protobuf.FeatureSet"
                        }
                    ]
                }
            ]
        },
        {
            "name": "SourceCodeInfo",
            "field": [
                {
                    "name": "location",
                    "number": 1,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.SourceCodeInfo.Location"
                }
            ],
            "nestedType": [
                {
                    "name": "Location",
                    "field": [
                        {
                            "name": "path",
                            "number": 1,
                            "type": 5,
                            "label": 3,
                            "options": {
                                "packed": true
                            }
                        },
                        {
                            "name": "span",
                            "number": 2,
                            "type": 5,
                            "label": 3,
                            "options": {
                                "packed": true
                            }
                        },
                        {
                            "name": "leading_comments",
                            "number": 3,
                            "type": 9,
                            "label": 1
                        },
                        {
                            "name": "trailing_comments",
                            "number": 4,
                            "type": 9,
                            "label": 1
                        },
                        {
                            "name": "leading_detached_comments",
                            "number": 6,
                            "type": 9,
                            "label": 3
                        }
                    ]
                }
            ],
            "extensionRange": [
                {
                    "start": 536000000,
                    "end": 536000001
                }
            ]
        },
        {
            "name": "GeneratedCodeInfo",
            "field": [
                {
                    "name": "annotation",
                    "number": 1,
                    "type": 11,
                    "label": 3,
                    "typeName": ".google.protobuf.GeneratedCodeInfo.Annotation"
                }
            ],
            "nestedType": [
                {
                    "name": "Annotation",
                    "field": [
                        {
                            "name": "path",
                            "number": 1,
                            "type": 5,
                            "label": 3,
                            "options": {
                                "packed": true
                            }
                        },
                        {
                            "name": "source_file",
                            "number": 2,
                            "type": 9,
                            "label": 1
                        },
                        {
                            "name": "begin",
                            "number": 3,
                            "type": 5,
                            "label": 1
                        },
                        {
                            "name": "end",
                            "number": 4,
                            "type": 5,
                            "label": 1
                        },
                        {
                            "name": "semantic",
                            "number": 5,
                            "type": 14,
                            "label": 1,
                            "typeName": ".google.protobuf.GeneratedCodeInfo.Annotation.Semantic"
                        }
                    ],
                    "enumType": [
                        {
                            "name": "Semantic",
                            "value": [
                                {
                                    "name": "NONE",
                                    "number": 0
                                },
                                {
                                    "name": "SET",
                                    "number": 1
                                },
                                {
                                    "name": "ALIAS",
                                    "number": 2
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ],
    "enumType": [
        {
            "name": "Edition",
            "value": [
                {
                    "name": "EDITION_UNKNOWN",
                    "number": 0
                },
                {
                    "name": "EDITION_LEGACY",
                    "number": 900
                },
                {
                    "name": "EDITION_PROTO2",
                    "number": 998
                },
                {
                    "name": "EDITION_PROTO3",
                    "number": 999
                },
                {
                    "name": "EDITION_2023",
                    "number": 1000
                },
                {
                    "name": "EDITION_2024",
                    "number": 1001
                },
                {
                    "name": "EDITION_UNSTABLE",
                    "number": 9999
                },
                {
                    "name": "EDITION_1_TEST_ONLY",
                    "number": 1
                },
                {
                    "name": "EDITION_2_TEST_ONLY",
                    "number": 2
                },
                {
                    "name": "EDITION_99997_TEST_ONLY",
                    "number": 99997
                },
                {
                    "name": "EDITION_99998_TEST_ONLY",
                    "number": 99998
                },
                {
                    "name": "EDITION_99999_TEST_ONLY",
                    "number": 99999
                },
                {
                    "name": "EDITION_MAX",
                    "number": 2147483647
                }
            ]
        },
        {
            "name": "SymbolVisibility",
            "value": [
                {
                    "name": "VISIBILITY_UNSET",
                    "number": 0
                },
                {
                    "name": "VISIBILITY_LOCAL",
                    "number": 1
                },
                {
                    "name": "VISIBILITY_EXPORT",
                    "number": 2
                }
            ]
        }
    ]
});
const FileDescriptorSetSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 0);
const FileDescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 1);
const DescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 2);
const DescriptorProto_ExtensionRangeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 2, 0);
const DescriptorProto_ReservedRangeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 2, 1);
const ExtensionRangeOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 3);
const ExtensionRangeOptions_DeclarationSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 3, 0);
var ExtensionRangeOptions_VerificationState;
(function(ExtensionRangeOptions_VerificationState) {
    /**
     * All the extensions of the range must be declared.
     *
     * @generated from enum value: DECLARATION = 0;
     */ ExtensionRangeOptions_VerificationState[ExtensionRangeOptions_VerificationState["DECLARATION"] = 0] = "DECLARATION";
    /**
     * @generated from enum value: UNVERIFIED = 1;
     */ ExtensionRangeOptions_VerificationState[ExtensionRangeOptions_VerificationState["UNVERIFIED"] = 1] = "UNVERIFIED";
})(ExtensionRangeOptions_VerificationState || (ExtensionRangeOptions_VerificationState = {}));
const ExtensionRangeOptions_VerificationStateSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 3, 0);
const FieldDescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 4);
var FieldDescriptorProto_Type;
(function(FieldDescriptorProto_Type) {
    /**
     * 0 is reserved for errors.
     * Order is weird for historical reasons.
     *
     * @generated from enum value: TYPE_DOUBLE = 1;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["DOUBLE"] = 1] = "DOUBLE";
    /**
     * @generated from enum value: TYPE_FLOAT = 2;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["FLOAT"] = 2] = "FLOAT";
    /**
     * Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT64 if
     * negative values are likely.
     *
     * @generated from enum value: TYPE_INT64 = 3;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["INT64"] = 3] = "INT64";
    /**
     * @generated from enum value: TYPE_UINT64 = 4;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["UINT64"] = 4] = "UINT64";
    /**
     * Not ZigZag encoded.  Negative numbers take 10 bytes.  Use TYPE_SINT32 if
     * negative values are likely.
     *
     * @generated from enum value: TYPE_INT32 = 5;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["INT32"] = 5] = "INT32";
    /**
     * @generated from enum value: TYPE_FIXED64 = 6;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["FIXED64"] = 6] = "FIXED64";
    /**
     * @generated from enum value: TYPE_FIXED32 = 7;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["FIXED32"] = 7] = "FIXED32";
    /**
     * @generated from enum value: TYPE_BOOL = 8;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["BOOL"] = 8] = "BOOL";
    /**
     * @generated from enum value: TYPE_STRING = 9;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["STRING"] = 9] = "STRING";
    /**
     * Tag-delimited aggregate.
     * Group type is deprecated and not supported after google.protobuf. However, Proto3
     * implementations should still be able to parse the group wire format and
     * treat group fields as unknown fields.  In Editions, the group wire format
     * can be enabled via the `message_encoding` feature.
     *
     * @generated from enum value: TYPE_GROUP = 10;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["GROUP"] = 10] = "GROUP";
    /**
     * Length-delimited aggregate.
     *
     * @generated from enum value: TYPE_MESSAGE = 11;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["MESSAGE"] = 11] = "MESSAGE";
    /**
     * New in version 2.
     *
     * @generated from enum value: TYPE_BYTES = 12;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["BYTES"] = 12] = "BYTES";
    /**
     * @generated from enum value: TYPE_UINT32 = 13;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["UINT32"] = 13] = "UINT32";
    /**
     * @generated from enum value: TYPE_ENUM = 14;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["ENUM"] = 14] = "ENUM";
    /**
     * @generated from enum value: TYPE_SFIXED32 = 15;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["SFIXED32"] = 15] = "SFIXED32";
    /**
     * @generated from enum value: TYPE_SFIXED64 = 16;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["SFIXED64"] = 16] = "SFIXED64";
    /**
     * Uses ZigZag encoding.
     *
     * @generated from enum value: TYPE_SINT32 = 17;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["SINT32"] = 17] = "SINT32";
    /**
     * Uses ZigZag encoding.
     *
     * @generated from enum value: TYPE_SINT64 = 18;
     */ FieldDescriptorProto_Type[FieldDescriptorProto_Type["SINT64"] = 18] = "SINT64";
})(FieldDescriptorProto_Type || (FieldDescriptorProto_Type = {}));
const FieldDescriptorProto_TypeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 4, 0);
var FieldDescriptorProto_Label;
(function(FieldDescriptorProto_Label) {
    /**
     * 0 is reserved for errors
     *
     * @generated from enum value: LABEL_OPTIONAL = 1;
     */ FieldDescriptorProto_Label[FieldDescriptorProto_Label["OPTIONAL"] = 1] = "OPTIONAL";
    /**
     * @generated from enum value: LABEL_REPEATED = 3;
     */ FieldDescriptorProto_Label[FieldDescriptorProto_Label["REPEATED"] = 3] = "REPEATED";
    /**
     * The required label is only allowed in google.protobuf.  In proto3 and Editions
     * it's explicitly prohibited.  In Editions, the `field_presence` feature
     * can be used to get this behavior.
     *
     * @generated from enum value: LABEL_REQUIRED = 2;
     */ FieldDescriptorProto_Label[FieldDescriptorProto_Label["REQUIRED"] = 2] = "REQUIRED";
})(FieldDescriptorProto_Label || (FieldDescriptorProto_Label = {}));
const FieldDescriptorProto_LabelSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 4, 1);
const OneofDescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 5);
const EnumDescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 6);
const EnumDescriptorProto_EnumReservedRangeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 6, 0);
const EnumValueDescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 7);
const ServiceDescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 8);
const MethodDescriptorProtoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 9);
const FileOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 10);
var FileOptions_OptimizeMode;
(function(FileOptions_OptimizeMode) {
    /**
     * Generate complete code for parsing, serialization,
     *
     * @generated from enum value: SPEED = 1;
     */ FileOptions_OptimizeMode[FileOptions_OptimizeMode["SPEED"] = 1] = "SPEED";
    /**
     * etc.
     *
     * Use ReflectionOps to implement these methods.
     *
     * @generated from enum value: CODE_SIZE = 2;
     */ FileOptions_OptimizeMode[FileOptions_OptimizeMode["CODE_SIZE"] = 2] = "CODE_SIZE";
    /**
     * Generate code using MessageLite and the lite runtime.
     *
     * @generated from enum value: LITE_RUNTIME = 3;
     */ FileOptions_OptimizeMode[FileOptions_OptimizeMode["LITE_RUNTIME"] = 3] = "LITE_RUNTIME";
})(FileOptions_OptimizeMode || (FileOptions_OptimizeMode = {}));
const FileOptions_OptimizeModeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 10, 0);
const MessageOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 11);
const FieldOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 12);
const FieldOptions_EditionDefaultSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 12, 0);
const FieldOptions_FeatureSupportSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 12, 1);
var FieldOptions_CType;
(function(FieldOptions_CType) {
    /**
     * Default mode.
     *
     * @generated from enum value: STRING = 0;
     */ FieldOptions_CType[FieldOptions_CType["STRING"] = 0] = "STRING";
    /**
     * The option [ctype=CORD] may be applied to a non-repeated field of type
     * "bytes". It indicates that in C++, the data should be stored in a Cord
     * instead of a string.  For very large strings, this may reduce memory
     * fragmentation. It may also allow better performance when parsing from a
     * Cord, or when parsing with aliasing enabled, as the parsed Cord may then
     * alias the original buffer.
     *
     * @generated from enum value: CORD = 1;
     */ FieldOptions_CType[FieldOptions_CType["CORD"] = 1] = "CORD";
    /**
     * @generated from enum value: STRING_PIECE = 2;
     */ FieldOptions_CType[FieldOptions_CType["STRING_PIECE"] = 2] = "STRING_PIECE";
})(FieldOptions_CType || (FieldOptions_CType = {}));
const FieldOptions_CTypeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 12, 0);
var FieldOptions_JSType;
(function(FieldOptions_JSType) {
    /**
     * Use the default type.
     *
     * @generated from enum value: JS_NORMAL = 0;
     */ FieldOptions_JSType[FieldOptions_JSType["JS_NORMAL"] = 0] = "JS_NORMAL";
    /**
     * Use JavaScript strings.
     *
     * @generated from enum value: JS_STRING = 1;
     */ FieldOptions_JSType[FieldOptions_JSType["JS_STRING"] = 1] = "JS_STRING";
    /**
     * Use JavaScript numbers.
     *
     * @generated from enum value: JS_NUMBER = 2;
     */ FieldOptions_JSType[FieldOptions_JSType["JS_NUMBER"] = 2] = "JS_NUMBER";
})(FieldOptions_JSType || (FieldOptions_JSType = {}));
const FieldOptions_JSTypeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 12, 1);
var FieldOptions_OptionRetention;
(function(FieldOptions_OptionRetention) {
    /**
     * @generated from enum value: RETENTION_UNKNOWN = 0;
     */ FieldOptions_OptionRetention[FieldOptions_OptionRetention["RETENTION_UNKNOWN"] = 0] = "RETENTION_UNKNOWN";
    /**
     * @generated from enum value: RETENTION_RUNTIME = 1;
     */ FieldOptions_OptionRetention[FieldOptions_OptionRetention["RETENTION_RUNTIME"] = 1] = "RETENTION_RUNTIME";
    /**
     * @generated from enum value: RETENTION_SOURCE = 2;
     */ FieldOptions_OptionRetention[FieldOptions_OptionRetention["RETENTION_SOURCE"] = 2] = "RETENTION_SOURCE";
})(FieldOptions_OptionRetention || (FieldOptions_OptionRetention = {}));
const FieldOptions_OptionRetentionSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 12, 2);
var FieldOptions_OptionTargetType;
(function(FieldOptions_OptionTargetType) {
    /**
     * @generated from enum value: TARGET_TYPE_UNKNOWN = 0;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_UNKNOWN"] = 0] = "TARGET_TYPE_UNKNOWN";
    /**
     * @generated from enum value: TARGET_TYPE_FILE = 1;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_FILE"] = 1] = "TARGET_TYPE_FILE";
    /**
     * @generated from enum value: TARGET_TYPE_EXTENSION_RANGE = 2;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_EXTENSION_RANGE"] = 2] = "TARGET_TYPE_EXTENSION_RANGE";
    /**
     * @generated from enum value: TARGET_TYPE_MESSAGE = 3;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_MESSAGE"] = 3] = "TARGET_TYPE_MESSAGE";
    /**
     * @generated from enum value: TARGET_TYPE_FIELD = 4;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_FIELD"] = 4] = "TARGET_TYPE_FIELD";
    /**
     * @generated from enum value: TARGET_TYPE_ONEOF = 5;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_ONEOF"] = 5] = "TARGET_TYPE_ONEOF";
    /**
     * @generated from enum value: TARGET_TYPE_ENUM = 6;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_ENUM"] = 6] = "TARGET_TYPE_ENUM";
    /**
     * @generated from enum value: TARGET_TYPE_ENUM_ENTRY = 7;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_ENUM_ENTRY"] = 7] = "TARGET_TYPE_ENUM_ENTRY";
    /**
     * @generated from enum value: TARGET_TYPE_SERVICE = 8;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_SERVICE"] = 8] = "TARGET_TYPE_SERVICE";
    /**
     * @generated from enum value: TARGET_TYPE_METHOD = 9;
     */ FieldOptions_OptionTargetType[FieldOptions_OptionTargetType["TARGET_TYPE_METHOD"] = 9] = "TARGET_TYPE_METHOD";
})(FieldOptions_OptionTargetType || (FieldOptions_OptionTargetType = {}));
const FieldOptions_OptionTargetTypeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 12, 3);
const OneofOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 13);
const EnumOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 14);
const EnumValueOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 15);
const ServiceOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 16);
const MethodOptionsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 17);
var MethodOptions_IdempotencyLevel;
(function(MethodOptions_IdempotencyLevel) {
    /**
     * @generated from enum value: IDEMPOTENCY_UNKNOWN = 0;
     */ MethodOptions_IdempotencyLevel[MethodOptions_IdempotencyLevel["IDEMPOTENCY_UNKNOWN"] = 0] = "IDEMPOTENCY_UNKNOWN";
    /**
     * implies idempotent
     *
     * @generated from enum value: NO_SIDE_EFFECTS = 1;
     */ MethodOptions_IdempotencyLevel[MethodOptions_IdempotencyLevel["NO_SIDE_EFFECTS"] = 1] = "NO_SIDE_EFFECTS";
    /**
     * idempotent, but may have side effects
     *
     * @generated from enum value: IDEMPOTENT = 2;
     */ MethodOptions_IdempotencyLevel[MethodOptions_IdempotencyLevel["IDEMPOTENT"] = 2] = "IDEMPOTENT";
})(MethodOptions_IdempotencyLevel || (MethodOptions_IdempotencyLevel = {}));
const MethodOptions_IdempotencyLevelSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 17, 0);
const UninterpretedOptionSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 18);
const UninterpretedOption_NamePartSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 18, 0);
const FeatureSetSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 19);
const FeatureSet_VisibilityFeatureSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 19, 0);
var FeatureSet_VisibilityFeature_DefaultSymbolVisibility;
(function(FeatureSet_VisibilityFeature_DefaultSymbolVisibility) {
    /**
     * @generated from enum value: DEFAULT_SYMBOL_VISIBILITY_UNKNOWN = 0;
     */ FeatureSet_VisibilityFeature_DefaultSymbolVisibility[FeatureSet_VisibilityFeature_DefaultSymbolVisibility["DEFAULT_SYMBOL_VISIBILITY_UNKNOWN"] = 0] = "DEFAULT_SYMBOL_VISIBILITY_UNKNOWN";
    /**
     * Default pre-EDITION_2024, all UNSET visibility are export.
     *
     * @generated from enum value: EXPORT_ALL = 1;
     */ FeatureSet_VisibilityFeature_DefaultSymbolVisibility[FeatureSet_VisibilityFeature_DefaultSymbolVisibility["EXPORT_ALL"] = 1] = "EXPORT_ALL";
    /**
     * All top-level symbols default to export, nested default to local.
     *
     * @generated from enum value: EXPORT_TOP_LEVEL = 2;
     */ FeatureSet_VisibilityFeature_DefaultSymbolVisibility[FeatureSet_VisibilityFeature_DefaultSymbolVisibility["EXPORT_TOP_LEVEL"] = 2] = "EXPORT_TOP_LEVEL";
    /**
     * All symbols default to local.
     *
     * @generated from enum value: LOCAL_ALL = 3;
     */ FeatureSet_VisibilityFeature_DefaultSymbolVisibility[FeatureSet_VisibilityFeature_DefaultSymbolVisibility["LOCAL_ALL"] = 3] = "LOCAL_ALL";
    /**
     * All symbols local by default. Nested types cannot be exported.
     * With special case caveat for message { enum {} reserved 1 to max; }
     * This is the recommended setting for new protos.
     *
     * @generated from enum value: STRICT = 4;
     */ FeatureSet_VisibilityFeature_DefaultSymbolVisibility[FeatureSet_VisibilityFeature_DefaultSymbolVisibility["STRICT"] = 4] = "STRICT";
})(FeatureSet_VisibilityFeature_DefaultSymbolVisibility || (FeatureSet_VisibilityFeature_DefaultSymbolVisibility = {}));
const FeatureSet_VisibilityFeature_DefaultSymbolVisibilitySchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 0, 0);
var FeatureSet_FieldPresence;
(function(FeatureSet_FieldPresence) {
    /**
     * @generated from enum value: FIELD_PRESENCE_UNKNOWN = 0;
     */ FeatureSet_FieldPresence[FeatureSet_FieldPresence["FIELD_PRESENCE_UNKNOWN"] = 0] = "FIELD_PRESENCE_UNKNOWN";
    /**
     * @generated from enum value: EXPLICIT = 1;
     */ FeatureSet_FieldPresence[FeatureSet_FieldPresence["EXPLICIT"] = 1] = "EXPLICIT";
    /**
     * @generated from enum value: IMPLICIT = 2;
     */ FeatureSet_FieldPresence[FeatureSet_FieldPresence["IMPLICIT"] = 2] = "IMPLICIT";
    /**
     * @generated from enum value: LEGACY_REQUIRED = 3;
     */ FeatureSet_FieldPresence[FeatureSet_FieldPresence["LEGACY_REQUIRED"] = 3] = "LEGACY_REQUIRED";
})(FeatureSet_FieldPresence || (FeatureSet_FieldPresence = {}));
const FeatureSet_FieldPresenceSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 0);
var FeatureSet_EnumType;
(function(FeatureSet_EnumType) {
    /**
     * @generated from enum value: ENUM_TYPE_UNKNOWN = 0;
     */ FeatureSet_EnumType[FeatureSet_EnumType["ENUM_TYPE_UNKNOWN"] = 0] = "ENUM_TYPE_UNKNOWN";
    /**
     * @generated from enum value: OPEN = 1;
     */ FeatureSet_EnumType[FeatureSet_EnumType["OPEN"] = 1] = "OPEN";
    /**
     * @generated from enum value: CLOSED = 2;
     */ FeatureSet_EnumType[FeatureSet_EnumType["CLOSED"] = 2] = "CLOSED";
})(FeatureSet_EnumType || (FeatureSet_EnumType = {}));
const FeatureSet_EnumTypeSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 1);
var FeatureSet_RepeatedFieldEncoding;
(function(FeatureSet_RepeatedFieldEncoding) {
    /**
     * @generated from enum value: REPEATED_FIELD_ENCODING_UNKNOWN = 0;
     */ FeatureSet_RepeatedFieldEncoding[FeatureSet_RepeatedFieldEncoding["REPEATED_FIELD_ENCODING_UNKNOWN"] = 0] = "REPEATED_FIELD_ENCODING_UNKNOWN";
    /**
     * @generated from enum value: PACKED = 1;
     */ FeatureSet_RepeatedFieldEncoding[FeatureSet_RepeatedFieldEncoding["PACKED"] = 1] = "PACKED";
    /**
     * @generated from enum value: EXPANDED = 2;
     */ FeatureSet_RepeatedFieldEncoding[FeatureSet_RepeatedFieldEncoding["EXPANDED"] = 2] = "EXPANDED";
})(FeatureSet_RepeatedFieldEncoding || (FeatureSet_RepeatedFieldEncoding = {}));
const FeatureSet_RepeatedFieldEncodingSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 2);
var FeatureSet_Utf8Validation;
(function(FeatureSet_Utf8Validation) {
    /**
     * @generated from enum value: UTF8_VALIDATION_UNKNOWN = 0;
     */ FeatureSet_Utf8Validation[FeatureSet_Utf8Validation["UTF8_VALIDATION_UNKNOWN"] = 0] = "UTF8_VALIDATION_UNKNOWN";
    /**
     * @generated from enum value: VERIFY = 2;
     */ FeatureSet_Utf8Validation[FeatureSet_Utf8Validation["VERIFY"] = 2] = "VERIFY";
    /**
     * @generated from enum value: NONE = 3;
     */ FeatureSet_Utf8Validation[FeatureSet_Utf8Validation["NONE"] = 3] = "NONE";
})(FeatureSet_Utf8Validation || (FeatureSet_Utf8Validation = {}));
const FeatureSet_Utf8ValidationSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 3);
var FeatureSet_MessageEncoding;
(function(FeatureSet_MessageEncoding) {
    /**
     * @generated from enum value: MESSAGE_ENCODING_UNKNOWN = 0;
     */ FeatureSet_MessageEncoding[FeatureSet_MessageEncoding["MESSAGE_ENCODING_UNKNOWN"] = 0] = "MESSAGE_ENCODING_UNKNOWN";
    /**
     * @generated from enum value: LENGTH_PREFIXED = 1;
     */ FeatureSet_MessageEncoding[FeatureSet_MessageEncoding["LENGTH_PREFIXED"] = 1] = "LENGTH_PREFIXED";
    /**
     * @generated from enum value: DELIMITED = 2;
     */ FeatureSet_MessageEncoding[FeatureSet_MessageEncoding["DELIMITED"] = 2] = "DELIMITED";
})(FeatureSet_MessageEncoding || (FeatureSet_MessageEncoding = {}));
const FeatureSet_MessageEncodingSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 4);
var FeatureSet_JsonFormat;
(function(FeatureSet_JsonFormat) {
    /**
     * @generated from enum value: JSON_FORMAT_UNKNOWN = 0;
     */ FeatureSet_JsonFormat[FeatureSet_JsonFormat["JSON_FORMAT_UNKNOWN"] = 0] = "JSON_FORMAT_UNKNOWN";
    /**
     * @generated from enum value: ALLOW = 1;
     */ FeatureSet_JsonFormat[FeatureSet_JsonFormat["ALLOW"] = 1] = "ALLOW";
    /**
     * @generated from enum value: LEGACY_BEST_EFFORT = 2;
     */ FeatureSet_JsonFormat[FeatureSet_JsonFormat["LEGACY_BEST_EFFORT"] = 2] = "LEGACY_BEST_EFFORT";
})(FeatureSet_JsonFormat || (FeatureSet_JsonFormat = {}));
const FeatureSet_JsonFormatSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 5);
var FeatureSet_EnforceNamingStyle;
(function(FeatureSet_EnforceNamingStyle) {
    /**
     * @generated from enum value: ENFORCE_NAMING_STYLE_UNKNOWN = 0;
     */ FeatureSet_EnforceNamingStyle[FeatureSet_EnforceNamingStyle["ENFORCE_NAMING_STYLE_UNKNOWN"] = 0] = "ENFORCE_NAMING_STYLE_UNKNOWN";
    /**
     * @generated from enum value: STYLE2024 = 1;
     */ FeatureSet_EnforceNamingStyle[FeatureSet_EnforceNamingStyle["STYLE2024"] = 1] = "STYLE2024";
    /**
     * @generated from enum value: STYLE_LEGACY = 2;
     */ FeatureSet_EnforceNamingStyle[FeatureSet_EnforceNamingStyle["STYLE_LEGACY"] = 2] = "STYLE_LEGACY";
})(FeatureSet_EnforceNamingStyle || (FeatureSet_EnforceNamingStyle = {}));
const FeatureSet_EnforceNamingStyleSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 19, 6);
const FeatureSetDefaultsSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 20);
const FeatureSetDefaults_FeatureSetEditionDefaultSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 20, 0);
const SourceCodeInfoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 21);
const SourceCodeInfo_LocationSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 21, 0);
const GeneratedCodeInfoSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 22);
const GeneratedCodeInfo_AnnotationSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_descriptor, 22, 0);
var GeneratedCodeInfo_Annotation_Semantic;
(function(GeneratedCodeInfo_Annotation_Semantic) {
    /**
     * There is no effect or the effect is indescribable.
     *
     * @generated from enum value: NONE = 0;
     */ GeneratedCodeInfo_Annotation_Semantic[GeneratedCodeInfo_Annotation_Semantic["NONE"] = 0] = "NONE";
    /**
     * The element is set or otherwise mutated.
     *
     * @generated from enum value: SET = 1;
     */ GeneratedCodeInfo_Annotation_Semantic[GeneratedCodeInfo_Annotation_Semantic["SET"] = 1] = "SET";
    /**
     * An alias to the element is returned.
     *
     * @generated from enum value: ALIAS = 2;
     */ GeneratedCodeInfo_Annotation_Semantic[GeneratedCodeInfo_Annotation_Semantic["ALIAS"] = 2] = "ALIAS";
})(GeneratedCodeInfo_Annotation_Semantic || (GeneratedCodeInfo_Annotation_Semantic = {}));
const GeneratedCodeInfo_Annotation_SemanticSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 22, 0, 0);
var Edition;
(function(Edition) {
    /**
     * A placeholder for an unknown edition value.
     *
     * @generated from enum value: EDITION_UNKNOWN = 0;
     */ Edition[Edition["EDITION_UNKNOWN"] = 0] = "EDITION_UNKNOWN";
    /**
     * A placeholder edition for specifying default behaviors *before* a feature
     * was first introduced.  This is effectively an "infinite past".
     *
     * @generated from enum value: EDITION_LEGACY = 900;
     */ Edition[Edition["EDITION_LEGACY"] = 900] = "EDITION_LEGACY";
    /**
     * Legacy syntax "editions".  These pre-date editions, but behave much like
     * distinct editions.  These can't be used to specify the edition of proto
     * files, but feature definitions must supply proto2/proto3 defaults for
     * backwards compatibility.
     *
     * @generated from enum value: EDITION_PROTO2 = 998;
     */ Edition[Edition["EDITION_PROTO2"] = 998] = "EDITION_PROTO2";
    /**
     * @generated from enum value: EDITION_PROTO3 = 999;
     */ Edition[Edition["EDITION_PROTO3"] = 999] = "EDITION_PROTO3";
    /**
     * Editions that have been released.  The specific values are arbitrary and
     * should not be depended on, but they will always be time-ordered for easy
     * comparison.
     *
     * @generated from enum value: EDITION_2023 = 1000;
     */ Edition[Edition["EDITION_2023"] = 1000] = "EDITION_2023";
    /**
     * @generated from enum value: EDITION_2024 = 1001;
     */ Edition[Edition["EDITION_2024"] = 1001] = "EDITION_2024";
    /**
     * A placeholder edition for developing and testing unscheduled features.
     *
     * @generated from enum value: EDITION_UNSTABLE = 9999;
     */ Edition[Edition["EDITION_UNSTABLE"] = 9999] = "EDITION_UNSTABLE";
    /**
     * Placeholder editions for testing feature resolution.  These should not be
     * used or relied on outside of tests.
     *
     * @generated from enum value: EDITION_1_TEST_ONLY = 1;
     */ Edition[Edition["EDITION_1_TEST_ONLY"] = 1] = "EDITION_1_TEST_ONLY";
    /**
     * @generated from enum value: EDITION_2_TEST_ONLY = 2;
     */ Edition[Edition["EDITION_2_TEST_ONLY"] = 2] = "EDITION_2_TEST_ONLY";
    /**
     * @generated from enum value: EDITION_99997_TEST_ONLY = 99997;
     */ Edition[Edition["EDITION_99997_TEST_ONLY"] = 99997] = "EDITION_99997_TEST_ONLY";
    /**
     * @generated from enum value: EDITION_99998_TEST_ONLY = 99998;
     */ Edition[Edition["EDITION_99998_TEST_ONLY"] = 99998] = "EDITION_99998_TEST_ONLY";
    /**
     * @generated from enum value: EDITION_99999_TEST_ONLY = 99999;
     */ Edition[Edition["EDITION_99999_TEST_ONLY"] = 99999] = "EDITION_99999_TEST_ONLY";
    /**
     * Placeholder for specifying unbounded edition support.  This should only
     * ever be used by plugins that can expect to never require any changes to
     * support a new edition.
     *
     * @generated from enum value: EDITION_MAX = 2147483647;
     */ Edition[Edition["EDITION_MAX"] = 2147483647] = "EDITION_MAX";
})(Edition || (Edition = {}));
const EditionSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 0);
var SymbolVisibility;
(function(SymbolVisibility) {
    /**
     * @generated from enum value: VISIBILITY_UNSET = 0;
     */ SymbolVisibility[SymbolVisibility["VISIBILITY_UNSET"] = 0] = "VISIBILITY_UNSET";
    /**
     * @generated from enum value: VISIBILITY_LOCAL = 1;
     */ SymbolVisibility[SymbolVisibility["VISIBILITY_LOCAL"] = 1] = "VISIBILITY_LOCAL";
    /**
     * @generated from enum value: VISIBILITY_EXPORT = 2;
     */ SymbolVisibility[SymbolVisibility["VISIBILITY_EXPORT"] = 2] = "VISIBILITY_EXPORT";
})(SymbolVisibility || (SymbolVisibility = {}));
const SymbolVisibilitySchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_descriptor, 1);
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FieldError",
    ()=>FieldError,
    "isFieldError",
    ()=>isFieldError
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
const errorNames = [
    "FieldValueInvalidError",
    "FieldListRangeError",
    "ForeignFieldError"
];
class FieldError extends Error {
    constructor(fieldOrOneof, message, name = "FieldValueInvalidError"){
        super(message);
        this.name = name;
        this.field = ()=>fieldOrOneof;
    }
}
function isFieldError(arg) {
    return arg instanceof Error && errorNames.includes(arg.name) && "field" in arg && typeof arg.field == "function";
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isObject",
    ()=>isObject,
    "isOneofADT",
    ()=>isOneofADT,
    "isReflectList",
    ()=>isReflectList,
    "isReflectMap",
    ()=>isReflectMap,
    "isReflectMessage",
    ()=>isReflectMessage
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js [middleware] (ecmascript)");
;
function isObject(arg) {
    return arg !== null && typeof arg == "object" && !Array.isArray(arg);
}
function isOneofADT(arg) {
    return arg !== null && typeof arg == "object" && "case" in arg && (typeof arg.case == "string" && "value" in arg && arg.value != null || arg.case === undefined && (!("value" in arg) || arg.value === undefined));
}
function isReflectList(arg, field) {
    var _a, _b, _c, _d;
    if (isObject(arg) && __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"] in arg && "add" in arg && "field" in arg && typeof arg.field == "function") {
        if (field !== undefined) {
            const a = field;
            const b = arg.field();
            return a.listKind == b.listKind && a.scalar === b.scalar && ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) && ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName);
        }
        return true;
    }
    return false;
}
function isReflectMap(arg, field) {
    var _a, _b, _c, _d;
    if (isObject(arg) && __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"] in arg && "has" in arg && "field" in arg && typeof arg.field == "function") {
        if (field !== undefined) {
            const a = field, b = arg.field();
            return a.mapKey === b.mapKey && a.mapKind == b.mapKind && a.scalar === b.scalar && ((_a = a.message) === null || _a === void 0 ? void 0 : _a.typeName) === ((_b = b.message) === null || _b === void 0 ? void 0 : _b.typeName) && ((_c = a.enum) === null || _c === void 0 ? void 0 : _c.typeName) === ((_d = b.enum) === null || _d === void 0 ? void 0 : _d.typeName);
        }
        return true;
    }
    return false;
}
function isReflectMessage(arg, messageDesc) {
    return isObject(arg) && __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"] in arg && "desc" in arg && isObject(arg.desc) && arg.desc.kind === "message" && (messageDesc === undefined || arg.desc.typeName == messageDesc.typeName);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "configureTextEncoding",
    ()=>configureTextEncoding,
    "getTextEncoding",
    ()=>getTextEncoding
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
const symbol = Symbol.for("@bufbuild/protobuf/text-encoding");
function configureTextEncoding(textEncoding) {
    globalThis[symbol] = textEncoding;
}
function getTextEncoding() {
    if (globalThis[symbol] == undefined) {
        const te = new globalThis.TextEncoder();
        const td = new globalThis.TextDecoder();
        globalThis[symbol] = {
            encodeUtf8 (text) {
                return te.encode(text);
            },
            decodeUtf8 (bytes) {
                return td.decode(bytes);
            },
            checkUtf8 (text) {
                try {
                    encodeURIComponent(text);
                    return true;
                } catch (_) {
                    return false;
                }
            }
        };
    }
    return globalThis[symbol];
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BinaryReader",
    ()=>BinaryReader,
    "BinaryWriter",
    ()=>BinaryWriter,
    "FLOAT32_MAX",
    ()=>FLOAT32_MAX,
    "FLOAT32_MIN",
    ()=>FLOAT32_MIN,
    "INT32_MAX",
    ()=>INT32_MAX,
    "INT32_MIN",
    ()=>INT32_MIN,
    "UINT32_MAX",
    ()=>UINT32_MAX,
    "WireType",
    ()=>WireType
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js [middleware] (ecmascript)");
;
;
;
var WireType;
(function(WireType) {
    /**
     * Used for int32, int64, uint32, uint64, sint32, sint64, bool, enum
     */ WireType[WireType["Varint"] = 0] = "Varint";
    /**
     * Used for fixed64, sfixed64, double.
     * Always 8 bytes with little-endian byte order.
     */ WireType[WireType["Bit64"] = 1] = "Bit64";
    /**
     * Used for string, bytes, embedded messages, packed repeated fields
     *
     * Only repeated numeric types (types which use the varint, 32-bit,
     * or 64-bit wire types) can be packed. In proto3, such fields are
     * packed by default.
     */ WireType[WireType["LengthDelimited"] = 2] = "LengthDelimited";
    /**
     * Start of a tag-delimited aggregate, such as a proto2 group, or a message
     * in editions with message_encoding = DELIMITED.
     */ WireType[WireType["StartGroup"] = 3] = "StartGroup";
    /**
     * End of a tag-delimited aggregate.
     */ WireType[WireType["EndGroup"] = 4] = "EndGroup";
    /**
     * Used for fixed32, sfixed32, float.
     * Always 4 bytes with little-endian byte order.
     */ WireType[WireType["Bit32"] = 5] = "Bit32";
})(WireType || (WireType = {}));
const FLOAT32_MAX = 3.4028234663852886e38;
const FLOAT32_MIN = -3.4028234663852886e38;
const UINT32_MAX = 0xffffffff;
const INT32_MAX = 0x7fffffff;
const INT32_MIN = -0x80000000;
class BinaryWriter {
    constructor(encodeUtf8 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getTextEncoding"])().encodeUtf8){
        this.encodeUtf8 = encodeUtf8;
        /**
         * Previous fork states.
         */ this.stack = [];
        this.chunks = [];
        this.buf = [];
    }
    /**
     * Return all bytes written and reset this writer.
     */ finish() {
        if (this.buf.length) {
            this.chunks.push(new Uint8Array(this.buf)); // flush the buffer
            this.buf = [];
        }
        let len = 0;
        for(let i = 0; i < this.chunks.length; i++)len += this.chunks[i].length;
        let bytes = new Uint8Array(len);
        let offset = 0;
        for(let i = 0; i < this.chunks.length; i++){
            bytes.set(this.chunks[i], offset);
            offset += this.chunks[i].length;
        }
        this.chunks = [];
        return bytes;
    }
    /**
     * Start a new fork for length-delimited data like a message
     * or a packed repeated field.
     *
     * Must be joined later with `join()`.
     */ fork() {
        this.stack.push({
            chunks: this.chunks,
            buf: this.buf
        });
        this.chunks = [];
        this.buf = [];
        return this;
    }
    /**
     * Join the last fork. Write its length and bytes, then
     * return to the previous state.
     */ join() {
        // get chunk of fork
        let chunk = this.finish();
        // restore previous state
        let prev = this.stack.pop();
        if (!prev) throw new Error("invalid state, fork stack empty");
        this.chunks = prev.chunks;
        this.buf = prev.buf;
        // write length of chunk as varint
        this.uint32(chunk.byteLength);
        return this.raw(chunk);
    }
    /**
     * Writes a tag (field number and wire type).
     *
     * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
     *
     * Generated code should compute the tag ahead of time and call `uint32()`.
     */ tag(fieldNo, type) {
        return this.uint32((fieldNo << 3 | type) >>> 0);
    }
    /**
     * Write a chunk of raw bytes.
     */ raw(chunk) {
        if (this.buf.length) {
            this.chunks.push(new Uint8Array(this.buf));
            this.buf = [];
        }
        this.chunks.push(chunk);
        return this;
    }
    /**
     * Write a `uint32` value, an unsigned 32 bit varint.
     */ uint32(value) {
        assertUInt32(value);
        // write value as varint 32, inlined for speed
        while(value > 0x7f){
            this.buf.push(value & 0x7f | 0x80);
            value = value >>> 7;
        }
        this.buf.push(value);
        return this;
    }
    /**
     * Write a `int32` value, a signed 32 bit varint.
     */ int32(value) {
        assertInt32(value);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint32write"])(value, this.buf);
        return this;
    }
    /**
     * Write a `bool` value, a variant.
     */ bool(value) {
        this.buf.push(value ? 1 : 0);
        return this;
    }
    /**
     * Write a `bytes` value, length-delimited arbitrary data.
     */ bytes(value) {
        this.uint32(value.byteLength); // write length of chunk as varint
        return this.raw(value);
    }
    /**
     * Write a `string` value, length-delimited data converted to UTF-8 text.
     */ string(value) {
        let chunk = this.encodeUtf8(value);
        this.uint32(chunk.byteLength); // write length of chunk as varint
        return this.raw(chunk);
    }
    /**
     * Write a `float` value, 32-bit floating point number.
     */ float(value) {
        assertFloat32(value);
        let chunk = new Uint8Array(4);
        new DataView(chunk.buffer).setFloat32(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `double` value, a 64-bit floating point number.
     */ double(value) {
        let chunk = new Uint8Array(8);
        new DataView(chunk.buffer).setFloat64(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
     */ fixed32(value) {
        assertUInt32(value);
        let chunk = new Uint8Array(4);
        new DataView(chunk.buffer).setUint32(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
     */ sfixed32(value) {
        assertInt32(value);
        let chunk = new Uint8Array(4);
        new DataView(chunk.buffer).setInt32(0, value, true);
        return this.raw(chunk);
    }
    /**
     * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
     */ sint32(value) {
        assertInt32(value);
        // zigzag encode
        value = (value << 1 ^ value >> 31) >>> 0;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint32write"])(value, this.buf);
        return this;
    }
    /**
     * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
     */ sfixed64(value) {
        let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].enc(value);
        view.setInt32(0, tc.lo, true);
        view.setInt32(4, tc.hi, true);
        return this.raw(chunk);
    }
    /**
     * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
     */ fixed64(value) {
        let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uEnc(value);
        view.setInt32(0, tc.lo, true);
        view.setInt32(4, tc.hi, true);
        return this.raw(chunk);
    }
    /**
     * Write a `int64` value, a signed 64-bit varint.
     */ int64(value) {
        let tc = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].enc(value);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint64write"])(tc.lo, tc.hi, this.buf);
        return this;
    }
    /**
     * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
     */ sint64(value) {
        const tc = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].enc(value), // zigzag encode
        sign = tc.hi >> 31, lo = tc.lo << 1 ^ sign, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign;
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint64write"])(lo, hi, this.buf);
        return this;
    }
    /**
     * Write a `uint64` value, an unsigned 64-bit varint.
     */ uint64(value) {
        const tc = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uEnc(value);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint64write"])(tc.lo, tc.hi, this.buf);
        return this;
    }
}
class BinaryReader {
    constructor(buf, decodeUtf8 = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getTextEncoding"])().decodeUtf8){
        this.decodeUtf8 = decodeUtf8;
        this.varint64 = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint64read"]; // dirty cast for `this`
        /**
         * Read a `uint32` field, an unsigned 32 bit varint.
         */ this.uint32 = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint32read"];
        this.buf = buf;
        this.len = buf.length;
        this.pos = 0;
        this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    /**
     * Reads a tag - field number and wire type.
     */ tag() {
        let tag = this.uint32(), fieldNo = tag >>> 3, wireType = tag & 7;
        if (fieldNo <= 0 || wireType < 0 || wireType > 5) throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
        return [
            fieldNo,
            wireType
        ];
    }
    /**
     * Skip one element and return the skipped data.
     *
     * When skipping StartGroup, provide the tags field number to check for
     * matching field number in the EndGroup tag.
     */ skip(wireType, fieldNo) {
        let start = this.pos;
        switch(wireType){
            case WireType.Varint:
                while(this.buf[this.pos++] & 0x80){
                // ignore
                }
                break;
            // @ts-ignore TS7029: Fallthrough case in switch -- ignore instead of expect-error for compiler settings without noFallthroughCasesInSwitch: true
            case WireType.Bit64:
                this.pos += 4;
            case WireType.Bit32:
                this.pos += 4;
                break;
            case WireType.LengthDelimited:
                let len = this.uint32();
                this.pos += len;
                break;
            case WireType.StartGroup:
                for(;;){
                    const [fn, wt] = this.tag();
                    if (wt === WireType.EndGroup) {
                        if (fieldNo !== undefined && fn !== fieldNo) {
                            throw new Error("invalid end group tag");
                        }
                        break;
                    }
                    this.skip(wt, fn);
                }
                break;
            default:
                throw new Error("cant skip wire type " + wireType);
        }
        this.assertBounds();
        return this.buf.subarray(start, this.pos);
    }
    /**
     * Throws error if position in byte array is out of range.
     */ assertBounds() {
        if (this.pos > this.len) throw new RangeError("premature EOF");
    }
    /**
     * Read a `int32` field, a signed 32 bit varint.
     */ int32() {
        return this.uint32() | 0;
    }
    /**
     * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
     */ sint32() {
        let zze = this.uint32();
        // decode zigzag
        return zze >>> 1 ^ -(zze & 1);
    }
    /**
     * Read a `int64` field, a signed 64-bit varint.
     */ int64() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].dec(...this.varint64());
    }
    /**
     * Read a `uint64` field, an unsigned 64-bit varint.
     */ uint64() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uDec(...this.varint64());
    }
    /**
     * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
     */ sint64() {
        let [lo, hi] = this.varint64();
        // decode zig zag
        let s = -(lo & 1);
        lo = (lo >>> 1 | (hi & 1) << 31) ^ s;
        hi = hi >>> 1 ^ s;
        return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].dec(lo, hi);
    }
    /**
     * Read a `bool` field, a variant.
     */ bool() {
        let [lo, hi] = this.varint64();
        return lo !== 0 || hi !== 0;
    }
    /**
     * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
     */ fixed32() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getUint32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
     */ sfixed32() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getInt32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
     */ fixed64() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uDec(this.sfixed32(), this.sfixed32());
    }
    /**
     * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
     */ sfixed64() {
        return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].dec(this.sfixed32(), this.sfixed32());
    }
    /**
     * Read a `float` field, 32-bit floating point number.
     */ float() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getFloat32((this.pos += 4) - 4, true);
    }
    /**
     * Read a `double` field, a 64-bit floating point number.
     */ double() {
        // biome-ignore lint/suspicious/noAssignInExpressions: no
        return this.view.getFloat64((this.pos += 8) - 8, true);
    }
    /**
     * Read a `bytes` field, length-delimited arbitrary data.
     */ bytes() {
        let len = this.uint32(), start = this.pos;
        this.pos += len;
        this.assertBounds();
        return this.buf.subarray(start, start + len);
    }
    /**
     * Read a `string` field, length-delimited data converted to UTF-8 text.
     */ string() {
        return this.decodeUtf8(this.bytes());
    }
}
/**
 * Assert a valid signed protobuf 32-bit integer as a number or string.
 */ function assertInt32(arg) {
    if (typeof arg == "string") {
        arg = Number(arg);
    } else if (typeof arg != "number") {
        throw new Error("invalid int32: " + typeof arg);
    }
    if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN) throw new Error("invalid int32: " + arg);
}
/**
 * Assert a valid unsigned protobuf 32-bit integer as a number or string.
 */ function assertUInt32(arg) {
    if (typeof arg == "string") {
        arg = Number(arg);
    } else if (typeof arg != "number") {
        throw new Error("invalid uint32: " + typeof arg);
    }
    if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0) throw new Error("invalid uint32: " + arg);
}
/**
 * Assert a valid protobuf float value as a number or string.
 */ function assertFloat32(arg) {
    if (typeof arg == "string") {
        const o = arg;
        arg = Number(arg);
        if (Number.isNaN(arg) && o !== "NaN") {
            throw new Error("invalid float32: " + o);
        }
    } else if (typeof arg != "number") {
        throw new Error("invalid float32: " + typeof arg);
    }
    if (Number.isFinite(arg) && (arg > FLOAT32_MAX || arg < FLOAT32_MIN)) throw new Error("invalid float32: " + arg);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect-check.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "checkField",
    ()=>checkField,
    "checkListItem",
    ()=>checkListItem,
    "checkMapEntry",
    ()=>checkMapEntry,
    "formatVal",
    ()=>formatVal
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$is$2d$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/is-message.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/text-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)");
;
;
;
;
;
;
;
function checkField(field, value) {
    const check = field.fieldKind == "list" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectList"])(value, field) : field.fieldKind == "map" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectMap"])(value, field) : checkSingular(field, value);
    if (check === true) {
        return undefined;
    }
    let reason;
    switch(field.fieldKind){
        case "list":
            reason = `expected ${formatReflectList(field)}, got ${formatVal(value)}`;
            break;
        case "map":
            reason = `expected ${formatReflectMap(field)}, got ${formatVal(value)}`;
            break;
        default:
            {
                reason = reasonSingular(field, value, check);
            }
    }
    return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, reason);
}
function checkListItem(field, index, value) {
    const check = checkSingular(field, value);
    if (check !== true) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, `list item #${index + 1}: ${reasonSingular(field, value, check)}`);
    }
    return undefined;
}
function checkMapEntry(field, key, value) {
    const checkKey = checkScalarValue(key, field.mapKey);
    if (checkKey !== true) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, `invalid map key: ${reasonSingular({
            scalar: field.mapKey
        }, key, checkKey)}`);
    }
    const checkVal = checkSingular(field, value);
    if (checkVal !== true) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, `map entry ${formatVal(key)}: ${reasonSingular(field, value, checkVal)}`);
    }
    return undefined;
}
function checkSingular(field, value) {
    if (field.scalar !== undefined) {
        return checkScalarValue(value, field.scalar);
    }
    if (field.enum !== undefined) {
        if (field.enum.open) {
            return Number.isInteger(value);
        }
        return field.enum.values.some((v)=>v.number === value);
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectMessage"])(value, field.message);
}
function checkScalarValue(value, scalar) {
    switch(scalar){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
            return typeof value == "number";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
            if (typeof value != "number") {
                return false;
            }
            if (Number.isNaN(value) || !Number.isFinite(value)) {
                return true;
            }
            if (value > __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FLOAT32_MAX"] || value < __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FLOAT32_MIN"]) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
            // signed
            if (typeof value !== "number" || !Number.isInteger(value)) {
                return false;
            }
            if (value > __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["INT32_MAX"] || value < __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["INT32_MIN"]) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
            // unsigned
            if (typeof value !== "number" || !Number.isInteger(value)) {
                return false;
            }
            if (value > __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["UINT32_MAX"] || value < 0) {
                return `${value.toFixed()} out of range`;
            }
            return true;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            return typeof value == "boolean";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            if (typeof value != "string") {
                return false;
            }
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$text$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getTextEncoding"])().checkUtf8(value) || "invalid UTF8";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            return value instanceof Uint8Array;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            // signed
            if (typeof value == "bigint" || typeof value == "number" || typeof value == "string" && value.length > 0) {
                try {
                    __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(value);
                    return true;
                } catch (_) {
                    return `${value} out of range`;
                }
            }
            return false;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
            // unsigned
            if (typeof value == "bigint" || typeof value == "number" || typeof value == "string" && value.length > 0) {
                try {
                    __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uParse(value);
                    return true;
                } catch (_) {
                    return `${value} out of range`;
                }
            }
            return false;
    }
}
function reasonSingular(field, val, details) {
    details = typeof details == "string" ? `: ${details}` : `, got ${formatVal(val)}`;
    if (field.scalar !== undefined) {
        return `expected ${scalarTypeDescription(field.scalar)}` + details;
    }
    if (field.enum !== undefined) {
        return `expected ${field.enum.toString()}` + details;
    }
    return `expected ${formatReflectMessage(field.message)}` + details;
}
function formatVal(val) {
    switch(typeof val){
        case "object":
            if (val === null) {
                return "null";
            }
            if (val instanceof Uint8Array) {
                return `Uint8Array(${val.length})`;
            }
            if (Array.isArray(val)) {
                return `Array(${val.length})`;
            }
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectList"])(val)) {
                return formatReflectList(val.field());
            }
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectMap"])(val)) {
                return formatReflectMap(val.field());
            }
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectMessage"])(val)) {
                return formatReflectMessage(val.desc);
            }
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$is$2d$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isMessage"])(val)) {
                return `message ${val.$typeName}`;
            }
            return "object";
        case "string":
            return val.length > 30 ? "string" : `"${val.split('"').join('\\"')}"`;
        case "boolean":
            return String(val);
        case "number":
            return String(val);
        case "bigint":
            return String(val) + "n";
        default:
            // "symbol" | "undefined" | "object" | "function"
            return typeof val;
    }
}
function formatReflectMessage(desc) {
    return `ReflectMessage (${desc.typeName})`;
}
function formatReflectList(field) {
    switch(field.listKind){
        case "message":
            return `ReflectList (${field.message.toString()})`;
        case "enum":
            return `ReflectList (${field.enum.toString()})`;
        case "scalar":
            return `ReflectList (${__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"][field.scalar]})`;
    }
}
function formatReflectMap(field) {
    switch(field.mapKind){
        case "message":
            return `ReflectMap (${__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"][field.mapKey]}, ${field.message.toString()})`;
        case "enum":
            return `ReflectMap (${__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"][field.mapKey]}, ${field.enum.toString()})`;
        case "scalar":
            return `ReflectMap (${__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"][field.mapKey]}, ${__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"][field.scalar]})`;
    }
}
function scalarTypeDescription(scalar) {
    switch(scalar){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            return "string";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            return "boolean";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
            return "bigint (int64)";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
            return "bigint (uint64)";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            return "Uint8Array";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
            return "number (float64)";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
            return "number (float32)";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
            return "number (uint32)";
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
            return "number (int32)";
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
__turbopack_context__.s([
    "isWrapper",
    ()=>isWrapper,
    "isWrapperDesc",
    ()=>isWrapperDesc
]);
function isWrapper(arg) {
    return isWrapperTypeName(arg.$typeName);
}
function isWrapperDesc(messageDesc) {
    const f = messageDesc.fields[0];
    return isWrapperTypeName(messageDesc.typeName) && f !== undefined && f.fieldKind == "scalar" && f.name == "value" && f.number == 1;
}
function isWrapperTypeName(name) {
    return name.startsWith("google.protobuf.") && [
        "DoubleValue",
        "FloatValue",
        "Int64Value",
        "UInt64Value",
        "Int32Value",
        "UInt32Value",
        "BoolValue",
        "StringValue",
        "BytesValue"
    ].includes(name.substring(16));
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/create.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "create",
    ()=>create
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$is$2d$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/is-message.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js [middleware] (ecmascript)");
;
;
;
;
;
;
// bootstrap-inject google.protobuf.Edition.EDITION_PROTO3: const $name: Edition.$localName = $number;
const EDITION_PROTO3 = 999;
// bootstrap-inject google.protobuf.Edition.EDITION_PROTO2: const $name: Edition.$localName = $number;
const EDITION_PROTO2 = 998;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.IMPLICIT: const $name: FeatureSet_FieldPresence.$localName = $number;
const IMPLICIT = 2;
function create(schema, init) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$is$2d$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isMessage"])(init, schema)) {
        return init;
    }
    const message = createZeroMessage(schema);
    if (init !== undefined) {
        initMessage(schema, message, init);
    }
    return message;
}
/**
 * Sets field values from a MessageInitShape on a zero message.
 */ function initMessage(messageDesc, message, init) {
    for (const member of messageDesc.members){
        let value = init[member.localName];
        if (value == null) {
            continue;
        }
        let field;
        if (member.kind == "oneof") {
            const oneofField = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeOneofCase"])(init, member);
            if (!oneofField) {
                continue;
            }
            field = oneofField;
            value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeGet"])(init, oneofField);
        } else {
            field = member;
        }
        switch(field.fieldKind){
            case "message":
                value = toMessage(field, value);
                break;
            case "scalar":
                value = initScalar(field, value);
                break;
            case "list":
                value = initList(field, value);
                break;
            case "map":
                value = initMap(field, value);
                break;
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeSet"])(message, field, value);
    }
    return message;
}
function initScalar(field, value) {
    if (field.scalar == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES) {
        return toU8Arr(value);
    }
    return value;
}
function initMap(field, value) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isObject"])(value)) {
        if (field.scalar == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES) {
            return convertObjectValues(value, toU8Arr);
        }
        if (field.mapKind == "message") {
            return convertObjectValues(value, (val)=>toMessage(field, val));
        }
    }
    return value;
}
function initList(field, value) {
    if (Array.isArray(value)) {
        if (field.scalar == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES) {
            return value.map(toU8Arr);
        }
        if (field.listKind == "message") {
            return value.map((item)=>toMessage(field, item));
        }
    }
    return value;
}
function toMessage(field, value) {
    if (field.fieldKind == "message" && !field.oneof && (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isWrapperDesc"])(field.message)) {
        // Types from google/protobuf/wrappers.proto are unwrapped when used in
        // a singular field that is not part of a oneof group.
        return initScalar(field.message.fields[0], value);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isObject"])(value)) {
        if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName !== "google.protobuf.Value") {
            // google.protobuf.Struct is represented with JsonObject when used in a
            // field, except when used in google.protobuf.Value.
            return value;
        }
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$is$2d$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isMessage"])(value, field.message)) {
            return create(field.message, value);
        }
    }
    return value;
}
// converts any ArrayLike<number> to Uint8Array if necessary.
function toU8Arr(value) {
    return Array.isArray(value) ? new Uint8Array(value) : value;
}
function convertObjectValues(obj, fn) {
    const ret = {};
    for (const entry of Object.entries(obj)){
        ret[entry[0]] = fn(entry[1]);
    }
    return ret;
}
const tokenZeroMessageField = Symbol();
const messagePrototypes = new WeakMap();
/**
 * Create a zero message.
 */ function createZeroMessage(desc) {
    let msg;
    if (!needsPrototypeChain(desc)) {
        msg = {
            $typeName: desc.typeName
        };
        for (const member of desc.members){
            if (member.kind == "oneof" || member.presence == IMPLICIT) {
                msg[member.localName] = createZeroField(member);
            }
        }
    } else {
        // Support default values and track presence via the prototype chain
        const cached = messagePrototypes.get(desc);
        let prototype;
        let members;
        if (cached) {
            ({ prototype, members } = cached);
        } else {
            prototype = {};
            members = new Set();
            for (const member of desc.members){
                if (member.kind == "oneof") {
                    continue;
                }
                if (member.fieldKind != "scalar" && member.fieldKind != "enum") {
                    continue;
                }
                if (member.presence == IMPLICIT) {
                    continue;
                }
                members.add(member);
                prototype[member.localName] = createZeroField(member);
            }
            messagePrototypes.set(desc, {
                prototype,
                members
            });
        }
        msg = Object.create(prototype);
        msg.$typeName = desc.typeName;
        for (const member of desc.members){
            if (members.has(member)) {
                continue;
            }
            if (member.kind == "field") {
                if (member.fieldKind == "message") {
                    continue;
                }
                if (member.fieldKind == "scalar" || member.fieldKind == "enum") {
                    if (member.presence != IMPLICIT) {
                        continue;
                    }
                }
            }
            msg[member.localName] = createZeroField(member);
        }
    }
    return msg;
}
/**
 * Do we need the prototype chain to track field presence?
 */ function needsPrototypeChain(desc) {
    switch(desc.file.edition){
        case EDITION_PROTO3:
            // proto3 always uses implicit presence, we never need the prototype chain.
            return false;
        case EDITION_PROTO2:
            // proto2 never uses implicit presence, we always need the prototype chain.
            return true;
        default:
            // If a message uses scalar or enum fields with explicit presence, we need
            // the prototype chain to track presence. This rule does not apply to fields
            // in a oneof group - they use a different mechanism to track presence.
            return desc.fields.some((f)=>f.presence != IMPLICIT && f.fieldKind != "message" && !f.oneof);
    }
}
/**
 * Returns a zero value for oneof groups, and for every field kind except
 * messages. Scalar and enum fields can have default values.
 */ function createZeroField(field) {
    if (field.kind == "oneof") {
        return {
            case: undefined
        };
    }
    if (field.fieldKind == "list") {
        return [];
    }
    if (field.fieldKind == "map") {
        return {}; // Object.create(null) would be desirable here, but is unsupported by react https://react.dev/reference/react/use-server#serializable-parameters-and-return-values
    }
    if (field.fieldKind == "message") {
        return tokenZeroMessageField;
    }
    const defaultValue = field.getDefaultValue();
    if (defaultValue !== undefined) {
        return field.fieldKind == "scalar" && field.longAsString ? defaultValue.toString() : defaultValue;
    }
    return field.fieldKind == "scalar" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["scalarZeroValue"])(field.scalar, field.longAsString) : field.enum.values[0].number;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "reflect",
    ()=>reflect,
    "reflectList",
    ()=>reflectList,
    "reflectMap",
    ()=>reflectMap
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect-check.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/unsafe.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/create.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/guard.js [middleware] (ecmascript)");
;
;
;
;
;
;
;
;
;
function reflect(messageDesc, message, /**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */ check = true) {
    return new ReflectMessageImpl(messageDesc, message, check);
}
const messageSortedFields = new WeakMap();
class ReflectMessageImpl {
    get sortedFields() {
        const cached = messageSortedFields.get(this.desc);
        if (cached) {
            return cached;
        }
        const sortedFields = this.desc.fields.concat().sort((a, b)=>a.number - b.number);
        messageSortedFields.set(this.desc, sortedFields);
        return sortedFields;
    }
    constructor(messageDesc, message, check = true){
        this.lists = new Map();
        this.maps = new Map();
        this.check = check;
        this.desc = messageDesc;
        this.message = this[__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"]] = message !== null && message !== void 0 ? message : (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(messageDesc);
        this.fields = messageDesc.fields;
        this.oneofs = messageDesc.oneofs;
        this.members = messageDesc.members;
    }
    findNumber(number) {
        if (!this._fieldsByNumber) {
            this._fieldsByNumber = new Map(this.desc.fields.map((f)=>[
                    f.number,
                    f
                ]));
        }
        return this._fieldsByNumber.get(number);
    }
    oneofCase(oneof) {
        assertOwn(this.message, oneof);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeOneofCase"])(this.message, oneof);
    }
    isSet(field) {
        assertOwn(this.message, field);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeIsSet"])(this.message, field);
    }
    clear(field) {
        assertOwn(this.message, field);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeClear"])(this.message, field);
    }
    get(field) {
        assertOwn(this.message, field);
        const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeGet"])(this.message, field);
        switch(field.fieldKind){
            case "list":
                // eslint-disable-next-line no-case-declarations
                let list = this.lists.get(field);
                if (!list || list[__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"]] !== value) {
                    this.lists.set(field, list = new ReflectListImpl(field, value, this.check));
                }
                return list;
            case "map":
                let map = this.maps.get(field);
                if (!map || map[__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"]] !== value) {
                    this.maps.set(field, map = new ReflectMapImpl(field, value, this.check));
                }
                return map;
            case "message":
                return messageToReflect(field, value, this.check);
            case "scalar":
                return value === undefined ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["scalarZeroValue"])(field.scalar, false) : longToReflect(field, value);
            case "enum":
                return value !== null && value !== void 0 ? value : field.enum.values[0].number;
        }
    }
    set(field, value) {
        assertOwn(this.message, field);
        if (this.check) {
            const err = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkField"])(field, value);
            if (err) {
                throw err;
            }
        }
        let local;
        if (field.fieldKind == "message") {
            local = messageToLocal(field, value);
        } else if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectMap"])(value) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectList"])(value)) {
            local = value[__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"]];
        } else {
            local = longToLocal(field, value);
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeSet"])(this.message, field, local);
    }
    getUnknown() {
        return this.message.$unknown;
    }
    setUnknown(value) {
        this.message.$unknown = value;
    }
}
function assertOwn(owner, member) {
    if (member.parent.typeName !== owner.$typeName) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](member, `cannot use ${member.toString()} with message ${owner.$typeName}`, "ForeignFieldError");
    }
}
function reflectList(field, unsafeInput, /**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */ check = true) {
    return new ReflectListImpl(field, unsafeInput !== null && unsafeInput !== void 0 ? unsafeInput : [], check);
}
class ReflectListImpl {
    field() {
        return this._field;
    }
    get size() {
        return this._arr.length;
    }
    constructor(field, unsafeInput, check){
        this._field = field;
        this._arr = this[__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"]] = unsafeInput;
        this.check = check;
    }
    get(index) {
        const item = this._arr[index];
        return item === undefined ? undefined : listItemToReflect(this._field, item, this.check);
    }
    set(index, item) {
        if (index < 0 || index >= this._arr.length) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](this._field, `list item #${index + 1}: out of range`);
        }
        if (this.check) {
            const err = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkListItem"])(this._field, index, item);
            if (err) {
                throw err;
            }
        }
        this._arr[index] = listItemToLocal(this._field, item);
    }
    add(item) {
        if (this.check) {
            const err = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkListItem"])(this._field, this._arr.length, item);
            if (err) {
                throw err;
            }
        }
        this._arr.push(listItemToLocal(this._field, item));
        return undefined;
    }
    clear() {
        this._arr.splice(0, this._arr.length);
    }
    [Symbol.iterator]() {
        return this.values();
    }
    keys() {
        return this._arr.keys();
    }
    *values() {
        for (const item of this._arr){
            yield listItemToReflect(this._field, item, this.check);
        }
    }
    *entries() {
        for(let i = 0; i < this._arr.length; i++){
            yield [
                i,
                listItemToReflect(this._field, this._arr[i], this.check)
            ];
        }
    }
}
function reflectMap(field, unsafeInput, /**
 * By default, field values are validated when setting them. For example,
 * a value for an uint32 field must be a ECMAScript Number >= 0.
 *
 * When field values are trusted, performance can be improved by disabling
 * checks.
 */ check = true) {
    return new ReflectMapImpl(field, unsafeInput, check);
}
class ReflectMapImpl {
    constructor(field, unsafeInput, check = true){
        this.obj = this[__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$unsafe$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["unsafeLocal"]] = unsafeInput !== null && unsafeInput !== void 0 ? unsafeInput : {};
        this.check = check;
        this._field = field;
    }
    field() {
        return this._field;
    }
    set(key, value) {
        if (this.check) {
            const err = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkMapEntry"])(this._field, key, value);
            if (err) {
                throw err;
            }
        }
        this.obj[mapKeyToLocal(key)] = mapValueToLocal(this._field, value);
        return this;
    }
    delete(key) {
        const k = mapKeyToLocal(key);
        const has = Object.prototype.hasOwnProperty.call(this.obj, k);
        if (has) {
            delete this.obj[k];
        }
        return has;
    }
    clear() {
        for (const key of Object.keys(this.obj)){
            delete this.obj[key];
        }
    }
    get(key) {
        let val = this.obj[mapKeyToLocal(key)];
        if (val !== undefined) {
            val = mapValueToReflect(this._field, val, this.check);
        }
        return val;
    }
    has(key) {
        return Object.prototype.hasOwnProperty.call(this.obj, mapKeyToLocal(key));
    }
    *keys() {
        for (const objKey of Object.keys(this.obj)){
            yield mapKeyToReflect(objKey, this._field.mapKey);
        }
    }
    *entries() {
        for (const objEntry of Object.entries(this.obj)){
            yield [
                mapKeyToReflect(objEntry[0], this._field.mapKey),
                mapValueToReflect(this._field, objEntry[1], this.check)
            ];
        }
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    get size() {
        return Object.keys(this.obj).length;
    }
    *values() {
        for (const val of Object.values(this.obj)){
            yield mapValueToReflect(this._field, val, this.check);
        }
    }
    forEach(callbackfn, thisArg) {
        for (const mapEntry of this.entries()){
            callbackfn.call(thisArg, mapEntry[1], mapEntry[0], this);
        }
    }
}
function messageToLocal(field, value) {
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isReflectMessage"])(value)) {
        return value;
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isWrapper"])(value.message) && !field.oneof && field.fieldKind == "message") {
        // Types from google/protobuf/wrappers.proto are unwrapped when used in
        // a singular field that is not part of a oneof group.
        return value.message.value;
    }
    if (value.desc.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value") {
        // google.protobuf.Struct is represented with JsonObject when used in a
        // field, except when used in google.protobuf.Value.
        return wktStructToLocal(value.message);
    }
    return value.message;
}
function messageToReflect(field, value, check) {
    if (value !== undefined) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isWrapperDesc"])(field.message) && !field.oneof && field.fieldKind == "message") {
            // Types from google/protobuf/wrappers.proto are unwrapped when used in
            // a singular field that is not part of a oneof group.
            value = {
                $typeName: field.message.typeName,
                value: longToReflect(field.message.fields[0], value)
            };
        } else if (field.message.typeName == "google.protobuf.Struct" && field.parent.typeName != "google.protobuf.Value" && (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isObject"])(value)) {
            // google.protobuf.Struct is represented with JsonObject when used in a
            // field, except when used in google.protobuf.Value.
            value = wktStructToReflect(value);
        }
    }
    return new ReflectMessageImpl(field.message, value, check);
}
function listItemToLocal(field, value) {
    if (field.listKind == "message") {
        return messageToLocal(field, value);
    }
    return longToLocal(field, value);
}
function listItemToReflect(field, value, check) {
    if (field.listKind == "message") {
        return messageToReflect(field, value, check);
    }
    return longToReflect(field, value);
}
function mapValueToLocal(field, value) {
    if (field.mapKind == "message") {
        return messageToLocal(field, value);
    }
    return longToLocal(field, value);
}
function mapValueToReflect(field, value, check) {
    if (field.mapKind == "message") {
        return messageToReflect(field, value, check);
    }
    return value;
}
function mapKeyToLocal(key) {
    return typeof key == "string" || typeof key == "number" ? key : String(key);
}
/**
 * Converts a map key (any scalar value except float, double, or bytes) from its
 * representation in a message (string or number, the only possible object key
 * types) to the closest possible type in ECMAScript.
 */ function mapKeyToReflect(key, type) {
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            return key;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
            {
                const n = Number.parseInt(key);
                if (Number.isFinite(n)) {
                    return n;
                }
                break;
            }
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            switch(key){
                case "true":
                    return true;
                case "false":
                    return false;
            }
            break;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
            try {
                return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uParse(key);
            } catch (_a) {
            //
            }
            break;
        default:
            // INT64, SFIXED64, SINT64
            try {
                return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(key);
            } catch (_b) {
            //
            }
            break;
    }
    return key;
}
function longToReflect(field, value) {
    switch(field.scalar){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            if ("longAsString" in field && field.longAsString && typeof value == "string") {
                value = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(value);
            }
            break;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
            if ("longAsString" in field && field.longAsString && typeof value == "string") {
                value = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uParse(value);
            }
            break;
    }
    return value;
}
function longToLocal(field, value) {
    switch(field.scalar){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            if ("longAsString" in field && field.longAsString) {
                value = String(value);
            } else if (typeof value == "string" || typeof value == "number") {
                value = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(value);
            }
            break;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
            if ("longAsString" in field && field.longAsString) {
                value = String(value);
            } else if (typeof value == "string" || typeof value == "number") {
                value = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].uParse(value);
            }
            break;
    }
    return value;
}
function wktStructToReflect(json) {
    const struct = {
        $typeName: "google.protobuf.Struct",
        fields: {}
    };
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$guard$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isObject"])(json)) {
        for (const [k, v] of Object.entries(json)){
            struct.fields[k] = wktValueToReflect(v);
        }
    }
    return struct;
}
function wktStructToLocal(val) {
    const json = {};
    for (const [k, v] of Object.entries(val.fields)){
        json[k] = wktValueToLocal(v);
    }
    return json;
}
function wktValueToLocal(val) {
    switch(val.kind.case){
        case "structValue":
            return wktStructToLocal(val.kind.value);
        case "listValue":
            return val.kind.value.values.map(wktValueToLocal);
        case "nullValue":
        case undefined:
            return null;
        default:
            return val.kind.value;
    }
}
function wktValueToReflect(json) {
    const value = {
        $typeName: "google.protobuf.Value",
        kind: {
            case: undefined
        }
    };
    switch(typeof json){
        case "number":
            value.kind = {
                case: "numberValue",
                value: json
            };
            break;
        case "string":
            value.kind = {
                case: "stringValue",
                value: json
            };
            break;
        case "boolean":
            value.kind = {
                case: "boolValue",
                value: json
            };
            break;
        case "object":
            if (json === null) {
                const nullValue = 0;
                value.kind = {
                    case: "nullValue",
                    value: nullValue
                };
            } else if (Array.isArray(json)) {
                const listValue = {
                    $typeName: "google.protobuf.ListValue",
                    values: []
                };
                if (Array.isArray(json)) {
                    for (const e of json){
                        listValue.values.push(wktValueToReflect(e));
                    }
                }
                value.kind = {
                    case: "listValue",
                    value: listValue
                };
            } else {
                value.kind = {
                    case: "structValue",
                    value: wktStructToReflect(json)
                };
            }
            break;
    }
    return value;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/from-binary.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromBinary",
    ()=>fromBinary,
    "mergeFromBinary",
    ()=>mergeFromBinary,
    "readField",
    ()=>readField
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/varint.js [middleware] (ecmascript)");
;
;
;
;
;
// Default options for parsing binary data.
const readDefaults = {
    readUnknownFields: true
};
function makeReadOptions(options) {
    return options ? Object.assign(Object.assign({}, readDefaults), options) : readDefaults;
}
function fromBinary(schema, bytes, options) {
    const msg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(schema, undefined, false);
    readMessage(msg, new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["BinaryReader"](bytes), makeReadOptions(options), false, bytes.byteLength);
    return msg.message;
}
function mergeFromBinary(schema, target, bytes, options) {
    readMessage((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(schema, target, false), new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["BinaryReader"](bytes), makeReadOptions(options), false, bytes.byteLength);
    return target;
}
/**
 * If `delimited` is false, read the length given in `lengthOrDelimitedFieldNo`.
 *
 * If `delimited` is true, read until an EndGroup tag. `lengthOrDelimitedFieldNo`
 * is the expected field number.
 *
 * @private
 */ function readMessage(message, reader, options, delimited, lengthOrDelimitedFieldNo) {
    var _a;
    const end = delimited ? reader.len : reader.pos + lengthOrDelimitedFieldNo;
    let fieldNo;
    let wireType;
    const unknownFields = (_a = message.getUnknown()) !== null && _a !== void 0 ? _a : [];
    while(reader.pos < end){
        [fieldNo, wireType] = reader.tag();
        if (delimited && wireType == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].EndGroup) {
            break;
        }
        const field = message.findNumber(fieldNo);
        if (!field) {
            const data = reader.skip(wireType, fieldNo);
            if (options.readUnknownFields) {
                unknownFields.push({
                    no: fieldNo,
                    wireType,
                    data
                });
            }
            continue;
        }
        readField(message, reader, field, wireType, options);
    }
    if (delimited) {
        if (wireType != __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].EndGroup || fieldNo !== lengthOrDelimitedFieldNo) {
            throw new Error("invalid end group tag");
        }
    }
    if (unknownFields.length > 0) {
        message.setUnknown(unknownFields);
    }
}
function readField(message, reader, field, wireType, options) {
    var _a;
    switch(field.fieldKind){
        case "scalar":
            message.set(field, readScalar(reader, field.scalar));
            break;
        case "enum":
            const val = readScalar(reader, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32);
            if (field.enum.open) {
                message.set(field, val);
            } else {
                const ok = field.enum.values.some((v)=>v.number === val);
                if (ok) {
                    message.set(field, val);
                } else if (options.readUnknownFields) {
                    const bytes = [];
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$varint$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["varint32write"])(val, bytes);
                    const unknownFields = (_a = message.getUnknown()) !== null && _a !== void 0 ? _a : [];
                    unknownFields.push({
                        no: field.number,
                        wireType,
                        data: new Uint8Array(bytes)
                    });
                    message.setUnknown(unknownFields);
                }
            }
            break;
        case "message":
            message.set(field, readMessageField(reader, options, field, message.get(field)));
            break;
        case "list":
            readListField(reader, wireType, message.get(field), options);
            break;
        case "map":
            readMapEntry(reader, message.get(field), options);
            break;
    }
}
// Read a map field, expecting key field = 1, value field = 2
function readMapEntry(reader, map, options) {
    const field = map.field();
    let key;
    let val;
    // Read the length of the map entry, which is a varint.
    const len = reader.uint32();
    // WARNING: Calculate end AFTER advancing reader.pos (above), so that
    //          reader.pos is at the start of the map entry.
    const end = reader.pos + len;
    while(reader.pos < end){
        const [fieldNo] = reader.tag();
        switch(fieldNo){
            case 1:
                key = readScalar(reader, field.mapKey);
                break;
            case 2:
                switch(field.mapKind){
                    case "scalar":
                        val = readScalar(reader, field.scalar);
                        break;
                    case "enum":
                        val = reader.int32();
                        break;
                    case "message":
                        val = readMessageField(reader, options, field);
                        break;
                }
                break;
        }
    }
    if (key === undefined) {
        key = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["scalarZeroValue"])(field.mapKey, false);
    }
    if (val === undefined) {
        switch(field.mapKind){
            case "scalar":
                val = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["scalarZeroValue"])(field.scalar, false);
                break;
            case "enum":
                val = field.enum.values[0].number;
                break;
            case "message":
                val = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(field.message, undefined, false);
                break;
        }
    }
    map.set(key, val);
}
function readListField(reader, wireType, list, options) {
    var _a;
    const field = list.field();
    if (field.listKind === "message") {
        list.add(readMessageField(reader, options, field));
        return;
    }
    const scalarType = (_a = field.scalar) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32;
    const packed = wireType == __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].LengthDelimited && scalarType != __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING && scalarType != __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES;
    if (!packed) {
        list.add(readScalar(reader, scalarType));
        return;
    }
    const e = reader.uint32() + reader.pos;
    while(reader.pos < e){
        list.add(readScalar(reader, scalarType));
    }
}
function readMessageField(reader, options, field, mergeMessage) {
    const delimited = field.delimitedEncoding;
    const message = mergeMessage !== null && mergeMessage !== void 0 ? mergeMessage : (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(field.message, undefined, false);
    readMessage(message, reader, options, delimited, delimited ? field.number : reader.uint32());
    return message;
}
function readScalar(reader, type) {
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            return reader.string();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            return reader.bool();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
            return reader.double();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
            return reader.float();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
            return reader.int32();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
            return reader.int64();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
            return reader.uint64();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
            return reader.fixed64();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            return reader.bytes();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
            return reader.fixed32();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
            return reader.sfixed32();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
            return reader.sfixed64();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            return reader.sint64();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
            return reader.uint32();
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
            return reader.sint32();
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fileDesc",
    ()=>fileDesc
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$base64$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$descriptor_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/descriptor_pb.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$registry$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/registry.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$restore$2d$json$2d$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/restore-json-names.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$from$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/from-binary.js [middleware] (ecmascript)");
;
;
;
;
;
function fileDesc(b64, imports) {
    var _a;
    const root = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$from$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["fromBinary"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$descriptor_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FileDescriptorProtoSchema"], (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$base64$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64Decode"])(b64));
    root.messageType.forEach(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$restore$2d$json$2d$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["restoreJsonNames"]);
    root.dependency = (_a = imports === null || imports === void 0 ? void 0 : imports.map((f)=>f.proto.name)) !== null && _a !== void 0 ? _a : [];
    const reg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$registry$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createFileRegistry"])(root, (protoFileName)=>imports === null || imports === void 0 ? void 0 : imports.find((f)=>f.proto.name === protoFileName));
    // biome-ignore lint/style/noNonNullAssertion: non-null assertion because we just created the registry from the file we look up
    return reg.getFile(root.name);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv1/message.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Hydrate a message descriptor.
 *
 * @private
 */ __turbopack_context__.s([
    "messageDesc",
    ()=>messageDesc
]);
function messageDesc(file, path, ...paths) {
    return paths.reduce((acc, cur)=>acc.nestedMessages[cur], file.messages[path]);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv1/service.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Copyright 2021-2026 Buf Technologies, Inc.
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
 * Hydrate a service descriptor.
 *
 * @private
 */ __turbopack_context__.s([
    "serviceDesc",
    ()=>serviceDesc
]);
function serviceDesc(file, path, ...paths) {
    if (paths.length > 0) {
        throw new Error();
    }
    return file.services[path];
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/timestamp_pb.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TimestampSchema",
    ()=>TimestampSchema,
    "file_google_protobuf_timestamp",
    ()=>file_google_protobuf_timestamp
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$file$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js [middleware] (ecmascript)");
;
;
const file_google_protobuf_timestamp = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$file$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["fileDesc"])("Ch9nb29nbGUvcHJvdG9idWYvdGltZXN0YW1wLnByb3RvEg9nb29nbGUucHJvdG9idWYiKwoJVGltZXN0YW1wEg8KB3NlY29uZHMYASABKAMSDQoFbmFub3MYAiABKAVChQEKE2NvbS5nb29nbGUucHJvdG9idWZCDlRpbWVzdGFtcFByb3RvUAFaMmdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3RpbWVzdGFtcHBi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
const TimestampSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_timestamp, 0);
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/timestamp.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "timestampDate",
    ()=>timestampDate,
    "timestampFromDate",
    ()=>timestampFromDate,
    "timestampFromMs",
    ()=>timestampFromMs,
    "timestampMs",
    ()=>timestampMs,
    "timestampNow",
    ()=>timestampNow
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$timestamp_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/timestamp_pb.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/create.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)");
;
;
;
function timestampNow() {
    return timestampFromDate(new Date());
}
function timestampFromDate(date) {
    return timestampFromMs(date.getTime());
}
function timestampDate(timestamp) {
    return new Date(timestampMs(timestamp));
}
function timestampFromMs(timestampMs) {
    const seconds = Math.floor(timestampMs / 1000);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$timestamp_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["TimestampSchema"], {
        seconds: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(seconds),
        nanos: (timestampMs - seconds * 1000) * 1000000
    });
}
function timestampMs(timestamp) {
    return Number(timestamp.seconds) * 1000 + Math.round(timestamp.nanos / 1000000);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/to-binary.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "toBinary",
    ()=>toBinary,
    "writeField",
    ()=>writeField
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
;
;
;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.LEGACY_REQUIRED: const $name: FeatureSet_FieldPresence.$localName = $number;
const LEGACY_REQUIRED = 3;
// Default options for serializing binary data.
const writeDefaults = {
    writeUnknownFields: true
};
function makeWriteOptions(options) {
    return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
}
function toBinary(schema, message, options) {
    return writeFields(new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["BinaryWriter"](), makeWriteOptions(options), (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(schema, message)).finish();
}
function writeFields(writer, opts, msg) {
    var _a;
    for (const f of msg.sortedFields){
        if (!msg.isSet(f)) {
            if (f.presence == LEGACY_REQUIRED) {
                throw new Error(`cannot encode ${f} to binary: required field not set`);
            }
            continue;
        }
        writeField(writer, opts, msg, f);
    }
    if (opts.writeUnknownFields) {
        for (const { no, wireType, data } of (_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : []){
            writer.tag(no, wireType).raw(data);
        }
    }
    return writer;
}
function writeField(writer, opts, msg, field) {
    var _a;
    switch(field.fieldKind){
        case "scalar":
        case "enum":
            writeScalar(writer, msg.desc.typeName, field.name, (_a = field.scalar) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32, field.number, msg.get(field));
            break;
        case "list":
            writeListField(writer, opts, field, msg.get(field));
            break;
        case "message":
            writeMessageField(writer, opts, field, msg.get(field));
            break;
        case "map":
            for (const [key, val] of msg.get(field)){
                writeMapEntry(writer, opts, field, key, val);
            }
            break;
    }
}
function writeScalar(writer, msgName, fieldName, scalarType, fieldNo, value) {
    writeScalarValue(writer.tag(fieldNo, writeTypeOfScalar(scalarType)), msgName, fieldName, scalarType, value);
}
function writeMessageField(writer, opts, field, message) {
    if (field.delimitedEncoding) {
        writeFields(writer.tag(field.number, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].StartGroup), opts, message).tag(field.number, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].EndGroup);
    } else {
        writeFields(writer.tag(field.number, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].LengthDelimited).fork(), opts, message).join();
    }
}
function writeListField(writer, opts, field, list) {
    var _a;
    if (field.listKind == "message") {
        for (const item of list){
            writeMessageField(writer, opts, field, item);
        }
        return;
    }
    const scalarType = (_a = field.scalar) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32;
    if (field.packed) {
        if (!list.size) {
            return;
        }
        writer.tag(field.number, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].LengthDelimited).fork();
        for (const item of list){
            writeScalarValue(writer, field.parent.typeName, field.name, scalarType, item);
        }
        writer.join();
        return;
    }
    for (const item of list){
        writeScalar(writer, field.parent.typeName, field.name, scalarType, field.number, item);
    }
}
function writeMapEntry(writer, opts, field, key, value) {
    var _a;
    writer.tag(field.number, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].LengthDelimited).fork();
    // write key, expecting key field number = 1
    writeScalar(writer, field.parent.typeName, field.name, field.mapKey, 1, key);
    // write value, expecting value field number = 2
    switch(field.mapKind){
        case "scalar":
        case "enum":
            writeScalar(writer, field.parent.typeName, field.name, (_a = field.scalar) !== null && _a !== void 0 ? _a : __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32, 2, value);
            break;
        case "message":
            writeFields(writer.tag(2, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].LengthDelimited).fork(), opts, value).join();
            break;
    }
    writer.join();
}
function writeScalarValue(writer, msgName, fieldName, type, value) {
    try {
        switch(type){
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
                writer.string(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
                writer.bool(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
                writer.double(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
                writer.float(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
                writer.int32(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
                writer.int64(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
                writer.uint64(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
                writer.fixed64(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
                writer.bytes(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
                writer.fixed32(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
                writer.sfixed32(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
                writer.sfixed64(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
                writer.sint64(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
                writer.uint32(value);
                break;
            case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
                writer.sint32(value);
                break;
        }
    } catch (e) {
        if (e instanceof Error) {
            throw new Error(`cannot encode field ${msgName}.${fieldName} to binary: ${e.message}`);
        }
        throw e;
    }
}
function writeTypeOfScalar(type) {
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].LengthDelimited;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].Bit64;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].Bit32;
        default:
            return __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["WireType"].Varint;
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/any_pb.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AnySchema",
    ()=>AnySchema,
    "file_google_protobuf_any",
    ()=>file_google_protobuf_any
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$file$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js [middleware] (ecmascript)");
;
;
const file_google_protobuf_any = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$file$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["fileDesc"])("Chlnb29nbGUvcHJvdG9idWYvYW55LnByb3RvEg9nb29nbGUucHJvdG9idWYiJgoDQW55EhAKCHR5cGVfdXJsGAEgASgJEg0KBXZhbHVlGAIgASgMQnYKE2NvbS5nb29nbGUucHJvdG9idWZCCEFueVByb3RvUAFaLGdvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL2FueXBiogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
const AnySchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_any, 0);
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/any.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "anyIs",
    ()=>anyIs,
    "anyPack",
    ()=>anyPack,
    "anyUnpack",
    ()=>anyUnpack,
    "anyUnpackTo",
    ()=>anyUnpackTo
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$any_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/any_pb.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/create.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$to$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/to-binary.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$from$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/from-binary.js [middleware] (ecmascript)");
;
;
;
;
function anyPack(schema, message, into) {
    let ret = false;
    if (!into) {
        into = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$any_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["AnySchema"]);
        ret = true;
    }
    into.value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$to$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["toBinary"])(schema, message);
    into.typeUrl = typeNameToUrl(message.$typeName);
    return ret ? into : undefined;
}
function anyIs(any, descOrTypeName) {
    if (any.typeUrl === "") {
        return false;
    }
    const want = typeof descOrTypeName == "string" ? descOrTypeName : descOrTypeName.typeName;
    const got = typeUrlToName(any.typeUrl);
    return want === got;
}
function anyUnpack(any, registryOrMessageDesc) {
    if (any.typeUrl === "") {
        return undefined;
    }
    const desc = registryOrMessageDesc.kind == "message" ? registryOrMessageDesc : registryOrMessageDesc.getMessage(typeUrlToName(any.typeUrl));
    if (!desc || !anyIs(any, desc)) {
        return undefined;
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$from$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["fromBinary"])(desc, any.value);
}
function anyUnpackTo(any, schema, message) {
    if (!anyIs(any, schema)) {
        return undefined;
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$from$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["mergeFromBinary"])(schema, message, any.value);
}
function typeNameToUrl(name) {
    return `type.googleapis.com/${name}`;
}
function typeUrlToName(url) {
    const slash = url.lastIndexOf("/");
    const name = slash >= 0 ? url.substring(slash + 1) : url;
    if (!name.length) {
        throw new Error(`invalid type url: ${url}`);
    }
    return name;
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/extensions.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearExtension",
    ()=>clearExtension,
    "createExtensionContainer",
    ()=>createExtensionContainer,
    "getExtension",
    ()=>getExtension,
    "getOption",
    ()=>getOption,
    "hasExtension",
    ()=>hasExtension,
    "hasOption",
    ()=>hasOption,
    "setExtension",
    ()=>setExtension
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/create.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$from$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/from-binary.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/scalar.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$to$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/to-binary.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/binary-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js [middleware] (ecmascript)");
;
;
;
;
;
;
;
function getExtension(message, extension) {
    assertExtendee(extension, message);
    const ufs = filterUnknownFields(message.$unknown, extension);
    const [container, field, get] = createExtensionContainer(extension);
    for (const uf of ufs){
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$from$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["readField"])(container, new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["BinaryReader"](uf.data), field, uf.wireType, {
            readUnknownFields: true
        });
    }
    return get();
}
function setExtension(message, extension, value) {
    var _a;
    assertExtendee(extension, message);
    const ufs = ((_a = message.$unknown) !== null && _a !== void 0 ? _a : []).filter((uf)=>uf.no !== extension.number);
    const [container, field] = createExtensionContainer(extension, value);
    const writer = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["BinaryWriter"]();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$to$2d$binary$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["writeField"])(writer, {
        writeUnknownFields: true
    }, container, field);
    const reader = new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$binary$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["BinaryReader"](writer.finish());
    while(reader.pos < reader.len){
        const [no, wireType] = reader.tag();
        const data = reader.skip(wireType, no);
        ufs.push({
            no,
            wireType,
            data
        });
    }
    message.$unknown = ufs;
}
function clearExtension(message, extension) {
    assertExtendee(extension, message);
    if (message.$unknown === undefined) {
        return;
    }
    message.$unknown = message.$unknown.filter((uf)=>uf.no !== extension.number);
}
function hasExtension(message, extension) {
    var _a;
    return extension.extendee.typeName === message.$typeName && !!((_a = message.$unknown) === null || _a === void 0 ? void 0 : _a.find((uf)=>uf.no === extension.number));
}
function hasOption(element, option) {
    const message = element.proto.options;
    if (!message) {
        return false;
    }
    return hasExtension(message, option);
}
function getOption(element, option) {
    const message = element.proto.options;
    if (!message) {
        const [, , get] = createExtensionContainer(option);
        return get();
    }
    return getExtension(message, option);
}
function filterUnknownFields(unknownFields, extension) {
    if (unknownFields === undefined) return [];
    if (extension.fieldKind === "enum" || extension.fieldKind === "scalar") {
        // singular scalar fields do not merge, we pick the last
        for(let i = unknownFields.length - 1; i >= 0; --i){
            if (unknownFields[i].no == extension.number) {
                return [
                    unknownFields[i]
                ];
            }
        }
        return [];
    }
    return unknownFields.filter((uf)=>uf.no === extension.number);
}
function createExtensionContainer(extension, value) {
    const localName = extension.typeName;
    const field = Object.assign(Object.assign({}, extension), {
        kind: "field",
        parent: extension.extendee,
        localName
    });
    const desc = Object.assign(Object.assign({}, extension.extendee), {
        fields: [
            field
        ],
        members: [
            field
        ],
        oneofs: []
    });
    const container = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(desc, value !== undefined ? {
        [localName]: value
    } : undefined);
    return [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(desc, container),
        field,
        ()=>{
            const value = container[localName];
            if (value === undefined) {
                // biome-ignore lint/style/noNonNullAssertion: Only message fields are undefined, rest will have a zero value.
                const desc = extension.message;
                if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isWrapperDesc"])(desc)) {
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$scalar$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["scalarZeroValue"])(desc.fields[0].scalar, desc.fields[0].longAsString);
                }
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(desc);
            }
            return value;
        }
    ];
}
function assertExtendee(extension, message) {
    if (extension.extendee.typeName != message.$typeName) {
        throw new Error(`extension ${extension.typeName} can only be applied to message ${extension.extendee.typeName}`);
    }
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/to-json.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "enumToJson",
    ()=>enumToJson,
    "toJson",
    ()=>toJson,
    "toJsonString",
    ()=>toJsonString
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$any$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/any.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$base64$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$extensions$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/extensions.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect-check.js [middleware] (ecmascript)");
;
;
;
;
;
;
;
;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.LEGACY_REQUIRED: const $name: FeatureSet_FieldPresence.$localName = $number;
const LEGACY_REQUIRED = 3;
// bootstrap-inject google.protobuf.FeatureSet.FieldPresence.IMPLICIT: const $name: FeatureSet_FieldPresence.$localName = $number;
const IMPLICIT = 2;
// Default options for serializing to JSON.
const jsonWriteDefaults = {
    alwaysEmitImplicit: false,
    enumAsInteger: false,
    useProtoFieldName: false
};
function makeWriteOptions(options) {
    return options ? Object.assign(Object.assign({}, jsonWriteDefaults), options) : jsonWriteDefaults;
}
function toJson(schema, message, options) {
    return reflectToJson((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(schema, message), makeWriteOptions(options));
}
function toJsonString(schema, message, options) {
    var _a;
    const jsonValue = toJson(schema, message, options);
    return JSON.stringify(jsonValue, null, (_a = options === null || options === void 0 ? void 0 : options.prettySpaces) !== null && _a !== void 0 ? _a : 0);
}
function enumToJson(descEnum, value) {
    var _a;
    if (descEnum.typeName == "google.protobuf.NullValue") {
        return null;
    }
    const name = (_a = descEnum.value[value]) === null || _a === void 0 ? void 0 : _a.name;
    if (name === undefined) {
        throw new Error(`${value} is not a value in ${descEnum}`);
    }
    return name;
}
function reflectToJson(msg, opts) {
    var _a;
    const wktJson = tryWktToJson(msg, opts);
    if (wktJson !== undefined) return wktJson;
    const json = {};
    for (const f of msg.sortedFields){
        if (!msg.isSet(f)) {
            if (f.presence == LEGACY_REQUIRED) {
                throw new Error(`cannot encode ${f} to JSON: required field not set`);
            }
            if (!opts.alwaysEmitImplicit || f.presence !== IMPLICIT) {
                continue;
            }
        }
        const jsonValue = fieldToJson(f, msg.get(f), opts);
        if (jsonValue !== undefined) {
            json[jsonName(f, opts)] = jsonValue;
        }
    }
    if (opts.registry) {
        const tagSeen = new Set();
        for (const { no } of (_a = msg.getUnknown()) !== null && _a !== void 0 ? _a : []){
            // Same tag can appear multiple times, so we
            // keep track and skip identical ones.
            if (!tagSeen.has(no)) {
                tagSeen.add(no);
                const extension = opts.registry.getExtensionFor(msg.desc, no);
                if (!extension) {
                    continue;
                }
                const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$extensions$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["getExtension"])(msg.message, extension);
                const [container, field] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$extensions$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createExtensionContainer"])(extension, value);
                const jsonValue = fieldToJson(field, container.get(field), opts);
                if (jsonValue !== undefined) {
                    json[extension.jsonName] = jsonValue;
                }
            }
        }
    }
    return json;
}
function fieldToJson(f, val, opts) {
    switch(f.fieldKind){
        case "scalar":
            return scalarToJson(f, val);
        case "message":
            return reflectToJson(val, opts);
        case "enum":
            return enumToJsonInternal(f.enum, val, opts.enumAsInteger);
        case "list":
            return listToJson(val, opts);
        case "map":
            return mapToJson(val, opts);
    }
}
function mapToJson(map, opts) {
    const f = map.field();
    const jsonObj = {};
    switch(f.mapKind){
        case "scalar":
            for (const [entryKey, entryValue] of map){
                jsonObj[entryKey] = scalarToJson(f, entryValue);
            }
            break;
        case "message":
            for (const [entryKey, entryValue] of map){
                jsonObj[entryKey] = reflectToJson(entryValue, opts);
            }
            break;
        case "enum":
            for (const [entryKey, entryValue] of map){
                jsonObj[entryKey] = enumToJsonInternal(f.enum, entryValue, opts.enumAsInteger);
            }
            break;
    }
    return opts.alwaysEmitImplicit || map.size > 0 ? jsonObj : undefined;
}
function listToJson(list, opts) {
    const f = list.field();
    const jsonArr = [];
    switch(f.listKind){
        case "scalar":
            for (const item of list){
                jsonArr.push(scalarToJson(f, item));
            }
            break;
        case "enum":
            for (const item of list){
                jsonArr.push(enumToJsonInternal(f.enum, item, opts.enumAsInteger));
            }
            break;
        case "message":
            for (const item of list){
                jsonArr.push(reflectToJson(item, opts));
            }
            break;
    }
    return opts.alwaysEmitImplicit || jsonArr.length > 0 ? jsonArr : undefined;
}
function enumToJsonInternal(desc, value, enumAsInteger) {
    var _a;
    if (typeof value != "number") {
        throw new Error(`cannot encode ${desc} to JSON: expected number, got ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(value)}`);
    }
    if (desc.typeName == "google.protobuf.NullValue") {
        return null;
    }
    if (enumAsInteger) {
        return value;
    }
    const val = desc.value[value];
    return (_a = val === null || val === void 0 ? void 0 : val.name) !== null && _a !== void 0 ? _a : value; // if we don't know the enum value, just return the number
}
function scalarToJson(field, value) {
    var _a, _b, _c, _d, _e, _f;
    switch(field.scalar){
        // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
            if (typeof value != "number") {
                throw new Error(`cannot encode ${field} to JSON: ${(_a = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkField"])(field, value)) === null || _a === void 0 ? void 0 : _a.message}`);
            }
            return value;
        // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
        // Either numbers or strings are accepted. Exponent notation is also accepted.
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
            if (typeof value != "number") {
                throw new Error(`cannot encode ${field} to JSON: ${(_b = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkField"])(field, value)) === null || _b === void 0 ? void 0 : _b.message}`);
            }
            if (Number.isNaN(value)) return "NaN";
            if (value === Number.POSITIVE_INFINITY) return "Infinity";
            if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
            return value;
        // string:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].STRING:
            if (typeof value != "string") {
                throw new Error(`cannot encode ${field} to JSON: ${(_c = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkField"])(field, value)) === null || _c === void 0 ? void 0 : _c.message}`);
            }
            return value;
        // bool:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            if (typeof value != "boolean") {
                throw new Error(`cannot encode ${field} to JSON: ${(_d = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkField"])(field, value)) === null || _d === void 0 ? void 0 : _d.message}`);
            }
            return value;
        // JSON value will be a decimal string. Either numbers or strings are accepted.
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED64:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT64:
            if (typeof value != "bigint" && typeof value != "string") {
                throw new Error(`cannot encode ${field} to JSON: ${(_e = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkField"])(field, value)) === null || _e === void 0 ? void 0 : _e.message}`);
            }
            return value.toString();
        // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
        // Either standard or URL-safe base64 encoding with/without paddings are accepted.
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            if (value instanceof Uint8Array) {
                return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$base64$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64Encode"])(value);
            }
            throw new Error(`cannot encode ${field} to JSON: ${(_f = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["checkField"])(field, value)) === null || _f === void 0 ? void 0 : _f.message}`);
    }
}
function jsonName(f, opts) {
    return opts.useProtoFieldName ? f.name : f.jsonName;
}
// returns a json value if wkt, otherwise returns undefined.
function tryWktToJson(msg, opts) {
    if (!msg.desc.typeName.startsWith("google.protobuf.")) {
        return undefined;
    }
    switch(msg.desc.typeName){
        case "google.protobuf.Any":
            return anyToJson(msg.message, opts);
        case "google.protobuf.Timestamp":
            return timestampToJson(msg.message);
        case "google.protobuf.Duration":
            return durationToJson(msg.message);
        case "google.protobuf.FieldMask":
            return fieldMaskToJson(msg.message);
        case "google.protobuf.Struct":
            return structToJson(msg.message);
        case "google.protobuf.Value":
            return valueToJson(msg.message);
        case "google.protobuf.ListValue":
            return listValueToJson(msg.message);
        default:
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isWrapperDesc"])(msg.desc)) {
                const valueField = msg.desc.fields[0];
                return scalarToJson(valueField, msg.get(valueField));
            }
            return undefined;
    }
}
function anyToJson(val, opts) {
    if (val.typeUrl === "") {
        return {};
    }
    const { registry } = opts;
    let message;
    let desc;
    if (registry) {
        message = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$any$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["anyUnpack"])(val, registry);
        if (message) {
            desc = registry.getMessage(message.$typeName);
        }
    }
    if (!desc || !message) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: "${val.typeUrl}" is not in the type registry`);
    }
    let json = reflectToJson((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(desc, message), opts);
    if (desc.typeName.startsWith("google.protobuf.") || json === null || Array.isArray(json) || typeof json !== "object") {
        json = {
            value: json
        };
    }
    json["@type"] = val.typeUrl;
    return json;
}
function durationToJson(val) {
    const seconds = Number(val.seconds);
    const nanos = val.nanos;
    if (seconds > 315576000000 || seconds < -315576000000) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: value out of range`);
    }
    if (seconds > 0 && nanos < 0 || seconds < 0 && nanos > 0) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos sign must match seconds sign`);
    }
    let text = val.seconds.toString();
    if (nanos !== 0) {
        let nanosStr = Math.abs(nanos).toString();
        nanosStr = "0".repeat(9 - nanosStr.length) + nanosStr;
        if (nanosStr.substring(3) === "000000") {
            nanosStr = nanosStr.substring(0, 3);
        } else if (nanosStr.substring(6) === "000") {
            nanosStr = nanosStr.substring(0, 6);
        }
        text += "." + nanosStr;
        if (nanos < 0 && seconds == 0) {
            text = "-" + text;
        }
    }
    return text + "s";
}
function fieldMaskToJson(val) {
    return val.paths.map((p)=>{
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoSnakeCase"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoCamelCase"])(p)) !== p) {
            throw new Error(`cannot encode message ${val.$typeName} to JSON: lowerCamelCase of path name "${p}" is irreversible`);
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoCamelCase"])(p);
    }).join(",");
}
function structToJson(val) {
    const json = {};
    for (const [k, v] of Object.entries(val.fields)){
        json[k] = valueToJson(v);
    }
    return json;
}
function valueToJson(val) {
    switch(val.kind.case){
        case "nullValue":
            return null;
        case "numberValue":
            if (!Number.isFinite(val.kind.value)) {
                throw new Error(`${val.$typeName} cannot be NaN or Infinity`);
            }
            return val.kind.value;
        case "boolValue":
            return val.kind.value;
        case "stringValue":
            return val.kind.value;
        case "structValue":
            return structToJson(val.kind.value);
        case "listValue":
            return listValueToJson(val.kind.value);
        default:
            throw new Error(`${val.$typeName} must have a value`);
    }
}
function listValueToJson(val) {
    return val.values.map(valueToJson);
}
function timestampToJson(val) {
    const ms = Number(val.seconds) * 1000;
    if (ms < Date.parse("0001-01-01T00:00:00Z") || ms > Date.parse("9999-12-31T23:59:59Z")) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive`);
    }
    if (val.nanos < 0) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be negative`);
    }
    if (val.nanos > 999999999) {
        throw new Error(`cannot encode message ${val.$typeName} to JSON: nanos must not be greater than 99999999`);
    }
    let z = "Z";
    if (val.nanos > 0) {
        const nanosStr = (val.nanos + 1000000000).toString().substring(1);
        if (nanosStr.substring(3) === "000000") {
            z = "." + nanosStr.substring(0, 3) + "Z";
        } else if (nanosStr.substring(6) === "000") {
            z = "." + nanosStr.substring(0, 6) + "Z";
        } else {
            z = "." + nanosStr + "Z";
        }
    }
    return new Date(ms).toISOString().replace(".000Z", z);
}
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/struct_pb.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ListValueSchema",
    ()=>ListValueSchema,
    "NullValue",
    ()=>NullValue,
    "NullValueSchema",
    ()=>NullValueSchema,
    "StructSchema",
    ()=>StructSchema,
    "ValueSchema",
    ()=>ValueSchema,
    "file_google_protobuf_struct",
    ()=>file_google_protobuf_struct
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$file$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/file.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/message.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/codegenv2/enum.js [middleware] (ecmascript)");
;
;
;
const file_google_protobuf_struct = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$file$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["fileDesc"])("Chxnb29nbGUvcHJvdG9idWYvc3RydWN0LnByb3RvEg9nb29nbGUucHJvdG9idWYihAEKBlN0cnVjdBIzCgZmaWVsZHMYASADKAsyIy5nb29nbGUucHJvdG9idWYuU3RydWN0LkZpZWxkc0VudHJ5GkUKC0ZpZWxkc0VudHJ5EgsKA2tleRgBIAEoCRIlCgV2YWx1ZRgCIAEoCzIWLmdvb2dsZS5wcm90b2J1Zi5WYWx1ZToCOAEi6gEKBVZhbHVlEjAKCm51bGxfdmFsdWUYASABKA4yGi5nb29nbGUucHJvdG9idWYuTnVsbFZhbHVlSAASFgoMbnVtYmVyX3ZhbHVlGAIgASgBSAASFgoMc3RyaW5nX3ZhbHVlGAMgASgJSAASFAoKYm9vbF92YWx1ZRgEIAEoCEgAEi8KDHN0cnVjdF92YWx1ZRgFIAEoCzIXLmdvb2dsZS5wcm90b2J1Zi5TdHJ1Y3RIABIwCgpsaXN0X3ZhbHVlGAYgASgLMhouZ29vZ2xlLnByb3RvYnVmLkxpc3RWYWx1ZUgAQgYKBGtpbmQiMwoJTGlzdFZhbHVlEiYKBnZhbHVlcxgBIAMoCzIWLmdvb2dsZS5wcm90b2J1Zi5WYWx1ZSobCglOdWxsVmFsdWUSDgoKTlVMTF9WQUxVRRAAQn8KE2NvbS5nb29nbGUucHJvdG9idWZCC1N0cnVjdFByb3RvUAFaL2dvb2dsZS5nb2xhbmcub3JnL3Byb3RvYnVmL3R5cGVzL2tub3duL3N0cnVjdHBi+AEBogIDR1BCqgIeR29vZ2xlLlByb3RvYnVmLldlbGxLbm93blR5cGVzYgZwcm90bzM");
const StructSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_struct, 0);
const ValueSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_struct, 1);
const ListValueSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$message$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["messageDesc"])(file_google_protobuf_struct, 2);
var NullValue;
(function(NullValue) {
    /**
     * Null value.
     *
     * @generated from enum value: NULL_VALUE = 0;
     */ NullValue[NullValue["NULL_VALUE"] = 0] = "NULL_VALUE";
})(NullValue || (NullValue = {}));
const NullValueSchema = /*@__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$codegenv2$2f$enum$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["enumDesc"])(file_google_protobuf_struct, 0);
}),
"[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/from-json.js [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "enumFromJson",
    ()=>enumFromJson,
    "fromJson",
    ()=>fromJson,
    "fromJsonString",
    ()=>fromJsonString,
    "isEnumJson",
    ()=>isEnumJson,
    "mergeFromJson",
    ()=>mergeFromJson,
    "mergeFromJsonString",
    ()=>mergeFromJsonString
]);
// Copyright 2021-2026 Buf Technologies, Inc.
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
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/descriptors.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/create.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/error.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/reflect-check.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/reflect/names.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$base64$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wire/base64-encoding.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/wrappers.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$any$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/any.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$struct_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/wkt/gen/google/protobuf/struct_pb.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$extensions$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/projects/next-js-boilerplate/node_modules/@bufbuild/protobuf/dist/esm/extensions.js [middleware] (ecmascript)");
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
// Default options for parsing JSON.
const jsonReadDefaults = {
    ignoreUnknownFields: false
};
function makeReadOptions(options) {
    return options ? Object.assign(Object.assign({}, jsonReadDefaults), options) : jsonReadDefaults;
}
function fromJsonString(schema, json, options) {
    return fromJson(schema, parseJsonString(json, schema.typeName), options);
}
function mergeFromJsonString(schema, target, json, options) {
    return mergeFromJson(schema, target, parseJsonString(json, schema.typeName), options);
}
function fromJson(schema, json, options) {
    const msg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(schema);
    try {
        readMessage(msg, json, makeReadOptions(options));
    } catch (e) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isFieldError"])(e)) {
            // @ts-expect-error we use the ES2022 error CTOR option "cause" for better stack traces
            throw new Error(`cannot decode ${e.field()} from JSON: ${e.message}`, {
                cause: e
            });
        }
        throw e;
    }
    return msg.message;
}
function mergeFromJson(schema, target, json, options) {
    try {
        readMessage((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(schema, target), json, makeReadOptions(options));
    } catch (e) {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isFieldError"])(e)) {
            // @ts-expect-error we use the ES2022 error CTOR option "cause" for better stack traces
            throw new Error(`cannot decode ${e.field()} from JSON: ${e.message}`, {
                cause: e
            });
        }
        throw e;
    }
    return target;
}
function enumFromJson(descEnum, json) {
    return readEnum(descEnum, json, false);
}
function isEnumJson(descEnum, value) {
    return undefined !== descEnum.values.find((v)=>v.name === value);
}
const messageJsonFields = new WeakMap();
function getJsonField(desc, jsonKey) {
    var _a;
    if (!messageJsonFields.has(desc)) {
        const jsonNames = new Map();
        for (const field of desc.fields){
            jsonNames.set(field.name, field).set(field.jsonName, field);
        }
        messageJsonFields.set(desc, jsonNames);
    }
    return (_a = messageJsonFields.get(desc)) === null || _a === void 0 ? void 0 : _a.get(jsonKey);
}
function readMessage(msg, json, opts) {
    var _a;
    if (tryWktFromJson(msg, json, opts)) {
        return;
    }
    if (json == null || Array.isArray(json) || typeof json != "object") {
        throw new Error(`cannot decode ${msg.desc} from JSON: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    const oneofSeen = new Map();
    for (const [jsonKey, jsonValue] of Object.entries(json)){
        const field = getJsonField(msg.desc, jsonKey);
        if (field) {
            if (field.oneof) {
                if (jsonValue === null && field.fieldKind == "scalar") {
                    continue;
                }
                const seen = oneofSeen.get(field.oneof);
                if (seen !== undefined) {
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field.oneof, `oneof set multiple times by ${seen.name} and ${field.name}`);
                }
                oneofSeen.set(field.oneof, field);
            }
            readField(msg, field, jsonValue, opts);
        } else {
            let extension = undefined;
            if (jsonKey.startsWith("[") && jsonKey.endsWith("]") && // biome-ignore lint/suspicious/noAssignInExpressions: no
            (extension = (_a = opts.registry) === null || _a === void 0 ? void 0 : _a.getExtension(jsonKey.substring(1, jsonKey.length - 1))) && extension.extendee.typeName === msg.desc.typeName) {
                const [container, field, get] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$extensions$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createExtensionContainer"])(extension);
                readField(container, field, jsonValue, opts);
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$extensions$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["setExtension"])(msg.message, extension, get());
            }
            if (!extension && !opts.ignoreUnknownFields) {
                throw new Error(`cannot decode ${msg.desc} from JSON: key "${jsonKey}" is unknown`);
            }
        }
    }
}
function readField(msg, field, json, opts) {
    switch(field.fieldKind){
        case "scalar":
            readScalarField(msg, field, json);
            break;
        case "enum":
            readEnumField(msg, field, json, opts);
            break;
        case "message":
            readMessageField(msg, field, json, opts);
            break;
        case "list":
            readListField(msg.get(field), json, opts);
            break;
        case "map":
            readMapField(msg.get(field), json, opts);
            break;
    }
}
function readListOrMapItem(field, json, opts) {
    if (field.scalar && json !== null) {
        return scalarFromJson(field, json);
    }
    if (field.message && !isResetSentinelNullValue(field, json)) {
        const msgValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(field.message);
        readMessage(msgValue, json, opts);
        return msgValue;
    }
    if (field.enum && !isResetSentinelNullValue(field, json)) {
        return readEnum(field.enum, json, opts.ignoreUnknownFields);
    }
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, `${field.fieldKind === "list" ? "list item" : "map value"} must not be null`);
}
function readMapField(map, json, opts) {
    if (json === null) {
        return;
    }
    const field = map.field();
    if (typeof json != "object" || Array.isArray(json)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, "expected object, got " + (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json));
    }
    for (const [jsonMapKey, jsonMapValue] of Object.entries(json)){
        const key = mapKeyFromJson(field.mapKey, jsonMapKey);
        const value = readListOrMapItem(field, jsonMapValue, opts);
        if (value !== tokenIgnoredUnknownEnum) {
            map.set(key, value);
        }
    }
}
function readListField(list, json, opts) {
    if (json === null) {
        return;
    }
    const field = list.field();
    if (!Array.isArray(json)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, "expected Array, got " + (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json));
    }
    for (const jsonItem of json){
        const value = readListOrMapItem(field, jsonItem, opts);
        if (value !== tokenIgnoredUnknownEnum) {
            list.add(value);
        }
    }
}
function readMessageField(msg, field, json, opts) {
    if (isResetSentinelNullValue(field, json)) {
        msg.clear(field);
        return;
    }
    const msgValue = msg.isSet(field) ? msg.get(field) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(field.message);
    readMessage(msgValue, json, opts);
    msg.set(field, msgValue);
}
function readEnumField(msg, field, json, opts) {
    if (isResetSentinelNullValue(field, json)) {
        msg.clear(field);
        return;
    }
    const enumValue = readEnum(field.enum, json, opts.ignoreUnknownFields);
    if (enumValue !== tokenIgnoredUnknownEnum) {
        msg.set(field, enumValue);
    }
}
function readScalarField(msg, field, json) {
    if (json === null) {
        msg.clear(field);
    } else {
        msg.set(field, scalarFromJson(field, json));
    }
}
/**
 * Indicates whether a value is a sentinel for reseting a field.
 *
 * For this to be true, the value must be a JSON null and the field must not
 * permit a present, Protobuf-serializable null.
 *
 * Only message google.protobuf.Value and enum google.protobuf.NullValue fields
 * permit Protobuf-serializable nulls.
 *
 * Note that field-resetting sentinel nulls are not permitted in lists and maps.
 */ function isResetSentinelNullValue(field, json) {
    var _a, _b;
    return json === null && ((_a = field.message) === null || _a === void 0 ? void 0 : _a.typeName) != "google.protobuf.Value" && ((_b = field.enum) === null || _b === void 0 ? void 0 : _b.typeName) != "google.protobuf.NullValue";
}
const tokenIgnoredUnknownEnum = Symbol();
function readEnum(desc, json, ignoreUnknownFields) {
    if (json === null) {
        return desc.values[0].number;
    }
    switch(typeof json){
        case "number":
            if (Number.isInteger(json)) {
                return json;
            }
            break;
        case "string":
            const value = desc.values.find((ev)=>ev.name === json);
            if (value !== undefined) {
                return value.number;
            }
            if (ignoreUnknownFields) {
                return tokenIgnoredUnknownEnum;
            }
            break;
    }
    throw new Error(`cannot decode ${desc} from JSON: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
}
/**
 * Try to parse a JSON value to a scalar value for the reflect API.
 *
 * Returns the input if the JSON value cannot be converted. Raises a FieldError
 * if conversion would be ambiguous.
 */ function scalarFromJson(field, json) {
    // int64, sfixed64, sint64, fixed64, uint64: Reflect supports string and number.
    // string, bool: Supported by reflect.
    switch(field.scalar){
        // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
        // Either numbers or strings are accepted. Exponent notation is also accepted.
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].DOUBLE:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FLOAT:
            if (json === "NaN") return NaN;
            if (json === "Infinity") return Number.POSITIVE_INFINITY;
            if (json === "-Infinity") return Number.NEGATIVE_INFINITY;
            if (typeof json == "number") {
                if (Number.isNaN(json)) {
                    // NaN must be encoded with string constants
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, "unexpected NaN number");
                }
                if (!Number.isFinite(json)) {
                    // Infinity must be encoded with string constants
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, "unexpected infinite number");
                }
                break;
            }
            if (typeof json == "string") {
                if (json === "") {
                    break;
                }
                if (json.trim().length !== json.length) {
                    break;
                }
                const float = Number(json);
                if (!Number.isFinite(float)) {
                    break;
                }
                return float;
            }
            break;
        // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
            return int32FromJson(json);
        // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
        // Either standard or URL-safe base64 encoding with/without paddings are accepted.
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BYTES:
            if (typeof json == "string") {
                if (json === "") {
                    return new Uint8Array(0);
                }
                try {
                    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wire$2f$base64$2d$encoding$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["base64Decode"])(json);
                } catch (e) {
                    const message = e instanceof Error ? e.message : String(e);
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$error$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["FieldError"](field, message);
                }
            }
            break;
    }
    return json;
}
/**
 * Try to parse a JSON value to a map key for the reflect API.
 *
 * Returns the input if the JSON value cannot be converted.
 */ function mapKeyFromJson(type, jsonString) {
    switch(type){
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].BOOL:
            switch(jsonString){
                case "true":
                    return true;
                case "false":
                    return false;
            }
            return jsonString;
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].INT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].FIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].UINT32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SFIXED32:
        case __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$descriptors$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ScalarType"].SINT32:
            return int32FromJson(jsonString);
        default:
            return jsonString;
    }
}
/**
 * Try to parse a JSON value to a 32-bit integer for the reflect API.
 *
 * Returns the input if the JSON value cannot be converted.
 */ function int32FromJson(json) {
    if (typeof json == "string") {
        if (json === "") {
            // empty string is not a number
            return json;
        }
        if (json.trim().length !== json.length) {
            // extra whitespace
            return json;
        }
        const num = Number(json);
        if (Number.isNaN(num)) {
            // not a number
            return json;
        }
        return num;
    }
    return json;
}
function parseJsonString(jsonString, typeName) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(`cannot decode message ${typeName} from JSON: ${message}`, // @ts-expect-error we use the ES2022 error CTOR option "cause" for better stack traces
        {
            cause: e
        });
    }
}
function tryWktFromJson(msg, jsonValue, opts) {
    if (!msg.desc.typeName.startsWith("google.protobuf.")) {
        return false;
    }
    switch(msg.desc.typeName){
        case "google.protobuf.Any":
            anyFromJson(msg.message, jsonValue, opts);
            return true;
        case "google.protobuf.Timestamp":
            timestampFromJson(msg.message, jsonValue);
            return true;
        case "google.protobuf.Duration":
            durationFromJson(msg.message, jsonValue);
            return true;
        case "google.protobuf.FieldMask":
            fieldMaskFromJson(msg.message, jsonValue);
            return true;
        case "google.protobuf.Struct":
            structFromJson(msg.message, jsonValue);
            return true;
        case "google.protobuf.Value":
            valueFromJson(msg.message, jsonValue);
            return true;
        case "google.protobuf.ListValue":
            listValueFromJson(msg.message, jsonValue);
            return true;
        default:
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$wrappers$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["isWrapperDesc"])(msg.desc)) {
                const valueField = msg.desc.fields[0];
                if (jsonValue === null) {
                    msg.clear(valueField);
                } else {
                    msg.set(valueField, scalarFromJson(valueField, jsonValue));
                }
                return true;
            }
            return false;
    }
}
function anyFromJson(any, json, opts) {
    var _a;
    if (json === null || Array.isArray(json) || typeof json != "object") {
        throw new Error(`cannot decode message ${any.$typeName} from JSON: expected object but got ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    if (Object.keys(json).length == 0) {
        return;
    }
    const typeUrl = json["@type"];
    if (typeof typeUrl != "string" || typeUrl == "") {
        throw new Error(`cannot decode message ${any.$typeName} from JSON: "@type" is empty`);
    }
    const typeName = typeUrl.includes("/") ? typeUrl.substring(typeUrl.lastIndexOf("/") + 1) : typeUrl;
    if (!typeName.length) {
        throw new Error(`cannot decode message ${any.$typeName} from JSON: "@type" is invalid`);
    }
    const desc = (_a = opts.registry) === null || _a === void 0 ? void 0 : _a.getMessage(typeName);
    if (!desc) {
        throw new Error(`cannot decode message ${any.$typeName} from JSON: ${typeUrl} is not in the type registry`);
    }
    const msg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["reflect"])(desc);
    if (typeName.startsWith("google.protobuf.") && Object.prototype.hasOwnProperty.call(json, "value")) {
        const value = json.value;
        readMessage(msg, value, opts);
    } else {
        const copy = Object.assign({}, json);
        // biome-ignore lint/performance/noDelete: <explanation>
        delete copy["@type"];
        readMessage(msg, copy, opts);
    }
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$any$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["anyPack"])(msg.desc, msg.message, any);
}
function timestampFromJson(timestamp, json) {
    if (typeof json !== "string") {
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    const matches = json.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,9}))?(?:Z|([+-][0-9][0-9]:[0-9][0-9]))$/);
    if (!matches) {
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: invalid RFC 3339 string`);
    }
    const ms = Date.parse(// biome-ignore format: want this to read well
    matches[1] + "-" + matches[2] + "-" + matches[3] + "T" + matches[4] + ":" + matches[5] + ":" + matches[6] + (matches[8] ? matches[8] : "Z"));
    if (Number.isNaN(ms)) {
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: invalid RFC 3339 string`);
    }
    if (ms < Date.parse("0001-01-01T00:00:00Z") || ms > Date.parse("9999-12-31T23:59:59Z")) {
        throw new Error(`cannot decode message ${timestamp.$typeName} from JSON: must be from 0001-01-01T00:00:00Z to 9999-12-31T23:59:59Z inclusive`);
    }
    timestamp.seconds = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(ms / 1000);
    timestamp.nanos = 0;
    if (matches[7]) {
        timestamp.nanos = parseInt("1" + matches[7] + "0".repeat(9 - matches[7].length)) - 1000000000;
    }
}
function durationFromJson(duration, json) {
    if (typeof json !== "string") {
        throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    const match = json.match(/^(-?[0-9]+)(?:\.([0-9]+))?s/);
    if (match === null) {
        throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    const longSeconds = Number(match[1]);
    if (longSeconds > 315576000000 || longSeconds < -315576000000) {
        throw new Error(`cannot decode message ${duration.$typeName} from JSON: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    duration.seconds = __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$proto$2d$int64$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoInt64"].parse(longSeconds);
    if (typeof match[2] !== "string") {
        return;
    }
    const nanosStr = match[2] + "0".repeat(9 - match[2].length);
    duration.nanos = parseInt(nanosStr);
    if (longSeconds < 0 || Object.is(longSeconds, -0)) {
        duration.nanos = -duration.nanos;
    }
}
function fieldMaskFromJson(fieldMask, json) {
    if (typeof json !== "string") {
        throw new Error(`cannot decode message ${fieldMask.$typeName} from JSON: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    if (json === "") {
        return;
    }
    fieldMask.paths = json.split(",").map((path)=>{
        if (path.includes("_")) {
            throw new Error(`cannot decode message ${fieldMask.$typeName} from JSON: path names must be lowerCamelCase`);
        }
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$names$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["protoSnakeCase"])(path);
    });
}
function structFromJson(struct, json) {
    if (typeof json != "object" || json == null || Array.isArray(json)) {
        throw new Error(`cannot decode message ${struct.$typeName} from JSON ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    for (const [k, v] of Object.entries(json)){
        const parsedV = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$struct_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ValueSchema"]);
        valueFromJson(parsedV, v);
        struct.fields[k] = parsedV;
    }
}
function valueFromJson(value, json) {
    switch(typeof json){
        case "number":
            value.kind = {
                case: "numberValue",
                value: json
            };
            break;
        case "string":
            value.kind = {
                case: "stringValue",
                value: json
            };
            break;
        case "boolean":
            value.kind = {
                case: "boolValue",
                value: json
            };
            break;
        case "object":
            if (json === null) {
                value.kind = {
                    case: "nullValue",
                    value: __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$struct_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NullValue"].NULL_VALUE
                };
            } else if (Array.isArray(json)) {
                const listValue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$struct_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ListValueSchema"]);
                listValueFromJson(listValue, json);
                value.kind = {
                    case: "listValue",
                    value: listValue
                };
            } else {
                const struct = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$struct_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["StructSchema"]);
                structFromJson(struct, json);
                value.kind = {
                    case: "structValue",
                    value: struct
                };
            }
            break;
        default:
            throw new Error(`cannot decode message ${value.$typeName} from JSON ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    return value;
}
function listValueFromJson(listValue, json) {
    if (!Array.isArray(json)) {
        throw new Error(`cannot decode message ${listValue.$typeName} from JSON ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$reflect$2f$reflect$2d$check$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["formatVal"])(json)}`);
    }
    for (const e of json){
        const value = (0, __TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$create$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["create"])(__TURBOPACK__imported__module__$5b$project$5d2f$projects$2f$next$2d$js$2d$boilerplate$2f$node_modules$2f40$bufbuild$2f$protobuf$2f$dist$2f$esm$2f$wkt$2f$gen$2f$google$2f$protobuf$2f$struct_pb$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["ValueSchema"]);
        valueFromJson(value, e);
        listValue.values.push(value);
    }
}
}),
];

//# debugId=4ab29864-68fc-b0d7-1c40-d97684c979bc
//# sourceMappingURL=b5a40_%40bufbuild_protobuf_dist_esm_d53dae33._.js.map