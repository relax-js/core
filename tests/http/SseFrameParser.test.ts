import { describe, it, expect } from 'vitest';
import { SseFrameParser } from '../../src/http/SseFrameParser';

describe('SseFrameParser', () => {
    it('frame_split_across_chunk_boundaries_is_emitted_once_complete', () => {
        const parser = new SseFrameParser();

        expect(parser.push('event: token\ndata: {"te')).toEqual([]);
        expect(parser.push('xt":"hi"}')).toEqual([]);
        expect(parser.push('\n\n')).toEqual([{ event: 'token', data: '{"text":"hi"}' }]);
    });

    it('several_frames_in_one_chunk_are_emitted_in_arrival_order', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('data: one\n\ndata: two\n\ndata: three\n\n');

        expect(frames.map((f) => f.data)).toEqual(['one', 'two', 'three']);
    });

    it('multi_line_data_fields_are_joined_with_newline', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('data: first\ndata: second\n\n');

        expect(frames).toEqual([{ event: 'message', data: 'first\nsecond' }]);
    });

    it('crlf_line_endings_are_parsed', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('event: ping\r\ndata: 1\r\n\r\n');

        expect(frames).toEqual([{ event: 'ping', data: '1' }]);
    });

    it('carriage_return_split_across_chunks_is_not_read_as_two_line_breaks', () => {
        const parser = new SseFrameParser();

        expect(parser.push('data: value\r')).toEqual([]);
        expect(parser.push('\n\r\n')).toEqual([{ event: 'message', data: 'value' }]);
    });

    it('comment_lines_are_ignored_as_heartbeats', () => {
        const parser = new SseFrameParser();

        const frames = parser.push(': keep-alive\n\ndata: real\n\n');

        expect(frames).toEqual([{ event: 'message', data: 'real' }]);
    });

    it('frame_without_data_field_is_not_emitted', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('event: lonely\n\n');

        expect(frames).toEqual([]);
    });

    it('frame_without_event_field_defaults_to_message', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('data: hello\n\n');

        expect(frames).toEqual([{ event: 'message', data: 'hello' }]);
    });

    it('incomplete_trailing_frame_is_discarded', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('data: complete\n\ndata: cut off');

        expect(frames).toEqual([{ event: 'message', data: 'complete' }]);
    });

    it('event_name_does_not_leak_into_the_next_frame', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('event: named\ndata: a\n\ndata: b\n\n');

        expect(frames.map((f) => f.event)).toEqual(['named', 'message']);
    });

    it('id_and_retry_fields_are_reported_with_the_frame', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('id: 42\nretry: 3000\ndata: hello\n\n');

        expect(frames).toEqual([{ event: 'message', data: 'hello', id: '42', retry: 3000 }]);
    });

    it('retry_field_that_is_not_a_number_is_ignored', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('retry: soon\ndata: hello\n\n');

        expect(frames[0].retry).toBeUndefined();
    });

    it('only_one_leading_space_is_stripped_from_a_value', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('data:  indented\n\n');

        expect(frames[0].data).toBe(' indented');
    });

    it('data_field_without_a_value_produces_an_empty_payload', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('data:\n\n');

        expect(frames).toEqual([{ event: 'message', data: '' }]);
    });

    it('unknown_fields_are_ignored', () => {
        const parser = new SseFrameParser();

        const frames = parser.push('unknown: whatever\ndata: hello\n\n');

        expect(frames).toEqual([{ event: 'message', data: 'hello' }]);
    });
});
