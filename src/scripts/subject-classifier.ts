/**
 * Subject Classifier
 *
 * A utility script that analyzes PDF filenames to extract subjects and
 * classify them according to standardized subjects.
 *
 * The script works as follows:
 * 1. It extracts the subject part from each filename by removing metadata
 *    like year, semester, branch, and exam type
 * 2. It checks the extracted subject part against known variations in variations.json
 * 3. If a match is found, the file is classified
 * 4. If no match is found, the user is prompted to enter a subject name and key
 */

import { SubjectManager } from "../utils/SubjectManager";
import fs from "fs/promises";
import path from "path";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function question(query: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

function clearConsole() {
    console.clear();
    console.log("🎓 MITAoE PYQs - Subject Classifier\n");
}

let processedFilesCount = 0;

function extractSubjectPart(filename: string): string {
    let name = path.basename(filename, path.extname(filename));
    name = name.replace(/[_\-\.]/g, " ");

    // Common patterns to be removed from filenames
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
        ],

        // Branch-related patterns
        [
            /\b(FE|SE|TE|BE)\b/gi, // FE, SE, TE, BE
            /\b(F\.?E\.?|S\.?E\.?|T\.?E\.?|B\.?E\.?)\b/gi, // F.E., S.E., etc.
            /\bFIRST YEAR\b/gi, // FIRST YEAR
            /\bSECOND YEAR\b/gi, // SECOND YEAR
            /\bTHIRD YEAR\b/gi, // THIRD YEAR
            /\bFOURTH YEAR\b/gi, // FOURTH YEAR
            /\bFY\b/gi, // FY
            /\bSY\b/gi, // SY
            /\bTY\b/gi, // TY
            /\bBTECH\b/gi, // BTECH
            /\bB[\s\-]*TECH\b/gi, // B TECH, B-TECH
            /\bB\.TECH\b/gi, // B.TECH
        ],

        // Exam-related patterns
        [
            /\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/gi, // Months
            /\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b/gi, // Full months
            /\bENDSEM\b/gi, // ENDSEM
            /\bMIDSEM\b/gi, // MIDSEM
            /\bEXAM\b/gi, // EXAM
            /\bTEST\b/gi, // TEST
            /\bQUESTION\s*PAPER\b/gi, // QUESTION PAPER
            /\bQP\b/gi, // QP
            /\bRE\s*EXAM\b/gi, // RE EXAM
            /\bREGULAR\b/gi, // REGULAR
            /\bSUPPLY\b/gi, // SUPPLY
            /\bSUPPLEMENTARY\b/gi, // SUPPLEMENTARY
            /\bBACKLOG\b/gi, // BACKLOG
            /\bCYCLE\s*[IVX]+\b/gi, // CYCLE I, CYCLE II, etc.
            /\bCYCLE\s*\d+\b/gi, // CYCLE 1, CYCLE 2, etc.
        ],

        // Months
        [
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\b/gi,
        ],

        // Common file elements
        [/\b(syllabus|notes|ppt|pdf|doc|docx|sol|solution|answer|key)\b/gi],

        // Other non-subject elements
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

    return name.toUpperCase().trim();
}

function generateSubjectKey(subjectName: string): string {
    return subjectName
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
}

