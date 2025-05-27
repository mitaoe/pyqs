import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
import {
    branchMappings,
    yearMappings,
    examMappings,
    semesterMappings,
    STANDARD_VALUES,
    firstYearPatterns,
} from "../config/mappings";
import PaperModel from "../models/Paper";
import { DirectoryNode, Paper } from "../types/paper";
import { SubjectManager } from "../utils/SubjectManager";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const BASE_URL =
    "http://43.227.20.36:82/DigitalLibrary/Old%20Question%20Papers/B%20Tech%20(Autonomy)/";
const DEFAULT_TEST_DIR = "/2%200%201%206/"; // Default test directory

const args = process.argv.slice(2);
const TEST_MODE = args.includes("--test") || args.includes("-t");
const VERBOSE = args.includes("--verbose") || args.includes("-v");
const LIST_ONLY = args.includes("--list-only") || args.includes("-l");

const INTERACTIVE = args.includes("--interactive") || args.includes("-i");

const testDirIndex = args.indexOf("--test-dir");
const TEST_DIR =
    testDirIndex !== -1 && args[testDirIndex + 1]
        ? args[testDirIndex + 1]
        : DEFAULT_TEST_DIR;

const LOG_DIR = path.join(process.cwd(), "logs");
const ERROR_LOG_FILE = path.join(
    LOG_DIR,
    `crawler-errors-${new Date().toISOString().split("T")[0]}.log`
);
const METADATA_LOG_FILE = path.join(
    LOG_DIR,
    `crawler-metadata-${new Date().toISOString().split("T")[0]}.log`
);

const subjectManager = new SubjectManager();

