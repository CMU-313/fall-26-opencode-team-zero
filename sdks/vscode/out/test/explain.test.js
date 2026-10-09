"use strict";
/// <reference types="node" />
/// <reference types="mocha" />
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert/strict"));
const explain_1 = require("../explain");
const runner = process.versions.bun
    ? require("bun:test")
    : { describe: suite, test };
runner.describe("Explain selected code", () => {
    runner.test("uses the selected line range", () => {
        assert.deepEqual((0, explain_1.selectedLineRange)({ startLine: 3, endLine: 5, endCharacter: 8 }), { start: 4, end: 6 });
    });
    runner.test("does not include the next line when a selection ends at column zero", () => {
        assert.deepEqual((0, explain_1.selectedLineRange)({ startLine: 3, endLine: 5, endCharacter: 0 }), { start: 4, end: 5 });
    });
    runner.test("includes the file reference, selected text, and learning guidance", () => {
        const prompt = (0, explain_1.buildExplanationPrompt)({
            relativePath: "src/example.ts",
            languageId: "typescript",
            text: "const answer = 42",
            startLine: 6,
            endLine: 6,
            endCharacter: 17,
        });
        assert.match(prompt, /@src\/example\.ts#L7/);
        assert.match(prompt, /const answer = 42/);
        assert.match(prompt, /beginner-friendly/);
        assert.match(prompt, /Do not modify any files/);
    });
    runner.test("formats a multi-line file reference for opencode", () => {
        const prompt = (0, explain_1.buildExplanationPrompt)({
            relativePath: "src/example.ts",
            languageId: "typescript",
            text: "const first = 1\nconst second = 2",
            startLine: 3,
            endLine: 4,
            endCharacter: 16,
        });
        assert.match(prompt, /@src\/example\.ts#L4-5/);
    });
    runner.test("uses a code fence longer than fences in the selected text", () => {
        const prompt = (0, explain_1.buildExplanationPrompt)({
            relativePath: "README.md",
            languageId: "markdown",
            text: "```ts\nconst value = true\n```",
            startLine: 0,
            endLine: 2,
            endCharacter: 3,
        });
        assert.match(prompt, /````markdown/);
        assert.ok(prompt.endsWith("````"));
    });
    runner.test("builds a beginner-friendly suggestion request with cursor context", () => {
        const prompt = (0, explain_1.buildCodeSuggestionPrompt)({
            relativePath: "src/example.ts",
            languageId: "typescript",
            text: "function total(values: number[]) {\n  \n}",
            startLine: 9,
            endLine: 11,
            cursorLine: 10,
            cursorCharacter: 2,
        });
        assert.match(prompt, /@src\/example\.ts#L11/);
        assert.match(prompt, /Cursor: line 11, column 3/);
        assert.match(prompt, /Context lines: 10-12/);
        assert.match(prompt, /function total/);
        assert.match(prompt, /beginner-friendly explanation/);
        assert.match(prompt, /Do not modify any files/);
    });
});
//# sourceMappingURL=explain.test.js.map