async function processIndividualFiles(
    files: string[],
    subjectManager: SubjectManager,
    autoMode = false
): Promise<void> {
    const totalCount = files.length;
    processedFilesCount = 0;

    for (const file of files) {
        try {
            if (subjectManager.isExcluded(file)) {
                processedFilesCount++;
                continue;
            }

            clearConsole();

            processedFilesCount++;
            console.log(
                `📁 File ${processedFilesCount}/${totalCount} (${Math.round(
                    (processedFilesCount / totalCount) * 100
                )}%)`
            );

            console.log(`Processing: ${path.basename(file)}`);

            const subjectPart = extractSubjectPart(path.basename(file));
            console.log(`Extracted subject part: "${subjectPart}"`);

            const matches = subjectManager.getMatchingVariations(subjectPart);

            if (matches.length > 0) {
                console.log("\nPossible subject matches:");
                for (let i = 0; i < matches.length; i++) {
                    console.log(
                        `${i + 1}. ${matches[i].standard} (${
                            matches[i].subjectKey
                        })`
                    );
                }

                if (autoMode) {
                    const bestMatch = matches[0];
                    console.log(
                        `\n⚠️ Auto-classifying as: ${bestMatch.standard} (${bestMatch.subjectKey})`
                    );
                    await subjectManager.addMapping(file, bestMatch.subjectKey);
                    continue;
                }

                const answer = await question(
                    '\nSelect a match number, or type "n" for none, or "e" to exclude this file: '
                );

                if (answer.toLowerCase() === "e") {
                    await subjectManager.addExclusion(file);
                    console.log("🚫 Added to exclusions.");
                } else if (answer.toLowerCase() === "n") {
                    await handleNewSubjectPart(
                        subjectPart,
                        file,
                        subjectManager
                    );
                } else {
                    const index = parseInt(answer) - 1;
                    if (index >= 0 && index < matches.length) {
                        await subjectManager.addMapping(
                            file,
                            matches[index].subjectKey
                        );
                        console.log(
                            `✅ Classified as: ${matches[index].standard} (${matches[index].subjectKey})`
                        );
                    } else {
                        console.log("❌ Invalid selection.");
                        await subjectManager.addUnclassified(file);
                    }
                }
            } else {
                if (autoMode) {
                    await subjectManager.addUnclassified(file);
                    console.log("⚠️ No matches found, added to unclassified.");
                    continue;
                }

                await handleNewSubjectPart(subjectPart, file, subjectManager);
            }
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }

    clearConsole();
    console.log(`✅ Processed ${processedFilesCount}/${totalCount} files\n`);
    await question("Press Enter to continue...");
}

async function handleNewSubjectPart(
    subjectPart: string,
    filePath: string,
    subjectManager: SubjectManager
): Promise<void> {
    try {
        clearConsole();

        console.log(`📊 Processed: ${processedFilesCount} files so far\n`);

        console.log(`File: ${path.basename(filePath)}`);
        console.log(`Extracted part: ${subjectPart}`);

        const fileName = path.basename(filePath);
        if (!fileName.toUpperCase().includes(subjectPart.toUpperCase())) {
            console.log(
                `⚠️ Warning: "${subjectPart}" not found in the filename. Please confirm.`
            );
            const confirm = await question("Continue anyway? (y/n): ");

            if (confirm.toLowerCase() !== "y") {
                await subjectManager.addUnclassified(filePath);
                console.log("Added to unclassified.");
                return;
            }
        }

        const variations = Object.keys(subjectManager.getVariations()).length;
        console.log(`�� Classified: ${variations} files\n`);

        console.log("No matches found in variations.");

        const correctPart = await question(
            `File name part [${subjectPart}] (or "s" to skip, "q" to quit, "e" to exclude, "f" to use file name): `
        );

        if (correctPart.toLowerCase() === "s") {
            await subjectManager.addUnclassified(filePath);
            console.log("Added to unclassified.");
            return;
        }

        if (correctPart.toLowerCase() === "e") {
            await subjectManager.addExclusion(filePath);
            console.log("Added to exclusions.");
            return;
        }

        if (correctPart.toLowerCase() === "q") {
            console.log("Exiting as requested by user.");
            process.exit(0);
        }

        if (correctPart.toLowerCase() === "f") {
            clearConsole();
            console.log(`📊 Classified: ${variations} files\n`);

            const fileNameWithoutExt = path.basename(
                filePath,
                path.extname(filePath)
            );
            const nameFromFile =
                fileNameWithoutExt.charAt(0) +
                fileNameWithoutExt.slice(1).toLowerCase();

            const subjectName = await question(
                `Subject name [${nameFromFile}]: `
            );

            if (!subjectName && !nameFromFile) {
                await subjectManager.addUnclassified(filePath);
                console.log("Added to unclassified.");
                return;
            }

            clearConsole();
            console.log(`📊 Classified: ${variations} files\n`);

            const finalSubjectName = subjectName || nameFromFile;

            const suggestedKey = generateSubjectKey(finalSubjectName);
            const subjectKey = await question(
                `Subject key [${suggestedKey}]: `
            );
            const finalSubjectKey = subjectKey || suggestedKey;

            const subjects = subjectManager.getSubjects();
            if (!subjects[finalSubjectKey]) {
                await subjectManager.addSubject(
                    finalSubjectKey,
                    finalSubjectName
                );
                console.log(
                    `✅ Added new subject: ${finalSubjectName} (${finalSubjectKey})`
                );
            }

            try {
                const variationKey = fileNameWithoutExt.toUpperCase();

                await subjectManager.addVariation(
                    variationKey,
                    finalSubjectKey
                );
                console.log(
                    `✅ Added variation: "${fileNameWithoutExt}" → ${finalSubjectKey}`
                );

                await subjectManager.addMapping(filePath, finalSubjectKey);
                console.log(
                    `✅ Classified file as: ${finalSubjectName} (${finalSubjectKey})`
                );
            } catch (error) {
                console.error("Error adding variation:", error);
                console.log(
                    "⚠️ Failed to add variation. Adding file to unclassified instead."
                );
                await subjectManager.addUnclassified(filePath);
            }

            return;
        }

        const finalSubjectPart = correctPart || subjectPart;

        if (
            correctPart &&
            !fileName.toUpperCase().includes(correctPart.toUpperCase())
        ) {
            console.log(
                `⚠️ Warning: "${correctPart}" not found in the filename. Please confirm.`
            );
            const confirm = await question("Continue anyway? (y/n): ");

            if (confirm.toLowerCase() !== "y") {
                await subjectManager.addUnclassified(filePath);
                console.log("Added to unclassified.");
                return;
            }
        }

        clearConsole();
        console.log(`📊 Classified: ${variations} files\n`);

        const nameFromPart =
            finalSubjectPart.charAt(0) +
            finalSubjectPart.slice(1).toLowerCase();

        const subjectName = await question(`Subject name [${nameFromPart}]: `);

        if (!subjectName && !nameFromPart) {
            await subjectManager.addUnclassified(filePath);
            console.log("Added to unclassified.");
            return;
        }

        clearConsole();
        console.log(`📊 Classified: ${variations} files\n`);

        const finalSubjectName = subjectName || nameFromPart;

        const suggestedKey = generateSubjectKey(finalSubjectName);
        const subjectKey = await question(`Subject key [${suggestedKey}]: `);
        const finalSubjectKey = subjectKey || suggestedKey;

        const subjects = subjectManager.getSubjects();
        if (!subjects[finalSubjectKey]) {
            await subjectManager.addSubject(finalSubjectKey, finalSubjectName);
            console.log(
                `✅ Added new subject: ${finalSubjectName} (${finalSubjectKey})`
            );
        }

        const variationToAdd = correctPart || subjectPart;

        await subjectManager.addVariation(
            variationToAdd.toUpperCase(),
            finalSubjectKey
        );
        console.log(
            `✅ Added variation: "${variationToAdd}" → ${finalSubjectKey}`
        );

        await subjectManager.addMapping(filePath, finalSubjectKey);
        console.log(
            `✅ Classified file as: ${finalSubjectName} (${finalSubjectKey})`
        );
    } catch (error) {
        console.error("Error handling new subject part:", error);
        await subjectManager.addUnclassified(filePath);
    }
}

async function viewStatistics(subjectManager: SubjectManager): Promise<void> {
    clearConsole();

    const subjects = subjectManager.getSubjects();
    const variations = subjectManager.getVariations();
    const exclusions = subjectManager.getExclusions();
    const unclassified = subjectManager.getUnclassified();

    const totalSubjects = Object.keys(subjects).length;
    const totalVariations = Object.keys(variations).length;
    const totalExclusions = exclusions.length;
    const totalUnclassified = unclassified.length;

    console.log("📊 Classification Status\n");
    console.log(`Subjects: ${totalSubjects}`);
    console.log(`Variations: ${totalVariations}`);
    console.log(`Exclusions: ${totalExclusions}`);
    console.log(`Unclassified: ${totalUnclassified}`);

    const total = totalVariations + totalExclusions + totalUnclassified;
    const classifiedPercent = Math.round((totalVariations / total) * 100);
    console.log(
        `\nProgress: ${classifiedPercent}% complete (${totalVariations}/${total})`
    );

    await question("\nPress Enter to continue...");
}

async function run(): Promise<void> {
    const subjectManager = new SubjectManager();
    await subjectManager.initialize();

    processedFilesCount = 0;

    const pdfFiles: string[] = [];

    console.log("🔍 Scanning for PDF files...");

    async function scanDir(dir: string) {
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });

            for (const item of items) {
                const itemPath = path.join(dir, item.name);

                if (item.isDirectory()) {
                    await scanDir(itemPath);
                } else if (item.isFile() && item.name.endsWith(".pdf")) {
                    pdfFiles.push(itemPath);
                }
            }
        } catch (error) {
            console.log(`Error scanning directory ${dir}:`, error);
        }
    }

    try {
        await scanDir(path.join(process.cwd(), "downloads"));
        console.log(`📁 Found ${pdfFiles.length} PDF files`);
    } catch (error) {
        console.log("❌ Error scanning downloads directory:", error);
        try {
            await scanDir(path.join(process.cwd(), "samples"));
            console.log(`📁 Found ${pdfFiles.length} PDF files`);
        } catch {
            console.log("❌ No PDF files found");
        }
    }

    let autoMode = false;
    const running = true;

    while (running) {
        clearConsole();

        const variations = subjectManager.getVariations();
        const unclassified = subjectManager.getUnclassified();

        const totalVariations = Object.keys(variations).length;
        const totalUnclassified = unclassified.length;

        console.log("📋 Subject Classifier");
        console.log("====================\n");

        console.log(
            `📊 Processed: ${processedFilesCount}/${
                pdfFiles.length
            } files (${Math.round(
                (processedFilesCount / pdfFiles.length) * 100 || 0
            )}%)`
        );
        console.log(
            `📊 Status: ${totalVariations} classified, ${totalUnclassified} unclassified`
        );
        console.log(`Auto Mode: ${autoMode ? "✅ ON" : "❌ OFF"}\n`);

        console.log("Menu:");
        console.log("1. Process files");
        console.log("2. Process unclassified files");
        console.log("3. View statistics");
        console.log("4. Exit");
        console.log("a. Toggle auto mode");

        const option = await question("\nSelect an option (1-4): ");

        switch (option) {
            case "1":
                await processIndividualFiles(
                    pdfFiles,
                    subjectManager,
                    autoMode
                );
                break;
            case "2":
                const unclassified = subjectManager.getUnclassified();

                if (unclassified.length === 0) {
                    clearConsole();
                    console.log("✅ No unclassified files found.");
                    await question("\nPress Enter to continue...");
                    break;
                }

                await processIndividualFiles(
                    unclassified,
                    subjectManager,
                    autoMode
                );
                break;
            case "3":
                await viewStatistics(subjectManager);
                break;
            case "4":
                clearConsole();
                console.log("👋 Exit");
                rl.close();
                return;
            case "a":
                autoMode = !autoMode;
                break;
            default:
                clearConsole();
                console.log("❌ Invalid option");
                await question("\nPress Enter to continue...");
        }
    }
}

run().catch(console.error);
