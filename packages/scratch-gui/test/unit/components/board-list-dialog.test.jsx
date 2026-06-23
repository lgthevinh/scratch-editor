import React from 'react';
import '@testing-library/jest-dom';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import BoardListDialog from '../../../src/components/device-controls/board-list-dialog.jsx';

jest.mock('../../../src/containers/modal.jsx', () => {
    const MockModal = ({children, contentLabel}) => (
        <div aria-label={contentLabel}>
            {children}
        </div>
    );
    return MockModal;
});

const mockScanningStep = jest.fn(() => <div data-testid="scanning-step" />);

jest.mock('../../../src/components/connection-modal/scanning-step.jsx', () => props => mockScanningStep(props));

describe('BoardListDialog', () => {
    beforeEach(() => {
        mockScanningStep.mockClear();
    });

    const renderDialog = props => renderWithIntl(
        <BoardListDialog
            boards={[
                {
                    id: '/dev/ttyACM0',
                    name: 'Arduino Uno'
                }
            ]}
            deviceIconURL="arduino-uno.svg"
            scanning={false}
            onCloseDialog={jest.fn()}
            onConnectBoard={jest.fn()}
            onScan={jest.fn()}
            {...props}
        />
    );

    test('reuses scanning step with board-list layout options', () => {
        const onConnectBoard = jest.fn();
        const onScan = jest.fn();
        renderDialog({
            onConnectBoard,
            onScan
        });

        expect(mockScanningStep).toHaveBeenCalledWith(expect.objectContaining({
            connectionSmallIconURL: 'arduino-uno.svg',
            onConnecting: onConnectBoard,
            onRefresh: onScan,
            peripheralList: [
                {
                    name: 'Arduino Uno',
                    peripheralId: '/dev/ttyACM0',
                    rssi: 0
                }
            ],
            scanning: true,
            showSignalStrength: false,
            showStepDots: false
        }));
    });

    test('shows an empty finished scan as not scanning', () => {
        renderDialog({
            boards: [],
            scanning: false
        });

        expect(mockScanningStep).toHaveBeenCalledWith(expect.objectContaining({
            peripheralList: [],
            scanning: false
        }));
    });
});
