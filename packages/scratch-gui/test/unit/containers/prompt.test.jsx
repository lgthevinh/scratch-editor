import React from 'react';
import Prompt from '../../../src/containers/prompt.jsx';
import {screen, fireEvent} from '@testing-library/react';
import {renderWithIntl} from '../../helpers/intl-helpers.jsx';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

describe('Variable Prompt Container', () => {
    const store = configureStore()({
        locales: {
            isRtl: false,
            locale: 'en-US'
        }
    });

    let onCancel;
    let onOk;

    beforeEach(() => {
        onCancel = jest.fn();
        onOk = jest.fn();
    });

    const renderPrompt = showTypeOption => renderWithIntl(
        <Provider store={store}>
            <Prompt
                label="New variable name:"
                showTypeOption={showTypeOption}
                title="New Variable"
                onCancel={onCancel}
                onOk={onOk}
            />
        </Provider>
    );

    test('shows the value-type options and not the sprite scope or cloud controls', () => {
        renderPrompt(true);
        // getByRole throws if the element is missing, asserting the three options exist.
        expect(screen.getByRole('radio', {name: 'Number'})).not.toBeNull();
        expect(screen.getByRole('radio', {name: 'Decimal'})).not.toBeNull();
        expect(screen.getByRole('radio', {name: 'Text'})).not.toBeNull();
        expect(screen.queryByText('For all sprites')).toBeNull();
        expect(screen.queryByText(/Cloud variable/)).toBeNull();
    });

    test('passes the selected type to onOk as a global variable', () => {
        renderPrompt(true);
        fireEvent.click(screen.getByRole('radio', {name: 'Decimal'}));
        fireEvent.click(screen.getByRole('button', {name: 'OK'}));
        expect(onOk).toHaveBeenCalledWith('', {scope: 'global', dataType: 'float'});
    });

    test('defaults to the Number type when nothing is changed', () => {
        renderPrompt(true);
        fireEvent.click(screen.getByRole('button', {name: 'OK'}));
        expect(onOk).toHaveBeenCalledWith('', {scope: 'global', dataType: 'int'});
    });

    test('omits the type when the chooser is hidden (lists, renames)', () => {
        renderPrompt(false);
        expect(screen.queryByRole('radio', {name: 'Number'})).toBeNull();
        fireEvent.click(screen.getByRole('button', {name: 'OK'}));
        expect(onOk).toHaveBeenCalledWith('', {scope: 'global', dataType: ''});
    });
});
