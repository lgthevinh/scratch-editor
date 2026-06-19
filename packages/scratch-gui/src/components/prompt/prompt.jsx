import {defineMessages, FormattedMessage} from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';

import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';

import styles from './prompt.css';


const messages = defineMessages({
    variableTypeLabel: {
        defaultMessage: 'Variable type:',
        description: 'Label for the control that selects the value type of a new variable',
        id: 'gui.gui.variableTypeLabel'
    },
    typeNumberMessage: {
        defaultMessage: 'Number',
        description: 'Option for creating a whole-number (integer) variable',
        id: 'gui.gui.variableTypeNumber'
    },
    typeDecimalMessage: {
        defaultMessage: 'Decimal',
        description: 'Option for creating a decimal (floating-point) variable',
        id: 'gui.gui.variableTypeDecimal'
    },
    typeTextMessage: {
        defaultMessage: 'Text',
        description: 'Option for creating a text (string) variable',
        id: 'gui.gui.variableTypeText'
    }
});

const TYPE_OPTIONS = [
    {value: 'int', message: messages.typeNumberMessage},
    {value: 'float', message: messages.typeDecimalMessage},
    {value: 'string', message: messages.typeTextMessage}
];

const PromptComponent = props => (
    <Modal
        className={styles.modalContent}
        contentLabel={props.title}
        onRequestClose={props.onCancel}
    >
        <Box className={styles.body}>
            <Box className={styles.label}>
                {props.label}
            </Box>
            <Box>
                <input
                    autoFocus
                    className={styles.variableNameTextInput}
                    defaultValue={props.defaultValue}
                    name={props.label}
                    onChange={props.onChange}
                    onFocus={props.onFocus}
                    onKeyPress={props.onKeyPress}
                />
            </Box>
            {props.showTypeOption ?
                <Box className={styles.optionsRow}>
                    <div className={styles.label}>
                        <FormattedMessage
                            {...messages.variableTypeLabel}
                        />
                    </div>
                    {TYPE_OPTIONS.map(option => (
                        <label key={option.value}>
                            <input
                                checked={props.selectedType === option.value}
                                name="variableTypeOption"
                                type="radio"
                                value={option.value}
                                onChange={props.onTypeOptionSelection}
                            />
                            <FormattedMessage
                                {...option.message}
                            />
                        </label>
                    ))}
                </Box> : null}

            <Box className={styles.buttonRow}>
                <button
                    className={styles.cancelButton}
                    onClick={props.onCancel}
                >
                    <FormattedMessage
                        defaultMessage="Cancel"
                        description="Button in prompt for cancelling the dialog"
                        id="gui.prompt.cancel"
                    />
                </button>
                <button
                    className={styles.okButton}
                    onClick={props.onOk}
                >
                    <FormattedMessage
                        defaultMessage="OK"
                        description="Button in prompt for confirming the dialog"
                        id="gui.prompt.ok"
                    />
                </button>
            </Box>
        </Box>
    </Modal>
);

PromptComponent.propTypes = {
    defaultValue: PropTypes.string,
    label: PropTypes.string.isRequired,
    onCancel: PropTypes.func.isRequired,
    onChange: PropTypes.func.isRequired,
    onFocus: PropTypes.func.isRequired,
    onKeyPress: PropTypes.func.isRequired,
    onOk: PropTypes.func.isRequired,
    onTypeOptionSelection: PropTypes.func.isRequired,
    selectedType: PropTypes.string.isRequired,
    showTypeOption: PropTypes.bool.isRequired,
    title: PropTypes.string.isRequired
};

export default PromptComponent;
