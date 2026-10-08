import assert from 'node:assert/strict';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import {buffer} from 'node:stream/consumers';
import {test} from 'node:test';
import {assertSaxmlFile, detectEncoding, saxmlToUtf8} from '../src/saxml.js';

// Same header shape as a real export; non-ASCII content exercises multi-byte decoding.
const saxml =
    '<?xml version="1.0" encoding="UTF-8"?>\r\n' +
    '<FMSaveAsXML version="2.3.0.1" Source="26.1.1" File="Sample.fmp12" UUID="00000000-0000-0000-0000-000000000000">\r\n' +
    '\t<Structure membercount="1">Ünïcödé — ☃ 😀</Structure>\r\n' +
    '</FMSaveAsXML>\r\n';
const expected = Buffer.from(saxml, 'utf8');

const fixtures: Record<string, Buffer> = {
    'UTF-16LE with BOM': Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(saxml, 'utf16le')]),
    'UTF-16LE without BOM': Buffer.from(saxml, 'utf16le'),
    'UTF-8 with BOM': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), expected]),
    'UTF-8 without BOM': expected,
};

function* chunk(input: Buffer, size: number): Generator<Buffer> {
    for (let i = 0; i < input.length; i += size) {
        yield input.subarray(i, i + size);
    }
}

const decode = (input: Buffer, chunkSize: number) =>
    buffer(Readable.from(chunk(input, chunkSize)).pipe(saxmlToUtf8()));

for (const [name, input] of Object.entries(fixtures)) {
    test(`${name} decodes to identical UTF-8`, async () => {
        // 1 and 3 force the sniffer to wait for more bytes and split multi-byte characters.
        for (const chunkSize of [1, 3, 64 * 1024]) {
            assert.deepEqual(await decode(input, chunkSize), expected, `chunk size ${chunkSize}`);
        }
    });
}

test('unrecognized leading bytes are rejected', async () => {
    assert.throws(() => detectEncoding(Buffer.from('hello')), /Unrecognized SaXML encoding/);
    await assert.rejects(decode(Buffer.from('hello world'), 64), /Unrecognized SaXML encoding/);
});

test('assertSaxmlFile accepts a SaXML file and rejects empty or non-SaXML files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'saxml-'));
    const write = async (name: string, data: Buffer) => {
        const path = join(dir, name);
        await writeFile(path, data);
        return path;
    };

    await assertSaxmlFile(await write('ok.xml', expected));
    await assert.rejects(assertSaxmlFile(await write('empty.xml', Buffer.alloc(0))), /empty/);
    await assert.rejects(
        assertSaxmlFile(await write('other.xml', Buffer.from('<?xml version="1.0"?><Other/>'))),
        /no <FMSaveAsXML element/,
    );
    // The original bug: UTF-8 bytes decoded as UTF-16LE produce garbage with no root element.
    const garbage = Buffer.from(Buffer.from(expected).toString('utf16le'), 'utf8');
    await assert.rejects(assertSaxmlFile(await write('garbage.xml', garbage)), /no <FMSaveAsXML/);
});
