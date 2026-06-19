import makeToolboxXML from '../../../src/lib/make-toolbox-xml';
import {defaultColors} from '../../../src/lib/settings/color-mode';

describe('makeToolboxXML board mode gating', () => {
    test('host mode (no board) shows host-only core blocks', () => {
        const xml = makeToolboxXML(false, true, 'target', [], defaultColors, false);
        expect(xml).toContain('event_whenflagclicked');
        expect(xml).toContain('event_whenkeypressed');
        expect(xml).toContain('sensing_mousex');
        expect(xml).toContain('sensing_askandwait');
        expect(xml).toContain('sensing_online');
    });

    test('board mode hides host-only core blocks but keeps the timer blocks', () => {
        const xml = makeToolboxXML(false, true, 'target', [], defaultColors, true);
        expect(xml).not.toContain('event_whenflagclicked');
        expect(xml).not.toContain('event_whenkeypressed');
        expect(xml).not.toContain('sensing_mousex');
        expect(xml).not.toContain('sensing_askandwait');
        expect(xml).not.toContain('sensing_online');
        // Timer maps to millis() on the board, so it stays available in both modes.
        expect(xml).toContain('sensing_timer');
    });

    test('operators category includes the type-convert blocks in both modes', () => {
        for (const boardMode of [false, true]) {
            const xml = makeToolboxXML(false, true, 'target', [], defaultColors, boardMode);
            expect(xml).toContain('operator_tonumber');
            expect(xml).toContain('operator_totext');
        }
    });
});
