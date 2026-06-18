import React from 'react';
import {IntlProvider} from 'react-intl';
import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import SerialLog from '../../../src/components/serial-log/serial-log';

describe('SerialLog', () => {
    const renderSerialLog = props => render(
        <IntlProvider locale="en">
            <SerialLog
                logs={[
                    {message: 'first message'},
                    {message: 'second message'}
                ]}
                {...props}
            />
        </IntlProvider>
    );

    test('triggers callback when clear button is clicked', () => {
        const onClear = jest.fn();
        renderSerialLog({onClear});

        fireEvent.click(screen.getByRole('button', {name: 'Clear monitor'}));

        expect(onClear).toHaveBeenCalledTimes(1);
    });

    describe('prompt prompt', () => {
        test('shows prompt text and answer placeholder when prompt prop is set', () => {
            renderSerialLog({prompt: 'What is your name?'});

            expect(screen.getByText('What is your name?')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
        });

        test('shows send placeholder when no prompt is active', () => {
            renderSerialLog({});

            expect(screen.getByPlaceholderText('Send message...')).toBeInTheDocument();
            expect(screen.queryByPlaceholderText('Type your answer...')).not.toBeInTheDocument();
        });

        test('shows prompt and input for empty-string prompt (promptless ask)', () => {
            renderSerialLog({prompt: ''});

            expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
        });

        test('calls onSend with empty string when prompt is active and input is empty', () => {
            const onSend = jest.fn();
            renderSerialLog({prompt: 'What?', onSend});

            fireEvent.click(screen.getByRole('button', {name: 'Send'}));

            expect(onSend).toHaveBeenCalledWith('');
        });

        test('does not call onSend when no prompt and input is empty', () => {
            const onSend = jest.fn();
            renderSerialLog({onSend});

            fireEvent.click(screen.getByRole('button', {name: 'Send'}));

            expect(onSend).not.toHaveBeenCalled();
        });

        test('auto-expands and clears input when prompt transitions from null to a value', () => {
            const onSend = jest.fn();
            const {rerender} = render(
                <IntlProvider locale="en">
                    <SerialLog
                        logs={[]}
                        onSend={onSend}
                        prompt={null}
                    />
                </IntlProvider>
            );

            // Collapse the panel manually
            fireEvent.click(screen.getByRole('button', {name: 'Collapse monitor'}));
            expect(screen.queryByPlaceholderText('Send message...')).not.toBeInTheDocument();

            // Trigger a prompt — panel should expand
            rerender(
                <IntlProvider locale="en">
                    <SerialLog
                        logs={[]}
                        onSend={onSend}
                        prompt="What is your name?"
                    />
                </IntlProvider>
            );

            expect(screen.getByPlaceholderText('Type your answer...')).toBeInTheDocument();
        });

        test('clears pre-existing input value when prompt becomes active', () => {
            const {rerender} = render(
                <IntlProvider locale="en">
                    <SerialLog
                        logs={[]}
                        prompt={null}
                    />
                </IntlProvider>
            );

            fireEvent.change(screen.getByPlaceholderText('Send message...'), {
                target: {value: 'half-typed text'}
            });

            rerender(
                <IntlProvider locale="en">
                    <SerialLog
                        logs={[]}
                        prompt="Are you ready?"
                    />
                </IntlProvider>
            );

            expect(screen.getByPlaceholderText('Type your answer...')).toHaveValue('');
        });
    });
});
