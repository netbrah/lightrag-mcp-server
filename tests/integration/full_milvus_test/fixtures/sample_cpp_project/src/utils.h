#ifndef UTILS_H
#define UTILS_H

#include <string>

/**
 * Utility functions for string manipulation.
 * This module provides common string operations including:
 * - Reversing strings
 * - Case conversion (upper/lower)
 * - Palindrome checking
 */

/**
 * Reverses a string.
 * @param str The input string
 * @return The reversed string
 */
std::string reverseString(const std::string& str);

/**
 * Converts a string to uppercase.
 * @param str The input string
 * @return The uppercase string
 */
std::string toUpperCase(const std::string& str);

/**
 * Converts a string to lowercase.
 * @param str The input string
 * @return The lowercase string
 */
std::string toLowerCase(const std::string& str);

/**
 * Checks if a string is a palindrome.
 * @param str The input string
 * @return true if palindrome, false otherwise
 */
bool isPalindrome(const std::string& str);

#endif // UTILS_H
