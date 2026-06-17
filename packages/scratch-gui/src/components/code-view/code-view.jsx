import React from 'react';
import PropTypes from 'prop-types';
import styles from './code-view.css';

const CodeView = ({code}) => (
    <div className={styles.codeView}>
        <div className={styles.header}>
            Generated Code
        </div>
        <pre className={styles.content}>
            <code>{code || ''}</code>
        </pre>
    </div>
);

CodeView.propTypes = {
    code: PropTypes.string
};

export default CodeView;
