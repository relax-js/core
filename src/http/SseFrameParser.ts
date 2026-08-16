/**
 * @module SseFrameParser
 * Turns the raw text of a `text/event-stream` response into complete SSE frames.
 *
 * A streamed response arrives in arbitrary chunks. A single frame is regularly split across two
 * chunks, and two frames regularly arrive in one chunk. The parser buffers whatever is incomplete
 * so the caller only ever sees whole frames.
 *
 * Internal to the http module. Not part of the public API.
 *
 * @example
 * const parser = new SseFrameParser();
 * parser.push('event: token\ndata: {"te');  // []
 * parser.push('xt":"hi"}\n\n');             // [{ event: 'token', data: '{"text":"hi"}' }]
 */

/**
 * One complete event received from the server.
 */
export interface SseFrame {
    /**
     * Name from the `event:` field, or `message` when the server did not send one.
     */
    event: string;

    /**
     * Payload from the `data:` field. Several `data:` lines are joined with a newline.
     */
    data: string;

    /**
     * Value of the `id:` field, when the server sent one for this frame.
     */
    id?: string;

    /**
     * Reconnection delay in milliseconds from the `retry:` field.
     */
    retry?: number;
}

/**
 * Parses `text/event-stream` text into frames.
 *
 * A frame that is still incomplete when the stream ends is discarded, as the event stream
 * specification requires. Half a JSON payload is worse than no payload.
 */
export class SseFrameParser {
    private buffer = '';
    private eventName = '';
    private data: string[] = [];
    private id?: string;
    private retry?: number;

    /**
     * Feed the next piece of the response body in.
     *
     * @param chunk - Decoded text, of any length and split at any position.
     * @returns Every frame that became complete with this chunk, in arrival order.
     */
    push(chunk: string): SseFrame[] {
        this.buffer += chunk;

        const frames: SseFrame[] = [];
        let position = 0;
        let lineBreak = this.findLineBreak(position);

        while (lineBreak) {
            const line = this.buffer.slice(position, lineBreak.start);
            position = lineBreak.end;

            if (line.length === 0) {
                const frame = this.takeFrame();
                if (frame) {
                    frames.push(frame);
                }
            } else {
                this.readField(line);
            }

            lineBreak = this.findLineBreak(position);
        }

        this.buffer = this.buffer.slice(position);
        return frames;
    }

    /**
     * Locates the next line terminator, which may be LF, CRLF or a lone CR.
     *
     * A CR at the very end of the buffer is left unresolved: the next chunk decides whether it was
     * a lone CR or the first half of a CRLF.
     */
    private findLineBreak(from: number): { start: number; end: number } | null {
        for (let i = from; i < this.buffer.length; i++) {
            const character = this.buffer[i];

            if (character === '\n') {
                return { start: i, end: i + 1 };
            }

            if (character === '\r') {
                if (i + 1 >= this.buffer.length) {
                    return null;
                }
                return this.buffer[i + 1] === '\n'
                    ? { start: i, end: i + 2 }
                    : { start: i, end: i + 1 };
            }
        }

        return null;
    }

    private readField(line: string): void {
        if (line[0] === ':') {
            return;
        }

        const colon = line.indexOf(':');
        const name = colon === -1 ? line : line.slice(0, colon);
        let value = colon === -1 ? '' : line.slice(colon + 1);

        if (value[0] === ' ') {
            value = value.slice(1);
        }

        switch (name) {
            case 'event':
                this.eventName = value;
                break;
            case 'data':
                this.data.push(value);
                break;
            case 'id':
                this.id = value;
                break;
            case 'retry':
                if (/^\d+$/.test(value)) {
                    this.retry = Number(value);
                }
                break;
        }
    }

    private takeFrame(): SseFrame | null {
        if (this.data.length === 0) {
            this.reset();
            return null;
        }

        const frame: SseFrame = {
            event: this.eventName.length > 0 ? this.eventName : 'message',
            data: this.data.join('\n')
        };

        if (this.id !== undefined) {
            frame.id = this.id;
        }
        if (this.retry !== undefined) {
            frame.retry = this.retry;
        }

        this.reset();
        return frame;
    }

    private reset(): void {
        this.eventName = '';
        this.data = [];
        this.id = undefined;
        this.retry = undefined;
    }
}
