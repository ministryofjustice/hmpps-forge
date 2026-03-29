"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable import/no-extraneous-dependencies */
var plugin_typescript_1 = require("@rollup/plugin-typescript");
var plugin_node_resolve_1 = require("@rollup/plugin-node-resolve");
var rollup_plugin_dts_1 = require("rollup-plugin-dts");
/* eslint-enable import/no-extraneous-dependencies */
var subpaths = {
    core: 'form-engine/src/index.ts',
    'core/authoring': 'form-engine/src/authoring/index.ts',
    'core/components': 'form-engine/src/components/index.ts',
    'core/framework': 'form-engine/src/framework/index.ts',
    'core/testing': 'form-engine/src/testing/index.ts',
    'express-nunjucks': 'form-engine-express-nunjucks/src/index.ts',
    'govuk-components': 'form-engine-govuk-components/src/index.ts',
    'moj-components': 'form-engine-moj-components/src/index.ts',
};
var external = ['bunyan', 'express', 'express-session', 'hmpps-forge/core', 'http-errors', 'nunjucks', 'zod'];
var externalPrefixes = [
    'hmpps-forge/core/',
    'hmpps-forge/express-nunjucks',
    'hmpps-forge/govuk-components',
    'hmpps-forge/moj-components',
];
var isExternal = function (id) {
    if (external.includes(id)) {
        return true;
    }
    return externalPrefixes.some(function (prefix) { return id === prefix || id.startsWith(prefix); });
};
var jsConfigs = Object.entries(subpaths).map(function (_a) {
    var name = _a[0], input = _a[1];
    return ({
        input: input,
        output: [
            { file: "dist/".concat(name, "/index.cjs.js"), format: 'cjs', sourcemap: true },
            { file: "dist/".concat(name, "/index.esm.js"), format: 'esm', sourcemap: true },
        ],
        plugins: [
            (0, plugin_node_resolve_1.nodeResolve)({ preferBuiltins: true }),
            (0, plugin_typescript_1.default)({
                tsconfig: './tsconfig.json',
                noEmitOnError: false,
                declaration: false,
                declarationDir: undefined,
            }),
        ],
        external: isExternal,
    });
});
var dtsConfigs = Object.entries(subpaths).map(function (_a) {
    var name = _a[0], input = _a[1];
    return ({
        input: input,
        output: {
            file: "dist/".concat(name, "/index.d.ts"),
            format: 'esm',
            paths: function (id) { return id; },
        },
        plugins: [(0, rollup_plugin_dts_1.dts)({ tsconfig: './tsconfig.json', respectExternal: true })],
        external: isExternal,
    });
});
exports.default = __spreadArray(__spreadArray([], jsConfigs, true), dtsConfigs, true);