if (TEST_MODE) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(
    level: "INFO" | "ERROR" | "METADATA",
    message: string,
    data?: unknown
) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level}: ${message}${
        data ? "\n" + JSON.stringify(data, null, 2) : ""
    }\n`;

    if (level === "ERROR" || VERBOSE || level === "METADATA") {
        if (level === "ERROR") {
            console.error(logMessage);
        } else {
            console.log(logMessage);
        }
    }

    if (TEST_MODE) {
        try {
            if (level === "ERROR") {
                fs.appendFileSync(ERROR_LOG_FILE, logMessage);
            } else if (level === "METADATA") {
                fs.appendFileSync(METADATA_LOG_FILE, logMessage);
            }
        } catch (err) {
            console.error("Failed to write to log file:", err);
        }
    }
}

interface DirectoryItem {
    name: string;
    isDirectory: boolean;
    path: string;
}

function cleanString(str: string): string {
    return str.replace(/\s+/g, " ").trim().toUpperCase();
}

function getPathParts(path: string): string[] {
    const decodedPath = decodeURIComponent(path);
    const basePath = "/Old Question Papers/B Tech (Autonomy)/";
    const parts = decodedPath.split(basePath)[1]?.split("/") || [];
    return parts.filter((part) => part.length > 0).map(cleanString);
}

async function fetchDirectory(urlStr: string): Promise<DirectoryItem[]> {
    try {
        let fullUrl = urlStr;
        if (!fullUrl.startsWith("http")) {
            if (fullUrl.startsWith("/")) {
                fullUrl = fullUrl.substring(1);
            }
            fullUrl = BASE_URL + fullUrl;
        }

        fullUrl = fullUrl.replace(/([^:])\/\//g, "$1/");

        fullUrl = fullUrl.replace(/&/g, "%26");

        if (VERBOSE) {
            log("INFO", `Fetching URL: ${fullUrl}`);
        }

        const response = await fetch(fullUrl, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            },
        });

        if (response.ok) {
            const html = await response.text();
            return parseDirectoryListing(html, urlStr);
        } else {
            log(
                "ERROR",
                `Failed to fetch URL (${response.status}): ${fullUrl}`
            );
            return [];
        }
    } catch (error) {
        log("ERROR", `Exception fetching directory ${urlStr}:`, error);
        return [];
    }
}

function parseDirectoryListing(
    html: string,
    currentPath: string
): DirectoryItem[] {
    const items: DirectoryItem[] = [];
    const $ = cheerio.load(html);

    $("a").each((_, link) => {
        const $link = $(link);
        const href = $link.attr("href");
        let name = $link.text().trim();

        if (name === "[To Parent Directory]" || !href) {
            return;
        }

        if (name.endsWith("/")) {
            name = name.slice(0, -1);
        }

        name = name.replace(/\s+/g, " ").trim();

        if (href.endsWith("/")) {
            items.push({
                name: name,
                isDirectory: true,
                path: new URL(href, currentPath).href,
            });

            if (TEST_MODE) {
                log(
                    "INFO",
                    `Found directory: ${name} at ${
                        new URL(href, currentPath).href
                    }`
                );
            }
        } else if (href.endsWith(".pdf")) {
            items.push({
                name,
                isDirectory: false,
                path: new URL(href, currentPath).href,
            });
        }
    });

    return items;
}

function extractYear(path: string, fileName: string): string {
    const pathYearMatch = path.match(/\/2\s*0\s*(\d\s*\d)/);
    if (pathYearMatch) {
        const year = pathYearMatch[0].replace(/\s+/g, "").slice(1); // Remove leading slash and spaces
        if (year >= "2016" && year <= "2025") {
            return year;
        }
    }

    const fileYearMatch = fileName.match(/20\d{2}/);
    if (fileYearMatch) {
        const year = fileYearMatch[0];
        if (year >= "2016" && year <= "2025") {
            return year;
        }
    }

    const upperFileName = fileName.toUpperCase();
    for (const [pattern, mappedYear] of Object.entries(yearMappings)) {
        if (upperFileName.includes(pattern)) {
            return mappedYear;
        }
    }

    const pathParts = getPathParts(path);
    for (const part of pathParts) {
        if (
            part.includes("DEC") ||
            part.includes("NOV") ||
            part.includes("OCT")
        ) {
            const yearMatch = part.match(/\b20\d{2}\b/);
            if (yearMatch) {
                return yearMatch[0];
            }
        }
    }

    return "Unknown";
}

function isFirstYearPaper(fileName: string, path: string): boolean {
    const upperFileName = fileName.toUpperCase();

    for (const pattern of firstYearPatterns) {
        if (pattern.test(upperFileName)) {
            return true;
        }
    }

    const pathParts = getPathParts(path);
    for (const part of pathParts) {
        for (const pattern of firstYearPatterns) {
            if (pattern.test(part)) {
                return true;
            }
        }
    }

    return false;
}

function extractBranch(path: string, fileName: string): string {
    if (isFirstYearPaper(fileName, path)) {
        if (VERBOSE) {
            log("INFO", `Branch: First Year -> COMMON for ${fileName}`);
        }
        return STANDARD_VALUES.BRANCHES.COMMON;
    }

    const pathParts = getPathParts(path);
    const upperFileName = fileName.toUpperCase();

    if (
        upperFileName.includes("M.TECH") ||
        upperFileName.includes("MTECH") ||
        upperFileName.includes("M TECH") ||
        path.includes("M.TECH") ||
        path.includes("MTECH") ||
        path.includes("M TECH")
    ) {
        if (VERBOSE) {
            log(
                "INFO",
                `Branch Match (MTech): ${fileName} -> ${STANDARD_VALUES.BRANCHES.MTECH}`
            );
        }
        return STANDARD_VALUES.BRANCHES.MTECH;
    }

    if (
        upperFileName.includes("RE EXAM") ||
        upperFileName.includes("RE-EXAM") ||
        path.includes("RE EXAM") ||
        path.includes("RE-EXAM") ||
        path.includes("DEC Re Exam")
    ) {
        for (const [abbr, branch] of Object.entries(branchMappings)) {
            if (abbr === "BTECH" || abbr === "COMMON" || abbr === "MTECH")
                continue;

            const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`\\b${escapedAbbr}\\b`, "i");

            if (regex.test(upperFileName)) {
                if (VERBOSE) {
                    log(
                        "INFO",
                        `Branch Match (Re-Exam): ${fileName} -> ${branch}`
                    );
                }
                return branch;
            }

            for (const part of pathParts) {
                if (regex.test(part)) {
                    if (VERBOSE) {
                        log(
                            "INFO",
                            `Branch Match (Re-Exam Path): ${fileName} -> ${branch}`
                        );
                    }
                    return branch;
                }
            }
        }
    }

    for (const [abbr, branch] of Object.entries(branchMappings)) {
        const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escapedAbbr}\\b`, "i");
        if (regex.test(upperFileName)) {
            if (VERBOSE) {
                log(
                    "INFO",
                    `Branch Match (Filename): ${fileName} -> ${branch}`
                );
                log("INFO", `Match pattern: ${abbr}`);
            }
            return branch;
        }
    }

    for (const part of pathParts) {
        for (const [abbr, branch] of Object.entries(branchMappings)) {
            const escapedAbbr = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`\\b${escapedAbbr}\\b`, "i");
            if (regex.test(part)) {
                if (VERBOSE) {
                    log(
                        "INFO",
                        `Branch Match (Path): ${fileName} -> ${branch}`
                    );
                    log("INFO", `Match pattern: ${abbr} in path part: ${part}`);
                }
                return branch;
            }
        }
    }

    if (
        upperFileName.includes("BTECH") ||
        upperFileName.includes("B.TECH") ||
        upperFileName.includes("B TECH")
    ) {
        if (VERBOSE) {
            log(
                "INFO",
                `Branch Fallback (BTech): ${fileName} -> ${STANDARD_VALUES.BRANCHES.COMMON}`
            );
        }
        return STANDARD_VALUES.BRANCHES.COMMON;
    }

    for (const part of pathParts) {
        if (
            part.includes("BTECH") ||
            part.includes("B.TECH") ||
            part.includes("B TECH")
        ) {
            if (VERBOSE) {
                log(
                    "INFO",
                    `Branch Fallback (BTech Path): ${fileName} -> ${STANDARD_VALUES.BRANCHES.COMMON}`
                );
            }
            return STANDARD_VALUES.BRANCHES.COMMON;
        }
    }

    if (VERBOSE) {
        log("ERROR", `Branch Extraction Failed: ${fileName}`);
        log("INFO", `File Path: ${path}`);
        log("INFO", `Path Parts: ${pathParts.join(" | ")}`);
    }

    return "Unknown";
}

