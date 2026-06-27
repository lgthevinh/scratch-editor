import React from 'react';
import '@testing-library/jest-dom';
import {fireEvent} from '@testing-library/react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import UploadModal from '../../../src/components/device-controls/upload-modal.jsx';

jest.mock('../../../src/containers/modal.jsx', () => {
    const MockModal = ({children, contentLabel}) => (
        <div aria-label={contentLabel}>
            {children}
        </div>
    );
    return MockModal;
});

describe('UploadModal', () => {
    const renderModal = props => renderWithIntl(
        <UploadModal
            status="compiling"
            logs={[]}
            onCancel={jest.fn()}
            onClose={jest.fn()}
            {...props}
        />
    );

    test('shows the compile status, progress percent, and a Stop button while compiling', () => {
        const {getByText, getByRole} = renderModal({
            status: 'compiling',
            progress: {phase: 'Linking', percent: 80},
            logs: ['Compiling sketch\n']
        });

        expect(getByText('Compiling your project…')).toBeInTheDocument();
        expect(getByText('80%')).toBeInTheDocument();
        expect(getByText('Compiling sketch')).toBeInTheDocument();
        expect(getByRole('button', {name: 'Stop'})).toBeInTheDocument();
    });

    test('parses the upload percent from the log to drive the bar', () => {
        const {getByText} = renderModal({
            status: 'uploading',
            logs: ['Writing at 0x1000 (40 %)\n', 'Writing at 0x8000 (72 %)\n']
        });

        expect(getByText('Writing to your board…')).toBeInTheDocument();
        expect(getByText('72%')).toBeInTheDocument();
    });

    test('strips ANSI escapes and carriage-return overwrites from the log', () => {
        const {getByText, queryByText} = renderModal({
            status: 'compiling',
            logs: ['[1A[2KWriting flash\rDone flashing']
        });

        // The cleaned line keeps the real text; the terminal control noise is gone.
        expect(getByText(/Done flashing/)).toBeInTheDocument();
        expect(queryByText(/\[2K/)).not.toBeInTheDocument();
    });

    test('clicking Stop while running calls onCancel', () => {
        const onCancel = jest.fn();
        const {getByRole} = renderModal({status: 'uploading', onCancel});

        fireEvent.click(getByRole('button', {name: 'Stop'}));
        expect(onCancel).toHaveBeenCalled();
    });

    test('shows a success status and a Close button when done', () => {
        const onClose = jest.fn();
        const {getByText, getByRole} = renderModal({status: 'done', onClose});

        expect(getByText('Your board is ready to go.')).toBeInTheDocument();
        const button = getByRole('button', {name: 'Close'});
        fireEvent.click(button);
        expect(onClose).toHaveBeenCalled();
    });

    test('shows the error detail when the upload failed', () => {
        const {getByText, getByRole} = renderModal({
            status: 'error',
            error: 'avrdude: not in sync'
        });

        expect(getByText('Upload didn’t finish.')).toBeInTheDocument();
        expect(getByText('avrdude: not in sync')).toBeInTheDocument();
        expect(getByRole('button', {name: 'Close'})).toBeInTheDocument();
    });

    test('shows the cancelled status', () => {
        const {getByText} = renderModal({status: 'cancelled'});
        expect(getByText('Upload stopped.')).toBeInTheDocument();
    });
});
