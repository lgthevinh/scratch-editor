import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import VM from '@scratch/scratch-vm';

import BoardLibrary from '../../../src/containers/board-library.jsx';

jest.mock('../../../src/components/library/library.jsx', () => {
    const MockLibraryComponent = ({data, fixedItemSize, renderItem}) => (
        <div data-fixed-item-size={fixedItemSize ? 'true' : 'false'}>
            {data.map(item => renderItem(item, item.deviceId || 'noBoard', jest.fn()))}
        </div>
    );
    return MockLibraryComponent;
});

describe('BoardLibrary', () => {
    const vm = Object.create(VM.prototype);
    vm.getDeviceList = jest.fn(() => [
        {
            deviceId: 'arduinoUno',
            name: 'Arduino Uno',
            description: 'The classic board for getting started.'
        },
        {
            deviceId: 'arduinoNano',
            name: 'Arduino Nano',
            description: 'A compact board for small projects.'
        },
        {
            deviceId: 'esp32',
            name: 'ESP32 Dev Module',
            description: 'A Wi-Fi and Bluetooth capable board.'
        }
    ]);

    const renderBoardLibrary = (visible = true) => {
        const store = configureStore()({
            scratchGui: {
                modals: {
                    boardLibrary: visible
                },
                vm
            }
        });

        return render(
            <Provider store={store}>
                <IntlProvider locale="en">
                    <BoardLibrary />
                </IntlProvider>
            </Provider>
        );
    };

    test('renders board names when visible', () => {
        renderBoardLibrary();

        expect(screen.getByRole('button', {name: /Arduino Uno/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Arduino Nano/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /ESP32 Dev Module/i})).toBeInTheDocument();
    });

    test('configures the library for fixed-size items', () => {
        renderBoardLibrary();

        expect(screen.getByText('Arduino Uno').closest('[data-fixed-item-size]')).toHaveAttribute(
            'data-fixed-item-size',
            'true'
        );
    });

    test('renders nothing when not visible', () => {
        const {container} = renderBoardLibrary(false);

        expect(container).toBeEmptyDOMElement();
    });
});
