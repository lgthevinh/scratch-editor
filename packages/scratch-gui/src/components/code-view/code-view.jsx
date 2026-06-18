import React, {useMemo} from 'react';
import PropTypes from 'prop-types';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-arduino';
import 'prismjs/components/prism-javascript';
import styles from './code-view.css';

const CodeView = ({code, language}) => {
    const highlighted = useMemo(() => {
        const lang = language || 'javascript';
        const grammar = Prism.languages[lang];
        if (!grammar || !code) return code || '';
        return Prism.highlight(code, grammar, lang);
    }, [code, language]);

    const lineCount = useMemo(() => (code || '').split('\n').length, [code]);

    return (
        <div className={styles.codeView}>
            <div className={styles.header}>
                {'Generated Code'}
            </div>
            <div className={styles.content}>
                <div className={styles.gutter}>
                    {Array.from({length: lineCount}, (_, i) => (
                        <div key={i} className={styles.lineNumber}>{i + 1}</div>
                    ))}
                </div>
                <pre className={styles.pre}>
                    <code
                        className={`language-${language || 'javascript'}`}
                        // eslint-disable-next-line react/no-danger
                        dangerouslySetInnerHTML={{__html: highlighted}}
                    />
                </pre>
            </div>
        </div>
    );
};

CodeView.propTypes = {
    code: PropTypes.string,
    language: PropTypes.string
};

export default CodeView;
