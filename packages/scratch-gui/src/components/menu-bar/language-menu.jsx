import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, {useCallback, useRef} from 'react';
import {useIntl, FormattedMessage, defineMessage} from 'react-intl';
import {connect} from 'react-redux';
import locales from 'scratch-l10n';

import check from './check.svg';
import {MenuItem, Submenu} from '../menu/menu.jsx';
import languageIcon from '../language-selector/language-icon.svg';
import {selectLocale} from '../../reducers/locales.js';
import useMenuNavigation from '../../hooks/use-menu-navigation.jsx';

import styles from './settings-menu.css';

import dropdownCaret from './dropdown-caret.svg';

const languageMenu = defineMessage({
    id: 'gui.aria.languageMenu',
    defaultMessage: 'Language menu',
    description: 'accessibility label for language menu'
});

const LanguageMenu = ({
    currentLocale,
    isRtl,
    onChangeLanguage,
    depth
}) => {
    const intl = useIntl();

    const selectedRef = useRef(null);

    const {
        isExpanded,
        handleKeyDown,
        handleKeyDownOpenMenu,
        handleOnOpen,
        menuRef
    } = useMenuNavigation({
        depth,
        defaultIndexOnOpen: (Object.keys(locales).indexOf(currentLocale))
    });

    const setRef = useCallback(component => {
        selectedRef.current = component;
    }, []);

    const handleMouseOver = useCallback(() => {
        // If we are using hover rather than clicks for submenus, scroll the selected option into view
        if (isExpanded() && selectedRef.current) {
            selectedRef.current.scrollIntoView({block: 'center'});
        }
    }, [isExpanded]);

    return (
        <MenuItem
            ref={menuRef}
            isDataMenuItemWrapper
            isExpanded={isExpanded()}
            ariaLabel={intl.formatMessage(languageMenu)}
            onKeyDown={handleKeyDown}
        >
            <button
                className={styles.option}
                onClick={handleOnOpen}
                onMouseOver={handleMouseOver}
                data-menu-item
            >
                <img
                    className={styles.icon}
                    src={languageIcon}
                />
                <span className={styles.submenuLabel}>
                    <FormattedMessage
                        defaultMessage="Language"
                        description="Language sub-menu"
                        id="gui.menuBar.language"
                    />
                </span>
                <img
                    className={styles.expandCaret}
                    src={dropdownCaret}
                />
            </button>
            <Submenu
                className={styles.languageSubmenu}
                place={isRtl ? 'left' : 'right'}
            >
                {
                    Object.keys(locales)
                        .map(locale => {
                            const isSelected = currentLocale === locale;

                            return (<MenuItem
                                key={locale}
                                className={styles.languageMenuItem}
                                // eslint-disable-next-line react/jsx-no-bind
                                onClick={() => onChangeLanguage(locale)}
                                isDataMenuItem
                                onParentKeyDown={handleKeyDownOpenMenu}
                                isSelected={isSelected}
                            >
                                <img
                                    className={classNames(styles.check, {
                                        [styles.selected]: isSelected
                                    })}
                                    src={check}
                                    {...(isSelected && {ref: setRef})}
                                />
                                {locales[locale].name}
                            </MenuItem>);
                        })
                }
            </Submenu>
        </MenuItem>
    );
};

LanguageMenu.propTypes = {
    currentLocale: PropTypes.string,
    isRtl: PropTypes.bool,
    onChangeLanguage: PropTypes.func,
    depth: PropTypes.number
};

const mapStateToProps = state => ({
    currentLocale: state.locales.locale,
    isRtl: state.locales.isRtl,
    messagesByLocale: state.locales.messagesByLocale
});

const mapDispatchToProps = dispatch => ({
    onChangeLanguage: locale => {
        dispatch(selectLocale(locale));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LanguageMenu);