function extractSemester(path: string, fileName: string): string {
    const upperFileName = fileName.toUpperCase();

    const semRegex = /SEM(?:ESTER)?[\s-]*([IVX\d]+)/i;
    const semMatch = upperFileName.match(semRegex);

    if (semMatch && semMatch[1]) {
        const semValue = semMatch[1].trim();
        if (semesterMappings[semValue]) {
            return semesterMappings[semValue];
        }
    }

    for (const [pattern, value] of Object.entries(semesterMappings)) {
        const regex = new RegExp(`\\b${pattern}\\b`, "i");
        if (regex.test(upperFileName)) {
            return value;
        }
    }

    if (isFirstYearPaper(fileName, path)) {
        return STANDARD_VALUES.SEMESTERS.SEM1;
    }

    return "Unknown";
}

function extractExamType(path: string, fileName: string): string {
    const upperFileName = fileName.toUpperCase();
    const pathParts = getPathParts(path);

    for (const part of pathParts) {
        if (
            part.includes("RE EXAM") ||
            part.includes("REEXAM") ||
            part.includes("RE-EXAM")
        ) {
            return STANDARD_VALUES.EXAM_TYPES.ESE;
        }
    }

    for (const [pattern, value] of Object.entries(examMappings)) {
        const regex = new RegExp(`\\b${pattern}\\b`, "i");
        if (regex.test(upperFileName)) {
            return value;
        }
    }

    for (const part of pathParts) {
        for (const [pattern, value] of Object.entries(examMappings)) {
            const regex = new RegExp(`\\b${pattern}\\b`, "i");
            if (regex.test(part)) {
                return value;
            }
        }
    }

    if (upperFileName.includes("END COURSE"))
        return STANDARD_VALUES.EXAM_TYPES.ESE;
    if (upperFileName.includes("UNIT TEST"))
        return STANDARD_VALUES.EXAM_TYPES.UT;
    if (upperFileName.includes("CYCLE")) return STANDARD_VALUES.EXAM_TYPES.CAT;

    return "Unknown";
}

