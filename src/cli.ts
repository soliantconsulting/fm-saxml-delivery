#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from "node:path";
import { Client } from "fm-data-api-client";
import type { FieldData } from "fm-data-api-client/dist/Layout.js";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "stream";
import { TextDecoder, TextEncoder } from "util";
import { createIdNameMaps } from "./id-name-map.js";

try {
    //if there's a .env file load it otherwise we don't need dotenv
    await fs.stat('.env');
    const dotenv = await import('dotenv');
    dotenv.config();
} catch (e) {
}

type ScriptResult = {
    errorCode: number;
    message: string;
    data?: {
        recordId: string;
        xmlFieldName: string;
    }
}

const log = (message: any, file: string) => {
    console.log(file, new Date().toLocaleTimeString(), message);
}

const mkdir = async (path: string): Promise<void> => {
    try {
        await fs.mkdir(path, {})
    } catch (e) {
        if (!e || typeof e !== 'object' || !('code' in e) || e?.code !== 'EEXIST') {
            console.log('error making directory', path, e);
            process.exit(-1);
        }
    }
}

await mkdir('SaXML');
await mkdir('XMLSplit');
await mkdir('id-name-maps');

const files = (process.env.FM_FILES ?? '').split(',');

// Define single output files for all data
const tableMapFile = path.join('id-name-maps', 'table-map.csv');
const fieldMapFile = path.join('id-name-maps', 'field-map.csv');

for (const env of ['FM_FILES', 'FM_USERNAME', 'FM_PASSWORD', 'FM_HOST']) {
    if (!process.env[env]) {
        console.error(`Environment viable ${env} is not set`);
        process.exit(-1);
    }
}

for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isFirstFile = i === 0;
    
    const client = new Client(
        process.env.FM_HOST ?? '',
        file,
        process.env.FM_USERNAME ?? '',
        process.env.FM_PASSWORD ?? ''
    );

    const layout = client.layout('SaXMLDeliveryExecutionContext');

    log('calling FM script', file);

    const executeScriptResult = await layout.executeScript('saxmlDelivery_createXml');

    if (!executeScriptResult.scriptResult || executeScriptResult.scriptError !== '0') {
        console.error('bad script result', file, executeScriptResult);
        process.exit(executeScriptResult.scriptError);
    }
    const scriptResult = JSON.parse(executeScriptResult.scriptResult) as ScriptResult;

    log(scriptResult, file);

    if (scriptResult.errorCode !== 0) {
        console.error(scriptResult.message);
        process.exit(scriptResult.errorCode);
    }

    if (!scriptResult.data?.recordId) {
        console.error('bad script result', file, scriptResult);
        process.exit(10);
    }

    const records = await layout.get(Number(scriptResult.data.recordId))

    const field = scriptResult.data.xmlFieldName.split('::').splice(-1)[0];
    const containerUrl = records.data[0].fieldData[field];
    if (!containerUrl || typeof containerUrl !== 'string') {
        console.error(`${field} from script result.fieldName is not on layout`, Object.keys(records.data[0].fieldData));
        process.exit(20);
    }

    log('Starting download of container field', file);

    const containerResponse = await client.requestContainer(containerUrl);

    const convertEncoding = new Transform({
        transform(chunk, _encoding, callback) {
            try {
                // Try UTF-16LE first, then fallback to UTF-8 if that fails
                let decoded;
                try {
                    decoded = new TextDecoder('utf-16le').decode(chunk);
                } catch (utf16Error) {
                    // If UTF-16LE fails, try UTF-8
                    decoded = new TextDecoder('utf-8').decode(chunk);
                }
                
                // Clean any invalid characters that might cause XML parsing issues
                const cleaned = decoded.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
                
                callback(null, new TextEncoder().encode(cleaned));
            } catch (err) {
                callback(err as Error);
            }
        }
    });

    const saxmlFile = path.join('SaXML', `${file}.xml`);
    await pipeline(
        containerResponse.buffer.stream(),
        convertEncoding,
        createWriteStream(saxmlFile),
    );

    log('finished downloading container field', file);

    const clearXml: Partial<FieldData> = {};
    clearXml[field] = '';

    await layout.update(Number(records.data[0].recordId), clearXml);
    await client.clearToken();

    await createIdNameMaps(saxmlFile, path.join('stylesheets', `field-map.xsl`), fieldMapFile, isFirstFile);
    await createIdNameMaps(saxmlFile, path.join('stylesheets', `table-map.xsl`), tableMapFile, isFirstFile);

    log('finished', file);
}
