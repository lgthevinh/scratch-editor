import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
import {fireEvent, render, screen} from '@testing-library/react';
import '@testing-library/jest-dom';
import VM from '@scratch/scratch-vm';

import BoardMenu from '../../../src/components/menu-bar/board-menu.jsx';

describe('BoardMenu', () => {
    const vm = new VM();
    const selectedDevice = vm.getDeviceList()[0];

    const renderBoardMenu = (selectedDeviceId = selectedDevice.deviceId) => {
        const store = configureStore()({
            scratchGui: {
                board: {selectedDeviceId},
                vm
            }
        });

        return {
            store,
            ...render(
                <Provider store={store}>
                    <IntlProvider locale="en">
                        <BoardMenu />
                    </IntlProvider>
                </Provider>
            )
        };
    };

    test('renders "Select board" when no device is selected', () => {
        renderBoardMenu(null);
        expect(screen.getByRole('button', {name: 'Select board'})).toBeInTheDocument();
    });

    test('renders with the selected device name', () => {
        renderBoardMenu(selectedDevice.deviceId);

        expect(screen.getByRole('button', {
            name: `Board: ${selectedDevice.name}`
        })).toBeInTheDocument();
    });

    test('clicking opens the board library', () => {
        const {store} = renderBoardMenu(selectedDevice.deviceId);

        fireEvent.click(screen.getByRole('button', {
            name: `Board: ${selectedDevice.name}`
        }));

        expect(store.getActions()).toEqual([{
            type: 'scratch-gui/modals/OPEN_MODAL',
            modal: 'boardLibrary'
        }]);
    });
});
