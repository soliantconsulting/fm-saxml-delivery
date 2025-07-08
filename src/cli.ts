#!/usr/bin/env node

import 'dotenv/config';
import {createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {fileURLToPath} from 'node:url';
import {TextEncoder} from 'node:util';
import {Client} from 'fm-data-api-client';
import type {FieldData} from 'fm-data-api-client/dist/Layout.js';
import {applyTransformation, applyTransformationSaveToFile} from './transformations.js';

try {
    //if there's a .env file load it otherwise we don't need dotenv
    await fs.stat('.env');
    const dotenv = await import('dotenv');
    dotenv.config();
} catch (_e) {
    // don't load dotenv if it's not there
}

type ScriptResult = {
    errorCode: number;
    message: string;
    data?: {
        recordId: string;
        xmlFieldName: string;
    };
};

const log = (message: unknown, file: string) => {
    console.log(file, new Date().toLocaleTimeString(), message);
};

const mkdir = async (path: string): Promise<void> => {
    try {
        await fs.mkdir(path, {});
    } catch (e) {
        if (!e || typeof e !== 'object' || !('code' in e) || e?.code !== 'EEXIST') {
            console.log('error making directory', path, e);
            process.exit(-1);
        }
    }
};

await mkdir('SaXML');
await mkdir('XMLSplit');
await mkdir('artifacts');

const files = (process.env.FM_FILES ?? '').split(',');

const tableMapFile = join('artifacts', 'table-map.csv');
const fieldMapFile = join('artifacts', 'field-map.csv');
const modificationsFile = join('artifacts', 'modifications.csv');

for (const env of ['FM_FILES', 'FM_USERNAME', 'FM_PASSWORD', 'FM_HOST']) {
    if (!process.env[env]) {
        console.error(`Environment viable ${env} is not set`);
        process.exit(-1);
    }
}

const downloadFile = async (saxmlFile: string, containerUrl: string, client: Client) => {
    const containerResponse = await client.requestContainer(containerUrl);

    const convertEncoding = new Transform({
        transform(chunk, _encoding, callback) {
            try {
                callback(null, new TextEncoder().encode(chunk));
            } catch (err) {
                callback(err as Error);
            }
        },
    });

    const containerReadable = Readable.fromWeb(containerResponse.buffer.stream(), {
        encoding: 'utf-16le',
    });
    await pipeline(containerReadable, convertEncoding, createWriteStream(saxmlFile));
};

for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const isFirstFile = i === 0;

    const client = new Client(
        process.env.FM_HOST ?? '',
        file,
        process.env.FM_USERNAME ?? '',
        process.env.FM_PASSWORD ?? '',
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

    const records = await layout.get(Number(scriptResult.data.recordId));

    const field = scriptResult.data.xmlFieldName.split('::').splice(-1)[0];
    const containerUrl = records.data[0].fieldData[field];
    if (!containerUrl || typeof containerUrl !== 'string') {
        console.error(
            `${field} from script result.fieldName is not on layout`,
            Object.keys(records.data[0].fieldData),
        );
        process.exit(20);
    }

    log('Starting download of container field', file);

    const saxmlFile = join('SaXML', `${file}.xml`);
    await downloadFile(saxmlFile, containerUrl, client);

    log('finished downloading container field', file);

    const clearXml: Partial<FieldData> = {};
    clearXml[field] = '';

    await layout.update(Number(records.data[0].recordId), clearXml);
    await client.clearToken();

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(dirname(__filename));
    log('running XSLT transformations', file);
    await applyTransformationSaveToFile(
        saxmlFile,
        join(__dirname, 'stylesheets', `field-map.xsl`),
        fieldMapFile,
        isFirstFile,
    );
    await applyTransformationSaveToFile(
        saxmlFile,
        join(__dirname, 'stylesheets', `table-map.xsl`),
        tableMapFile,
        isFirstFile,
    );
    const saxmlVersion = await applyTransformation(
        saxmlFile,
        join(__dirname, 'stylesheets', `saxml-version.xsl`),
    );
    if (saxmlVersion !== '2.2.3.0') {
        log(
            `⚠️  Warning: ${file} uses SaXML version ${saxmlVersion}. Only v2.2.3.0 is fully supported. Results might not be correct.`,
            file,
        );
    }
    await applyTransformationSaveToFile(
        saxmlFile,
        join(__dirname, 'stylesheets', `modifications.xsl`),
        modificationsFile,
        isFirstFile,
    );

    log('finished', file);
}
