import * as libxslt from 'libxslt-next';
import fs from 'node:fs/promises';

export const createIdNameMaps = async (inputFile: string, stylesheetFile: string, outputFile: string, isFirstFile: boolean = false) => {
    const stylesheetString = await fs.readFile(stylesheetFile, 'utf8');
    const stylesheet = libxslt.parse(stylesheetString);
    const saxmlString = await fs.readFile(inputFile, 'utf8');
    const result = stylesheet.apply(saxmlString);
    
    if (isFirstFile) {
        // For the first file, write the entire result (including header)
        await fs.writeFile(outputFile, result);
    } else {
        // For subsequent files, append only the data rows (skip the header)
        const lines = result.split('\n');
        const dataLines = lines.slice(1); // Skip the header row
        const dataToAppend = dataLines.join('\n');
        if (dataToAppend.trim()) {
            await fs.appendFile(outputFile, dataToAppend + '\n');
        }
    }
}