async function extractSubject(
    fileName: string,
    filePath: string,
    verbose = false
): Promise<{ subject: string; standardSubject: string }> {
    try {
        const fullNamePart = path
            .basename(fileName, path.extname(fileName))
            .replace(/[_\-\.]/g, " ")
            .toUpperCase();

        if (verbose) {
            console.log(`Testing full filename: ${fullNamePart}`);
            console.log(`Original filename: ${fileName}`);
            log("METADATA", `Checking full filename part: ${fullNamePart}`, {
                fileName,
                filePath,
            });
        }

        let matches = subjectManager.getMatchingVariations(
            fullNamePart,
            verbose
        );

        if (matches.length === 0) {
            const subjectPart = extractSubjectPartFromFilename(fileName);

            if (verbose) {
                log(
                    "METADATA",
                    `Falling back to extracted subject part: ${subjectPart}`,
                    { fileName, filePath }
                );
            }

            matches = subjectManager.getMatchingVariations(
                subjectPart,
                verbose
            );
        }

        if (matches.length > 0) {
            const bestMatch = matches[0];

            if (!INTERACTIVE) {
                processedFilesCount++;
            }

            if (verbose || INTERACTIVE) {
                log(
                    "METADATA",
                    `✅ Subject Match: ${bestMatch.variation} -> ${bestMatch.standard}`,
                    { fileName, filePath }
                );

                if (INTERACTIVE) {
                    const fullUrl = new URL(filePath, BASE_URL).toString();

                    processedFilesCount++;

                    console.log(`\n------------------------------`);
                    console.log(`📊 Processed: ${processedFilesCount} files`);
                    console.log(`File: ${fileName}`);
                    console.log(`URL: ${fullUrl}`);
                    console.log(
                        `✅ Auto-classified as: ${bestMatch.standard} (${bestMatch.subjectKey})`
                    );
                    console.log(`------------------------------`);
                }
            }

            return {
                subject: bestMatch.variation,
                standardSubject: bestMatch.standard,
            };
        }

        if (INTERACTIVE) {
            const relativePath = filePath.replace(BASE_URL, "");

            const fullUrl = new URL(filePath, BASE_URL).toString();

            processedFilesCount++;

            console.log(`\n------------------------------`);
            console.log(`📊 Processed: ${processedFilesCount} files`);
            console.log(`File: ${fileName}`);
            console.log(`URL: ${fullUrl}`);
            console.log(`❌ Unable to automatically classify subject.`);

            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            return await new Promise((resolve) => {
                console.log(`\n📊 Processed: ${processedFilesCount} files`);

                rl.question(
                    `File name part [${fullNamePart}] (or "s" to skip, "q" to quit, "e" to exclude, "f" to use file name): `,
                    async (correctSubjectPart: string) => {
                        if (correctSubjectPart.toLowerCase() === "s") {
                            await subjectManager.addUnclassified(relativePath);
                            rl.close();
                            return resolve({
                                subject: "Unknown Subject",
                                standardSubject: "Unknown Subject",
                            });
                        }

                        if (correctSubjectPart.toLowerCase() === "e") {
                            await subjectManager.addExclusion(relativePath);
                            rl.close();
                            return resolve({
                                subject: "Unknown Subject",
                                standardSubject: "Unknown Subject",
                            });
                        }

                        if (correctSubjectPart.toLowerCase() === "q") {
                            console.log(
                                "Quitting crawler as requested by user."
                            );
                            process.exit(0);
                        }

                        if (correctSubjectPart.toLowerCase() === "f") {
                            const fileNameWithoutExt = path.basename(
                                fileName,
                                path.extname(fileName)
                            );
                            const nameFromFile =
                                fileNameWithoutExt.charAt(0) +
                                fileNameWithoutExt.slice(1).toLowerCase();

                            console.clear();
                            console.log(
                                `📊 Processed: ${processedFilesCount} files\n`
                            );

                            rl.question(
                                `Subject name [${nameFromFile}]: `,
                                async (subjectName: string) => {
                                    if (!subjectName && !nameFromFile) {
                                        await subjectManager.addUnclassified(
                                            relativePath
                                        );
                                        rl.close();
                                        return resolve({
                                            subject: "Unknown Subject",
                                            standardSubject: "Unknown Subject",
                                        });
                                    }

                                    console.clear();
                                    console.log(
                                        `📊 Processed: ${processedFilesCount} files\n`
                                    );

                                    const finalSubjectName =
                                        subjectName || nameFromFile;

                                    const suggestedKey = finalSubjectName
                                        .toUpperCase()
                                        .replace(/[^A-Z0-9]/g, "_")
                                        .replace(/_+/g, "_")
                                        .replace(/^_|_$/g, "");

                                    rl.question(
                                        `Subject key [${suggestedKey}]: `,
                                        async (subjectKey: string) => {
                                            const finalSubjectKey =
                                                subjectKey || suggestedKey;

                                            try {
                                                try {
                                                    await subjectManager.addSubject(
                                                        finalSubjectKey,
                                                        finalSubjectName
                                                    );
                                                    console.log(
                                                        `✅ Added new subject: ${finalSubjectName} (${finalSubjectKey})`
                                                    );
                                                } catch {
                                                    console.log(
                                                        `ℹ️ Subject key ${finalSubjectKey} already exists, using it`
                                                    );
                                                }

                                                let variationToAdd;
                                                if (
                                                    correctSubjectPart &&
                                                    correctSubjectPart.toLowerCase() !==
                                                        "f"
                                                ) {
                                                    variationToAdd =
                                                        correctSubjectPart.toUpperCase();
                                                    console.log(
                                                        `✅ Added variation: "${correctSubjectPart}" → ${finalSubjectKey}`
                                                    );
                                                } else {
                                                    variationToAdd =
                                                        fileNameWithoutExt.toUpperCase();
                                                    console.log(
                                                        `✅ Added variation: "${fileNameWithoutExt}" → ${finalSubjectKey}`
                                                    );
                                                }

                                                await subjectManager.addVariation(
                                                    variationToAdd,
                                                    finalSubjectKey
                                                );

                                                await subjectManager.addMapping(
                                                    relativePath,
                                                    finalSubjectKey
                                                );

                                                rl.close();

                                                return resolve({
                                                    subject: finalSubjectName,
                                                    standardSubject:
                                                        finalSubjectName,
                                                });
                                            } catch (error: unknown) {
                                                console.error(
                                                    `❌ Failed to add custom subject:`,
                                                    error instanceof Error
                                                        ? error.message
                                                        : String(error)
                                                );
                                                log(
                                                    "ERROR",
                                                    `Failed to add custom subject: ${
                                                        error instanceof Error
                                                            ? error.message
                                                            : String(error)
                                                    }`,
                                                    { fileName, filePath }
                                                );
                                                rl.close();
                                                return resolve({
                                                    subject: "Unknown Subject",
                                                    standardSubject:
                                                        "Unknown Subject",
                                                });
                                            }
                                        }
                                    );
                                }
                            );
                            return;
                        }

                        const finalSubjectPart =
                            correctSubjectPart || fullNamePart;

                        if (
                            correctSubjectPart &&
                            correctSubjectPart.toLowerCase() !== "f" &&
                            !fileName
                                .toUpperCase()
                                .includes(correctSubjectPart.toUpperCase())
                        ) {
                            console.log(
                                `⚠️ Warning: "${correctSubjectPart}" not found in the filename. Please confirm.`
                            );
                            const confirm = await new Promise<string>((res) => {
                                rl.question("Continue anyway? (y/n): ", res);
                            });

                            if (confirm.toLowerCase() !== "y") {
                                rl.close();
                                return resolve({
                                    subject: "Unknown Subject",
                                    standardSubject: "Unknown Subject",
                                });
                            }
                        }

                        console.clear();
                        console.log(
                            `📊 Processed: ${processedFilesCount} files\n`
                        );

                        const nameFromPart =
                            finalSubjectPart.charAt(0) +
                            finalSubjectPart.slice(1).toLowerCase();

                        rl.question(
                            `Subject name [${nameFromPart}]: `,
                            async (subjectName: string) => {
                                if (!subjectName && !nameFromPart) {
                                    await subjectManager.addUnclassified(
                                        relativePath
                                    );
                                    rl.close();
                                    return resolve({
                                        subject: "Unknown Subject",
                                        standardSubject: "Unknown Subject",
                                    });
                                }

                                console.clear();
                                console.log(
                                    `📊 Processed: ${processedFilesCount} files\n`
                                );

                                const finalSubjectName =
                                    subjectName || nameFromPart;

                                const suggestedKey = finalSubjectName
                                    .toUpperCase()
                                    .replace(/[^A-Z0-9]/g, "_")
                                    .replace(/_+/g, "_")
                                    .replace(/^_|_$/g, "");

                                rl.question(
                                    `Subject key [${suggestedKey}]: `,
                                    async (subjectKey: string) => {
                                        const finalSubjectKey =
                                            subjectKey || suggestedKey;

                                        try {
                                            try {
                                                await subjectManager.addSubject(
                                                    finalSubjectKey,
                                                    finalSubjectName
                                                );
                                                console.log(
                                                    `✅ Added new subject: ${finalSubjectName} (${finalSubjectKey})`
                                                );
                                            } catch {
                                                console.log(
                                                    `ℹ️ Subject key ${finalSubjectKey} already exists, using it`
                                                );
                                            }

                                            await subjectManager.addVariation(
                                                finalSubjectPart.toUpperCase(),
                                                finalSubjectKey
                                            );
                                            console.log(
                                                `✅ Added variation: "${finalSubjectPart}" → ${finalSubjectKey}`
                                            );

                                            await subjectManager.addMapping(
                                                relativePath,
                                                finalSubjectKey
                                            );

                                            rl.close();

                                            return resolve({
                                                subject: finalSubjectName,
                                                standardSubject:
                                                    finalSubjectName,
                                            });
                                        } catch (error: unknown) {
                                            console.error(
                                                `❌ Failed to add custom subject:`,
                                                error instanceof Error
                                                    ? error.message
                                                    : String(error)
                                            );
                                            log(
                                                "ERROR",
                                                `Failed to add custom subject: ${
                                                    error instanceof Error
                                                        ? error.message
                                                        : String(error)
                                                }`,
                                                { fileName, filePath }
                                            );
                                            rl.close();
                                            return resolve({
                                                subject: "Unknown Subject",
                                                standardSubject:
                                                    "Unknown Subject",
                                            });
                                        }
                                    }
                                );
                            }
                        );
                    }
                );
            });
        }

        // If we got here, we couldn't determine the subject
        return {
            subject: "Unknown Subject",
            standardSubject: "Unknown Subject",
        };
    } catch (error) {
        log(
            "ERROR",
            `Error in extractSubject: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { fileName, filePath }
        );
        return {
            subject: "Unknown Subject",
            standardSubject: "Unknown Subject",
        };
    }
}

function extractSubjectPartFromFilename(filename: string): string {
    let name = path.basename(filename, path.extname(filename));

    name = name.replace(/[_\-\.]/g, " ");

    const patternGroups = [
        // Year-related patterns
        [
            /\b20(1[5-9]|2[0-4])\b/g, // Years 2015-2024
            /\b(201[5-9]|202[0-4])\b/g, // Years 2015-2024 alternative
            /\b(19|20)\d{2}\b/g, // Any 4-digit year starting with 19 or 20
        ],

        // Semester-related patterns
        [
            /\bSEM\s*[IVX]+\b/gi, // SEM I, SEM II, etc. (Roman numerals)
            /\bSEMESTER\s*[IVX]+\b/gi, // SEMESTER I, etc.
            /\bSEM\s*\d+\b/gi, // SEM 1, SEM 2, etc.
            /\bSEMESTER\s*\d+\b/gi, // SEMESTER 1, etc.
            /\bS\s*\d\b/gi, // S1, S2, etc.
            /\bSEMESTER\b/gi, // Standalone "SEMESTER"
            /\bSEM\b/gi, // Standalone "SEM"
        ],

        // Year indicators
        [
            /\bFE[\s\-_]*BTECH\b/gi, // FE-BTECH and variations
            /\bSY[\s\-_]*BTECH\b/gi, // SY-BTECH and variations
            /\bTY[\s\-_]*BTECH\b/gi, // TY-BTECH and variations
            /\bF[\s\-_]*E\b/gi, // F E, F-E, etc.
            /\bS[\s\-_]*Y\b/gi, // S Y, S-Y, etc.
            /\bT[\s\-_]*Y\b/gi, // T Y, T-Y, etc.
            /\bFE\b/gi, // Standalone FE
            /\bSY\b/gi, // Standalone SY
            /\bTY\b/gi, // Standalone TY
            /\bF\.E\b/gi, // F.E
            /\bS\.Y\b/gi, // S.Y
            /\bT\.Y\b/gi, // T.Y
            /\bBTECH\b/gi, // Standalone BTECH
            /\bB[\s\-_]*TECH\b/gi, // B TECH, B-TECH, etc.
            /\bB\.TECH\b/gi, // B.TECH
        ],

        [
            /\b(cse|it|civil|mech|entc|comp|computer|mechanical|electrical|electronics|instrumentation|information|technology)\b/gi,
        ],

        [
            /\b(insem|endsem|midsem|quiz|assignment|cat1|cat2|fat|prelim|final|exam|paper|question|winter|summer)\b/gi,
            /\bre[\s\-_]*exam\b/gi,
            /\bcycle\s*\d+\b/gi,
        ],

        [
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi,
        ],

        [/\b(syllabus|notes|ppt|pdf|doc|docx|sol|solution|answer|key)\b/gi],

        [
            /\b(engineering|part[12]|unit\d+|chapter\d+)\b/gi,
            /\bAS\b/gi,
            /\bHP\b/gi,
        ],
    ];

    let prevName = "";
    while (prevName !== name) {
        prevName = name;

        for (const patternGroup of patternGroups) {
            for (const pattern of patternGroup) {
                name = name.replace(pattern, " ");
            }
        }

        name = name.replace(/\s+/g, " ").trim();
    }

    name = name.replace(/\s+/g, " ").trim();

    return name.toUpperCase();
}

async function extractMetadata(
    filePath: string,
    fileName: string
): Promise<Paper> {
    try {
        const year = extractYear(filePath, fileName);
        const branch = extractBranch(filePath, fileName);
        const semester = extractSemester(filePath, fileName);
        const examType = extractExamType(filePath, fileName);
        const subjectInfo = await extractSubject(fileName, filePath, VERBOSE);

        const metadata: Paper = {
            fileName,
            url: BASE_URL + filePath,
            year,
            semester,
            branch,
            examType,
            subject: subjectInfo.subject,
            standardSubject: subjectInfo.standardSubject,
        };

        if (
            TEST_MODE &&
            (subjectInfo.subject !== "Unknown Subject" ||
                subjectInfo.standardSubject !== "Unknown Subject")
        ) {
            log("METADATA", "Extracted subject information:", {
                fileName,
                subject: subjectInfo.subject,
                standardSubject: subjectInfo.standardSubject,
            });
        }

        return metadata;
    } catch (error) {
        log("ERROR", "Failed to extract metadata:", {
            fileName,
            filePath,
            error: error instanceof Error ? error.message : "Unknown error",
        });

        return {
            fileName,
            url: BASE_URL + filePath,
            year: "Unknown",
            semester: "Unknown",
            branch: "Unknown",
            examType: "Unknown",
            subject: "Unknown",
            standardSubject: "Unknown",
        };
    }
}

interface PaperCollection {
    papers: Paper[];
    meta: {
        years: string[];
        branches: string[];
        examTypes: string[];
        semesters: string[];
        subjects: string[];
        standardSubjects: string[];
    };
    stats: {
        totalFiles: number;
        totalDirectories: number;
        lastUpdated: Date;
    };
}

function addUniqueValue(arr: string[], value: string) {
    if (value !== "Unknown" && !arr.includes(value)) {
        arr.push(value);
    }
}

function sanitizeKey(key: string): string {
    return key.replace(/\./g, "_").replace(/[$]/g, "_");
}

async function addToStructure(
    structure: DirectoryNode,
    paper: Paper,
    isDirectory: boolean = false
): Promise<void> {
    try {
        const url = new URL(paper.url);
        const urlPath = url.pathname;

        const basePath =
            "/DigitalLibrary/Old Question Papers/B Tech (Autonomy)/";

        let relativePath = urlPath;
        if (urlPath.includes(basePath)) {
            relativePath = urlPath.substring(
                urlPath.indexOf(basePath) + basePath.length
            );
        }

        const pathParts = relativePath
            .split("/")
            .filter(Boolean)
            .map(decodeURIComponent);

        if (pathParts.length === 0 && !isDirectory) {
            return;
        }

        let current = structure;

        for (let i = 0; i < pathParts.length - (isDirectory ? 0 : 1); i++) {
            const part = pathParts[i];
            const sanitizedPart = sanitizeKey(part);

            if (!current.children[sanitizedPart]) {
                const newPathSegments = pathParts.slice(0, i + 1);
                const newPathForUrl = `${basePath}${newPathSegments.join("/")}`;
                const fullUrl = `${url.protocol}//${url.host}${newPathForUrl}`;

                current.children[sanitizedPart] = {
                    name: part,
                    path: fullUrl,
                    type: "directory",
                    parent: current,
                    children: {},
                    stats: { totalFiles: 0, totalDirectories: 0 },
                    meta: {
                        papers: [],
                        years: [],
                        branches: [],
                        examTypes: [],
                        semesters: [],
                        subjects: [],
                        standardSubjects: [],
                    },
                };

                propagateStats(current, 0, 1);
            }

            current = current.children[sanitizedPart];
        }

        if (!isDirectory && pathParts.length > 0) {
            const lastPart = pathParts[pathParts.length - 1];
            const sanitizedPart = sanitizeKey(lastPart);

            if (!current.children[sanitizedPart]) {
                current.children[sanitizedPart] = {
                    name: lastPart,
                    path: paper.url,
                    type: "file",
                    parent: current,
                    children: {},
                    stats: { totalFiles: 0, totalDirectories: 0 },
                    meta: {
                        papers: [],
                        years: [],
                        branches: [],
                        examTypes: [],
                        semesters: [],
                        subjects: [],
                        standardSubjects: [],
                    },
                    metadata: paper,
                };

                propagateStats(current, 1, 0);
            }
        }

        let node: DirectoryNode | undefined = current;
        while (node) {
            if (paper.year) addUniqueValue(node.meta.years, paper.year);
            if (paper.branch) addUniqueValue(node.meta.branches, paper.branch);
            if (paper.examType)
                addUniqueValue(node.meta.examTypes, paper.examType);
            if (paper.semester)
                addUniqueValue(node.meta.semesters, paper.semester);
            if (paper.subject)
                addUniqueValue(node.meta.subjects, paper.subject);
            if (paper.standardSubject)
                addUniqueValue(
                    node.meta.standardSubjects,
                    paper.standardSubject
                );

            node = node.parent;
        }
    } catch (error) {
        log("ERROR", `Error adding to structure: ${paper.url}`, error);
    }
}

