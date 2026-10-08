import {open} from 'node:fs/promises';
import {Transform} from 'node:stream';
import {TextDecoder} from 'node:util';

type SaxmlEncoding = 'utf-8' | 'utf-16le';

/**
 * Sniff the SaXML encoding from its leading bytes. FileMaker Server emitted UTF-16LE with a BOM
 * up to format 2.2.x and UTF-8 without a BOM from 2.3.x, so neither can be assumed.
 */
export const detectEncoding = (head: Buffer): {encoding: SaxmlEncoding; bomLength: number} => {
    if (head[0] === 0xff && head[1] === 0xfe) {
        return {encoding: 'utf-16le', bomLength: 2};
    }
    if (head[0] === 0xef && head[1] === 0xbb && head[2] === 0xbf) {
        return {encoding: 'utf-8', bomLength: 3};
    }
    if (head[0] === 0x3c && head[1] === 0x3f) {
        return {encoding: 'utf-8', bomLength: 0}; // "<?"
    }
    if (head[0] === 0x3c && head[1] === 0x00) {
        return {encoding: 'utf-16le', bomLength: 0}; // "<" as UTF-16LE
    }
    throw new Error(
        `Unrecognized SaXML encoding (first bytes: ${head.subarray(0, 4).toString('hex')})`,
    );
};

/**
 * Streams SaXML bytes in any supported encoding out as UTF-8 without a BOM.
 * TextDecoder (not StringDecoder) because it keeps a UTF-16 surrogate pair split across chunks
 * together; StringDecoder can emit the halves separately, which re-encode as U+FFFD.
 */
export const saxmlToUtf8 = (): Transform => {
    let decoder: TextDecoder | undefined;
    let head = Buffer.alloc(0);

    return new Transform({
        transform(chunk: Buffer, _encoding, callback) {
            let data = chunk;
            if (!decoder) {
                head = Buffer.concat([head, chunk]);
                if (head.length < 4) {
                    return callback(); // not enough bytes to sniff yet
                }
                try {
                    const {encoding, bomLength} = detectEncoding(head);
                    decoder = new TextDecoder(encoding);
                    data = head.subarray(bomLength);
                } catch (e) {
                    return callback(e as Error);
                }
            }
            callback(null, Buffer.from(decoder.decode(data, {stream: true}), 'utf8'));
        },
        flush(callback) {
            // No decoder means the whole input was under 4 bytes; pass it through so the
            // file-level validation reports it rather than silently writing nothing.
            callback(null, decoder ? Buffer.from(decoder.decode(), 'utf8') : head);
        },
    });
};

const VALIDATION_WINDOW_BYTES = 4096;

/** Throws unless the file is non-empty and declares <FMSaveAsXML near the top. */
export const assertSaxmlFile = async (path: string): Promise<void> => {
    const handle = await open(path, 'r');
    try {
        const {size} = await handle.stat();
        if (size === 0) {
            throw new Error(`${path} is empty (0 bytes); the container held no SaXML`);
        }
        const head = Buffer.alloc(VALIDATION_WINDOW_BYTES);
        const {bytesRead} = await handle.read(head, 0, head.length, 0);
        if (!head.subarray(0, bytesRead).includes('<FMSaveAsXML')) {
            throw new Error(
                `${path} has no <FMSaveAsXML element in its first ${bytesRead} bytes; not a SaXML export`,
            );
        }
    } finally {
        await handle.close();
    }
};
