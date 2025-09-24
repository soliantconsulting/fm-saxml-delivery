#!/usr/bin/env node

import 'dotenv/config';
import {createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import {join} from 'node:path';
import {Readable, Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {TextEncoder} from 'node:util';
import {Client} from 'fm-data-api-client';
import type {FieldData} from 'fm-data-api-client/dist/Layout.js';

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

const files = (process.env.FM_FILES ?? '').split(',');

for (const env of ['FM_FILES', 'FM_USERNAME', 'FM_PASSWORD', 'FM_HOST']) {
    if (!process.env[env]) {
        console.error(`Environment viable ${env} is not set`);
        process.exit(-1);
    }
}

const formatBytes = () => {
    const memoryUsage = process.memoryUsage();
    return `${(memoryUsage.external/1024/1024).toFixed(2)}MB ${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`;
};

const downloadFile = async (saxmlFile: string, containerUrl: string, client: Client) => {
    const containerResponse = await client.requestContainer(containerUrl);
    if (!containerResponse.buffer) {
        throw new Error('Could not download container');
    }

    const convertEncoding = new Transform({
        transform(chunk, _encoding, callback) {
            try {
                callback(null, new TextEncoder().encode(chunk));
            } catch (err) {
                callback(err as Error);
            }
        },
    });

    const containerReadable = Readable.fromWeb(containerResponse.buffer, {
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
        process.exit(executeScriptResult.scriptError !== '0' ? executeScriptResult.scriptError : 1);
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
    try {
        await downloadFile(saxmlFile, containerUrl, client);
    } catch (e) {
        console.error(e);
        console.error('failed to download container field', containerUrl);
        process.exit(10);
    }
    log('finished downloading container field', file);

    const clearXml: Partial<FieldData> = {};
    clearXml[field] = '';

    await layout.update(Number(records.data[0].recordId), clearXml);
    await client.clearToken();

    log('finished', file);
}