function propagateStats(
    node: DirectoryNode | undefined,
    deltaFiles: number,
    deltaDirectories: number
) {
    let currentNode = node;
    while (currentNode) {
        currentNode.stats.totalFiles += deltaFiles;
        currentNode.stats.totalDirectories += deltaDirectories;
        currentNode = currentNode.parent;
    }
}

async function crawlDirectory(
    baseUrl: string,
    paperCollection: PaperCollection,
    directoryStructure: DirectoryNode
): Promise<void> {
    try {
        if (!baseUrl || typeof baseUrl !== "string") {
            log("ERROR", "Invalid baseUrl for crawling", { baseUrl });
            return;
        }

        log("INFO", `Crawling directory: ${baseUrl}`);
        const items = await fetchDirectory(baseUrl);

        if (TEST_MODE) {
            log("INFO", `Raw directory items for ${baseUrl}:`, items);
        }

        const directories = items.filter((item) => item.isDirectory);
        const files = items.filter(
            (item) => !item.isDirectory && item.path.endsWith(".pdf")
        );

        for (const item of directories) {
            try {
                paperCollection.stats.totalDirectories++;

                const cleanName = item.name.trim();

                const dirMetadata = {
                    fileName: cleanName,
                    url: item.path,
                    year: extractYear(item.path, cleanName),
                    branch: extractBranch(item.path, cleanName),
                    semester: extractSemester(item.path, cleanName),
                    examType: extractExamType(item.path, cleanName),
                    subject: "Unknown",
                    standardSubject: "Unknown",
                    isDirectory: true,
                };

                if (TEST_MODE) {
                    log("INFO", `Adding directory: ${cleanName}`, dirMetadata);
                }

                await addToStructure(directoryStructure, dirMetadata, true);

                await crawlDirectory(
                    item.path,
                    paperCollection,
                    directoryStructure
                );
            } catch (dirError) {
                log(
                    "ERROR",
                    `Error processing directory: ${item.path}`,
                    dirError
                );
            }
        }

        for (const item of files) {
            try {
                if (subjectManager.isExcluded(item.path)) {
                    log("INFO", `Skipping excluded file: ${item.name}`, {
                        path: item.path,
                    });
                    continue;
                }

                const metadata = await extractMetadata(item.path, item.name);

                paperCollection.papers.push(metadata);
                paperCollection.stats.totalFiles++;

                addUniqueValue(paperCollection.meta.years, metadata.year);
                addUniqueValue(paperCollection.meta.branches, metadata.branch);
                addUniqueValue(
                    paperCollection.meta.examTypes,
                    metadata.examType
                );
                addUniqueValue(
                    paperCollection.meta.semesters,
                    metadata.semester
                );
                if (metadata.subject)
                    addUniqueValue(
                        paperCollection.meta.subjects,
                        metadata.subject
                    );
                if (metadata.standardSubject)
                    addUniqueValue(
                        paperCollection.meta.standardSubjects,
                        metadata.standardSubject
                    );

                await addToStructure(directoryStructure, metadata);

                if (TEST_MODE) {
                    log("METADATA", `Added file: ${item.name}`, metadata);
                }
            } catch (fileError) {
                log("ERROR", `Error processing file: ${item.path}`, fileError);
            }
        }
    } catch (error) {
        log("ERROR", "Error crawling directory:", {
            url: baseUrl,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

async function connectToMongoDB(): Promise<mongoose.Connection> {
    if (!MONGODB_URI) {
        throw new Error("MONGODB_URI is not defined");
    }

    await mongoose.connect(MONGODB_URI);
    log("METADATA", "Connected to MongoDB");
    return mongoose.connection;
}

async function getNestedFiles(
    baseUrl: string,
    path: string = ""
): Promise<{ path: string; isDirectory: boolean }[]> {
    const fullUrl = baseUrl + path;

    try {
        const items = await fetchDirectory(fullUrl);

        const result: { path: string; isDirectory: boolean }[] = [];

        for (const item of items) {
            result.push({
                path: item.path,
                isDirectory: item.isDirectory,
            });
        }

        for (const item of items) {
            if (item.isDirectory) {
                const nestedItems = await getNestedFiles(baseUrl, item.path);
                result.push(...nestedItems);
            }
        }

        return result;
    } catch (error) {
        log(
            "ERROR",
            `Error fetching nested files: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { baseUrl, path }
        );
        return [];
    }
}

let processedFilesCount = 0;

async function runCrawler() {
    let db: mongoose.Connection | undefined;

    console.log("Starting crawler...");
    console.log(`Debug Mode: ${TEST_MODE}`);
    console.log(`Test Mode: ${TEST_MODE}`);
    console.log(`List Only Mode: ${LIST_ONLY}`);
    console.log(`Interactive Mode: ${INTERACTIVE}`);

    try {
        await subjectManager.initialize();

        db = await connectToMongoDB();

        if (LIST_ONLY) {
            console.log(
                "List Only mode: Fetching all files without processing or storing..."
            );

            const baseUrl = TEST_MODE ? BASE_URL + TEST_DIR : BASE_URL;
            const allFiles = await getNestedFiles(baseUrl);

            console.log(`Found ${allFiles.length} total items.`);
            console.log(
                `Files: ${allFiles.filter((f) => !f.isDirectory).length}`
            );
            console.log(
                `Directories: ${allFiles.filter((f) => f.isDirectory).length}`
            );

            if (TEST_MODE) {
                const outputFile = path.join(
                    LOG_DIR,
                    `file-list-${new Date().toISOString().split("T")[0]}.json`
                );
                fs.writeFileSync(outputFile, JSON.stringify(allFiles, null, 2));
                console.log(`File list saved to ${outputFile}`);
            }

            process.exit(0);
            return;
        }

        const baseUrl = TEST_MODE ? BASE_URL + TEST_DIR : BASE_URL;
        console.log(`Base URL: ${baseUrl}`);

        const rootNode: DirectoryNode = {
            name: "root",
            path: baseUrl,
            type: "directory",
            children: {},
            stats: { totalFiles: 0, totalDirectories: 0 },
            meta: {
                papers: [],
                years: [],
                branches: [],
                examTypes: [],
                semesters: [],
                subjects: [],
                standardSubjects: [],
            },
        };

        const paperCollection: PaperCollection = {
            papers: [],
            meta: {
                years: [],
                branches: [],
                examTypes: [],
                semesters: [],
                subjects: [],
                standardSubjects: [],
            },
            stats: {
                totalFiles: 0,
                totalDirectories: 0,
                lastUpdated: new Date(),
            },
        };

        processedFilesCount = 0;

        console.log("Starting crawl...");
        await crawlDirectory(baseUrl, paperCollection, rootNode);

        console.log("\nCrawling Complete!");
        console.log("Summary:");

        const summary = {
            totalFiles: paperCollection.stats.totalFiles,
            totalDirectories: paperCollection.stats.totalDirectories,
            lastUpdated: paperCollection.stats.lastUpdated,
            uniqueBranches: paperCollection.meta.branches.length,
            uniqueYears: paperCollection.meta.years.length,
            uniqueExamTypes: paperCollection.meta.examTypes.length,
            uniqueSemesters: paperCollection.meta.semesters.length,
            uniqueSubjects: paperCollection.meta.subjects.length,
            uniqueStandardSubjects:
                paperCollection.meta.standardSubjects.length,
            uniqueBranchValues: paperCollection.meta.branches,
            uniqueYearValues: paperCollection.meta.years,
            uniqueExamTypeValues: paperCollection.meta.examTypes,
            uniqueSemesterValues: paperCollection.meta.semesters,
            uniqueSubjectValues:
                paperCollection.meta.subjects.length > 100
                    ? [
                          ...paperCollection.meta.subjects.slice(0, 100),
                          `... ${
                              paperCollection.meta.subjects.length - 100
                          } more items`,
                      ]
                    : paperCollection.meta.subjects,
            uniqueStandardSubjectValues:
                paperCollection.meta.standardSubjects.length > 100
                    ? [
                          ...paperCollection.meta.standardSubjects.slice(
                              0,
                              100
                          ),
                          `... ${
                              paperCollection.meta.standardSubjects.length - 100
                          } more items`,
                      ]
                    : paperCollection.meta.standardSubjects,
            directoryStats: rootNode.stats,
        };

        console.log(JSON.stringify(summary, null, 2));

        if (!LIST_ONLY && db) {
            console.log("Saving to MongoDB...");

            try {
                await PaperModel.deleteMany({});

                const processedPapers = paperCollection.papers.map((paper) => ({
                    ...paper,
                    year: paper.year || "Unknown",
                    branch: paper.branch || "Unknown",
                    semester: paper.semester || "Unknown",
                    examType: paper.examType || "Unknown",
                    subject: paper.subject || "Unknown",
                    standardSubject: paper.standardSubject || "Unknown",
                }));

                const paperDocument = {
                    papers: processedPapers,
                    meta: {
                        years: paperCollection.meta.years.length
                            ? paperCollection.meta.years
                            : ["Unknown"],
                        branches: paperCollection.meta.branches.length
                            ? paperCollection.meta.branches
                            : ["Unknown"],
                        examTypes: paperCollection.meta.examTypes.length
                            ? paperCollection.meta.examTypes
                            : ["Unknown"],
                        semesters: paperCollection.meta.semesters.length
                            ? paperCollection.meta.semesters
                            : ["Unknown"],
                        subjects: paperCollection.meta.subjects.length
                            ? paperCollection.meta.subjects
                            : ["Unknown"],
                        standardSubjects: paperCollection.meta.standardSubjects
                            .length
                            ? paperCollection.meta.standardSubjects
                            : ["Unknown"],
                    },
                    stats: {
                        totalFiles: paperCollection.stats.totalFiles,
                        totalDirectories:
                            paperCollection.stats.totalDirectories,
                        lastUpdated: new Date(),
                    },
                };

                const newPaperCollection = new PaperModel(paperDocument);
                await newPaperCollection.save();
                console.log("Paper collection saved to MongoDB.");
            } catch (error) {
                console.error("Failed to save to MongoDB:", error);
            }
        }
    } catch (error) {
        console.error("Failed to run crawler:", error);
    } finally {
        if (db) {
            await mongoose.disconnect();
            console.log("Disconnected from MongoDB");
        }
    }
}

runCrawler();
