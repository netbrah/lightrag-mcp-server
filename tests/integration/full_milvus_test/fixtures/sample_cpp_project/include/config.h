#ifndef CONFIG_H
#define CONFIG_H

/**
 * Configuration constants for the StringProcessor application.
 * These values define application metadata and limits.
 */

// Application metadata
#define APP_NAME "StringProcessor"
#define APP_VERSION "1.0.0"
#define APP_AUTHOR "LightRAG Integration Test"

// Processing limits
#define MAX_STRING_LENGTH 1024
#define MIN_STRING_LENGTH 1

// Feature flags
#define ENABLE_PALINDROME_CHECK 1
#define ENABLE_CASE_CONVERSION 1

#endif // CONFIG_H
