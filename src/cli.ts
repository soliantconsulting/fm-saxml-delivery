#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs/promises';
import path from "node:path";
import {transcode} from 'node:buffer';
import {Client} from "fm-data-api-client";
import type {FieldData} from "fm-data-api-client/dist/Layout.js";

try {
    //if there's a .env file load it otherwise we don't need dotenv
    await fs.stat('.env');
    const dotenv = await import('dotenv');
    dotenv.config();
} catch (e) {
}

type ScriptResult = {
    errorCode : number;
    message : string;
    data ?: {
        recordId : string;
        xmlFieldName : string;
    }
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

const files = (process.env.FM_FILES ?? '').split(',');

for (const env of ['FM_FILES', 'FM_USERNAME', 'FM_PASSWORD', 'FM_HOST']) {
    if (!process.env[env]) {
        console.error(`Environment viable ${env} is not set`);
        process.exit(-1);
    }
}

for (const file of files) {
    const client = new Client(
        process.env.FM_HOST ?? '',
        file,
        process.env.FM_USERNAME ?? '',
        process.env.FM_PASSWORD ?? ''
    );

    const layout = client.layout('SaXMLDeliveryExecutionContext');

    console.log('calling FM script');

    const executeScriptResult = await layout.executeScript('RunSaXMLDelivery');

    if (!executeScriptResult.scriptResult || executeScriptResult.scriptError !== '0') {
        console.error('bad script result', file, executeScriptResult);
        process.exit(executeScriptResult.scriptError);
    }
    const scriptResult = JSON.parse(executeScriptResult.scriptResult) as ScriptResult;

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

    console.log('Starting download of container field');

    const containerResponse = await client.requestContainer(containerUrl);

    await fs.writeFile(
        path.join('SaXML', `${file}.xml`),
        transcode(containerResponse.buffer, 'utf-16le', 'utf8')
    );

    const clearXml : Partial<FieldData> = {};
    clearXml[field] = '';

    await layout.update(Number(records.data[0].recordId), clearXml);
    await client.clearToken();
}

