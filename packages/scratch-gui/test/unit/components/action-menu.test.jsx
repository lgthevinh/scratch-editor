import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import ActionMenu from '../../../src/components/action-menu/action-menu.jsx';
import {KEY} from '../../../src/lib/navigation-keys';
import React, {act} from 'react';

// Mock the CSS module so class names exist
jest.mock('../../../src/components/action-menu/action-menu.css', () => ({
    expanded: 'expanded'
}));

describe('ActionMenu keyboard navigation', () => {
    const mockOnClick = jest.fn();
    const mockMoreButtonClick = jest.fn();

    const defaultProps = {
        title: 'Main Button',
        img: 'main-icon.svg',
        onClick: mockOnClick,
        moreButtons: [
            {title: 'Button 1', img: 'icon1.svg', onClick: mockMoreButtonClick},
            {title: 'Button 2', img: 'icon2.svg', onClick: mockMoreButtonClick},
            {title: 'Button 3', img: 'icon3.svg', onClick: mockMoreButtonClick}
        ]
    };

    beforeEach(() => {
        mockOnClick.mockClear();
        mockMoreButtonClick.mockClear();
    });

    test('focus + arrow_down opens menu and arrow_up cycles to last', () => {
        render(<ActionMenu {...defaultProps} />);
        const mainButton = screen.getByRole('button', {name: 'Main Button'});

        act(() => {
            mainButton.focus();
            fireEvent.keyDown(mainButton, {key: KEY.ARROW_DOWN});
        });

        const firstItem = screen.getByRole('button', {name: 'Button 1'});
        expect(document.activeElement).toBe(firstItem);

        act(() => {
            fireEvent.keyDown(firstItem, {key: KEY.ARROW_UP});
        });

        const lastItem = screen.getByRole('button', {name: 'Button 3'});
        expect(document.activeElement).toBe(lastItem);

        const menuContainer = mainButton.parentElement;
        expect(menuContainer).toHaveClass('expanded');
    });

    test('escape closes menu and returns focus to main button', () => {
        render(<ActionMenu {...defaultProps} />);
        const mainButton = screen.getByRole('button', {name: 'Main Button'});

        act(() => {
            mainButton.focus();
            fireEvent.keyDown(mainButton, {key: KEY.ARROW_DOWN});
        });

        const firstItem = screen.getByRole('button', {name: 'Button 1'});
        expect(document.activeElement).toBe(firstItem);

        act(() => {
            fireEvent.keyDown(firstItem, {key: KEY.ESCAPE});
        });

        expect(document.activeElement).toBe(mainButton);
        
        const menuContainer = mainButton.parentElement;
        expect(menuContainer).not.toHaveClass('expanded');
    });

    test('tab closes menu and focuses next element', async () => {
        render(
            <>
                <ActionMenu {...defaultProps} />
                <button>After Menu</button>
            </>
        );
        const mainButton = screen.getByRole('button', {name: 'Main Button'});
        const afterButton = screen.getByRole('button', {name: 'After Menu'});
        const user = userEvent.setup();

        act(() => {
            mainButton.focus();
            fireEvent.keyDown(mainButton, {key: KEY.ARROW_DOWN});
        });

        const firstItem = screen.getByRole('button', {name: 'Button 1'});
        expect(document.activeElement).toBe(firstItem);

        act(() => {
            user.tab();
        });

        await waitFor(() => {
            expect(document.activeElement).toBe(afterButton);
            expect(mainButton.parentElement).not.toHaveClass('expanded');
        });
    });

    test('shift + tab closes menu and focuses previous element', async () => {
        render(
            <>
                <button>Before Menu</button>
                <ActionMenu {...defaultProps} />
                <button>After Menu</button>
            </>
        );

        const mainButton = screen.getByRole('button', {name: 'Main Button'});
        const beforeButton = screen.getByRole('button', {name: 'Before Menu'});
        const user = userEvent.setup();

        act(() => {
            mainButton.focus();
        });

        const menuContainer = mainButton.parentElement;
        expect(menuContainer).toHaveClass('expanded');
        act(() => {
            user.tab({shift: true});
        });

        await waitFor(() => {
            expect(document.activeElement).toBe(beforeButton);
            expect(mainButton.parentElement).not.toHaveClass('expanded');
        });
    });
});
