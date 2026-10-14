/**
 * Strip SQL comments from a SQL string
 * Handles:
 * - Single-line comments: -- comment (until end of line)
 * - Hash comments: # comment (until end of line, MySQL specific)
 * - Multi-line comments: /* comment *\/
 * 
 * Preserves strings literals to avoid stripping comments inside strings
 */

/**
 * Strip all types of SQL comments from a SQL string
 * @param sql - The SQL string to process
 * @returns SQL string with comments removed
 */
export function stripSQLComments(sql: string): string {
    let result = '';
    let i = 0;
    const len = sql.length;

    while (i < len) {
        // Check for string literals (single quotes)
        if (sql[i] === "'") {
            result += sql[i];
            i++;
            // Find end of string (handle escaped quotes '')
            while (i < len) {
                if (sql[i] === "'") {
                    result += sql[i];
                    i++;
                    // Check for escaped quote ''
                    if (i < len && sql[i] === "'") {
                        result += sql[i];
                        i++;
                        continue;
                    }
                    break; // End of string
                }
                result += sql[i];
                i++;
            }
            continue;
        }

        // Check for string literals (double quotes) - for identifiers or strings
        if (sql[i] === '"') {
            result += sql[i];
            i++;
            while (i < len) {
                if (sql[i] === '"') {
                    result += sql[i];
                    i++;
                    // Check for escaped quote ""
                    if (i < len && sql[i] === '"') {
                        result += sql[i];
                        i++;
                        continue;
                    }
                    break;
                }
                result += sql[i];
                i++;
            }
            continue;
        }

        // Check for single-line comment -- (SQL standard)
        if (sql[i] === '-' && i + 1 < len && sql[i + 1] === '-') {
            // Skip until end of line
            while (i < len && sql[i] !== '\n') {
                i++;
            }
            // Keep the newline for line number preservation
            if (i < len && sql[i] === '\n') {
                result += '\n';
                i++;
            }
            continue;
        }

        // Check for hash comment # (MySQL)
        if (sql[i] === '#') {
            // Skip until end of line
            while (i < len && sql[i] !== '\n') {
                i++;
            }
            // Keep the newline
            if (i < len && sql[i] === '\n') {
                result += '\n';
                i++;
            }
            continue;
        }

        // Check for multi-line comment /* */
        if (sql[i] === '/' && i + 1 < len && sql[i + 1] === '*') {
            i += 2; // Skip /*
            // Find closing */
            while (i < len) {
                if (sql[i] === '*' && i + 1 < len && sql[i + 1] === '/') {
                    i += 2; // Skip */
                    break;
                }
                // Preserve newlines for line number preservation
                if (sql[i] === '\n') {
                    result += '\n';
                }
                i++;
            }
            continue;
        }

        // Regular character
        result += sql[i];
        i++;
    }

    return result;
}

/**
 * Preprocess SQL by stripping comments and trimming
 * @param sql - The SQL string to preprocess
 * @returns Preprocessed SQL string
 */
export function preprocessSQL(sql: string): string {
    return stripSQLComments(sql).trim();
}
